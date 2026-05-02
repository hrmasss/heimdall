package ai

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
)

func (s *Service) GetPlatformCatalog(ctx context.Context, principal *iam.Principal) (*PlatformAICatalog, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.view"); err != nil {
		return nil, err
	}
	settings, err := s.GetPlatformSettings(ctx, principal)
	if err != nil {
		return nil, err
	}
	return &PlatformAICatalog{Providers: settings.Providers}, nil
}

func (s *Service) GetPlatformSettings(ctx context.Context, principal *iam.Principal) (*PlatformAISettings, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.view"); err != nil {
		return nil, err
	}
	providers := make([]PlatformAIProvider, 0, len(allProviders()))
	for _, provider := range allProviders() {
		setting := s.platformProviderSetting(ctx, provider)
		credentialCount, healthyCount := s.platformCredentialCounts(ctx, provider)
		providers = append(providers, PlatformAIProvider{
			Provider:        provider,
			Label:           s.providerLabel(provider),
			BaseURL:         defaultString(setting.BaseURL, s.providerBaseURL(provider)),
			DefaultModel:    defaultString(setting.DefaultModel, s.defaultModel(provider)),
			ApprovedModels:  parseStringSlice(setting.ApprovedModels),
			CredentialCount: credentialCount,
			HealthyCount:    healthyCount,
			Strategy:        normalizeStrategy(setting.Strategy),
		})
	}
	credentials, err := s.listPlatformCredentials(ctx)
	if err != nil {
		return nil, err
	}
	fallbackRoutes, err := s.listPlatformFallbackRoutes(ctx)
	if err != nil {
		return nil, err
	}
	return &PlatformAISettings{
		Providers:      providers,
		Credentials:    mapPlatformCredentials(credentials),
		FallbackRoutes: mapPlatformFallbackRoutes(fallbackRoutes),
	}, nil
}

func (s *Service) UpdatePlatformRouting(ctx context.Context, principal *iam.Principal, input UpdatePlatformAIRoutingInput) (*PlatformAISettings, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.manage"); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	for _, item := range input.Providers {
		provider := strings.TrimSpace(item.Provider)
		if err := s.validateProvider(provider); err != nil {
			return nil, err
		}
		approvedModels := uniqueNonEmpty(item.ApprovedModels)
		if len(approvedModels) == 0 {
			approvedModels = s.approvedModels(provider)
		}
		defaultModel := defaultString(item.DefaultModel, s.defaultModel(provider))
		if defaultModel != "" && !slices.Contains(approvedModels, defaultModel) {
			approvedModels = append([]string{defaultModel}, approvedModels...)
		}
		record := &database.PlatformAIProviderSetting{
			Provider:       provider,
			DefaultModel:   defaultModel,
			ApprovedModels: marshalMustJSON(approvedModels),
			BaseURL:        defaultString(item.BaseURL, s.providerBaseURL(provider)),
			Strategy:       normalizeStrategy(item.Strategy),
			UpdatedAt:      now,
		}
		exists := false
		if s.db != nil {
			var existing database.PlatformAIProviderSetting
			err := s.db.NewSelect().Model(&existing).Where("provider = ?", provider).Limit(1).Scan(ctx)
			exists = err == nil
		}
		if exists {
			_, err := s.db.NewUpdate().
				Model(record).
				Column("default_model", "approved_models", "base_url", "strategy", "updated_at").
				Where("provider = ?", provider).
				Exec(ctx)
			if err != nil {
				return nil, err
			}
		} else if s.db != nil {
			record.CreatedAt = now
			if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
				return nil, err
			}
		}
	}
	if input.FallbackRoutes != nil && s.db != nil {
		nextRoutes := make([]*database.PlatformAIFallbackRoute, 0, len(input.FallbackRoutes))
		for index, item := range input.FallbackRoutes {
			provider := strings.TrimSpace(item.Provider)
			if err := s.validateProvider(provider); err != nil {
				return nil, err
			}
			position := item.Position
			if position == 0 {
				position = index
			}
			id, err := parseOptionalUUID(item.ID)
			if err != nil {
				return nil, err
			}
			nextRoutes = append(nextRoutes, &database.PlatformAIFallbackRoute{
				ID:        id,
				Provider:  provider,
				Model:     defaultString(item.Model, s.platformDefaultModel(ctx, provider)),
				Position:  position,
				Enabled:   item.Enabled,
				CreatedAt: now,
				UpdatedAt: now,
			})
		}
		if _, err := s.db.NewDelete().Model((*database.PlatformAIFallbackRoute)(nil)).Where("1 = 1").Exec(ctx); err != nil {
			return nil, err
		}
		for _, record := range nextRoutes {
			if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
				return nil, err
			}
		}
	}
	return s.GetPlatformSettings(ctx, principal)
}

