package social

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
	"github.com/heimdall/api/internal/resources"
)

type OAuthCallbackResult struct {
	ReturnOrigin string `json:"returnOrigin"`
	ReturnPath   string `json:"returnPath"`
	Provider     string `json:"provider"`
	Success      bool   `json:"success"`
	Message      string `json:"message"`
}

type Service struct {
	db         *bun.DB
	cfg        config.SocialConfig
	authorizer WorkspaceAuthorizer
	variants   VariantReader
	storage    resources.Storage
	secretBox  secretBox
	adapters   map[string]providerAdapter
}

func NewService(db *bun.DB, cfg config.SocialConfig, authorizer WorkspaceAuthorizer, variants VariantReader, storage resources.Storage) *Service {
	service := &Service{
		db:         db,
		cfg:        cfg,
		authorizer: authorizer,
		variants:   variants,
		storage:    storage,
		secretBox:  newSecretBox(cfg.EncryptionKey),
		adapters:   map[string]providerAdapter{},
	}
	for _, adapter := range []providerAdapter{
		newMetaAdapter(cfg),
		newLinkedInAdapter(cfg),
		newXAdapter(cfg),
		newTikTokAdapter(cfg),
	} {
		service.adapters[adapter.Provider()] = adapter
	}
	return service
}

func (s *Service) ListProviderAvailability(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]ProviderAvailability, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}

	providers := []string{"meta", "linkedin", "x", "tiktok"}
	items := make([]ProviderAvailability, 0, len(providers))
	for _, provider := range providers {
		adapter, ok := s.adapters[provider]
		if !ok {
			continue
		}
		_, managedAvailable := managedProviderCredential(s.cfg, provider)
		statusText := "Managed app ready."
		status := "ready"
		if !managedAvailable {
			status = "pending"
			statusText = "Managed app credentials are not configured yet."
		}
		items = append(items, ProviderAvailability{
			Provider:          provider,
			Label:             adapter.Label(),
			ManagedAvailable:  managedAvailable,
			SupportsBYOK:      adapter.SupportsBYOK(),
			ConnectionModes:   []string{credentialSourceManaged, credentialSourceBYOK},
			ManagedStatus:     status,
			ManagedStatusText: statusText,
		})
	}
	return items, nil
}

func (s *Service) ListAppCredentials(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]AppCredentialRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}

	records := make([]AppCredentialRecord, 0, 6)
	for _, provider := range []string{"meta", "linkedin", "x", "tiktok"} {
		if managed, ok := managedProviderCredential(s.cfg, provider); ok {
			records = append(records, AppCredentialRecord{
				ID:             fmt.Sprintf("managed:%s", provider),
				Provider:       provider,
				Source:         credentialSourceManaged,
				Status:         "active",
				ClientID:       managed.ClientID,
				ClientIDMasked: maskClientID(managed.ClientID),
			})
		}
	}

	var rows []database.ProviderAppCredential
	if err := s.db.NewSelect().
		Model(&rows).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("provider ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, row := range rows {
		records = append(records, mapProviderCredentialRecord(row))
	}
	return records, nil
}

func (s *Service) UpsertAppCredential(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, provider string, input UpsertAppCredentialInput) (*AppCredentialRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	adapter, ok := s.adapters[strings.TrimSpace(provider)]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported provider", iam.ErrValidation)
	}
	if !adapter.SupportsBYOK() {
		return nil, fmt.Errorf("%w: provider does not support BYOK", iam.ErrValidation)
	}
	clientID := strings.TrimSpace(input.ClientID)
	clientSecret := strings.TrimSpace(input.ClientSecret)
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("%w: client id and client secret are required", iam.ErrValidation)
	}
	ciphertext, err := s.secretBox.Encrypt(clientSecret)
	if err != nil {
		return nil, err
	}
	metadata, err := marshalJSON(input.Metadata)
	if err != nil {
		return nil, err
	}
	row := new(database.ProviderAppCredential)
	err = s.db.NewSelect().
		Model(row).
		Where("workspace_id = ?", workspaceID).
		Where("provider = ?", provider).
		Where("source = ?", credentialSourceBYOK).
		Limit(1).
		Scan(ctx)
	now := time.Now().UTC()
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		row = &database.ProviderAppCredential{
			ID:                     uuid.New(),
			WorkspaceID:            workspaceID,
			Provider:               provider,
			Source:                 credentialSourceBYOK,
			Status:                 "active",
			ClientID:               clientID,
			ClientSecretCiphertext: ciphertext,
			ClientSecretHint:       secretHint(clientSecret),
			Metadata:               metadata,
			CreatedByUserID:        &principal.UserID,
			UpdatedByUserID:        &principal.UserID,
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		if _, err := s.db.NewInsert().Model(row).Exec(ctx); err != nil {
			return nil, err
		}
		record := mapProviderCredentialRecord(*row)
		return &record, nil
	}

	row.Status = "active"
	row.ClientID = clientID
	row.ClientSecretCiphertext = ciphertext
	row.ClientSecretHint = secretHint(clientSecret)
	row.Metadata = metadata
	row.UpdatedByUserID = &principal.UserID
	row.UpdatedAt = now
	if _, err := s.db.NewUpdate().
		Model(row).
		Column("status", "client_id", "client_secret_ciphertext", "client_secret_hint", "metadata", "updated_by_user_id", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	record := mapProviderCredentialRecord(*row)
	return &record, nil
}

