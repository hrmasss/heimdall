package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/resources"
)

const (
	providerOpenAI  = "openai"
	providerGemini  = "gemini"
	providerCopilot = "copilot"

	modeNative = "native"
	modeBYOK   = "byok"

	strategyFirstHealthy = "first_healthy"
	strategyRoundRobin   = "round_robin"

	credentialStatusActive   = "active"
	credentialStatusDisabled = "disabled"

	healthStatusHealthy    = "healthy"
	healthStatusCooling    = "cooling_down"
	healthStatusAuthFailed = "auth_failed"

	useCasePostGeneration      = "post_generation"
	useCaseCampaignPlanning    = "campaign_planning"
	useCaseVariationGeneration = "variation_generation"
	useCaseImageGeneration     = "image_generation"
	useCaseReelGeneration      = "reel_generation"
	useCasePDFGeneration       = "pdf_generation"
	extractorVersion           = "workspace-intelligence-v1"
	processingStatusReady      = "ready"

	PromptScopeAutomations = "automations"
	PromptScopeStudioImage = "studio_image"
	PromptScopeStudioPDF   = "studio_pdf"
	PromptScopeStudioReel  = "studio_reel"
)

type Authorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
	RequirePlatformPermission(ctx context.Context, principal *iam.Principal, requiredPermission string) ([]iam.APIPermission, error)
}

type Service struct {
	db         *bun.DB
	cfg        config.AIConfig
	authorizer Authorizer
	storage    resources.Storage
	httpClient *http.Client
	secretBox  secretBox
}

type ContextFact struct {
	Key        string   `json:"key"`
	Label      string   `json:"label"`
	Value      string   `json:"value"`
	AppliesTo  []string `json:"appliesTo"`
	Importance string   `json:"importance"`
}

type WorkspaceBusinessContext struct {
	Narrative          string        `json:"narrative"`
	Summary            string        `json:"summary"`
	UnderstandingScore int           `json:"understandingScore"`
	MissingGaps        []string      `json:"missingGaps"`
	Facts              []ContextFact `json:"facts"`
	ExtractorVersion   string        `json:"extractorVersion"`
	SourceHash         string        `json:"sourceHash"`
	UpdatedAt          string        `json:"updatedAt,omitempty"`
}

type WorkspaceBrandContext struct {
	Narrative           string         `json:"narrative"`
	Summary             string         `json:"summary"`
	DesignTokens        map[string]any `json:"designTokens"`
	VisualGuardrails    []string       `json:"visualGuardrails"`
	MissingGaps         []string       `json:"missingGaps"`
	ReferenceResourceID string         `json:"referenceResourceId,omitempty"`
	ProcessingStatus    string         `json:"processingStatus"`
	ExtractorVersion    string         `json:"extractorVersion"`
	SourceHash          string         `json:"sourceHash"`
	UpdatedAt           string         `json:"updatedAt,omitempty"`
}

type WorkspaceIntelligenceReadiness struct {
	HasBusinessContext bool     `json:"hasBusinessContext"`
	HasBrandContext    bool     `json:"hasBrandContext"`
	HasAIAccess        bool     `json:"hasAiAccess"`
	Complete           bool     `json:"complete"`
	Missing            []string `json:"missing"`
}

type WorkspaceContextResponse struct {
	Business  WorkspaceBusinessContext       `json:"business"`
	Brand     WorkspaceBrandContext          `json:"brand"`
	Readiness WorkspaceIntelligenceReadiness `json:"readiness"`
}

type AIModelSelection struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type AIProviderCredentialRecord struct {
	ID            string   `json:"id"`
	Provider      string   `json:"provider"`
	Position      int      `json:"position"`
	Status        string   `json:"status"`
	KeyHint       string   `json:"keyHint"`
	AllowedModels []string `json:"allowedModels"`
	UpdatedAt     string   `json:"updatedAt,omitempty"`
}

type PlatformAIProvider struct {
	Provider        string   `json:"provider"`
	Label           string   `json:"label"`
	BaseURL         string   `json:"baseUrl"`
	DefaultModel    string   `json:"defaultModel"`
	ApprovedModels  []string `json:"approvedModels"`
	CredentialCount int      `json:"credentialCount"`
	HealthyCount    int      `json:"healthyCount"`
	Strategy        string   `json:"strategy"`
}

type PlatformAICredentialRecord struct {
	ID            string   `json:"id"`
	Provider      string   `json:"provider"`
	Label         string   `json:"label"`
	Position      int      `json:"position"`
	Status        string   `json:"status"`
	KeyHint       string   `json:"keyHint"`
	AllowedModels []string `json:"allowedModels"`
	HealthStatus  string   `json:"healthStatus"`
	CooldownUntil string   `json:"cooldownUntil,omitempty"`
	RequestCount  int      `json:"requestCount"`
	LastUsedAt    string   `json:"lastUsedAt,omitempty"`
	LastError     string   `json:"lastError,omitempty"`
	UpdatedAt     string   `json:"updatedAt,omitempty"`
}

type PlatformAIFallbackRouteRecord struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Position int    `json:"position"`
	Enabled  bool   `json:"enabled"`
}

type PlatformAICatalog struct {
	Providers []PlatformAIProvider `json:"providers"`
}

type PlatformAISettings struct {
	Providers      []PlatformAIProvider            `json:"providers"`
	Credentials    []PlatformAICredentialRecord    `json:"credentials"`
	FallbackRoutes []PlatformAIFallbackRouteRecord `json:"fallbackRoutes"`
}

type WorkspaceSystemPrompts struct {
	Base        string `json:"base"`
	StudioImage string `json:"studioImage"`
	StudioPDF   string `json:"studioPdf"`
	StudioReel  string `json:"studioReel"`
	Automations string `json:"automations"`
}