func (s *Service) CreatePlatformCredential(ctx context.Context, principal *iam.Principal, input CreatePlatformAICredentialInput) (*PlatformAICredentialRecord, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.manage"); err != nil {
		return nil, err
	}
	provider := strings.TrimSpace(input.Provider)
	if err := s.validateProvider(provider); err != nil {
		return nil, err
	}
	apiKey := strings.TrimSpace(input.APIKey)
	if apiKey == "" {
		return nil, fmt.Errorf("%w: api key is required", iam.ErrValidation)
	}
	ciphertext, err := s.secretBox.Encrypt(apiKey)
	if err != nil {
		return nil, err
	}
	allowedModels := input.AllowedModels
	if len(allowedModels) == 0 {
		allowedModels = s.approvedModelsFor(ctx, provider)
	}
	now := time.Now().UTC()
	record := &database.PlatformAICredential{
		ID:               uuid.New(),
		Provider:         provider,
		Label:            defaultString(input.Label, s.providerLabel(provider)),
		Position:         input.Position,
		Status:           defaultString(input.Status, credentialStatusActive),
		APIKeyCiphertext: ciphertext,
		APIKeyHint:       secretHint(apiKey),
		AllowedModels:    marshalMustJSON(uniqueNonEmpty(allowedModels)),
		HealthStatus:     healthStatusHealthy,
		Metadata:         marshalMustJSON(map[string]any{}),
		CreatedByUserID:  &principal.UserID,
		UpdatedByUserID:  &principal.UserID,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if s.db != nil {
		if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
			return nil, err
		}
	}
	mapped := mapPlatformCredential(*record)
	return &mapped, nil
}

func (s *Service) UpdatePlatformCredential(ctx context.Context, principal *iam.Principal, credentialID uuid.UUID, input UpdatePlatformAICredentialInput) (*PlatformAICredentialRecord, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.manage"); err != nil {
		return nil, err
	}
	record := new(database.PlatformAICredential)
	if err := s.db.NewSelect().Model(record).Where("id = ?", credentialID).Limit(1).Scan(ctx); err != nil {
		return nil, err
	}
	record.Label = strings.TrimSpace(input.Label)
	record.Position = input.Position
	record.Status = defaultString(input.Status, credentialStatusActive)
	if input.AllowedModels != nil {
		record.AllowedModels = marshalMustJSON(uniqueNonEmpty(input.AllowedModels))
	}
	if apiKey := strings.TrimSpace(input.APIKey); apiKey != "" {
		ciphertext, err := s.secretBox.Encrypt(apiKey)
		if err != nil {
			return nil, err
		}
		record.APIKeyCiphertext = ciphertext
		record.APIKeyHint = secretHint(apiKey)
		record.HealthStatus = healthStatusHealthy
		record.CooldownUntil = nil
		record.LastError = nil
	}
	record.UpdatedByUserID = &principal.UserID
	record.UpdatedAt = time.Now().UTC()
	if _, err := s.db.NewUpdate().
		Model(record).
		Column("label", "position", "status", "api_key_ciphertext", "api_key_hint", "allowed_models", "health_status", "cooldown_until", "last_error", "updated_by_user_id", "updated_at").
		Where("id = ?", credentialID).
		Exec(ctx); err != nil {
		return nil, err
	}
	mapped := mapPlatformCredential(*record)
	return &mapped, nil
}

func (s *Service) DeletePlatformCredential(ctx context.Context, principal *iam.Principal, credentialID uuid.UUID) error {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.manage"); err != nil {
		return err
	}
	_, err := s.db.NewDelete().Model((*database.PlatformAICredential)(nil)).Where("id = ?", credentialID).Exec(ctx)
	return err
}

