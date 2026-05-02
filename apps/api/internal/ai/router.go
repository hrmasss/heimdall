package ai

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
)

type routedCredential struct {
	provider        string
	model           string
	baseURL         string
	apiKey          string
	workspaceRecord *database.WorkspaceAICredential
	platformRecord  *database.PlatformAICredential
	source          string
}

type poolCandidate struct {
	id            string
	position      int
	status        string
	healthStatus  string
	cooldownUntil *time.Time
	requestCount  int
}

type routeResult struct {
	text       string
	usage      aiUsage
	credential *database.WorkspaceAICredential
	provider   string
	model      string
	lastErr    error
}

func (s *Service) routedGenerateJSON(ctx context.Context, workspaceID uuid.UUID, provider, model, mode, systemPrompt, userPrompt string, image *providerImage, workspaceFallbackEnabled bool) routeResult {
	if mode == modeBYOK {
		return s.runCredentialRoute(ctx, s.workspaceCredentialRoute(ctx, workspaceID, provider, model, workspaceFallbackEnabled), systemPrompt, userPrompt, image)
	}

	routes := []struct {
		provider string
		model    string
	}{
		{provider: provider, model: model},
	}
	for _, fallback := range s.enabledPlatformFallbackRoutes(ctx) {
		fallbackProvider := strings.TrimSpace(fallback.Provider)
		if fallbackProvider == "" || fallbackProvider == provider {
			continue
		}
		routes = append(routes, struct {
			provider string
			model    string
		}{provider: fallbackProvider, model: defaultString(fallback.Model, s.platformDefaultModel(ctx, fallbackProvider))})
	}

	var last routeResult
	for _, route := range routes {
		credentials := s.platformCredentialRoute(ctx, route.provider, defaultString(route.model, s.platformDefaultModel(ctx, route.provider)))
		result := s.runCredentialRoute(ctx, credentials, systemPrompt, userPrompt, image)
		if result.lastErr == nil {
			return result
		}
		last = result
		if !isRetryableRouteError(result.lastErr) && !isCredentialUnavailable(result.lastErr) {
			break
		}
	}
	return last
}

func (s *Service) runCredentialRoute(ctx context.Context, credentials []routedCredential, systemPrompt, userPrompt string, image *providerImage) routeResult {
	var last routeResult
	if len(credentials) == 0 {
		last.lastErr = fmt.Errorf("%w: ai credential pool exhausted or unavailable", iam.ErrValidation)
		return last
	}
	for _, credential := range credentials {
		text, usage, err := s.generateJSONWithBaseURL(ctx, credential.provider, credential.model, credential.apiKey, credential.baseURL, systemPrompt, userPrompt, image)
		last = routeResult{
			text:       text,
			usage:      usage,
			credential: credential.workspaceRecord,
			provider:   credential.provider,
			model:      credential.model,
			lastErr:    err,
		}
		if err == nil {
			s.markPlatformCredentialSuccess(ctx, credential.platformRecord)
			return last
		}
		s.markPlatformCredentialFailure(ctx, credential.platformRecord, err)
		if !isRetryableRouteError(err) {
			return last
		}
	}
	return last
}

func (s *Service) workspaceCredentialRoute(ctx context.Context, workspaceID uuid.UUID, provider, model string, fallbackEnabled bool) []routedCredential {
	credentials, err := s.resolveCredentialChain(ctx, workspaceID, provider, modeBYOK, fallbackEnabled)
	if err != nil {
		return []routedCredential{}
	}
	result := make([]routedCredential, 0, len(credentials))
	for _, credential := range credentials {
		result = append(result, routedCredential{
			provider:        provider,
			model:           model,
			baseURL:         s.providerBaseURL(provider),
			apiKey:          credential.apiKey,
			workspaceRecord: credential.record,
			source:          "workspace",
		})
	}
	return result
}

func (s *Service) platformCredentialRoute(ctx context.Context, provider, model string) []routedCredential {
	setting := s.platformProviderSetting(ctx, provider)
	baseURL := defaultString(setting.BaseURL, s.providerBaseURL(provider))
	model = defaultString(model, defaultString(setting.DefaultModel, s.defaultModel(provider)))
	records := s.orderedPlatformCredentials(ctx, provider, setting)
	result := make([]routedCredential, 0, len(records))
	for _, record := range records {
		apiKey, err := s.secretBox.Decrypt(record.APIKeyCiphertext)
		if err != nil || strings.TrimSpace(apiKey) == "" {
			continue
		}
		recordCopy := record
		result = append(result, routedCredential{
			provider:       provider,
			model:          model,
			baseURL:        baseURL,
			apiKey:         apiKey,
			platformRecord: &recordCopy,
			source:         "platform",
		})
	}
	if len(result) > 0 {
		return result
	}
	if s.platformCredentialExists(ctx, provider) {
		return result
	}
	for index, apiKey := range s.nativeAPIKeys(provider) {
		result = append(result, routedCredential{
			provider: provider,
			model:    model,
			baseURL:  baseURL,
			apiKey:   apiKey,
			source:   fmt.Sprintf("env:%d", index),
		})
	}
	return result
}