type WorkspaceAISettings struct {
	DefaultMode         string                       `json:"defaultMode"`
	CapabilityDefaults  map[string]AIModelSelection  `json:"capabilityDefaults"`
	FallbackPoolEnabled bool                         `json:"fallbackPoolEnabled"`
	UsagePolicy         map[string]any               `json:"usagePolicy"`
	SystemPrompts       WorkspaceSystemPrompts       `json:"systemPrompts"`
	Credentials         []AIProviderCredentialRecord `json:"credentials"`
}

type AIProviderCatalogEntry struct {
	Provider                  string   `json:"provider"`
	Label                     string   `json:"label"`
	ApprovedModels            []string `json:"approvedModels"`
	DefaultModel              string   `json:"defaultModel"`
	NativeAvailable           bool     `json:"nativeAvailable"`
	ConfiguredCredentialCount int      `json:"configuredCredentialCount"`
	SupportsByok              bool     `json:"supportsByok"`
	SupportsImages            bool     `json:"supportsImages"`
}

type AIProviderCatalog struct {
	Providers []AIProviderCatalogEntry `json:"providers"`
}

type AIRunEventSummary struct {
	ID                 string `json:"id"`
	UseCase            string `json:"useCase"`
	Provider           string `json:"provider"`
	Model              string `json:"model"`
	CredentialMode     string `json:"credentialMode"`
	ContextFingerprint string `json:"contextFingerprint"`
	Status             string `json:"status"`
	CreatedAt          string `json:"createdAt"`
}

type GeneratedPostDraft struct {
	Title              string             `json:"title"`
	ContentKind        string             `json:"contentKind"`
	ContentPayload     map[string]any     `json:"contentPayload"`
	Provider           string             `json:"provider"`
	Model              string             `json:"model"`
	CredentialMode     string             `json:"credentialMode"`
	ContextFingerprint string             `json:"contextFingerprint"`
	Warnings           []string           `json:"warnings"`
	RunEvent           *AIRunEventSummary `json:"runEvent,omitempty"`
}

type GenerateStructuredArtifactInput struct {
	UseCase      string     `json:"useCase"`
	Prompt       string     `json:"prompt"`
	SystemPrompt string     `json:"systemPrompt"`
	PromptScope  string     `json:"promptScope"`
	Provider     string     `json:"provider"`
	Model        string     `json:"model"`
	Mode         string     `json:"mode"`
	CampaignID   *uuid.UUID `json:"campaignId"`
}

type GeneratedStructuredArtifact struct {
	Payload            map[string]any     `json:"payload"`
	Provider           string             `json:"provider"`
	Model              string             `json:"model"`
	CredentialMode     string             `json:"credentialMode"`
	ContextFingerprint string             `json:"contextFingerprint"`
	Warnings           []string           `json:"warnings"`
	RunEvent           *AIRunEventSummary `json:"runEvent,omitempty"`
}

type UpdateBusinessContextInput struct {
	Narrative          string        `json:"narrative"`
	Summary            string        `json:"summary"`
	UnderstandingScore *int          `json:"understandingScore"`
	MissingGaps        []string      `json:"missingGaps"`
	Facts              []ContextFact `json:"facts"`
}

type UpdateBrandContextInput struct {
	Narrative           string         `json:"narrative"`
	Summary             string         `json:"summary"`
	DesignTokens        map[string]any `json:"designTokens"`
	VisualGuardrails    []string       `json:"visualGuardrails"`
	MissingGaps         []string       `json:"missingGaps"`
	ReferenceResourceID *uuid.UUID     `json:"referenceResourceId"`
	ClearReferenceImage bool           `json:"clearReferenceImage"`
}

type AIProviderCredentialInput struct {
	ID            string   `json:"id"`
	Provider      string   `json:"provider"`
	Position      int      `json:"position"`
	Status        string   `json:"status"`
	APIKey        string   `json:"apiKey"`
	AllowedModels []string `json:"allowedModels"`
}

type UpdateWorkspaceAISettingsInput struct {
	DefaultMode        string                      `json:"defaultMode"`
	CapabilityDefaults map[string]AIModelSelection `json:"capabilityDefaults"`
	SystemPrompts      *WorkspaceSystemPrompts     `json:"systemPrompts"`
	Credentials        []AIProviderCredentialInput `json:"credentials"`
}

type UpdatePlatformWorkspaceAISettingsInput struct {
	FallbackPoolEnabled *bool `json:"fallbackPoolEnabled"`
}

type PlatformAIProviderSettingInput struct {
	Provider       string   `json:"provider"`
	DefaultModel   string   `json:"defaultModel"`
	ApprovedModels []string `json:"approvedModels"`
	BaseURL        string   `json:"baseUrl"`
	Strategy       string   `json:"strategy"`
}

type PlatformAIFallbackRouteInput struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	Position int    `json:"position"`
	Enabled  bool   `json:"enabled"`
}

type UpdatePlatformAIRoutingInput struct {
	Providers      []PlatformAIProviderSettingInput `json:"providers"`
	FallbackRoutes []PlatformAIFallbackRouteInput   `json:"fallbackRoutes"`
}

type CreatePlatformAICredentialInput struct {
	Provider      string   `json:"provider"`
	Label         string   `json:"label"`
	APIKey        string   `json:"apiKey"`
	Position      int      `json:"position"`
	AllowedModels []string `json:"allowedModels"`
	Status        string   `json:"status"`
}

type UpdatePlatformAICredentialInput struct {
	Label         string   `json:"label"`
	APIKey        string   `json:"apiKey"`
	Position      int      `json:"position"`
	AllowedModels []string `json:"allowedModels"`
	Status        string   `json:"status"`
}

type GeneratePostDraftInput struct {
	Prompt      string     `json:"prompt"`
	PromptScope string     `json:"promptScope"`
	Provider    string     `json:"provider"`
	Model       string     `json:"model"`
	Mode        string     `json:"mode"`
	CampaignID  *uuid.UUID `json:"campaignId"`
}

type aiUsage struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

type providerImage struct {
	MimeType string
	Data     []byte
}