func (s *Service) TestPlatformCredential(ctx context.Context, principal *iam.Principal, credentialID uuid.UUID) (*PlatformAICredentialRecord, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.settings.manage"); err != nil {
		return nil, err
	}
	record := new(database.PlatformAICredential)
	if err := s.db.NewSelect().Model(record).Where("id = ?", credentialID).Limit(1).Scan(ctx); err != nil {
		return nil, err
	}
	apiKey, err := s.secretBox.Decrypt(record.APIKeyCiphertext)
	if err != nil {
		return nil, err
	}
	setting := s.platformProviderSetting(ctx, record.Provider)
	model := defaultString(firstString(parseStringSlice(record.AllowedModels)), defaultString(setting.DefaultModel, s.defaultModel(record.Provider)))
	_, _, err = s.generateJSONWithBaseURL(ctx, record.Provider, model, apiKey, defaultString(setting.BaseURL, s.providerBaseURL(record.Provider)), "Return a JSON object with key ok set to true.", "Health check.", nil)
	if err != nil {
		s.markPlatformCredentialFailure(ctx, record, err)
		return nil, err
	}
	s.markPlatformCredentialSuccess(ctx, record)
	refreshed := new(database.PlatformAICredential)
	if err := s.db.NewSelect().Model(refreshed).Where("id = ?", credentialID).Limit(1).Scan(ctx); err == nil {
		record = refreshed
	}
	mapped := mapPlatformCredential(*record)
	return &mapped, nil
}

func (s *Service) listPlatformCredentials(ctx context.Context) ([]database.PlatformAICredential, error) {
	if s.db == nil {
		return []database.PlatformAICredential{}, nil
	}
	var records []database.PlatformAICredential
	err := s.db.NewSelect().Model(&records).OrderExpr("provider ASC, position ASC").Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return []database.PlatformAICredential{}, nil
	}
	return records, err
}

func (s *Service) listPlatformFallbackRoutes(ctx context.Context) ([]database.PlatformAIFallbackRoute, error) {
	if s.db == nil {
		return []database.PlatformAIFallbackRoute{}, nil
	}
	var records []database.PlatformAIFallbackRoute
	err := s.db.NewSelect().Model(&records).OrderExpr("position ASC").Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return []database.PlatformAIFallbackRoute{}, nil
	}
	return records, err
}

func (s *Service) platformCredentialCounts(ctx context.Context, provider string) (int, int) {
	records, err := s.listPlatformCredentials(ctx)
	if err != nil {
		return 0, 0
	}
	now := time.Now().UTC()
	total := 0
	healthy := 0
	for _, record := range records {
		if record.Provider != provider || record.Status != credentialStatusActive {
			continue
		}
		total++
		if (record.CooldownUntil == nil || !record.CooldownUntil.After(now)) && record.HealthStatus != healthStatusAuthFailed {
			healthy++
		}
	}
	return total, healthy
}

func mapPlatformCredentials(records []database.PlatformAICredential) []PlatformAICredentialRecord {
	result := make([]PlatformAICredentialRecord, 0, len(records))
	for _, record := range records {
		result = append(result, mapPlatformCredential(record))
	}
	return result
}

func mapPlatformCredential(record database.PlatformAICredential) PlatformAICredentialRecord {
	item := PlatformAICredentialRecord{
		ID:            record.ID.String(),
		Provider:      record.Provider,
		Label:         record.Label,
		Position:      record.Position,
		Status:        record.Status,
		KeyHint:       record.APIKeyHint,
		AllowedModels: parseStringSlice(record.AllowedModels),
		HealthStatus:  defaultString(record.HealthStatus, healthStatusHealthy),
		RequestCount:  record.RequestCount,
		UpdatedAt:     record.UpdatedAt.Format(time.RFC3339),
	}
	if record.CooldownUntil != nil {
		item.CooldownUntil = record.CooldownUntil.Format(time.RFC3339)
	}
	if record.LastUsedAt != nil {
		item.LastUsedAt = record.LastUsedAt.Format(time.RFC3339)
	}
	if record.LastError != nil {
		item.LastError = *record.LastError
	}
	return item
}

func mapPlatformFallbackRoutes(records []database.PlatformAIFallbackRoute) []PlatformAIFallbackRouteRecord {
	result := make([]PlatformAIFallbackRouteRecord, 0, len(records))
	for _, record := range records {
		result = append(result, PlatformAIFallbackRouteRecord{
			ID:       record.ID.String(),
			Provider: record.Provider,
			Model:    record.Model,
			Position: record.Position,
			Enabled:  record.Enabled,
		})
	}
	return result
}

func parseOptionalUUID(value string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || strings.HasPrefix(trimmed, "new-") {
		return uuid.New(), nil
	}
	id, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: invalid route id", iam.ErrValidation)
	}
	return id, nil
}

func firstString(values []string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