func (s *Service) platformCredentialExists(ctx context.Context, provider string) bool {
	if s.db == nil {
		return false
	}
	count, err := s.db.NewSelect().
		Model((*database.PlatformAICredential)(nil)).
		Where("provider = ?", provider).
		Where("status = ?", credentialStatusActive).
		Count(ctx)
	return err == nil && count > 0
}

func (s *Service) orderedPlatformCredentials(ctx context.Context, provider string, setting database.PlatformAIProviderSetting) []database.PlatformAICredential {
	if s.db == nil {
		return []database.PlatformAICredential{}
	}
	var records []database.PlatformAICredential
	if err := s.db.NewSelect().
		Model(&records).
		Where("provider = ?", provider).
		Where("status = ?", credentialStatusActive).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return []database.PlatformAICredential{}
	}
	candidates := make([]poolCandidate, 0, len(records))
	byID := map[string]database.PlatformAICredential{}
	for _, record := range records {
		candidate := poolCandidate{
			id:            record.ID.String(),
			position:      record.Position,
			status:        record.Status,
			healthStatus:  record.HealthStatus,
			cooldownUntil: record.CooldownUntil,
			requestCount:  record.RequestCount,
		}
		candidates = append(candidates, candidate)
		byID[candidate.id] = record
	}
	ordered, nextCursor := orderPoolCandidates(candidates, normalizeStrategy(setting.Strategy), setting.RoundRobinCursor, time.Now().UTC())
	if normalizeStrategy(setting.Strategy) == strategyRoundRobin && nextCursor != setting.RoundRobinCursor {
		_, _ = s.db.NewUpdate().
			Model((*database.PlatformAIProviderSetting)(nil)).
			Set("round_robin_cursor = ?", nextCursor).
			Set("updated_at = ?", time.Now().UTC()).
			Where("provider = ?", provider).
			Exec(ctx)
	}
	result := make([]database.PlatformAICredential, 0, len(ordered))
	for _, candidate := range ordered {
		if record, ok := byID[candidate.id]; ok {
			result = append(result, record)
		}
	}
	return result
}

func orderPoolCandidates(candidates []poolCandidate, strategy string, cursor int, now time.Time) ([]poolCandidate, int) {
	healthy := make([]poolCandidate, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.status != credentialStatusActive {
			continue
		}
		if candidate.cooldownUntil != nil && candidate.cooldownUntil.After(now) {
			continue
		}
		if candidate.healthStatus == healthStatusAuthFailed {
			continue
		}
		healthy = append(healthy, candidate)
	}
	slices.SortStableFunc(healthy, func(left, right poolCandidate) int {
		return left.position - right.position
	})
	if len(healthy) == 0 {
		return []poolCandidate{}, cursor
	}
	if strategy != strategyRoundRobin {
		return healthy, cursor
	}
	start := cursor % len(healthy)
	if start < 0 {
		start = 0
	}
	ordered := append([]poolCandidate{}, healthy[start:]...)
	ordered = append(ordered, healthy[:start]...)
	return ordered, (start + 1) % len(healthy)
}

func (s *Service) markPlatformCredentialSuccess(ctx context.Context, credential *database.PlatformAICredential) {
	if credential == nil || s.db == nil {
		return
	}
	now := time.Now().UTC()
	_, _ = s.db.NewUpdate().
		Model((*database.PlatformAICredential)(nil)).
		Set("health_status = ?", healthStatusHealthy).
		Set("cooldown_until = NULL").
		Set("last_error = NULL").
		Set("request_count = request_count + 1").
		Set("last_used_at = ?", now).
		Set("updated_at = ?", now).
		Where("id = ?", credential.ID).
		Exec(ctx)
}

func (s *Service) markPlatformCredentialFailure(ctx context.Context, credential *database.PlatformAICredential, err error) {
	if credential == nil || s.db == nil || err == nil {
		return
	}
	now := time.Now().UTC()
	cooldown := cooldownDurationForError(err)
	health := healthStatusCooling
	if isAuthFailure(err) {
		health = healthStatusAuthFailed
	}
	cooldownUntil := now.Add(cooldown)
	message := strings.TrimSpace(err.Error())
	if len(message) > 600 {
		message = message[:600]
	}
	_, _ = s.db.NewUpdate().
		Model((*database.PlatformAICredential)(nil)).
		Set("health_status = ?", health).
		Set("cooldown_until = ?", cooldownUntil).
		Set("last_error = ?", message).
		Set("updated_at = ?", now).
		Where("id = ?", credential.ID).
		Exec(ctx)
}

