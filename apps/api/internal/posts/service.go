package posts

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/resources"
)

const (
	postAssetSlot         = "content_assets"
	postEntityType        = "post"
	postVariantEntityType = "post_variant"
)

type WorkspaceAuthorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
	ResolveWorkspaceID(principal *iam.Principal, requestedWorkspaceID string) (uuid.UUID, error)
}

type ResourceLibrary interface {
	ResolveResources(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, resourceIDs []uuid.UUID) ([]resources.ResourceListItem, error)
	SyncReferences(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, entityType, entityID, slot string, refs []resources.ReferenceInput) error
}

type Service struct {
	db         *bun.DB
	authorizer WorkspaceAuthorizer
	resources  ResourceLibrary
}

type UpsertPostInput struct {
	Title          string
	ContentKind    string
	ContentPayload map[string]any
	OriginPlatform string
	OriginSurface  string
	Notes          string
}

type UpsertVariantInput struct {
	Platform       string
	Surface        string
	ContentMode    string
	ContentKind    string
	ContentPayload map[string]any
	AssetMode      string
	Notes          string
}

type SyncAssetsInput struct {
	ResourceIDs                 []uuid.UUID
	AssetMode                   string
	RemovedInheritedResourceIDs []uuid.UUID
}

type ReviewInput struct {
	Comment string
}

type DecisionInput struct {
	ApprovalState string
	Comment       string
}

type UpsertPublicationInput struct {
	PublicationState  string
	PlannedAt         *time.Time
	PublishedAt       *time.Time
	ExternalPostID    string
	ExternalAccountID string
	Source            string
	LastError         string
	Metadata          map[string]any
}

type RecordMetricObservationInput struct {
	MetricCode string
	ObservedAt time.Time
	Value      float64
	Source     string
	Metadata   map[string]any
}

type MetricSnapshotItem struct {
	Code       string  `json:"code"`
	Label      string  `json:"label"`
	Unit       string  `json:"unit"`
	Rollup     string  `json:"rollup"`
	Value      float64 `json:"value"`
	ObservedAt string  `json:"observedAt"`
}

type ReviewRecord struct {
	ID            string `json:"id"`
	VariantID     string `json:"variantId"`
	ApprovalState string `json:"approvalState"`
	Decision      string `json:"decision"`
	Comment       string `json:"comment,omitempty"`
	ActorUserID   string `json:"actorUserId,omitempty"`
	CreatedAt     string `json:"createdAt"`
}

type PublicationPlan struct {
	ID                string         `json:"id"`
	VariantID         string         `json:"variantId"`
	PublicationState  string         `json:"publicationState"`
	PlannedAt         string         `json:"plannedAt,omitempty"`
	PublishedAt       string         `json:"publishedAt,omitempty"`
	ExternalPostID    string         `json:"externalPostId,omitempty"`
	ExternalAccountID string         `json:"externalAccountId,omitempty"`
	Source            string         `json:"source"`
	LastError         string         `json:"lastError,omitempty"`
	Metadata          map[string]any `json:"metadata,omitempty"`
	CreatedAt         string         `json:"createdAt"`
	UpdatedAt         string         `json:"updatedAt"`
}

type MetricDefinitionRecord struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Label    string `json:"label"`
	Unit     string `json:"unit"`
	Rollup   string `json:"rollup"`
	Platform string `json:"platform,omitempty"`
	Surface  string `json:"surface,omitempty"`
}