func (s *Service) StartOAuth(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input StartOAuthInput) (*StartOAuthResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	provider := strings.TrimSpace(input.Provider)
	adapter, ok := s.adapters[provider]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported provider", iam.ErrValidation)
	}
	credentialSource := strings.TrimSpace(input.CredentialSource)
	if credentialSource == "" {
		credentialSource = credentialSourceManaged
	}
	credential, err := s.resolveProviderCredential(ctx, workspaceID, provider, credentialSource)
	if err != nil {
		return nil, err
	}
	stateToken, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	var codeVerifier *string
	if provider == "x" {
		verifier, err := randomToken(48)
		if err != nil {
			return nil, err
		}
		codeVerifier = &verifier
	}
	state := database.SocialOAuthState{
		ID:               uuid.New(),
		WorkspaceID:      workspaceID,
		Provider:         provider,
		CredentialSource: credentialSource,
		StateToken:       stateToken,
		ReturnOrigin:     strings.TrimSpace(input.ReturnOrigin),
		ReturnPath:       defaultString(strings.TrimSpace(input.ReturnPath), "/dashboard/settings"),
		Status:           "pending",
		ExpiresAt:        time.Now().UTC().Add(s.cfg.OAuthStateTTL),
		CreatedByUserID:  &principal.UserID,
		CreatedAt:        time.Now().UTC(),
	}
	if credential.ID != nil {
		state.ProviderCredentialID = credential.ID
	}
	if codeVerifier != nil {
		state.CodeVerifier = codeVerifier
	}
	if _, err := s.db.NewInsert().Model(&state).Exec(ctx); err != nil {
		return nil, err
	}
	authURL, err := adapter.BuildAuthorizationURL(credential, s.redirectURI(provider), state)
	if err != nil {
		return nil, err
	}
	return &StartOAuthResponse{AuthURL: authURL, State: stateToken}, nil
}

func (s *Service) CompleteOAuth(ctx context.Context, provider, stateToken, code string) (*OAuthCallbackResult, error) {
	provider = strings.TrimSpace(provider)
	if provider == "" || strings.TrimSpace(stateToken) == "" || strings.TrimSpace(code) == "" {
		return nil, fmt.Errorf("%w: provider, state, and code are required", iam.ErrValidation)
	}
	adapter, ok := s.adapters[provider]
	if !ok {
		return nil, fmt.Errorf("%w: unsupported provider", iam.ErrValidation)
	}
	state := new(database.SocialOAuthState)
	if err := s.db.NewSelect().
		Model(state).
		Where("provider = ?", provider).
		Where("state_token = ?", stateToken).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrUnauthorized
		}
		return nil, err
	}
	if state.Status != "pending" || state.ExpiresAt.Before(time.Now().UTC()) {
		return nil, fmt.Errorf("%w: oauth state is no longer valid", iam.ErrUnauthorized)
	}
	credential, err := s.resolveProviderCredentialFromState(ctx, *state)
	if err != nil {
		return nil, err
	}
	exchanged, err := adapter.ExchangeCode(ctx, credential, s.redirectURI(provider), *state, strings.TrimSpace(code))
	if err != nil {
		return nil, err
	}
	if err := s.upsertConnectionAndTargets(ctx, *state, credential, exchanged); err != nil {
		return nil, err
	}
	state.Status = "complete"
	if _, err := s.db.NewUpdate().Model(state).Column("status").WherePK().Exec(ctx); err != nil {
		return nil, err
	}
	return &OAuthCallbackResult{
		ReturnOrigin: state.ReturnOrigin,
		ReturnPath:   state.ReturnPath,
		Provider:     provider,
		Success:      true,
		Message:      "Account connected.",
	}, nil
}

func (s *Service) ListConnections(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*ConnectionsResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.view"); err != nil {
		return nil, err
	}
	var connections []database.SocialConnection
	if err := s.db.NewSelect().
		Model(&connections).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	var targets []database.SocialTarget
	if err := s.db.NewSelect().
		Model(&targets).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	targetsByConnection := make(map[string][]TargetRecord, len(connections))
	targetRecords := make([]TargetRecord, 0, len(targets))
	for _, target := range targets {
		mapped := mapSocialTarget(target)
		targetRecords = append(targetRecords, mapped)
		targetsByConnection[target.ConnectionID.String()] = append(targetsByConnection[target.ConnectionID.String()], mapped)
	}
	connectionRecords := make([]ConnectionRecord, 0, len(connections))
	for _, connection := range connections {
		mapped := mapSocialConnection(connection)
		mapped.Targets = ensureTargetRecords(targetsByConnection[connection.ID.String()])
		connectionRecords = append(connectionRecords, mapped)
	}
	return &ConnectionsResponse{
		Connections: connectionRecords,
		Targets:     ensureTargetRecords(targetRecords),
	}, nil
}