type providerError struct {
	StatusCode int
	Message    string
	Retryable  bool
}

func (e *providerError) Error() string {
	return e.Message
}

type resolvedCredential struct {
	apiKey string
	record *database.WorkspaceAICredential
}

func NewService(db *bun.DB, cfg config.AIConfig, authorizer Authorizer, storage resources.Storage) *Service {
	return &Service{
		db:         db,
		cfg:        cfg,
		authorizer: authorizer,
		storage:    storage,
		httpClient: &http.Client{Timeout: cfg.RequestTimeout},
		secretBox:  newSecretBox(cfg.EncryptionKey),
	}
}

func (s *Service) GetContext(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*WorkspaceContextResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}
	business, _ := s.loadBusinessContext(ctx, workspaceID)
	brand, _ := s.loadBrandContext(ctx, workspaceID)
	settings, _, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return &WorkspaceContextResponse{
		Business:  mapBusinessContext(business),
		Brand:     mapBrandContext(brand),
		Readiness: s.buildReadiness(business, brand, settings, credentials),
	}, nil
}

func (s *Service) UpdateBusinessContext(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpdateBusinessContextInput) (*WorkspaceBusinessContext, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}

	narrative := strings.TrimSpace(input.Narrative)
	extracted, err := s.extractBusinessContext(ctx, workspaceID, narrative)
	if err != nil {
		extracted = heuristicBusinessExtraction(narrative)
	}
	if extracted == nil {
		extracted = heuristicBusinessExtraction(narrative)
	}

	if input.Facts != nil {
		extracted.Facts = sanitizeFacts(input.Facts)
	}
	if input.MissingGaps != nil {
		extracted.MissingGaps = uniqueNonEmpty(input.MissingGaps)
	}
	if input.UnderstandingScore != nil {
		extracted.UnderstandingScore = clamp(*input.UnderstandingScore, 0, 100)
	}
	if strings.TrimSpace(input.Summary) != "" {
		extracted.Summary = strings.TrimSpace(input.Summary)
	}

	record := &database.WorkspaceBusinessContext{
		WorkspaceID:        workspaceID,
		Narrative:          narrative,
		Summary:            extracted.Summary,
		UnderstandingScore: extracted.UnderstandingScore,
		MissingGaps:        marshalMustJSON(extracted.MissingGaps),
		DecisionFacts:      marshalMustJSON(extracted.Facts),
		ExtractorVersion:   extractorVersion,
		SourceHash:         hashStrings(extractorVersion, narrative),
		UpdatedAt:          time.Now().UTC(),
	}

	existing, found := s.loadBusinessContext(ctx, workspaceID)
	if found {
		record.CreatedAt = existing.CreatedAt
		_, err = s.db.NewUpdate().
			Model(record).
			Column("narrative", "summary", "understanding_score", "missing_gaps", "decision_facts", "extractor_version", "source_hash", "updated_at").
			Where("workspace_id = ?", workspaceID).
			Exec(ctx)
	} else {
		record.CreatedAt = record.UpdatedAt
		_, err = s.db.NewInsert().Model(record).Exec(ctx)
	}
	if err != nil {
		return nil, err
	}
	if err := s.rebuildContextCaches(ctx, workspaceID); err != nil {
		return nil, err
	}
	mapped := mapBusinessContext(record)
	return &mapped, nil
}

func (s *Service) UpdateBrandContext(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpdateBrandContextInput) (*WorkspaceBrandContext, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	var referenceResourceID *uuid.UUID
	if !input.ClearReferenceImage {
		referenceResourceID = input.ReferenceResourceID
	}
	narrative := strings.TrimSpace(input.Narrative)
	image, resourceRecord, _ := s.loadReferenceImage(ctx, workspaceID, referenceResourceID)
	extracted, err := s.extractBrandContext(ctx, workspaceID, narrative, image)
	if err != nil {
		extracted = heuristicBrandExtraction(narrative, resourceRecord)
	}
	if extracted == nil {
		extracted = heuristicBrandExtraction(narrative, resourceRecord)
	}

	if input.DesignTokens != nil {
		extracted.DesignTokens = compactMap(input.DesignTokens)
	}
	if input.VisualGuardrails != nil {
		extracted.VisualGuardrails = uniqueNonEmpty(input.VisualGuardrails)
	}
	if input.MissingGaps != nil {
		extracted.MissingGaps = uniqueNonEmpty(input.MissingGaps)
	}
	if strings.TrimSpace(input.Summary) != "" {
		extracted.Summary = strings.TrimSpace(input.Summary)
	}

	record := &database.WorkspaceBrandContext{
		WorkspaceID:         workspaceID,
		Narrative:           narrative,
		Summary:             extracted.Summary,
		DesignTokens:        marshalMustJSON(extracted.DesignTokens),
		VisualGuardrails:    marshalMustJSON(extracted.VisualGuardrails),
		MissingGaps:         marshalMustJSON(extracted.MissingGaps),
		ReferenceResourceID: referenceResourceID,
		ProcessingStatus:    processingStatusReady,
		ExtractorVersion:    extractorVersion,
		SourceHash:          hashStrings(extractorVersion, narrative, uuidString(referenceResourceID)),
		UpdatedAt:           time.Now().UTC(),
	}

	existing, found := s.loadBrandContext(ctx, workspaceID)
	if found {
		record.CreatedAt = existing.CreatedAt
		_, err = s.db.NewUpdate().
			Model(record).
			Column("narrative", "summary", "design_tokens", "visual_guardrails", "missing_gaps", "reference_resource_id", "processing_status", "extractor_version", "source_hash", "updated_at").
			Where("workspace_id = ?", workspaceID).
			Exec(ctx)
	} else {
		record.CreatedAt = record.UpdatedAt
		_, err = s.db.NewInsert().Model(record).Exec(ctx)
	}
	if err != nil {
		return nil, err
	}
	if err := s.rebuildContextCaches(ctx, workspaceID); err != nil {
		return nil, err
	}
	mapped := mapBrandContext(record)
	return &mapped, nil
}