type MetricObservationRecord struct {
	ID            string         `json:"id"`
	PublicationID string         `json:"publicationId"`
	MetricCode    string         `json:"metricCode"`
	Label         string         `json:"label"`
	Unit          string         `json:"unit"`
	Rollup        string         `json:"rollup"`
	ObservedAt    string         `json:"observedAt"`
	Value         float64        `json:"value"`
	Source        string         `json:"source"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

type PostVariant struct {
	ID                          string                       `json:"id"`
	PostID                      string                       `json:"postId"`
	Platform                    string                       `json:"platform"`
	Surface                     string                       `json:"surface"`
	ContentMode                 string                       `json:"contentMode"`
	ContentKind                 string                       `json:"contentKind,omitempty"`
	ContentPayload              map[string]any               `json:"contentPayload,omitempty"`
	AssetMode                   string                       `json:"assetMode"`
	RemovedInheritedResourceIDs []string                     `json:"removedInheritedResourceIds,omitempty"`
	Assets                      []resources.ResourceListItem `json:"assets"`
	EffectiveAssets             []resources.ResourceListItem `json:"effectiveAssets"`
	ApprovalState               string                       `json:"approvalState"`
	LatestReview                *ReviewRecord                `json:"latestReview,omitempty"`
	ReviewHistory               []ReviewRecord               `json:"reviewHistory,omitempty"`
	LatestPublication           *PublicationPlan             `json:"latestPublication,omitempty"`
	MetricSnapshot              []MetricSnapshotItem         `json:"metricSnapshot,omitempty"`
	Notes                       string                       `json:"notes,omitempty"`
	CreatedAt                   string                       `json:"createdAt"`
	UpdatedAt                   string                       `json:"updatedAt"`
}

type PostSummary struct {
	ID                        string               `json:"id"`
	WorkspaceID               string               `json:"workspaceId"`
	Title                     string               `json:"title"`
	ContentKind               string               `json:"contentKind"`
	OriginPlatform            string               `json:"originPlatform,omitempty"`
	OriginSurface             string               `json:"originSurface,omitempty"`
	AggregateApprovalState    string               `json:"aggregateApprovalState"`
	AggregatePublicationState string               `json:"aggregatePublicationState"`
	VariantCount              int                  `json:"variantCount"`
	LatestPlannedAt           string               `json:"latestPlannedAt,omitempty"`
	MetricSnapshot            []MetricSnapshotItem `json:"metricSnapshot,omitempty"`
	CreatedAt                 string               `json:"createdAt"`
	UpdatedAt                 string               `json:"updatedAt"`
}

type PostDetail struct {
	PostSummary
	ContentPayload map[string]any               `json:"contentPayload"`
	Assets         []resources.ResourceListItem `json:"assets"`
	Variants       []PostVariant                `json:"variants"`
	Notes          string                       `json:"notes,omitempty"`
}

type metricSnapshotAccumulator struct {
	code       string
	label      string
	unit       string
	rollup     string
	value      float64
	observedAt time.Time
}

type metricObservationRow struct {
	ID            uuid.UUID `bun:"id"`
	PublicationID uuid.UUID `bun:"publication_id"`
	Code          string    `bun:"code"`
	Label         string    `bun:"label"`
	Unit          string    `bun:"unit"`
	Rollup        string    `bun:"rollup"`
	ObservedAt    time.Time `bun:"observed_at"`
	Value         float64   `bun:"value"`
	Source        string    `bun:"source"`
	Metadata      string    `bun:"metadata"`
}

func NewService(db *bun.DB, authorizer WorkspaceAuthorizer, resourceLibrary ResourceLibrary) *Service {
	return &Service{
		db:         db,
		authorizer: authorizer,
		resources:  resourceLibrary,
	}
}

func (s *Service) ListPosts(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]PostSummary, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}

	var records []database.Post
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return s.hydratePostSummaries(ctx, principal, workspaceID, records)
}

func (s *Service) GetPost(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID) (*PostDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}
	record, err := s.findPost(ctx, workspaceID, postID)
	if err != nil {
		return nil, err
	}
	details, err := s.hydratePostDetails(ctx, principal, workspaceID, []database.Post{*record})
	if err != nil {
		return nil, err
	}
	if len(details) == 0 {
		return nil, iam.ErrNotFound
	}
	return &details[0], nil
}

func (s *Service) CreatePost(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpsertPostInput) (*PostDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	payload, contentKind, originPlatform, originSurface, err := normalizePostInput(input)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	record := &database.Post{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		Title:           strings.TrimSpace(input.Title),
		ContentKind:     contentKind,
		ContentPayload:  payload,
		OriginPlatform:  originPlatform,
		OriginSurface:   originSurface,
		Notes:           strings.TrimSpace(input.Notes),
		CreatedByUserID: &principal.UserID,
		UpdatedByUserID: &principal.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
		return nil, err
	}
	return s.GetPost(ctx, principal, workspaceID, record.ID)
}

func (s *Service) UpdatePost(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID, input UpsertPostInput) (*PostDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	record, err := s.findPost(ctx, workspaceID, postID)
	if err != nil {
		return nil, err
	}
	payload, contentKind, originPlatform, originSurface, err := normalizePostInput(input)
	if err != nil {
		return nil, err
	}
	record.Title = strings.TrimSpace(input.Title)
	record.ContentKind = contentKind
	record.ContentPayload = payload
	record.OriginPlatform = originPlatform
	record.OriginSurface = originSurface
	record.Notes = strings.TrimSpace(input.Notes)
	record.UpdatedAt = time.Now().UTC()
	record.UpdatedByUserID = &principal.UserID
	if _, err := s.db.NewUpdate().
		Model(record).
		Column("title", "content_kind", "content_payload", "origin_platform", "origin_surface", "notes", "updated_at", "updated_by_user_id").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	return s.GetPost(ctx, principal, workspaceID, postID)
}

func (s *Service) DeletePost(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return err
	}
	record, err := s.findPost(ctx, workspaceID, postID)
	if err != nil {
		return err
	}
	_, err = s.db.NewDelete().Model(record).WherePK().Exec(ctx)
	return err
}

func (s *Service) SyncPostAssets(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID, resourceIDs []uuid.UUID) (*PostDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	if _, err := s.findPost(ctx, workspaceID, postID); err != nil {
		return nil, err
	}
	if err := s.resources.SyncReferences(ctx, principal, workspaceID, postEntityType, postID.String(), postAssetSlot, resourceIDsToReferenceInputs(resourceIDs)); err != nil {
		return nil, err
	}
	return s.GetPost(ctx, principal, workspaceID, postID)
}

func (s *Service) CreateVariant(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID, input UpsertVariantInput) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	if _, err := s.findPost(ctx, workspaceID, postID); err != nil {
		return nil, err
	}
	record, err := s.insertVariant(ctx, principal, workspaceID, postID, input)
	if err != nil {
		return nil, err
	}
	return s.GetVariant(ctx, principal, workspaceID, record.ID)
}

func (s *Service) GetVariant(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}
	record, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	postRecord, err := s.findPost(ctx, workspaceID, record.PostID)
	if err != nil {
		return nil, err
	}
	details, err := s.hydratePostDetails(ctx, principal, workspaceID, []database.Post{*postRecord})
	if err != nil {
		return nil, err
	}
	for _, detail := range details {
		for _, variant := range detail.Variants {
			if variant.ID == variantID.String() {
				return &variant, nil
			}
		}
	}
	return nil, iam.ErrNotFound
}

func (s *Service) UpdateVariant(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input UpsertVariantInput) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	record, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	contentMode, contentKind, contentPayload, assetMode, err := normalizeVariantInput(input)
	if err != nil {
		return nil, err
	}
	record.Platform = strings.TrimSpace(input.Platform)
	record.Surface = strings.TrimSpace(input.Surface)
	record.ContentMode = contentMode
	record.ContentKind = contentKind
	record.ContentPayload = contentPayload
	record.AssetMode = assetMode
	record.Notes = strings.TrimSpace(input.Notes)
	record.UpdatedAt = time.Now().UTC()
	record.UpdatedByUserID = &principal.UserID
	if _, err := s.db.NewUpdate().
		Model(record).
		Column("platform", "surface", "content_mode", "content_kind", "content_payload", "asset_mode", "notes", "updated_at", "updated_by_user_id").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	return s.GetVariant(ctx, principal, workspaceID, variantID)
}

func (s *Service) DeleteVariant(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return err
	}
	record, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return err
	}
	_, err = s.db.NewDelete().Model(record).WherePK().Exec(ctx)
	return err
}

func (s *Service) SyncVariantAssets(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input SyncAssetsInput) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	record, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	assetMode := strings.TrimSpace(input.AssetMode)
	if assetMode == "" {
		assetMode = record.AssetMode
	}
	if !slices.Contains([]string{"inherit", "replace"}, assetMode) {
		return nil, fmt.Errorf("%w: asset mode must be inherit or replace", iam.ErrValidation)
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		record.AssetMode = assetMode
		record.UpdatedAt = time.Now().UTC()
		record.UpdatedByUserID = &principal.UserID
		if _, err := tx.NewUpdate().
			Model(record).
			Column("asset_mode", "updated_at", "updated_by_user_id").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().
			Model((*database.PostVariantRemovedResource)(nil)).
			Where("variant_id = ?", variantID).
			Exec(ctx); err != nil {
			return err
		}
		if assetMode == "inherit" {
			now := time.Now().UTC()
			for _, removedID := range uniqueUUIDs(input.RemovedInheritedResourceIDs) {
				if _, err := tx.NewInsert().Model(&database.PostVariantRemovedResource{
					ID:         uuid.New(),
					VariantID:  variantID,
					ResourceID: removedID,
					CreatedAt:  now,
				}).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	if err := s.resources.SyncReferences(ctx, principal, workspaceID, postVariantEntityType, variantID.String(), postAssetSlot, resourceIDsToReferenceInputs(input.ResourceIDs)); err != nil {
		return nil, err
	}
	return s.GetVariant(ctx, principal, workspaceID, variantID)
}

func (s *Service) SubmitVariantReview(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input ReviewInput) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.manage"); err != nil {
		return nil, err
	}
	if _, err := s.recordReview(ctx, principal, workspaceID, variantID, "in_review", "submit", input.Comment); err != nil {
		return nil, err
	}
	return s.GetVariant(ctx, principal, workspaceID, variantID)
}

func (s *Service) DecideVariantReview(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input DecisionInput) (*PostVariant, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, err
	}
	state := strings.TrimSpace(input.ApprovalState)
	if !slices.Contains([]string{"approved", "changes_requested"}, state) {
		return nil, fmt.Errorf("%w: approval state must be approved or changes_requested", iam.ErrValidation)
	}
	if _, err := s.recordReview(ctx, principal, workspaceID, variantID, state, state, input.Comment); err != nil {
		return nil, err
	}
	return s.GetVariant(ctx, principal, workspaceID, variantID)
}

func (s *Service) UpsertPublicationPlan(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input UpsertPublicationInput) (*PublicationPlan, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, err
	}
	if _, err := s.findPostVariant(ctx, workspaceID, variantID); err != nil {
		return nil, err
	}
	publicationState := strings.TrimSpace(input.PublicationState)
	if publicationState == "" {
		publicationState = "unscheduled"
	}
	if !slices.Contains([]string{"unscheduled", "scheduled", "publishing", "published", "failed", "cancelled"}, publicationState) {
		return nil, fmt.Errorf("%w: invalid publication state", iam.ErrValidation)
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "manual"
	}
	metadata, err := marshalMetadata(input.Metadata)
	if err != nil {
		return nil, err
	}

	record := new(database.PostVariantPublication)
	err = s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("variant_id = ?", variantID).
		Limit(1).
		Scan(ctx)
	now := time.Now().UTC()
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		record = &database.PostVariantPublication{
			ID:               uuid.New(),
			WorkspaceID:      workspaceID,
			VariantID:        variantID,
			PublicationState: publicationState,
			PlannedAt:        input.PlannedAt,
			PublishedAt:      input.PublishedAt,
			Source:           source,
			Metadata:         metadata,
			CreatedByUserID:  &principal.UserID,
			UpdatedByUserID:  &principal.UserID,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if value := strings.TrimSpace(input.ExternalPostID); value != "" {
			record.ExternalPostID = &value
		}
		if value := strings.TrimSpace(input.ExternalAccountID); value != "" {
			record.ExternalAccountID = &value
		}
		if value := strings.TrimSpace(input.LastError); value != "" {
			record.LastError = &value
		}
		if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
			return nil, err
		}
		return mapPublicationPlan(*record), nil
	}

	record.PublicationState = publicationState
	record.PlannedAt = input.PlannedAt
	record.PublishedAt = input.PublishedAt
	record.Source = source
	record.Metadata = metadata
	record.ExternalPostID = nil
	record.ExternalAccountID = nil
	record.LastError = nil
	record.UpdatedAt = now
	record.UpdatedByUserID = &principal.UserID
	if value := strings.TrimSpace(input.ExternalPostID); value != "" {
		record.ExternalPostID = &value
	}
	if value := strings.TrimSpace(input.ExternalAccountID); value != "" {
		record.ExternalAccountID = &value
	}
	if value := strings.TrimSpace(input.LastError); value != "" {
		record.LastError = &value
	}
	if _, err := s.db.NewUpdate().
		Model(record).
		Column("publication_state", "planned_at", "published_at", "external_post_id", "external_account_id", "source", "last_error", "metadata", "updated_at", "updated_by_user_id").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	return mapPublicationPlan(*record), nil
}

func (s *Service) DeletePublicationPlan(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return err
	}
	_, err := s.db.NewDelete().
		Model((*database.PostVariantPublication)(nil)).
		Where("workspace_id = ?", workspaceID).
		Where("variant_id = ?", variantID).
		Exec(ctx)
	return err
}

func (s *Service) ListMetricDefinitions(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, platform, surface string) ([]MetricDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}
	platform = strings.TrimSpace(platform)
	surface = strings.TrimSpace(surface)

	var records []database.MetricDefinition
	query := s.db.NewSelect().
		Model(&records).
		OrderExpr("code ASC")
	if platform != "" {
		query = query.WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			q = q.Where("platform IS NULL")
			return q.WhereOr("platform = ? AND (surface IS NULL OR surface = ?)", platform, surface)
		})
	}
	if err := query.Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	items := make([]MetricDefinitionRecord, 0, len(records))
	for _, record := range records {
		items = append(items, mapMetricDefinition(record))
	}
	return items, nil
}

func (s *Service) RecordMetricObservation(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, input RecordMetricObservationInput) (*MetricObservationRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, err
	}
	variant, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	publication, err := s.findPublicationByVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	definition, err := s.resolveMetricDefinition(ctx, strings.TrimSpace(input.MetricCode), variant.Platform, variant.Surface)
	if err != nil {
		return nil, err
	}
	if input.ObservedAt.IsZero() {
		input.ObservedAt = time.Now().UTC()
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "manual"
	}
	metadata, err := marshalMetadata(input.Metadata)
	if err != nil {
		return nil, err
	}
	record := &database.MetricObservation{
		ID:                 uuid.New(),
		WorkspaceID:        workspaceID,
		PublicationID:      publication.ID,
		MetricDefinitionID: definition.ID,
		ObservedAt:         input.ObservedAt.UTC(),
		Value:              input.Value,
		Source:             source,
		Metadata:           metadata,
		CreatedByUserID:    &principal.UserID,
		CreatedAt:          time.Now().UTC(),
	}
	if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
		return nil, err
	}
	return &MetricObservationRecord{
		ID:            record.ID.String(),
		PublicationID: publication.ID.String(),
		MetricCode:    definition.Code,
		Label:         definition.Label,
		Unit:          definition.Unit,
		Rollup:        definition.Rollup,
		ObservedAt:    record.ObservedAt.Format(time.RFC3339),
		Value:         record.Value,
		Source:        record.Source,
		Metadata:      parseMetadata(record.Metadata),
	}, nil
}

func (s *Service) ListMetricObservations(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID) ([]MetricObservationRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.view"); err != nil {
		return nil, err
	}
	if _, err := s.findPostVariant(ctx, workspaceID, variantID); err != nil {
		return nil, err
	}
	publication, err := s.findPublicationByVariant(ctx, workspaceID, variantID)
	if err != nil {
		if errors.Is(err, iam.ErrNotFound) {
			return []MetricObservationRecord{}, nil
		}
		return nil, err
	}
	rows, err := s.loadMetricObservationRows(ctx, []uuid.UUID{publication.ID})
	if err != nil {
		return nil, err
	}
	items := make([]MetricObservationRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, MetricObservationRecord{
			ID:            row.ID.String(),
			PublicationID: row.PublicationID.String(),
			MetricCode:    row.Code,
			Label:         row.Label,
			Unit:          row.Unit,
			Rollup:        row.Rollup,
			ObservedAt:    row.ObservedAt.Format(time.RFC3339),
			Value:         row.Value,
			Source:        row.Source,
			Metadata:      parseMetadata(row.Metadata),
		})
	}
	return items, nil
}

func (s *Service) insertVariant(ctx context.Context, principal *iam.Principal, workspaceID, postID uuid.UUID, input UpsertVariantInput) (*database.PostVariant, error) {
	contentMode, contentKind, contentPayload, assetMode, err := normalizeVariantInput(input)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	record := &database.PostVariant{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		PostID:          postID,
		Platform:        strings.TrimSpace(input.Platform),
		Surface:         strings.TrimSpace(input.Surface),
		ContentMode:     contentMode,
		ContentKind:     contentKind,
		ContentPayload:  contentPayload,
		AssetMode:       assetMode,
		ApprovalState:   "draft",
		Notes:           strings.TrimSpace(input.Notes),
		CreatedByUserID: &principal.UserID,
		UpdatedByUserID: &principal.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "post_variants_workspace_id_post_id_platform_surface_key") {
			return nil, fmt.Errorf("%w: a variant already exists for this platform and surface", iam.ErrConflict)
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) recordReview(ctx context.Context, principal *iam.Principal, workspaceID, variantID uuid.UUID, approvalState, decision, comment string) (*database.PostVariantReview, error) {
	variant, err := s.findPostVariant(ctx, workspaceID, variantID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	record := &database.PostVariantReview{
		ID:            uuid.New(),
		WorkspaceID:   workspaceID,
		VariantID:     variantID,
		ApprovalState: approvalState,
		Decision:      decision,
		Comment:       strings.TrimSpace(comment),
		ActorUserID:   &principal.UserID,
		CreatedAt:     now,
	}
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		variant.ApprovalState = approvalState
		variant.UpdatedAt = now
		variant.UpdatedByUserID = &principal.UserID
		if _, err := tx.NewUpdate().
			Model(variant).
			Column("approval_state", "updated_at", "updated_by_user_id").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewInsert().Model(record).Exec(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	return record, nil
}

func (s *Service) hydratePostSummaries(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, posts []database.Post) ([]PostSummary, error) {
	if len(posts) == 0 {
		return []PostSummary{}, nil
	}
	details, err := s.hydratePostDetails(ctx, principal, workspaceID, posts)
	if err != nil {
		return nil, err
	}
	items := make([]PostSummary, 0, len(details))
	for _, detail := range details {
		items = append(items, detail.PostSummary)
	}
	return items, nil
}

func (s *Service) hydratePostDetails(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, posts []database.Post) ([]PostDetail, error) {
	if len(posts) == 0 {
		return []PostDetail{}, nil
	}

	postIDs := make([]uuid.UUID, 0, len(posts))
	for _, record := range posts {
		postIDs = append(postIDs, record.ID)
	}
	rootAssetIDs, err := s.loadReferenceResourceIDs(ctx, workspaceID, postEntityType, uuidStrings(postIDs), postAssetSlot)
	if err != nil {
		return nil, err
	}
	variantRecords, err := s.loadVariantsByPostIDs(ctx, workspaceID, postIDs)
	if err != nil {
		return nil, err
	}
	variantIDs := make([]uuid.UUID, 0, len(variantRecords))
	for _, variant := range variantRecords {
		variantIDs = append(variantIDs, variant.ID)
	}
	variantAssetIDs, err := s.loadReferenceResourceIDs(ctx, workspaceID, postVariantEntityType, uuidStrings(variantIDs), postAssetSlot)
	if err != nil {
		return nil, err
	}
	removedByVariant, err := s.loadRemovedInheritedResources(ctx, variantIDs)
	if err != nil {
		return nil, err
	}
	reviewsByVariant, latestReviewByVariant, err := s.loadReviews(ctx, variantIDs)
	if err != nil {
		return nil, err
	}
	publicationsByVariant, err := s.loadPublications(ctx, workspaceID, variantIDs)
	if err != nil {
		return nil, err
	}

	publicationIDs := make([]uuid.UUID, 0, len(publicationsByVariant))
	for _, publication := range publicationsByVariant {
		publicationIDs = append(publicationIDs, publication.ID)
	}
	metricSnapshotsByPublication, err := s.loadMetricSnapshots(ctx, publicationIDs)
	if err != nil {
		return nil, err
	}

	rootAssetCache := map[string][]resources.ResourceListItem{}
	for _, record := range posts {
		items, err := s.resources.ResolveResources(ctx, principal, workspaceID, rootAssetIDs[record.ID.String()])
		if err != nil {
			return nil, err
		}
		rootAssetCache[record.ID.String()] = items
	}
	variantAssetCache := map[string][]resources.ResourceListItem{}
	for _, variant := range variantRecords {
		items, err := s.resources.ResolveResources(ctx, principal, workspaceID, variantAssetIDs[variant.ID.String()])
		if err != nil {
			return nil, err
		}
		variantAssetCache[variant.ID.String()] = items
	}

	variantsByPost := map[string][]PostVariant{}
	for _, variantRecord := range variantRecords {
		rootAssets := rootAssetCache[variantRecord.PostID.String()]
		variantAssets := variantAssetCache[variantRecord.ID.String()]
		effectiveAssets := resolveEffectiveAssets(rootAssets, variantAssets, variantRecord.AssetMode, removedByVariant[variantRecord.ID.String()])
		var latestReview *ReviewRecord
		if review := latestReviewByVariant[variantRecord.ID.String()]; review != nil {
			mapped := mapReviewRecord(*review)
			latestReview = &mapped
		}
		var latestPublication *PublicationPlan
		if publication := publicationsByVariant[variantRecord.ID.String()]; publication != nil {
			latestPublication = mapPublicationPlan(*publication)
		}
		variantsByPost[variantRecord.PostID.String()] = append(variantsByPost[variantRecord.PostID.String()], PostVariant{
			ID:                          variantRecord.ID.String(),
			PostID:                      variantRecord.PostID.String(),
			Platform:                    variantRecord.Platform,
			Surface:                     variantRecord.Surface,
			ContentMode:                 variantRecord.ContentMode,
			ContentKind:                 derefString(variantRecord.ContentKind),
			ContentPayload:              parseMetadata(variantRecord.ContentPayload),
			AssetMode:                   variantRecord.AssetMode,
			RemovedInheritedResourceIDs: removedByVariant[variantRecord.ID.String()],
			Assets:                      variantAssets,
			EffectiveAssets:             effectiveAssets,
			ApprovalState:               variantRecord.ApprovalState,
			LatestReview:                latestReview,
			ReviewHistory:               mapReviewRecords(reviewsByVariant[variantRecord.ID.String()]),
			LatestPublication:           latestPublication,
			MetricSnapshot:              metricSnapshotsByPublication[publicationIDString(publicationsByVariant[variantRecord.ID.String()])],
			Notes:                       variantRecord.Notes,
			CreatedAt:                   variantRecord.CreatedAt.Format(time.RFC3339),
			UpdatedAt:                   variantRecord.UpdatedAt.Format(time.RFC3339),
		})
	}

	items := make([]PostDetail, 0, len(posts))
	for _, record := range posts {
		variants := variantsByPost[record.ID.String()]
		summary := PostSummary{
			ID:                        record.ID.String(),
			WorkspaceID:               record.WorkspaceID.String(),
			Title:                     record.Title,
			ContentKind:               record.ContentKind,
			AggregateApprovalState:    aggregateApprovalState(variants),
			AggregatePublicationState: aggregatePublicationState(variants),
			VariantCount:              len(variants),
			MetricSnapshot:            aggregateMetricSnapshot(variants),
			CreatedAt:                 record.CreatedAt.Format(time.RFC3339),
			UpdatedAt:                 record.UpdatedAt.Format(time.RFC3339),
		}
		if record.OriginPlatform != nil {
			summary.OriginPlatform = *record.OriginPlatform
		}
		if record.OriginSurface != nil {
			summary.OriginSurface = *record.OriginSurface
		}
		if latest := latestPlannedAt(variants); !latest.IsZero() {
			summary.LatestPlannedAt = latest.Format(time.RFC3339)
		}
		items = append(items, PostDetail{
			PostSummary:    summary,
			ContentPayload: parseMetadata(record.ContentPayload),
			Assets:         rootAssetCache[record.ID.String()],
			Variants:       variants,
			Notes:          record.Notes,
		})
	}
	return items, nil
}

func (s *Service) loadVariantsByPostIDs(ctx context.Context, workspaceID uuid.UUID, postIDs []uuid.UUID) ([]database.PostVariant, error) {
	if len(postIDs) == 0 {
		return []database.PostVariant{}, nil
	}
	var records []database.PostVariant
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		Where("post_id IN (?)", bun.In(postIDs)).
		OrderExpr("created_at ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return records, nil
}

func (s *Service) loadReferenceResourceIDs(ctx context.Context, workspaceID uuid.UUID, entityType string, entityIDs []string, slot string) (map[string][]uuid.UUID, error) {
	result := map[string][]uuid.UUID{}
	if len(entityIDs) == 0 {
		return result, nil
	}
	var refs []database.ResourceReference
	if err := s.db.NewSelect().
		Model(&refs).
		Where("workspace_id = ?", workspaceID).
		Where("entity_type = ?", entityType).
		Where("entity_id IN (?)", bun.In(entityIDs)).
		Where("slot = ?", slot).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, ref := range refs {
		result[ref.EntityID] = append(result[ref.EntityID], ref.ResourceID)
	}
	return result, nil
}

func (s *Service) loadRemovedInheritedResources(ctx context.Context, variantIDs []uuid.UUID) (map[string][]string, error) {
	result := map[string][]string{}
	if len(variantIDs) == 0 {
		return result, nil
	}
	var records []database.PostVariantRemovedResource
	if err := s.db.NewSelect().
		Model(&records).
		Where("variant_id IN (?)", bun.In(variantIDs)).
		OrderExpr("created_at ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, record := range records {
		result[record.VariantID.String()] = append(result[record.VariantID.String()], record.ResourceID.String())
	}
	return result, nil
}

func (s *Service) loadReviews(ctx context.Context, variantIDs []uuid.UUID) (map[string][]database.PostVariantReview, map[string]*database.PostVariantReview, error) {
	grouped := map[string][]database.PostVariantReview{}
	latest := map[string]*database.PostVariantReview{}
	if len(variantIDs) == 0 {
		return grouped, latest, nil
	}
	var records []database.PostVariantReview
	if err := s.db.NewSelect().
		Model(&records).
		Where("variant_id IN (?)", bun.In(variantIDs)).
		OrderExpr("created_at ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, nil, err
	}
	for index := range records {
		record := records[index]
		grouped[record.VariantID.String()] = append(grouped[record.VariantID.String()], record)
		copy := record
		latest[record.VariantID.String()] = &copy
	}
	return grouped, latest, nil
}

func (s *Service) loadPublications(ctx context.Context, workspaceID uuid.UUID, variantIDs []uuid.UUID) (map[string]*database.PostVariantPublication, error) {
	result := map[string]*database.PostVariantPublication{}
	if len(variantIDs) == 0 {
		return result, nil
	}
	var records []database.PostVariantPublication
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		Where("variant_id IN (?)", bun.In(variantIDs)).
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for index := range records {
		record := records[index]
		copy := record
		result[record.VariantID.String()] = &copy
	}
	return result, nil
}

func (s *Service) loadMetricSnapshots(ctx context.Context, publicationIDs []uuid.UUID) (map[string][]MetricSnapshotItem, error) {
	result := map[string][]MetricSnapshotItem{}
	if len(publicationIDs) == 0 {
		return result, nil
	}
	rows, err := s.loadMetricObservationRows(ctx, publicationIDs)
	if err != nil {
		return nil, err
	}
	latestByPublication := map[string]map[string]metricSnapshotAccumulator{}
	for _, row := range rows {
		publicationID := row.PublicationID.String()
		if _, ok := latestByPublication[publicationID]; !ok {
			latestByPublication[publicationID] = map[string]metricSnapshotAccumulator{}
		}
		current, ok := latestByPublication[publicationID][row.Code]
		if ok && !row.ObservedAt.After(current.observedAt) {
			continue
		}
		latestByPublication[publicationID][row.Code] = metricSnapshotAccumulator{
			code:       row.Code,
			label:      row.Label,
			unit:       row.Unit,
			rollup:     row.Rollup,
			value:      row.Value,
			observedAt: row.ObservedAt,
		}
	}
	for publicationID, metrics := range latestByPublication {
		codes := make([]string, 0, len(metrics))
		for code := range metrics {
			codes = append(codes, code)
		}
		slices.Sort(codes)
		snapshot := make([]MetricSnapshotItem, 0, len(codes))
		for _, code := range codes {
			item := metrics[code]
			snapshot = append(snapshot, MetricSnapshotItem{
				Code:       item.code,
				Label:      item.label,
				Unit:       item.unit,
				Rollup:     item.rollup,
				Value:      item.value,
				ObservedAt: item.observedAt.Format(time.RFC3339),
			})
		}
		result[publicationID] = snapshot
	}
	return result, nil
}

func (s *Service) loadMetricObservationRows(ctx context.Context, publicationIDs []uuid.UUID) ([]metricObservationRow, error) {
	var rows []metricObservationRow
	if err := s.db.NewSelect().
		TableExpr("metric_observations AS mo").
		ColumnExpr("mo.id").
		ColumnExpr("mo.publication_id").
		ColumnExpr("md.code").
		ColumnExpr("md.label").
		ColumnExpr("md.unit").
		ColumnExpr("md.rollup").
		ColumnExpr("mo.observed_at").
		ColumnExpr("mo.value").
		ColumnExpr("mo.source").
		ColumnExpr("mo.metadata").
		Join("JOIN metric_definitions AS md ON md.id = mo.metric_definition_id").
		Where("mo.publication_id IN (?)", bun.In(publicationIDs)).
		OrderExpr("mo.observed_at DESC").
		Scan(ctx, &rows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return rows, nil
}

func (s *Service) resolveMetricDefinition(ctx context.Context, metricCode, platform, surface string) (*database.MetricDefinition, error) {
	if metricCode == "" {
		return nil, fmt.Errorf("%w: metric code is required", iam.ErrValidation)
	}
	record := new(database.MetricDefinition)
	if err := s.db.NewSelect().
		Model(record).
		Where("code = ?", metricCode).
		WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			q = q.Where("(platform = ? AND surface = ?)", platform, surface)
			return q.WhereOr("(platform IS NULL AND surface IS NULL)")
		}).
		OrderExpr("platform IS NULL ASC").
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("%w: metric definition not found", iam.ErrNotFound)
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findPost(ctx context.Context, workspaceID, postID uuid.UUID) (*database.Post, error) {
	record := new(database.Post)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", postID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findPostVariant(ctx context.Context, workspaceID, variantID uuid.UUID) (*database.PostVariant, error) {
	record := new(database.PostVariant)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", variantID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findPublicationByVariant(ctx context.Context, workspaceID, variantID uuid.UUID) (*database.PostVariantPublication, error) {
	record := new(database.PostVariantPublication)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("variant_id = ?", variantID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func normalizePostInput(input UpsertPostInput) (string, string, *string, *string, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return "", "", nil, nil, fmt.Errorf("%w: title is required", iam.ErrValidation)
	}
	contentPayload, contentKind, err := normalizeContentPayload(strings.TrimSpace(input.ContentKind), input.ContentPayload)
	if err != nil {
		return "", "", nil, nil, err
	}
	var originPlatform *string
	var originSurface *string
	if value := strings.TrimSpace(input.OriginPlatform); value != "" {
		originPlatform = &value
	}
	if value := strings.TrimSpace(input.OriginSurface); value != "" {
		if originPlatform == nil {
			return "", "", nil, nil, fmt.Errorf("%w: origin platform is required when origin surface is set", iam.ErrValidation)
		}
		originSurface = &value
	}
	return contentPayload, contentKind, originPlatform, originSurface, nil
}

func normalizeVariantInput(input UpsertVariantInput) (string, *string, string, string, error) {
	platform := strings.TrimSpace(input.Platform)
	surface := strings.TrimSpace(input.Surface)
	if platform == "" || surface == "" {
		return "", nil, "", "", fmt.Errorf("%w: platform and surface are required", iam.ErrValidation)
	}
	contentMode := strings.TrimSpace(input.ContentMode)
	if contentMode == "" {
		contentMode = "inherit"
	}
	if !slices.Contains([]string{"inherit", "custom"}, contentMode) {
		return "", nil, "", "", fmt.Errorf("%w: content mode must be inherit or custom", iam.ErrValidation)
	}
	assetMode := strings.TrimSpace(input.AssetMode)
	if assetMode == "" {
		assetMode = "inherit"
	}
	if !slices.Contains([]string{"inherit", "replace"}, assetMode) {
		return "", nil, "", "", fmt.Errorf("%w: asset mode must be inherit or replace", iam.ErrValidation)
	}
	if contentMode == "inherit" {
		return contentMode, nil, "{}", assetMode, nil
	}
	contentPayload, contentKind, err := normalizeContentPayload(strings.TrimSpace(input.ContentKind), input.ContentPayload)
	if err != nil {
		return "", nil, "", "", err
	}
	return contentMode, &contentKind, contentPayload, assetMode, nil
}

func normalizeContentPayload(contentKind string, payload map[string]any) (string, string, error) {
	switch contentKind {
	case "text":
		body, _ := payload["body"].(string)
		return marshalMust(map[string]any{"body": body}), contentKind, nil
	case "article":
		title, _ := payload["title"].(string)
		body, _ := payload["body"].(string)
		return marshalMust(map[string]any{"title": title, "body": body}), contentKind, nil
	case "thread":
		items := make([]map[string]any, 0)
		switch raw := payload["items"].(type) {
		case []any:
			for _, item := range raw {
				typed, _ := item.(map[string]any)
				body, _ := typed["body"].(string)
				items = append(items, map[string]any{"body": body})
			}
		case []map[string]any:
			for _, item := range raw {
				body, _ := item["body"].(string)
				items = append(items, map[string]any{"body": body})
			}
		}
		return marshalMust(map[string]any{"items": items}), contentKind, nil
	default:
		return "", "", fmt.Errorf("%w: content kind must be text, article, or thread", iam.ErrValidation)
	}
}

func resolveEffectiveAssets(rootAssets, variantAssets []resources.ResourceListItem, assetMode string, removedIDs []string) []resources.ResourceListItem {
	if assetMode == "replace" {
		return append([]resources.ResourceListItem{}, variantAssets...)
	}
	removed := make(map[string]struct{}, len(removedIDs))
	for _, id := range removedIDs {
		removed[id] = struct{}{}
	}
	effective := make([]resources.ResourceListItem, 0, len(rootAssets)+len(variantAssets))
	seen := make(map[string]struct{}, len(rootAssets)+len(variantAssets))
	for _, item := range rootAssets {
		if _, ok := removed[item.ID]; ok {
			continue
		}
		effective = append(effective, item)
		seen[item.ID] = struct{}{}
	}
	for _, item := range variantAssets {
		if _, ok := seen[item.ID]; ok {
			continue
		}
		effective = append(effective, item)
		seen[item.ID] = struct{}{}
	}
	return effective
}

func aggregateApprovalState(variants []PostVariant) string {
	if len(variants) == 0 {
		return "draft"
	}
	states := make([]string, 0, len(variants))
	for _, variant := range variants {
		states = append(states, variant.ApprovalState)
	}
	switch {
	case slices.Contains(states, "changes_requested"):
		return "changes_requested"
	case slices.Contains(states, "in_review"):
		return "in_review"
	case allEqual(states, "approved"):
		return "approved"
	default:
		return "draft"
	}
}

func aggregatePublicationState(variants []PostVariant) string {
	if len(variants) == 0 {
		return "unscheduled"
	}
	states := make([]string, 0, len(variants))
	for _, variant := range variants {
		if variant.LatestPublication != nil {
			states = append(states, variant.LatestPublication.PublicationState)
		} else {
			states = append(states, "unscheduled")
		}
	}
	switch {
	case slices.Contains(states, "failed"):
		return "failed"
	case slices.Contains(states, "publishing"):
		return "publishing"
	case slices.Contains(states, "scheduled"):
		return "scheduled"
	case allEqual(states, "published"):
		return "published"
	case allEqual(states, "cancelled"):
		return "cancelled"
	default:
		return "unscheduled"
	}
}

func aggregateMetricSnapshot(variants []PostVariant) []MetricSnapshotItem {
	accumulators := map[string]metricSnapshotAccumulator{}
	for _, variant := range variants {
		for _, metric := range variant.MetricSnapshot {
			observedAt, _ := time.Parse(time.RFC3339, metric.ObservedAt)
			current, ok := accumulators[metric.Code]
			if !ok {
				accumulators[metric.Code] = metricSnapshotAccumulator{
					code:       metric.Code,
					label:      metric.Label,
					unit:       metric.Unit,
					rollup:     metric.Rollup,
					value:      metric.Value,
					observedAt: observedAt,
				}
				continue
			}
			if metric.Rollup == "sum" {
				current.value += metric.Value
				if observedAt.After(current.observedAt) {
					current.observedAt = observedAt
				}
				accumulators[metric.Code] = current
				continue
			}
			if observedAt.After(current.observedAt) {
				accumulators[metric.Code] = metricSnapshotAccumulator{
					code:       metric.Code,
					label:      metric.Label,
					unit:       metric.Unit,
					rollup:     metric.Rollup,
					value:      metric.Value,
					observedAt: observedAt,
				}
			}
		}
	}
	if len(accumulators) == 0 {
		return nil
	}
	codes := make([]string, 0, len(accumulators))
	for code := range accumulators {
		codes = append(codes, code)
	}
	slices.Sort(codes)
	items := make([]MetricSnapshotItem, 0, len(codes))
	for _, code := range codes {
		item := accumulators[code]
		items = append(items, MetricSnapshotItem{
			Code:       item.code,
			Label:      item.label,
			Unit:       item.unit,
			Rollup:     item.rollup,
			Value:      item.value,
			ObservedAt: item.observedAt.Format(time.RFC3339),
		})
	}
	return items
}

func latestPlannedAt(variants []PostVariant) time.Time {
	var latest time.Time
	for _, variant := range variants {
		if variant.LatestPublication == nil || variant.LatestPublication.PlannedAt == "" {
			continue
		}
		plannedAt, err := time.Parse(time.RFC3339, variant.LatestPublication.PlannedAt)
		if err != nil {
			continue
		}
		if plannedAt.After(latest) {
			latest = plannedAt
		}
	}
	return latest
}

func resourceIDsToReferenceInputs(resourceIDs []uuid.UUID) []resources.ReferenceInput {
	result := make([]resources.ReferenceInput, 0, len(resourceIDs))
	for _, resourceID := range uniqueUUIDs(resourceIDs) {
		result = append(result, resources.ReferenceInput{ResourceID: resourceID})
	}
	return result
}

func mapReviewRecord(record database.PostVariantReview) ReviewRecord {
	item := ReviewRecord{
		ID:            record.ID.String(),
		VariantID:     record.VariantID.String(),
		ApprovalState: record.ApprovalState,
		Decision:      record.Decision,
		Comment:       record.Comment,
		CreatedAt:     record.CreatedAt.Format(time.RFC3339),
	}
	if record.ActorUserID != nil {
		item.ActorUserID = record.ActorUserID.String()
	}
	return item
}

func mapReviewRecords(records []database.PostVariantReview) []ReviewRecord {
	items := make([]ReviewRecord, 0, len(records))
	for _, record := range records {
		items = append(items, mapReviewRecord(record))
	}
	return items
}

func mapPublicationPlan(record database.PostVariantPublication) *PublicationPlan {
	item := &PublicationPlan{
		ID:               record.ID.String(),
		VariantID:        record.VariantID.String(),
		PublicationState: record.PublicationState,
		Source:           record.Source,
		Metadata:         parseMetadata(record.Metadata),
		CreatedAt:        record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        record.UpdatedAt.Format(time.RFC3339),
	}
	if record.PlannedAt != nil {
		item.PlannedAt = record.PlannedAt.Format(time.RFC3339)
	}
	if record.PublishedAt != nil {
		item.PublishedAt = record.PublishedAt.Format(time.RFC3339)
	}
	if record.ExternalPostID != nil {
		item.ExternalPostID = *record.ExternalPostID
	}
	if record.ExternalAccountID != nil {
		item.ExternalAccountID = *record.ExternalAccountID
	}
	if record.LastError != nil {
		item.LastError = *record.LastError
	}
	return item
}

func mapMetricDefinition(record database.MetricDefinition) MetricDefinitionRecord {
	item := MetricDefinitionRecord{
		ID:     record.ID.String(),
		Code:   record.Code,
		Label:  record.Label,
		Unit:   record.Unit,
		Rollup: record.Rollup,
	}
	if record.Platform != nil {
		item.Platform = *record.Platform
	}
	if record.Surface != nil {
		item.Surface = *record.Surface
	}
	return item
}

func marshalMetadata(metadata map[string]any) (string, error) {
	if len(metadata) == 0 {
		return "{}", nil
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return "", fmt.Errorf("%w: invalid metadata payload", iam.ErrValidation)
	}
	return string(payload), nil
}

func parseMetadata(payload string) map[string]any {
	if strings.TrimSpace(payload) == "" || payload == "{}" {
		return map[string]any{}
	}
	metadata := map[string]any{}
	_ = json.Unmarshal([]byte(payload), &metadata)
	return metadata
}

func marshalMust(value map[string]any) string {
	payload, _ := json.Marshal(value)
	return string(payload)
}

func uuidStrings(values []uuid.UUID) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, value.String())
	}
	return result
}

func uniqueUUIDs(values []uuid.UUID) []uuid.UUID {
	result := make([]uuid.UUID, 0, len(values))
	seen := make(map[uuid.UUID]struct{}, len(values))
	for _, value := range values {
		if value == uuid.Nil {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func allEqual(values []string, target string) bool {
	if len(values) == 0 {
		return false
	}
	for _, value := range values {
		if value != target {
			return false
		}
	}
	return true
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func publicationIDString(record *database.PostVariantPublication) string {
	if record == nil {
		return ""
	}
	return record.ID.String()
}