func (s *Service) SelectTarget(ctx context.Context, principal *iam.Principal, workspaceID, targetID uuid.UUID, selected bool) (*TargetRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	target, err := s.findTarget(ctx, workspaceID, targetID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if selected {
		query := s.db.NewUpdate().
			Model((*database.SocialTarget)(nil)).
			Set("is_selected = false").
			Set("updated_at = ?", now).
			Where("workspace_id = ?", workspaceID).
			Where("provider = ?", target.Provider)
		if target.Provider == "meta" {
			query = query.Where("target_type = ?", metaTargetTypeForPlatform(selectionScopeForTarget(*target)))
		}
		if _, err := query.Exec(ctx); err != nil {
			return nil, err
		}
	}
	target.IsSelected = selected
	target.UpdatedAt = now
	if _, err := s.db.NewUpdate().
		Model(target).
		Column("is_selected", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	record := mapSocialTarget(*target)
	return &record, nil
}

func (s *Service) ValidateTarget(ctx context.Context, principal *iam.Principal, workspaceID, targetID uuid.UUID, checkpoint string) (*ValidateTargetResult, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "workspace.settings.manage"); err != nil {
		return nil, err
	}
	target, err := s.findTarget(ctx, workspaceID, targetID)
	if err != nil {
		return nil, err
	}
	connection, err := s.findConnection(ctx, workspaceID, target.ConnectionID)
	if err != nil {
		return nil, err
	}
	session, err := s.providerSessionFromConnection(*connection)
	if err != nil {
		return nil, err
	}
	adapter := s.adapters[target.Provider]
	result, err := adapter.ValidateTargetCapabilities(ctx, session, *target)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	target.ScopeSnapshot = marshalMustJSON(result.Scopes)
	target.CapabilitySnapshot = marshalMustJSON(result.Capabilities)
	target.Status = result.Status
	target.LastValidatedAt = &now
	if strings.TrimSpace(result.Error) != "" {
		target.LastValidationError = &result.Error
	} else {
		target.LastValidationError = nil
	}
	if _, err := s.db.NewUpdate().
		Model(target).
		Column("scope_snapshot", "capability_snapshot", "status", "last_validated_at", "last_validation_error").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	connection.HealthStatus = result.Status
	connection.LastValidatedAt = &now
	connection.LastValidationError = target.LastValidationError
	if _, err := s.db.NewUpdate().
		Model(connection).
		Column("health_status", "last_validated_at", "last_validation_error").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	targetRecord := mapSocialTarget(*target)
	connectionRecord := mapSocialConnection(*connection)
	return &ValidateTargetResult{
		Target:               targetRecord,
		Connection:           connectionRecord,
		ValidationCheckpoint: defaultString(strings.TrimSpace(checkpoint), "manual"),
	}, nil
}

func (s *Service) PreviewVariantPublishability(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, targetID *uuid.UUID) (*PublishabilityPreview, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}
	variant, err := s.variants.GetVariant(ctx, principal, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	issues := append([]posts.ReadinessIssue{}, variant.Readiness.PublishBlockers...)
	preview := &PublishabilityPreview{
		Ready:    len(issues) == 0,
		Provider: variant.Platform,
		Issues:   ensureIssues(issues),
		Warnings: ensureIssues(nil),
	}
	if targetID == nil {
		return preview, nil
	}
	target, err := s.findTarget(ctx, workspaceID, *targetID)
	if err != nil {
		return nil, err
	}
	targetRecord := mapSocialTarget(*target)
	preview.Target = &targetRecord
	preview.CapabilitySnapshot = parseJSONMap(target.CapabilitySnapshot)
	content := buildPublishContent(*variant, PublishVariantInput{})
	if !targetMatchesPlatform(*target, variant.Platform) {
		preview.Issues = append(preview.Issues, posts.ReadinessIssue{
			Code:    "target_platform_mismatch",
			Message: "The selected account belongs to a different platform than this variant.",
		})
	}
	if target.Status == targetStatusReauth || target.Status == targetStatusRevoked {
		preview.Issues = append(preview.Issues, posts.ReadinessIssue{
			Code:    "target_invalid",
			Message: "Reconnect or revalidate this target before publishing.",
		})
	}
	if !surfaceAllowed(preview.CapabilitySnapshot, variant.Surface) {
		message := "This account cannot publish the selected surface with the current permissions."
		if target.Provider == "tiktok" && variant.Surface == "photo_post" {
			message = "TikTok photo posting requires Heimdall-managed app credentials in MVP."
		}
		preview.Issues = append(preview.Issues, posts.ReadinessIssue{
			Code:    "surface_not_allowed",
			Message: message,
		})
	}
	if builder, ok := s.adapters[target.Provider].(previewMetadataBuilder); ok {
		connection, err := s.findConnection(ctx, workspaceID, target.ConnectionID)
		if err != nil {
			return nil, err
		}
		session, err := s.providerSessionFromConnection(*connection)
		if err != nil {
			return nil, err
		}
		assets, err := s.loadAssetBlobs(ctx, variant.EffectiveAssets)
		if err != nil {
			return nil, err
		}
		metadata, issues, warnings, err := builder.BuildPreviewMetadata(ctx, session, *target, content, assets)
		if err != nil {
			return nil, err
		}
		preview.PublicationMetadata = metadata
		preview.Issues = append(preview.Issues, issues...)
		preview.Warnings = append(preview.Warnings, warnings...)
	}
	preview.Ready = len(preview.Issues) == 0
	return preview, nil
}

func (s *Service) PublishVariant(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input PublishVariantInput) (*posts.PublicationPlan, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, err
	}
	variant, err := s.variants.GetVariant(ctx, principal, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	if len(variant.Readiness.PublishBlockers) > 0 {
		return nil, fmt.Errorf("%w: variant is not publishable yet", iam.ErrConflict)
	}
	publication, err := s.ensurePublication(ctx, principal.UserID, workspaceID, variantID, input.SocialTargetID, defaultString(strings.TrimSpace(input.Source), "social_api"))
	if err != nil {
		return nil, err
	}
	if input.SocialTargetID == nil {
		if publication.SocialTargetID != nil {
			input.SocialTargetID = publication.SocialTargetID
		} else {
			selectedTarget, err := s.findSelectedTargetByPlatform(ctx, workspaceID, variant.Platform)
			if err != nil {
				return nil, fmt.Errorf("%w: social target is required for social publishing", iam.ErrValidation)
			}
			input.SocialTargetID = &selectedTarget.ID
			publication.SocialTargetID = &selectedTarget.ID
		}
	}
	target, err := s.findTarget(ctx, workspaceID, *input.SocialTargetID)
	if err != nil {
		return nil, err
	}
	preview, err := s.PreviewVariantPublishability(ctx, principal, workspaceID, variantID, input.SocialTargetID)
	if err != nil {
		return nil, err
	}
	if !preview.Ready {
		return nil, fmt.Errorf("%w: target or variant is not publishable", iam.ErrConflict)
	}
	connection, err := s.findConnection(ctx, workspaceID, target.ConnectionID)
	if err != nil {
		return nil, err
	}
	session, err := s.providerSessionFromConnection(*connection)
	if err != nil {
		return nil, err
	}
	content := buildPublishContent(*variant, input)
	assets, err := s.loadAssetBlobs(ctx, variant.EffectiveAssets)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	publication.PublicationState = "publishing"
	publication.SocialTargetID = input.SocialTargetID
	publication.LastError = nil
	publication.UpdatedByUserID = &principal.UserID
	publication.UpdatedAt = now
	if _, err := s.db.NewUpdate().
		Model(publication).
		Column("social_target_id", "publication_state", "last_error", "updated_by_user_id", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	adapter := s.adapters[target.Provider]
	result, err := adapter.PublishPost(ctx, session, *target, content, assets)
	if err != nil {
		message := err.Error()
		publication.PublicationState = "failed"
		publication.LastError = &message
		publication.UpdatedAt = time.Now().UTC()
		if _, updateErr := s.db.NewUpdate().
			Model(publication).
			Column("publication_state", "last_error", "updated_at").
			WherePK().
			Exec(ctx); updateErr != nil {
			return nil, updateErr
		}
		return nil, err
	}
	metadata := parseJSONMap(publication.Metadata)
	metadata["publishResult"] = result.Metadata
	metadata["capabilitySnapshot"] = preview.CapabilitySnapshot
	if preview.PublicationMetadata != nil {
		metadata["publicationMetadata"] = preview.PublicationMetadata
	}
	if input.TikTok != nil {
		metadata["tiktokOptions"] = map[string]any{
			"privacyLevel":   strings.TrimSpace(input.TikTok.PrivacyLevel),
			"allowComment":   valueOrNil(input.TikTok.AllowComment),
			"allowDuet":      valueOrNil(input.TikTok.AllowDuet),
			"allowStitch":    valueOrNil(input.TikTok.AllowStitch),
			"brandContent":   valueOrNil(input.TikTok.BrandContent),
			"brandedContent": valueOrNil(input.TikTok.BrandedContent),
		}
	}
	if externalPostURL := stringValue(result.Metadata["externalPostUrl"]); externalPostURL != "" {
		metadata["externalPostUrl"] = externalPostURL
	}
	publication.PublicationState = "published"
	publication.PublishedAt = &result.PublishedAt
	publication.ExternalPostID = optionalString(result.ExternalPostID)
	publication.ExternalAccountID = optionalString(result.ExternalAccountID)
	publication.Metadata = marshalMustJSON(metadata)
	publication.LastError = nil
	publication.UpdatedAt = time.Now().UTC()
	if _, err := s.db.NewUpdate().
		Model(publication).
		Column("publication_state", "published_at", "external_post_id", "external_account_id", "metadata", "last_error", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	return &posts.PublicationPlan{
		ID:                publication.ID.String(),
		VariantID:         publication.VariantID.String(),
		SocialTargetID:    target.ID.String(),
		PublicationState:  publication.PublicationState,
		PublishedAt:       result.PublishedAt.Format(time.RFC3339),
		ExternalPostID:    result.ExternalPostID,
		ExternalPostURL:   stringValue(metadata["externalPostUrl"]),
		ExternalAccountID: result.ExternalAccountID,
		Source:            publication.Source,
		Metadata:          metadata,
		CreatedAt:         publication.CreatedAt.Format(time.RFC3339),
		UpdatedAt:         publication.UpdatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) PublishDue(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]posts.PublicationPlan, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, err
	}
	var rows []database.PostVariantPublication
	if err := s.db.NewSelect().
		Model(&rows).
		Where("workspace_id = ?", workspaceID).
		Where("publication_state = ?", "scheduled").
		Where("planned_at IS NOT NULL").
		Where("planned_at <= ?", time.Now().UTC()).
		OrderExpr("planned_at ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	items := make([]posts.PublicationPlan, 0, len(rows))
	for _, row := range rows {
		plan, err := s.PublishVariant(ctx, principal, workspaceID, row.VariantID, PublishVariantInput{
			SocialTargetID: row.SocialTargetID,
			Source:         row.Source,
		})
		if err != nil {
			continue
		}
		items = append(items, *plan)
	}
	return items, nil
}

func (s *Service) SyncPublicationMetrics(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) (*SyncMetricsResult, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "analytics.view"); err != nil {
		return nil, err
	}
	publication, err := s.findPublicationByVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	if publication.SocialTargetID == nil {
		return nil, fmt.Errorf("%w: no social target is linked to this publication", iam.ErrValidation)
	}
	target, err := s.findTarget(ctx, workspaceID, *publication.SocialTargetID)
	if err != nil {
		return nil, err
	}
	connection, err := s.findConnection(ctx, workspaceID, target.ConnectionID)
	if err != nil {
		return nil, err
	}
	session, err := s.providerSessionFromConnection(*connection)
	if err != nil {
		return nil, err
	}
	result, err := s.adapters[target.Provider].GetPostMetrics(ctx, session, *target, *publication)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	for code, value := range result.Metrics {
		definition, err := s.ensureMetricDefinition(ctx, code, target.Provider, "")
		if err != nil {
			return nil, err
		}
		record := &database.MetricObservation{
			ID:                 uuid.New(),
			WorkspaceID:        workspaceID,
			PublicationID:      publication.ID,
			MetricDefinitionID: definition.ID,
			ObservedAt:         now,
			Value:              value,
			Source:             "provider_sync",
			Metadata:           marshalMustJSON(result.Metadata),
			CreatedByUserID:    &principal.UserID,
			CreatedAt:          now,
		}
		if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
			return nil, err
		}
	}
	metadata := parseJSONMap(publication.Metadata)
	for key, value := range result.Metadata {
		metadata[key] = value
	}
	publication.Metadata = marshalMustJSON(metadata)
	if externalPostID := stringValue(result.Metadata["externalPostId"]); externalPostID != "" {
		publication.ExternalPostID = &externalPostID
	}
	publication.UpdatedAt = now
	if _, err := s.db.NewUpdate().
		Model(publication).
		Column("external_post_id", "metadata", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	return &SyncMetricsResult{
		PublicationID: publication.ID.String(),
		VariantID:     variantID.String(),
		Metrics:       result.Metrics,
		SyncedAt:      now.Format(time.RFC3339),
	}, nil
}

func (s *Service) redirectURI(provider string) string {
	base := strings.TrimRight(strings.TrimSpace(s.cfg.PublicAPIBaseURL), "/")
	return fmt.Sprintf("%s/api/v1/social/oauth/callback/%s", base, provider)
}

func (s *Service) resolveProviderCredential(ctx context.Context, workspaceID uuid.UUID, provider, source string) (providerCredential, error) {
	if source == credentialSourceManaged {
		credential, ok := managedProviderCredential(s.cfg, provider)
		if !ok {
			return providerCredential{}, fmt.Errorf("%w: managed credentials are not configured for %s", iam.ErrConflict, provider)
		}
		return credential, nil
	}
	row := new(database.ProviderAppCredential)
	if err := s.db.NewSelect().
		Model(row).
		Where("workspace_id = ?", workspaceID).
		Where("provider = ?", provider).
		Where("source = ?", credentialSourceBYOK).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return providerCredential{}, fmt.Errorf("%w: configure BYOK credentials first", iam.ErrNotFound)
		}
		return providerCredential{}, err
	}
	secret, err := s.secretBox.Decrypt(row.ClientSecretCiphertext)
	if err != nil {
		return providerCredential{}, err
	}
	return providerCredential{
		ID:           &row.ID,
		Provider:     row.Provider,
		Source:       row.Source,
		ClientID:     row.ClientID,
		ClientSecret: secret,
		Metadata:     parseJSONMap(row.Metadata),
	}, nil
}