func (s *Service) GetSettings(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*WorkspaceAISettings, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}
	settings, _, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	result := mapAISettings(settings, credentials)
	return &result, nil
}

func (s *Service) GetPlatformWorkspaceSettings(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*WorkspaceAISettings, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.workspaces.manage"); err != nil {
		return nil, err
	}
	settings, _, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	result := mapAISettings(settings, credentials)
	return &result, nil
}

func (s *Service) UpdateSettings(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpdateWorkspaceAISettingsInput) (*WorkspaceAISettings, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	settings, existed, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.DefaultMode) != "" {
		switch strings.TrimSpace(input.DefaultMode) {
		case modeNative, modeBYOK:
			settings.DefaultMode = strings.TrimSpace(input.DefaultMode)
		default:
			return nil, fmt.Errorf("%w: invalid ai mode", iam.ErrValidation)
		}
	}
	if input.CapabilityDefaults != nil {
		if err := s.validateCapabilityDefaults(ctx, input.CapabilityDefaults); err != nil {
			return nil, err
		}
		settings.CapabilityDefaults = marshalMustJSON(s.normalizeCapabilityDefaults(input.CapabilityDefaults))
	}
	if input.SystemPrompts != nil {
		settings.UsagePolicy = marshalMustJSON(
			s.withSystemPrompts(parseJSONObject(settings.UsagePolicy), *input.SystemPrompts),
		)
	}
	settings.UpdatedAt = time.Now().UTC()
	if existed {
		_, err = s.db.NewUpdate().
			Model(settings).
			Column("default_mode", "capability_defaults", "usage_policy", "updated_at").
			Where("workspace_id = ?", workspaceID).
			Exec(ctx)
	} else {
		settings.CreatedAt = settings.UpdatedAt
		_, err = s.db.NewInsert().Model(settings).Exec(ctx)
	}
	if err != nil {
		return nil, err
	}
	if input.Credentials != nil {
		if err := s.upsertCredentials(ctx, principal, workspaceID, input.Credentials, settings.FallbackPoolEnabled); err != nil {
			return nil, err
		}
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	result := mapAISettings(settings, credentials)
	return &result, nil
}

func (s *Service) GetCatalog(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*AIProviderCatalog, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	counts := map[string]int{}
	for _, credential := range credentials {
		counts[credential.Provider]++
	}
	entries := make([]AIProviderCatalogEntry, 0, len(allProviders()))
	for _, provider := range allProviders() {
		setting := s.platformProviderSetting(ctx, provider)
		entries = append(entries, AIProviderCatalogEntry{
			Provider:                  provider,
			Label:                     s.providerLabel(provider),
			ApprovedModels:            parseStringSlice(setting.ApprovedModels),
			DefaultModel:              defaultString(setting.DefaultModel, s.defaultModel(provider)),
			NativeAvailable:           s.hasNativeAccess(ctx, provider),
			ConfiguredCredentialCount: counts[provider],
			SupportsByok:              true,
			SupportsImages:            provider != providerCopilot,
		})
	}
	return &AIProviderCatalog{Providers: entries}, nil
}

func (s *Service) UpdatePlatformWorkspaceSettings(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpdatePlatformWorkspaceAISettingsInput) (*WorkspaceAISettings, error) {
	if _, err := s.authorizer.RequirePlatformPermission(ctx, principal, "platform.workspaces.manage"); err != nil {
		return nil, err
	}
	settings, existed, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if input.FallbackPoolEnabled != nil {
		settings.FallbackPoolEnabled = *input.FallbackPoolEnabled
	}
	settings.UpdatedAt = time.Now().UTC()
	if existed {
		_, err = s.db.NewUpdate().
			Model(settings).
			Column("fallback_pool_enabled", "updated_at").
			Where("workspace_id = ?", workspaceID).
			Exec(ctx)
	} else {
		settings.CreatedAt = settings.UpdatedAt
		_, err = s.db.NewInsert().Model(settings).Exec(ctx)
	}
	if err != nil {
		return nil, err
	}
	credentials, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	result := mapAISettings(settings, credentials)
	return &result, nil
}

func (s *Service) GeneratePostDraft(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input GeneratePostDraftInput) (*GeneratedPostDraft, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return nil, fmt.Errorf("%w: prompt is required", iam.ErrValidation)
	}
	systemPrompt := "You generate concise, decision-aware social post drafts for Heimdall. Return strict JSON with keys title, body, tags, warnings. Use context only when it materially improves relevance. Avoid invented offers, audiences, or claims."
	artifact, err := s.GenerateStructuredArtifact(ctx, principal, workspaceID, GenerateStructuredArtifactInput{
		UseCase:      useCasePostGeneration,
		Prompt:       input.Prompt,
		SystemPrompt: systemPrompt,
		PromptScope:  input.PromptScope,
		Provider:     input.Provider,
		Model:        input.Model,
		Mode:         input.Mode,
		CampaignID:   input.CampaignID,
	})
	if err != nil && artifact == nil {
		return nil, err
	}
	if err != nil {
		return &GeneratedPostDraft{
			Provider:           artifact.Provider,
			Model:              artifact.Model,
			CredentialMode:     artifact.CredentialMode,
			ContextFingerprint: artifact.ContextFingerprint,
			Warnings:           artifact.Warnings,
			RunEvent:           artifact.RunEvent,
		}, err
	}
	payload := map[string]any{}
	if artifact != nil {
		payload = artifact.Payload
	}

	title := compactString(payload["title"])
	body := compactString(payload["body"])
	if body == "" {
		return nil, fmt.Errorf("%w: generated draft body was empty", iam.ErrValidation)
	}
	tags := toStringSlice(payload["tags"])
	warnings := toStringSlice(payload["warnings"])
	return &GeneratedPostDraft{
		Title:              defaultString(title, "AI draft"),
		ContentKind:        "text",
		ContentPayload:     map[string]any{"body": body, "tags": tags},
		Provider:           artifact.Provider,
		Model:              artifact.Model,
		CredentialMode:     artifact.CredentialMode,
		ContextFingerprint: artifact.ContextFingerprint,
		Warnings:           append(artifact.Warnings, warnings...),
		RunEvent:           artifact.RunEvent,
	}, nil
}