func cooldownDurationForError(err error) time.Duration {
	var providerErr *providerError
	if errors.As(err, &providerErr) {
		message := strings.ToLower(providerErr.Message)
		switch {
		case providerErr.StatusCode == 429:
			return time.Hour
		case providerErr.StatusCode == 402 || strings.Contains(message, "quota") || strings.Contains(message, "billing") || strings.Contains(message, "credit"):
			return 24 * time.Hour
		case providerErr.StatusCode == 401 || providerErr.StatusCode == 403 || strings.Contains(message, "api_key_invalid") || strings.Contains(message, "api key not valid"):
			return 24 * time.Hour
		case providerErr.StatusCode >= 500:
			return 5 * time.Minute
		}
	}
	return 5 * time.Minute
}

func isRetryableRouteError(err error) bool {
	if err == nil {
		return false
	}
	var providerErr *providerError
	if errors.As(err, &providerErr) {
		return providerErr.Retryable
	}
	var netErr net.Error
	return errors.As(err, &netErr)
}

func isCredentialUnavailable(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "no ai credentials available") || strings.Contains(lower, "pool exhausted")
}

func isAuthFailure(err error) bool {
	var providerErr *providerError
	if !errors.As(err, &providerErr) {
		return false
	}
	message := strings.ToLower(providerErr.Message)
	return providerErr.StatusCode == 401 || providerErr.StatusCode == 403 || strings.Contains(message, "api_key_invalid") || strings.Contains(message, "api key not valid")
}

func normalizeStrategy(value string) string {
	switch strings.TrimSpace(value) {
	case strategyRoundRobin:
		return strategyRoundRobin
	default:
		return strategyFirstHealthy
	}
}

func (s *Service) platformProviderSetting(ctx context.Context, provider string) database.PlatformAIProviderSetting {
	setting := database.PlatformAIProviderSetting{
		Provider:       provider,
		DefaultModel:   s.defaultModel(provider),
		ApprovedModels: marshalMustJSON(s.approvedModels(provider)),
		BaseURL:        s.providerBaseURL(provider),
		Strategy:       strategyFirstHealthy,
	}
	if s.db == nil {
		return setting
	}
	_ = s.db.NewSelect().Model(&setting).Where("provider = ?", provider).Limit(1).Scan(ctx)
	setting.Provider = provider
	setting.Strategy = normalizeStrategy(setting.Strategy)
	if strings.TrimSpace(setting.DefaultModel) == "" {
		setting.DefaultModel = s.defaultModel(provider)
	}
	if len(parseStringSlice(setting.ApprovedModels)) == 0 {
		setting.ApprovedModels = marshalMustJSON(s.approvedModels(provider))
	}
	if strings.TrimSpace(setting.BaseURL) == "" {
		setting.BaseURL = s.providerBaseURL(provider)
	}
	return setting
}

func (s *Service) platformDefaultModel(ctx context.Context, provider string) string {
	return defaultString(s.platformProviderSetting(ctx, provider).DefaultModel, s.defaultModel(provider))
}

func (s *Service) hasNativeAccess(ctx context.Context, provider string) bool {
	if len(s.nativeAPIKeys(provider)) > 0 {
		return true
	}
	if s.db == nil {
		return false
	}
	count, err := s.db.NewSelect().
		Model((*database.PlatformAICredential)(nil)).
		Where("provider = ?", provider).
		Where("status = ?", credentialStatusActive).
		Count(ctx)
	return err == nil && count > 0
}

func (s *Service) defaultMode(ctx context.Context) string {
	if defaultMode(s.cfg) == modeNative {
		return modeNative
	}
	for _, provider := range allProviders() {
		if s.hasNativeAccess(ctx, provider) {
			return modeNative
		}
	}
	return modeBYOK
}

func (s *Service) enabledPlatformFallbackRoutes(ctx context.Context) []database.PlatformAIFallbackRoute {
	if s.db == nil {
		return []database.PlatformAIFallbackRoute{}
	}
	var records []database.PlatformAIFallbackRoute
	if err := s.db.NewSelect().
		Model(&records).
		Where("enabled = ?", true).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return []database.PlatformAIFallbackRoute{}
	}
	return records
}

func (s *Service) validateProvider(provider string) error {
	if slices.Contains(allProviders(), strings.TrimSpace(provider)) {
		return nil
	}
	return fmt.Errorf("%w: unsupported provider", iam.ErrValidation)
}