func (s *Service) resolveProviderCredentialFromState(ctx context.Context, state database.SocialOAuthState) (providerCredential, error) {
	if state.CredentialSource == credentialSourceManaged {
		return s.resolveProviderCredential(ctx, state.WorkspaceID, state.Provider, credentialSourceManaged)
	}
	if state.ProviderCredentialID == nil {
		return providerCredential{}, fmt.Errorf("%w: missing BYOK credential", iam.ErrValidation)
	}
	row := new(database.ProviderAppCredential)
	if err := s.db.NewSelect().Model(row).Where("id = ?", *state.ProviderCredentialID).Limit(1).Scan(ctx); err != nil {
		return providerCredential{}, err
	}
	secret, err := s.secretBox.Decrypt(row.ClientSecretCiphertext)
	if err != nil {
		return providerCredential{}, err
	}
	return providerCredential{
		ID:           &row.ID,
		Provider:     row.Provider,
		Source:       row.Source,
		ClientID:     row.ClientID,
		ClientSecret: secret,
		Metadata:     parseJSONMap(row.Metadata),
	}, nil
}

func (s *Service) upsertConnectionAndTargets(ctx context.Context, state database.SocialOAuthState, credential providerCredential, exchanged *exchangeResult) error {
	now := time.Now().UTC()
	accessToken, err := s.secretBox.Encrypt(exchanged.AccessToken)
	if err != nil {
		return err
	}
	refreshToken, err := s.secretBox.Encrypt(exchanged.RefreshToken)
	if err != nil {
		return err
	}
	metadata, err := marshalJSON(exchanged.Metadata)
	if err != nil {
		return err
	}
	row := new(database.SocialConnection)
	err = s.db.NewSelect().
		Model(row).
		Where("workspace_id = ?", state.WorkspaceID).
		Where("provider = ?", state.Provider).
		Where("auth_subject_id = ?", exchanged.AuthSubjectID).
		Where("credential_source = ?", state.CredentialSource).
		Limit(1).
		Scan(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if errors.Is(err, sql.ErrNoRows) {
		row = &database.SocialConnection{
			ID:                     uuid.New(),
			WorkspaceID:            state.WorkspaceID,
			Provider:               state.Provider,
			CredentialSource:       state.CredentialSource,
			ProviderCredentialID:   state.ProviderCredentialID,
			Status:                 connectionStatusConnected,
			HealthStatus:           targetStatusHealthy,
			AuthSubjectID:          exchanged.AuthSubjectID,
			AuthSubjectName:        exchanged.AuthSubjectName,
			AccessTokenCiphertext:  accessToken,
			RefreshTokenCiphertext: refreshToken,
			TokenType:              defaultString(exchanged.TokenType, "Bearer"),
			Scopes:                 marshalMustJSON(exchanged.Scopes),
			Metadata:               metadata,
			AccessTokenExpiresAt:   exchanged.AccessTokenExpiresAt,
			ConnectedAt:            now,
			CreatedByUserID:        state.CreatedByUserID,
			UpdatedByUserID:        state.CreatedByUserID,
			CreatedAt:              now,
			UpdatedAt:              now,
		}
		if _, err := s.db.NewInsert().Model(row).Exec(ctx); err != nil {
			return err
		}
	} else {
		row.ProviderCredentialID = state.ProviderCredentialID
		row.Status = connectionStatusConnected
		row.HealthStatus = targetStatusHealthy
		row.AuthSubjectName = exchanged.AuthSubjectName
		row.AccessTokenCiphertext = accessToken
		row.RefreshTokenCiphertext = refreshToken
		row.TokenType = defaultString(exchanged.TokenType, "Bearer")
		row.Scopes = marshalMustJSON(exchanged.Scopes)
		row.Metadata = metadata
		row.AccessTokenExpiresAt = exchanged.AccessTokenExpiresAt
		row.LastValidationError = nil
		row.UpdatedByUserID = state.CreatedByUserID
		row.UpdatedAt = now
		if _, err := s.db.NewUpdate().
			Model(row).
			Column("provider_credential_id", "status", "health_status", "auth_subject_name", "access_token_ciphertext", "refresh_token_ciphertext", "token_type", "scopes", "metadata", "access_token_expires_at", "last_validation_error", "updated_by_user_id", "updated_at").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
	}

	for _, discovered := range exchanged.Targets {
		target := new(database.SocialTarget)
		err := s.db.NewSelect().
			Model(target).
			Where("workspace_id = ?", state.WorkspaceID).
			Where("provider = ?", state.Provider).
			Where("external_account_id = ?", discovered.ExternalAccountID).
			Limit(1).
			Scan(ctx)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		scopeSnapshot := marshalMustJSON(discovered.Scopes)
		capabilitySnapshot := marshalMustJSON(discovered.Capabilities)
		targetMetadata := marshalMustJSON(discovered.Metadata)
		status := defaultString(strings.TrimSpace(discovered.Status), targetStatusHealthy)
		if errors.Is(err, sql.ErrNoRows) {
			target = &database.SocialTarget{
				ID:                    uuid.New(),
				WorkspaceID:           state.WorkspaceID,
				ConnectionID:          row.ID,
				Provider:              state.Provider,
				ExternalAccountID:     discovered.ExternalAccountID,
				DisplayName:           discovered.DisplayName,
				TargetType:            discovered.TargetType,
				AccountClassification: defaultString(discovered.AccountClassification, "business"),
				Status:                status,
				IsSelected:            len(exchanged.Targets) == 1,
				ScopeSnapshot:         scopeSnapshot,
				CapabilitySnapshot:    capabilitySnapshot,
				Metadata:              targetMetadata,
				CreatedAt:             now,
				UpdatedAt:             now,
			}
			if value := strings.TrimSpace(discovered.ExternalParentID); value != "" {
				target.ExternalParentID = &value
			}
			if value := strings.TrimSpace(discovered.Username); value != "" {
				target.Username = &value
			}
			if _, err := s.db.NewInsert().Model(target).Exec(ctx); err != nil {
				return err
			}
			continue
		}
		target.ConnectionID = row.ID
		target.DisplayName = discovered.DisplayName
		target.TargetType = discovered.TargetType
		target.AccountClassification = defaultString(discovered.AccountClassification, "business")
		target.Status = status
		target.ScopeSnapshot = scopeSnapshot
		target.CapabilitySnapshot = capabilitySnapshot
		target.Metadata = targetMetadata
		target.UpdatedAt = now
		if value := strings.TrimSpace(discovered.ExternalParentID); value != "" {
			target.ExternalParentID = &value
		} else {
			target.ExternalParentID = nil
		}
		if value := strings.TrimSpace(discovered.Username); value != "" {
			target.Username = &value
		} else {
			target.Username = nil
		}
		if _, err := s.db.NewUpdate().
			Model(target).
			Column("connection_id", "display_name", "target_type", "account_classification", "status", "scope_snapshot", "capability_snapshot", "metadata", "external_parent_id", "username", "updated_at").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) providerSessionFromConnection(connection database.SocialConnection) (providerSession, error) {
	credential, err := s.resolveProviderCredential(context.Background(), connection.WorkspaceID, connection.Provider, connection.CredentialSource)
	if err != nil {
		return providerSession{}, err
	}
	accessToken, err := s.secretBox.Decrypt(connection.AccessTokenCiphertext)
	if err != nil {
		return providerSession{}, err
	}
	refreshToken, err := s.secretBox.Decrypt(connection.RefreshTokenCiphertext)
	if err != nil {
		return providerSession{}, err
	}
	return providerSession{
		Connection:   &connection,
		Credential:   credential,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Scopes:       parseJSONStringSlice(connection.Scopes),
	}, nil
}

func (s *Service) loadAssetBlobs(ctx context.Context, assets []resources.ResourceListItem) ([]assetBlob, error) {
	ids := make([]uuid.UUID, 0, len(assets))
	for _, asset := range assets {
		parsed, err := uuid.Parse(asset.ID)
		if err != nil {
			continue
		}
		ids = append(ids, parsed)
	}
	if len(ids) == 0 {
		return []assetBlob{}, nil
	}
	var rows []database.Resource
	if err := s.db.NewSelect().Model(&rows).Where("id IN (?)", bun.In(ids)).Scan(ctx); err != nil {
		return nil, err
	}
	byID := make(map[string]database.Resource, len(rows))
	for _, row := range rows {
		byID[row.ID.String()] = row
	}
	result := make([]assetBlob, 0, len(assets))
	for _, asset := range assets {
		row, ok := byID[asset.ID]
		if !ok {
			continue
		}
		publicURL := absoluteURL(s.cfg.PublicAssetBaseURL, asset.DownloadURL)
		resource := row
		result = append(result, assetBlob{
			ResourceID:   asset.ID,
			DisplayName:  asset.DisplayName,
			OriginalName: asset.OriginalName,
			MediaKind:    asset.MediaKind,
			MIMEType:     asset.MIMEType,
			SizeBytes:    asset.SizeBytes,
			PublicURL:    publicURL,
			Open: func(ctx context.Context) (io.ReadCloser, error) {
				return s.storage.Open(ctx, resource.StorageKey)
			},
		})
	}
	return result, nil
}

func (s *Service) ensurePublication(ctx context.Context, actorUserID, workspaceID, variantID uuid.UUID, socialTargetID *uuid.UUID, source string) (*database.PostVariantPublication, error) {
	row := new(database.PostVariantPublication)
	err := s.db.NewSelect().
		Model(row).
		Where("workspace_id = ?", workspaceID).
		Where("variant_id = ?", variantID).
		Limit(1).
		Scan(ctx)
	now := time.Now().UTC()
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		row = &database.PostVariantPublication{
			ID:               uuid.New(),
			WorkspaceID:      workspaceID,
			VariantID:        variantID,
			SocialTargetID:   socialTargetID,
			PublicationState: "unscheduled",
			Source:           source,
			Metadata:         "{}",
			CreatedByUserID:  &actorUserID,
			UpdatedByUserID:  &actorUserID,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if _, err := s.db.NewInsert().Model(row).Exec(ctx); err != nil {
			return nil, err
		}
		return row, nil
	}
	if socialTargetID != nil {
		row.SocialTargetID = socialTargetID
	}
	row.Source = defaultString(row.Source, source)
	return row, nil
}

func (s *Service) findConnection(ctx context.Context, workspaceID, connectionID uuid.UUID) (*database.SocialConnection, error) {
	row := new(database.SocialConnection)
	if err := s.db.NewSelect().Model(row).Where("workspace_id = ?", workspaceID).Where("id = ?", connectionID).Limit(1).Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return row, nil
}

func (s *Service) findTarget(ctx context.Context, workspaceID, targetID uuid.UUID) (*database.SocialTarget, error) {
	row := new(database.SocialTarget)
	if err := s.db.NewSelect().Model(row).Where("workspace_id = ?", workspaceID).Where("id = ?", targetID).Limit(1).Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return row, nil
}

func (s *Service) findSelectedTargetByPlatform(ctx context.Context, workspaceID uuid.UUID, provider string) (*database.SocialTarget, error) {
	row := new(database.SocialTarget)
	query := s.db.NewSelect().
		Model(row).
		Where("workspace_id = ?", workspaceID).
		Where("is_selected = ?", true).
		OrderExpr("updated_at DESC").
		Limit(1)
	if provider == "facebook" || provider == "instagram" {
		query = query.
			Where("provider = ?", "meta").
			Where("target_type = ?", metaTargetTypeForPlatform(provider))
	} else {
		query = query.Where("provider = ?", provider)
	}
	if err := query.Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return row, nil
}

func (s *Service) findPublicationByVariant(ctx context.Context, workspaceID, variantID uuid.UUID) (*database.PostVariantPublication, error) {
	row := new(database.PostVariantPublication)
	if err := s.db.NewSelect().Model(row).Where("workspace_id = ?", workspaceID).Where("variant_id = ?", variantID).Limit(1).Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return row, nil
}

func (s *Service) ensureMetricDefinition(ctx context.Context, code, platform, surface string) (*database.MetricDefinition, error) {
	row := new(database.MetricDefinition)
	err := s.db.NewSelect().
		Model(row).
		Where("code = ?", code).
		WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			q = q.Where("platform IS NULL")
			return q.WhereOr("platform = ? AND (surface IS NULL OR surface = ?)", platform, surface)
		}).
		OrderExpr("platform NULLS FIRST, surface NULLS FIRST").
		Limit(1).
		Scan(ctx)
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	now := time.Now().UTC()
	row = &database.MetricDefinition{
		ID:        uuid.New(),
		Code:      code,
		Label:     metricLabel(code),
		Unit:      "count",
		Rollup:    "latest",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if strings.TrimSpace(platform) != "" {
		row.Platform = &platform
	}
	if strings.TrimSpace(surface) != "" {
		row.Surface = &surface
	}
	if _, err := s.db.NewInsert().Model(row).Exec(ctx); err != nil {
		return nil, err
	}
	return row, nil
}

func buildPublishContent(variant posts.PostVariant, input PublishVariantInput) publishContent {
	content := publishContent{
		ContentKind: variant.ContentKind,
		Content:     variant.ContentPayload,
		Platform:    variant.Platform,
		Surface:     variant.Surface,
		Caption:     textBody(variant.ContentPayload),
		Title:       stringValue(variant.ContentPayload["title"]),
		Body:        textBody(variant.ContentPayload),
		TikTok:      input.TikTok,
	}
	if parsed, err := uuid.Parse(variant.ID); err == nil {
		content.VariantID = parsed
	}
	if variant.ContentKind == "thread" {
		items := make([]string, 0)
		if rawItems, ok := variant.ContentPayload["items"].([]any); ok {
			for _, item := range rawItems {
				if typed, ok := item.(map[string]any); ok {
					if body := textBody(typed); body != "" {
						items = append(items, body)
					}
				}
			}
		}
		content.ThreadItems = items
	}
	return content
}

func selectionScopeForTarget(target database.SocialTarget) string {
	if target.Provider != "meta" {
		return target.Provider
	}
	switch target.TargetType {
	case "facebook_page":
		return "facebook"
	case "instagram_professional":
		return "instagram"
	default:
		return target.Provider
	}
}

func metaTargetTypeForPlatform(platform string) string {
	switch strings.TrimSpace(platform) {
	case "facebook":
		return "facebook_page"
	case "instagram":
		return "instagram_professional"
	default:
		return ""
	}
}

func targetMatchesPlatform(target database.SocialTarget, platform string) bool {
	platform = strings.TrimSpace(platform)
	if target.Provider == platform {
		return true
	}
	if target.Provider != "meta" {
		return false
	}
	switch platform {
	case "facebook":
		return target.TargetType == "facebook_page"
	case "instagram":
		return target.TargetType == "instagram_professional"
	case "meta":
		return true
	default:
		return false
	}
}

func mapProviderCredentialRecord(record database.ProviderAppCredential) AppCredentialRecord {
	return AppCredentialRecord{
		ID:               record.ID.String(),
		WorkspaceID:      record.WorkspaceID.String(),
		Provider:         record.Provider,
		Source:           record.Source,
		Status:           record.Status,
		ClientID:         record.ClientID,
		ClientIDMasked:   maskClientID(record.ClientID),
		ClientSecretHint: record.ClientSecretHint,
		Metadata:         parseJSONMap(record.Metadata),
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
}

func mapSocialConnection(record database.SocialConnection) ConnectionRecord {
	item := ConnectionRecord{
		ID:               record.ID.String(),
		Provider:         record.Provider,
		CredentialSource: record.CredentialSource,
		Status:           record.Status,
		HealthStatus:     record.HealthStatus,
		AuthSubjectID:    record.AuthSubjectID,
		AuthSubjectName:  record.AuthSubjectName,
		Scopes:           parseJSONStringSlice(record.Scopes),
		Metadata:         parseJSONMap(record.Metadata),
		ConnectedAt:      record.ConnectedAt.Format(time.RFC3339),
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
		Targets:          []TargetRecord{},
	}
	if record.AccessTokenExpiresAt != nil {
		item.AccessTokenExpiresAt = record.AccessTokenExpiresAt.Format(time.RFC3339)
	}
	if record.LastValidatedAt != nil {
		item.LastValidatedAt = record.LastValidatedAt.Format(time.RFC3339)
	}
	if record.LastValidationError != nil {
		item.LastValidationError = *record.LastValidationError
	}
	return item
}

func mapSocialTarget(record database.SocialTarget) TargetRecord {
	item := TargetRecord{
		ID:                    record.ID.String(),
		ConnectionID:          record.ConnectionID.String(),
		Provider:              record.Provider,
		ExternalAccountID:     record.ExternalAccountID,
		DisplayName:           record.DisplayName,
		TargetType:            record.TargetType,
		AccountClassification: record.AccountClassification,
		Status:                record.Status,
		IsSelected:            record.IsSelected,
		ScopeSnapshot:         parseJSONStringSlice(record.ScopeSnapshot),
		CapabilitySnapshot:    parseJSONMap(record.CapabilitySnapshot),
		Metadata:              parseJSONMap(record.Metadata),
	}
	if record.ExternalParentID != nil {
		item.ExternalParentID = *record.ExternalParentID
	}
	if record.Username != nil {
		item.Username = *record.Username
	}
	if record.LastValidatedAt != nil {
		item.LastValidatedAt = record.LastValidatedAt.Format(time.RFC3339)
	}
	if record.LastValidationError != nil {
		item.LastValidationError = *record.LastValidationError
	}
	return item
}

func parseJSONMap(value string) map[string]any {
	if strings.TrimSpace(value) == "" || strings.TrimSpace(value) == "{}" {
		return map[string]any{}
	}
	out := map[string]any{}
	_ = json.Unmarshal([]byte(value), &out)
	return out
}

func parseJSONStringSlice(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	var out []string
	if err := json.Unmarshal([]byte(value), &out); err != nil {
		return []string{}
	}
	return out
}

func parseJSONAnyMap(value any) map[string]any {
	typed, ok := value.(map[string]any)
	if !ok || typed == nil {
		return map[string]any{}
	}
	return typed
}

func valueOrNil(value *bool) any {
	if value == nil {
		return nil
	}
	return *value
}

func marshalJSON(value any) (string, error) {
	if value == nil {
		return "{}", nil
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return "", fmt.Errorf("%w: invalid metadata payload", iam.ErrValidation)
	}
	return string(payload), nil
}

func marshalMustJSON(value any) string {
	if value == nil {
		return "{}"
	}
	payload, _ := json.Marshal(value)
	return string(payload)
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}

func ensureTargetRecords(items []TargetRecord) []TargetRecord {
	if len(items) == 0 {
		return []TargetRecord{}
	}
	return items
}

func ensureIssues(items []posts.ReadinessIssue) []posts.ReadinessIssue {
	if len(items) == 0 {
		return []posts.ReadinessIssue{}
	}
	return items
}

func textBody(payload map[string]any) string {
	if payload == nil {
		return ""
	}
	for _, key := range []string{"body", "caption", "text"} {
		if value, ok := payload[key]; ok {
			return strings.TrimSpace(fmt.Sprint(value))
		}
	}
	return ""
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func metricLabel(code string) string {
	parts := strings.FieldsFunc(code, func(r rune) bool {
		return r == '_' || r == '-'
	})
	for i, part := range parts {
		if part == "" {
			continue
		}
		parts[i] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func absoluteURL(base, maybeRelative string) string {
	base = strings.TrimSpace(base)
	maybeRelative = strings.TrimSpace(maybeRelative)
	if maybeRelative == "" {
		return ""
	}
	if strings.HasPrefix(maybeRelative, "http://") || strings.HasPrefix(maybeRelative, "https://") {
		return maybeRelative
	}
	if base == "" {
		return maybeRelative
	}
	baseURL, err := url.Parse(base)
	if err != nil {
		return maybeRelative
	}
	relativeURL, err := url.Parse(maybeRelative)
	if err != nil {
		return maybeRelative
	}
	return baseURL.ResolveReference(relativeURL).String()
}

func surfaceAllowed(capabilities map[string]any, surface string) bool {
	raw, ok := capabilities["allowedSurfaces"]
	if !ok {
		return true
	}
	switch typed := raw.(type) {
	case []string:
		for _, candidate := range typed {
			if candidate == surface {
				return true
			}
		}
	case []any:
		for _, candidate := range typed {
			if fmt.Sprint(candidate) == surface {
				return true
			}
		}
	default:
		return true
	}
	return false
}