func (s *Service) GenerateStructuredArtifact(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input GenerateStructuredArtifactInput) (*GeneratedStructuredArtifact, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Prompt) == "" {
		return nil, fmt.Errorf("%w: prompt is required", iam.ErrValidation)
	}
	useCase := normalizeGeneratedUseCase(input.UseCase)
	if useCase == "" {
		return nil, fmt.Errorf("%w: unsupported ai use case", iam.ErrValidation)
	}
	settings, _, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	provider, model, mode, err := s.resolveGenerationSelectionForUseCase(ctx, settings, useCase, input.Provider, input.Model, input.Mode)
	if err != nil {
		return nil, err
	}
	contextPack, contextFingerprint, err := s.resolveContextPack(ctx, workspaceID, useCase, input.CampaignID)
	if err != nil {
		return nil, err
	}
	systemPrompt := s.composeSystemPrompt(settings, input.PromptScope, input.SystemPrompt)
	userPrompt := fmt.Sprintf("User request:\n%s\n\nWorkspace context:\n%s", strings.TrimSpace(input.Prompt), marshalPretty(contextPack))

	var (
		payload      map[string]any
		responseText string
		lastErr      error
	)
	route := s.routedGenerateJSON(ctx, workspaceID, provider, model, mode, systemPrompt, userPrompt, nil, settings.FallbackPoolEnabled)
	responseText = route.text
	lastErr = route.lastErr
	if lastErr != nil {
		event, _ := s.recordRunEvent(ctx, principal, workspaceID, useCase, route.credential, mode, defaultString(route.provider, provider), defaultString(route.model, model), contextFingerprint, input.CampaignID, "failed", route.usage, map[string]any{"brief": input.Prompt}, map[string]any{}, lastErr.Error())
		return &GeneratedStructuredArtifact{
			Payload:            map[string]any{},
			Provider:           defaultString(route.provider, provider),
			Model:              defaultString(route.model, model),
			CredentialMode:     mode,
			ContextFingerprint: contextFingerprint,
			Warnings:           []string{lastErr.Error()},
			RunEvent:           event,
		}, lastErr
	}
	if err := json.Unmarshal([]byte(cleanJSONText(responseText)), &payload); err != nil {
		return nil, fmt.Errorf("%w: invalid provider payload", iam.ErrValidation)
	}
	event, _ := s.recordRunEvent(ctx, principal, workspaceID, useCase, route.credential, mode, defaultString(route.provider, provider), defaultString(route.model, model), contextFingerprint, input.CampaignID, "success", route.usage, map[string]any{"brief": input.Prompt}, payload, "")
	return &GeneratedStructuredArtifact{
		Payload:            payload,
		Provider:           defaultString(route.provider, provider),
		Model:              defaultString(route.model, model),
		CredentialMode:     mode,
		ContextFingerprint: contextFingerprint,
		Warnings:           toStringSlice(payload["warnings"]),
		RunEvent:           event,
	}, nil
}

func (s *Service) loadBusinessContext(ctx context.Context, workspaceID uuid.UUID) (*database.WorkspaceBusinessContext, bool) {
	record := new(database.WorkspaceBusinessContext)
	if err := s.db.NewSelect().Model(record).Where("workspace_id = ?", workspaceID).Limit(1).Scan(ctx); err != nil {
		return nil, false
	}
	return record, true
}

func (s *Service) loadBrandContext(ctx context.Context, workspaceID uuid.UUID) (*database.WorkspaceBrandContext, bool) {
	record := new(database.WorkspaceBrandContext)
	if err := s.db.NewSelect().Model(record).Where("workspace_id = ?", workspaceID).Limit(1).Scan(ctx); err != nil {
		return nil, false
	}
	return record, true
}

func (s *Service) loadSettings(ctx context.Context, workspaceID uuid.UUID) (*database.WorkspaceAISettings, bool, error) {
	record := &database.WorkspaceAISettings{
		WorkspaceID:         workspaceID,
		DefaultMode:         s.defaultMode(ctx),
		CapabilityDefaults:  marshalMustJSON(s.defaultCapabilityDefaults()),
		FallbackPoolEnabled: false,
		UsagePolicy:         marshalMustJSON(s.defaultUsagePolicy()),
	}
	err := s.db.NewSelect().Model(record).Where("workspace_id = ?", workspaceID).Limit(1).Scan(ctx)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return record, false, nil
		}
		return nil, false, err
	}
	return record, true, nil
}

func (s *Service) listCredentials(ctx context.Context, workspaceID uuid.UUID) ([]database.WorkspaceAICredential, error) {
	var records []database.WorkspaceAICredential
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("provider ASC, position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return records, nil
}

func (s *Service) upsertCredentials(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, inputs []AIProviderCredentialInput, fallbackEnabled bool) error {
	existing, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return err
	}
	existingByID := map[string]database.WorkspaceAICredential{}
	for _, credential := range existing {
		existingByID[credential.ID.String()] = credential
	}
	counts := map[string]int{}
	for _, input := range inputs {
		counts[strings.TrimSpace(input.Provider)]++
	}
	if !fallbackEnabled {
		for provider, count := range counts {
			if count > 1 {
				return fmt.Errorf("%w: multiple %s keys require fallback pools", iam.ErrValidation, provider)
			}
		}
	}

	keep := map[string]struct{}{}
	now := time.Now().UTC()
	for _, input := range inputs {
		provider := strings.TrimSpace(input.Provider)
		if err := s.validateProvider(provider); err != nil {
			return fmt.Errorf("%w: unsupported provider", iam.ErrValidation)
		}
		allowedModels := input.AllowedModels
		if len(allowedModels) == 0 {
			allowedModels = s.approvedModels(provider)
		}
		if err := s.validateAllowedModels(provider, allowedModels); err != nil {
			return err
		}
		var record *database.WorkspaceAICredential
		if existingRecord, ok := existingByID[input.ID]; ok {
			copyRecord := existingRecord
			record = &copyRecord
		} else {
			record = &database.WorkspaceAICredential{
				ID:              uuid.New(),
				WorkspaceID:     workspaceID,
				CreatedAt:       now,
				CreatedByUserID: &principal.UserID,
			}
		}
		record.Provider = provider
		record.Position = input.Position
		record.Status = defaultString(input.Status, "active")
		record.AllowedModels = marshalMustJSON(uniqueNonEmpty(allowedModels))
		record.Metadata = marshalMustJSON(map[string]any{})
		record.UpdatedAt = now
		record.UpdatedByUserID = &principal.UserID
		if strings.TrimSpace(input.APIKey) != "" {
			ciphertext, err := s.secretBox.Encrypt(strings.TrimSpace(input.APIKey))
			if err != nil {
				return err
			}
			record.APIKeyCiphertext = ciphertext
			record.APIKeyHint = secretHint(input.APIKey)
		} else if record.APIKeyCiphertext == "" {
			return fmt.Errorf("%w: api key is required", iam.ErrValidation)
		}

		if _, ok := existingByID[record.ID.String()]; ok {
			_, err = s.db.NewUpdate().
				Model(record).
				Column("provider", "position", "status", "api_key_ciphertext", "api_key_hint", "allowed_models", "metadata", "updated_by_user_id", "updated_at").
				Where("id = ?", record.ID).
				Exec(ctx)
		} else {
			_, err = s.db.NewInsert().Model(record).Exec(ctx)
		}
		if err != nil {
			return err
		}
		keep[record.ID.String()] = struct{}{}
	}

	for _, credential := range existing {
		if _, ok := keep[credential.ID.String()]; ok {
			continue
		}
		if _, err := s.db.NewDelete().Model((*database.WorkspaceAICredential)(nil)).Where("id = ?", credential.ID).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) rebuildContextCaches(ctx context.Context, workspaceID uuid.UUID) error {
	business, _ := s.loadBusinessContext(ctx, workspaceID)
	brand, _ := s.loadBrandContext(ctx, workspaceID)
	sourceFingerprint := s.buildSourceFingerprint(business, brand)
	for _, useCase := range []string{useCasePostGeneration, useCaseCampaignPlanning, useCaseImageGeneration, useCaseReelGeneration} {
		cache := &database.WorkspaceContextCache{
			WorkspaceID:       workspaceID,
			UseCase:           useCase,
			Payload:           marshalMustJSON(s.buildContextPayload(useCase, business, brand)),
			SourceFingerprint: sourceFingerprint,
			UpdatedAt:         time.Now().UTC(),
		}
		if _, err := s.db.NewDelete().
			Model((*database.WorkspaceContextCache)(nil)).
			Where("workspace_id = ?", workspaceID).
			Where("use_case = ?", useCase).
			Exec(ctx); err != nil {
			return err
		}
		if _, err := s.db.NewInsert().Model(cache).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) resolveContextPack(ctx context.Context, workspaceID uuid.UUID, useCase string, campaignID *uuid.UUID) (map[string]any, string, error) {
	business, _ := s.loadBusinessContext(ctx, workspaceID)
	brand, _ := s.loadBrandContext(ctx, workspaceID)
	sourceFingerprint := s.buildSourceFingerprint(business, brand)
	cacheUseCase := normalizeContextCacheUseCase(useCase)

	var cache database.WorkspaceContextCache
	err := s.db.NewSelect().
		Model(&cache).
		Where("workspace_id = ?", workspaceID).
		Where("use_case = ?", cacheUseCase).
		Limit(1).
		Scan(ctx)
	if err != nil || cache.SourceFingerprint != sourceFingerprint {
		if err := s.rebuildContextCaches(ctx, workspaceID); err != nil {
			return nil, "", err
		}
		if err := s.db.NewSelect().
			Model(&cache).
			Where("workspace_id = ?", workspaceID).
			Where("use_case = ?", cacheUseCase).
			Limit(1).
			Scan(ctx); err != nil {
			return nil, "", err
		}
	}
	payload := parseJSONObject(cache.Payload)
	if campaignID != nil {
		if objective := s.loadCampaignObjective(ctx, workspaceID, *campaignID); objective != "" {
			payload["campaignObjective"] = objective
			sourceFingerprint = hashStrings(sourceFingerprint, campaignID.String(), objective)
		}
	}
	return payload, sourceFingerprint, nil
}

func (s *Service) resolveGenerationSelection(ctx context.Context, settings *database.WorkspaceAISettings, input GeneratePostDraftInput) (string, string, string, error) {
	return s.resolveGenerationSelectionForUseCase(ctx, settings, useCasePostGeneration, input.Provider, input.Model, input.Mode)
}

func (s *Service) resolveGenerationSelectionForUseCase(ctx context.Context, settings *database.WorkspaceAISettings, useCase, providerInput, modelInput, modeInput string) (string, string, string, error) {
	mode := defaultString(strings.TrimSpace(modeInput), settings.DefaultMode)
	if mode != modeNative && mode != modeBYOK {
		return "", "", "", fmt.Errorf("%w: invalid ai mode", iam.ErrValidation)
	}
	provider := strings.TrimSpace(providerInput)
	model := strings.TrimSpace(modelInput)
	defaults := parseCapabilityDefaults(settings.CapabilityDefaults)
	if provider == "" {
		lookupUseCase := normalizeConfiguredUseCase(useCase)
		if item, ok := defaults[lookupUseCase]; ok {
			provider = item.Provider
			if model == "" {
				model = item.Model
			}
		}
	}
	if provider == "" {
		provider = s.defaultProvider()
	}
	if model == "" {
		model = s.platformDefaultModel(ctx, provider)
	}
	if provider == "" || model == "" {
		return "", "", "", fmt.Errorf("%w: ai provider is not configured", iam.ErrValidation)
	}
	if !slices.Contains(s.approvedModelsFor(ctx, provider), model) {
		return "", "", "", fmt.Errorf("%w: model is not approved", iam.ErrValidation)
	}
	return provider, model, mode, nil
}

func (s *Service) resolveCredentialChain(ctx context.Context, workspaceID uuid.UUID, provider, mode string, fallbackEnabled bool) ([]resolvedCredential, error) {
	if mode == modeNative {
		apiKeys := s.nativeAPIKeys(provider)
		if len(apiKeys) == 0 {
			return nil, fmt.Errorf("%w: no native %s key is configured", iam.ErrValidation, provider)
		}
		result := make([]resolvedCredential, 0, len(apiKeys))
		for _, apiKey := range apiKeys {
			result = append(result, resolvedCredential{apiKey: apiKey})
		}
		return result, nil
	}
	records, err := s.listCredentials(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	result := []resolvedCredential{}
	for _, record := range records {
		if record.Provider != provider || record.Status != "active" {
			continue
		}
		apiKey, err := s.secretBox.Decrypt(record.APIKeyCiphertext)
		if err != nil {
			return nil, err
		}
		recordCopy := record
		result = append(result, resolvedCredential{apiKey: apiKey, record: &recordCopy})
		if !fallbackEnabled {
			break
		}
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("%w: no active %s workspace keys found", iam.ErrValidation, provider)
	}
	return result, nil
}

func (s *Service) recordRunEvent(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, useCase string, credential *database.WorkspaceAICredential, credentialMode, provider, model, contextFingerprint string, campaignID *uuid.UUID, status string, usage aiUsage, requestPayload, responsePayload map[string]any, errorText string) (*AIRunEventSummary, error) {
	record := &database.AIRunEvent{
		ID:                 uuid.New(),
		WorkspaceID:        workspaceID,
		UseCase:            useCase,
		Provider:           provider,
		Model:              model,
		CredentialMode:     credentialMode,
		ContextFingerprint: contextFingerprint,
		Status:             status,
		RequestPayload:     marshalMustJSON(requestPayload),
		ResponsePayload:    marshalMustJSON(responsePayload),
		CreatedAt:          time.Now().UTC(),
	}
	if principal != nil {
		record.CreatedByUserID = &principal.UserID
	}
	if credential != nil {
		record.CredentialID = &credential.ID
	}
	if campaignID != nil {
		record.SourceEntityType = "campaign"
		record.SourceEntityID = campaignID.String()
	}
	if usage.PromptTokens > 0 {
		record.PromptTokens = &usage.PromptTokens
	}
	if usage.CompletionTokens > 0 {
		record.CompletionTokens = &usage.CompletionTokens
	}
	if usage.TotalTokens > 0 {
		record.TotalTokens = &usage.TotalTokens
	}
	if strings.TrimSpace(errorText) != "" {
		record.ErrorText = &errorText
	}
	if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
		return nil, err
	}
	return &AIRunEventSummary{
		ID:                 record.ID.String(),
		UseCase:            record.UseCase,
		Provider:           record.Provider,
		Model:              record.Model,
		CredentialMode:     record.CredentialMode,
		ContextFingerprint: record.ContextFingerprint,
		Status:             record.Status,
		CreatedAt:          record.CreatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) loadCampaignObjective(ctx context.Context, workspaceID, campaignID uuid.UUID) string {
	var row struct {
		Objective string `bun:"objective"`
	}
	if err := s.db.NewSelect().
		TableExpr("campaigns").
		ColumnExpr("objective").
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", campaignID).
		Limit(1).
		Scan(ctx, &row); err != nil {
		return ""
	}
	return strings.TrimSpace(row.Objective)
}

func (s *Service) buildReadiness(business *database.WorkspaceBusinessContext, brand *database.WorkspaceBrandContext, settings *database.WorkspaceAISettings, credentials []database.WorkspaceAICredential) WorkspaceIntelligenceReadiness {
	hasBusiness := business != nil && (strings.TrimSpace(business.Narrative) != "" || strings.TrimSpace(business.Summary) != "" || business.DecisionFacts != "[]")
	hasBrand := brand != nil && (strings.TrimSpace(brand.Narrative) != "" || strings.TrimSpace(brand.Summary) != "" || brand.DesignTokens != "{}")
	hasAIAccess := s.hasNativeAPIKey(providerOpenAI) || s.hasNativeAPIKey(providerGemini)
	if !hasAIAccess {
		for _, credential := range credentials {
			if credential.Status == "active" {
				hasAIAccess = true
				break
			}
		}
	}
	_ = settings
	missing := []string{}
	if !hasBusiness {
		missing = append(missing, "Add business context")
	}
	if !hasAIAccess {
		missing = append(missing, "Configure AI access")
	}
	return WorkspaceIntelligenceReadiness{
		HasBusinessContext: hasBusiness,
		HasBrandContext:    hasBrand,
		HasAIAccess:        hasAIAccess,
		Complete:           hasBusiness && hasAIAccess,
		Missing:            missing,
	}
}

func mapBusinessContext(record *database.WorkspaceBusinessContext) WorkspaceBusinessContext {
	if record == nil {
		return WorkspaceBusinessContext{MissingGaps: []string{}, Facts: []ContextFact{}, ExtractorVersion: extractorVersion}
	}
	return WorkspaceBusinessContext{
		Narrative:          record.Narrative,
		Summary:            record.Summary,
		UnderstandingScore: record.UnderstandingScore,
		MissingGaps:        parseStringSlice(record.MissingGaps),
		Facts:              parseFacts(record.DecisionFacts),
		ExtractorVersion:   record.ExtractorVersion,
		SourceHash:         record.SourceHash,
		UpdatedAt:          record.UpdatedAt.Format(time.RFC3339),
	}
}

func mapBrandContext(record *database.WorkspaceBrandContext) WorkspaceBrandContext {
	if record == nil {
		return WorkspaceBrandContext{DesignTokens: map[string]any{}, VisualGuardrails: []string{}, MissingGaps: []string{}, ProcessingStatus: processingStatusReady, ExtractorVersion: extractorVersion}
	}
	return WorkspaceBrandContext{
		Narrative:           record.Narrative,
		Summary:             record.Summary,
		DesignTokens:        compactMap(parseJSONObject(record.DesignTokens)),
		VisualGuardrails:    parseStringSlice(record.VisualGuardrails),
		MissingGaps:         parseStringSlice(record.MissingGaps),
		ReferenceResourceID: uuidString(record.ReferenceResourceID),
		ProcessingStatus:    defaultString(record.ProcessingStatus, processingStatusReady),
		ExtractorVersion:    record.ExtractorVersion,
		SourceHash:          record.SourceHash,
		UpdatedAt:           record.UpdatedAt.Format(time.RFC3339),
	}
}

func mapAISettings(record *database.WorkspaceAISettings, credentials []database.WorkspaceAICredential) WorkspaceAISettings {
	usagePolicy := compactMap(parseJSONObject(record.UsagePolicy))
	systemPrompts := parseWorkspaceSystemPrompts(usagePolicy)
	usagePolicy["systemPrompts"] = workspaceSystemPromptsMap(systemPrompts)
	items := make([]AIProviderCredentialRecord, 0, len(credentials))
	for _, credential := range credentials {
		items = append(items, AIProviderCredentialRecord{
			ID:            credential.ID.String(),
			Provider:      credential.Provider,
			Position:      credential.Position,
			Status:        credential.Status,
			KeyHint:       credential.APIKeyHint,
			AllowedModels: parseStringSlice(credential.AllowedModels),
			UpdatedAt:     credential.UpdatedAt.Format(time.RFC3339),
		})
	}
	return WorkspaceAISettings{
		DefaultMode:         defaultString(record.DefaultMode, modeNative),
		CapabilityDefaults:  parseCapabilityDefaults(record.CapabilityDefaults),
		FallbackPoolEnabled: record.FallbackPoolEnabled,
		UsagePolicy:         usagePolicy,
		SystemPrompts:       systemPrompts,
		Credentials:         items,
	}
}

func (s *Service) ComposeExecutionSystemPrompt(ctx context.Context, workspaceID uuid.UUID, scope, existing string) (string, error) {
	settings, _, err := s.loadSettings(ctx, workspaceID)
	if err != nil {
		return "", err
	}
	return s.composeSystemPrompt(settings, scope, existing), nil
}

func (s *Service) defaultUsagePolicy() map[string]any {
	return map[string]any{
		"windowDays":    30,
		"systemPrompts": workspaceSystemPromptsMap(WorkspaceSystemPrompts{}),
	}
}

func (s *Service) composeSystemPrompt(settings *database.WorkspaceAISettings, scope, existing string) string {
	policy := parseJSONObject(settings.UsagePolicy)
	prompts := parseWorkspaceSystemPrompts(policy)
	parts := []string{}
	if prompts.Base != "" {
		parts = append(parts, prompts.Base)
	}
	if scoped := promptForScope(prompts, scope); scoped != "" {
		parts = append(parts, scoped)
	}
	if strings.TrimSpace(existing) != "" {
		parts = append(parts, strings.TrimSpace(existing))
	}
	return strings.Join(parts, "\n\n")
}

func (s *Service) withSystemPrompts(policy map[string]any, prompts WorkspaceSystemPrompts) map[string]any {
	next := compactMap(policy)
	if len(next) == 0 {
		next = s.defaultUsagePolicy()
	}
	next["systemPrompts"] = workspaceSystemPromptsMap(normalizeWorkspaceSystemPrompts(prompts))
	return next
}

func parseWorkspaceSystemPrompts(policy map[string]any) WorkspaceSystemPrompts {
	raw, _ := policy["systemPrompts"].(map[string]any)
	return WorkspaceSystemPrompts{
		Base:        strings.TrimSpace(stringValue(raw["base"])),
		StudioImage: strings.TrimSpace(stringValue(raw["studioImage"])),
		StudioPDF:   strings.TrimSpace(stringValue(raw["studioPdf"])),
		StudioReel:  strings.TrimSpace(stringValue(raw["studioReel"])),
		Automations: strings.TrimSpace(stringValue(raw["automations"])),
	}
}

func normalizeWorkspaceSystemPrompts(prompts WorkspaceSystemPrompts) WorkspaceSystemPrompts {
	return WorkspaceSystemPrompts{
		Base:        strings.TrimSpace(prompts.Base),
		StudioImage: strings.TrimSpace(prompts.StudioImage),
		StudioPDF:   strings.TrimSpace(prompts.StudioPDF),
		StudioReel:  strings.TrimSpace(prompts.StudioReel),
		Automations: strings.TrimSpace(prompts.Automations),
	}
}

func workspaceSystemPromptsMap(prompts WorkspaceSystemPrompts) map[string]any {
	normalized := normalizeWorkspaceSystemPrompts(prompts)
	return map[string]any{
		"base":        normalized.Base,
		"studioImage": normalized.StudioImage,
		"studioPdf":   normalized.StudioPDF,
		"studioReel":  normalized.StudioReel,
		"automations": normalized.Automations,
	}
}

func promptForScope(prompts WorkspaceSystemPrompts, scope string) string {
	switch strings.TrimSpace(scope) {
	case PromptScopeStudioImage:
		return prompts.StudioImage
	case PromptScopeStudioPDF:
		return prompts.StudioPDF
	case PromptScopeStudioReel:
		return prompts.StudioReel
	case PromptScopeAutomations:
		return prompts.Automations
	default:
		return ""
	}
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}
