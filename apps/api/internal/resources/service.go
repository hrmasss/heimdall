package resources

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
)

type WorkspaceAuthorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
	ResolveWorkspaceID(principal *iam.Principal, requestedWorkspaceID string) (uuid.UUID, error)
}

type Service struct {
	db           *bun.DB
	cfg          config.StorageConfig
	storage      Storage
	authorizer   WorkspaceAuthorizer
	capabilities CapabilityMatrix
}

type UploadInput struct {
	DisplayName     string
	OriginalName    string
	ContentType     string
	SourceType      string
	Optimize        *bool
	TransformRecipe string
	Body            io.Reader
}

type UpdateInput struct {
	DisplayName string
}

type ReferenceInput struct {
	ResourceID uuid.UUID
	Metadata   map[string]any
}

type ResourceListItem struct {
	ID               string                  `json:"id"`
	WorkspaceID      string                  `json:"workspaceId"`
	ParentResourceID string                  `json:"parentResourceId,omitempty"`
	MediaKind        string                  `json:"mediaKind"`
	SourceType       string                  `json:"sourceType"`
	LifecycleStatus  string                  `json:"lifecycleStatus"`
	DisplayName      string                  `json:"displayName"`
	OriginalName     string                  `json:"originalName"`
	MIMEType         string                  `json:"mimeType"`
	FileExtension    string                  `json:"fileExtension"`
	ChecksumSHA256   string                  `json:"checksumSha256"`
	SizeBytes        int64                   `json:"sizeBytes"`
	WidthPx          *int                    `json:"widthPx,omitempty"`
	HeightPx         *int                    `json:"heightPx,omitempty"`
	DurationMS       *int64                  `json:"durationMs,omitempty"`
	PageCount        *int                    `json:"pageCount,omitempty"`
	FrameRate        *float64                `json:"frameRate,omitempty"`
	HasAudio         *bool                   `json:"hasAudio,omitempty"`
	Optimized        bool                    `json:"optimized"`
	StorageBackend   string                  `json:"storageBackend"`
	DownloadURL      string                  `json:"downloadUrl"`
	PreviewURL       string                  `json:"previewUrl"`
	UsageCount       int                     `json:"usageCount"`
	ChildCount       int                     `json:"childCount"`
	TransformRecipe  map[string]any          `json:"transformRecipe,omitempty"`
	Compatibility    []ResourceCompatibility `json:"compatibility"`
	ProcessingError  string                  `json:"processingError,omitempty"`
	CreatedAt        string                  `json:"createdAt"`
	UpdatedAt        string                  `json:"updatedAt"`
}

type ResourceDetail struct {
	ResourceListItem
	Variants []ResourceListItem `json:"variants"`
}

type UploadResponse struct {
	Resource     ResourceDetail      `json:"resource"`
	Optimization *optimizationResult `json:"optimization,omitempty"`
}

type cleanupPayload struct {
	Keys []string `json:"keys"`
}

func NewService(db *bun.DB, cfg config.StorageConfig, storage Storage, authorizer WorkspaceAuthorizer) *Service {
	return &Service{
		db:           db,
		cfg:          cfg,
		storage:      storage,
		authorizer:   authorizer,
		capabilities: defaultCapabilityMatrix(),
	}
}

func (s *Service) Capabilities() CapabilityMatrix {
	return s.capabilities
}

func (s *Service) ListResources(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]ResourceListItem, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.view"); err != nil {
		return nil, err
	}
	var records []database.Resource
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		Where("lifecycle_status = ?", "ready").
		OrderExpr("created_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return s.hydrateResources(ctx, records)
}

func (s *Service) GetResource(ctx context.Context, principal *iam.Principal, workspaceID, resourceID uuid.UUID) (*ResourceDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.view"); err != nil {
		return nil, err
	}
	record, err := s.findResource(ctx, workspaceID, resourceID)
	if err != nil {
		return nil, err
	}
	items, err := s.hydrateResources(ctx, []database.Resource{*record})
	if err != nil {
		return nil, err
	}
	var childRecords []database.Resource
	if err := s.db.NewSelect().
		Model(&childRecords).
		Where("parent_resource_id = ?", resourceID).
		Where("workspace_id = ?", workspaceID).
		Where("lifecycle_status = ?", "ready").
		OrderExpr("created_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	childItems, err := s.hydrateResources(ctx, childRecords)
	if err != nil {
		return nil, err
	}
	detail := &ResourceDetail{
		ResourceListItem: items[0],
		Variants:         childItems,
	}
	return detail, nil
}

func (s *Service) UploadResource(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UploadInput) (*UploadResponse, error) {
	return s.uploadResource(ctx, principal, workspaceID, uuid.Nil, input)
}

func (s *Service) CreateVariant(ctx context.Context, principal *iam.Principal, workspaceID, parentResourceID uuid.UUID, input UploadInput) (*UploadResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}
	if _, err := s.findResource(ctx, workspaceID, parentResourceID); err != nil {
		return nil, err
	}
	return s.uploadResource(ctx, principal, workspaceID, parentResourceID, input)
}

func (s *Service) uploadResource(ctx context.Context, principal *iam.Principal, workspaceID, parentResourceID uuid.UUID, input UploadInput) (*UploadResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}
	tempFile, sniffed, size, err := s.copyToTemp(input.Body)
	if err != nil {
		return nil, err
	}
	defer os.Remove(tempFile)

	if size > s.cfg.MaxUploadSizeBytes {
		return nil, fmt.Errorf("%w: file exceeds the upload limit", iam.ErrValidation)
	}
	mimeType := detectMIMEType(sniffed, input.OriginalName, input.ContentType)
	finalPath, metadata, optimization, err := extractFileMetadata(tempFile, input.OriginalName, mimeType, s.shouldOptimize(input))
	if err != nil {
		return nil, fmt.Errorf("%w: %s", iam.ErrValidation, err.Error())
	}
	if finalPath != tempFile {
		defer os.Remove(finalPath)
	}

	resourceID := uuid.New()
	now := time.Now().UTC()
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		displayName = strings.TrimSuffix(input.OriginalName, filepath.Ext(input.OriginalName))
	}
	if displayName == "" {
		displayName = resourceID.String()
	}
	sourceType := strings.TrimSpace(input.SourceType)
	if sourceType == "" {
		sourceType = "upload"
	}
	transformRecipe := strings.TrimSpace(input.TransformRecipe)
	if transformRecipe == "" {
		transformRecipe = "{}"
	}

	key := filepath.ToSlash(filepath.Join("workspaces", workspaceID.String(), "resources", resourceID.String(), "original"+metadata.Extension))
	file, err := os.Open(finalPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	if err := s.storage.Put(ctx, key, file); err != nil {
		return nil, err
	}

	resource := &database.Resource{
		ID:              resourceID,
		WorkspaceID:     workspaceID,
		MediaKind:       metadata.MediaKind,
		SourceType:      sourceType,
		LifecycleStatus: "ready",
		DisplayName:     displayName,
		OriginalName:    input.OriginalName,
		MIMEType:        metadata.MIMEType,
		FileExtension:   metadata.Extension,
		ChecksumSHA256:  metadata.ChecksumSHA256,
		SizeBytes:       metadata.SizeBytes,
		WidthPx:         metadata.WidthPx,
		HeightPx:        metadata.HeightPx,
		PageCount:       metadata.PageCount,
		Optimized:       metadata.Optimized,
		StorageBackend:  s.cfg.Driver,
		StorageKey:      key,
		TransformRecipe: transformRecipe,
		CreatedByUserID: &principal.UserID,
		UpdatedByUserID: &principal.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if parentResourceID != uuid.Nil {
		resource.ParentResourceID = &parentResourceID
		resource.SourceType = "variant"
	}
	if _, err := s.db.NewInsert().Model(resource).Exec(ctx); err != nil {
		_ = s.storage.Delete(ctx, key)
		return nil, err
	}

	detail, err := s.GetResource(ctx, principal, workspaceID, resourceID)
	if err != nil {
		return nil, err
	}
	return &UploadResponse{
		Resource:     *detail,
		Optimization: optimization,
	}, nil
}

func (s *Service) DeleteResource(ctx context.Context, principal *iam.Principal, workspaceID, resourceID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return err
	}
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		record, err := s.findResourceTx(ctx, tx, workspaceID, resourceID)
		if err != nil {
			return err
		}
		refCount, err := tx.NewSelect().Model((*database.ResourceReference)(nil)).Where("resource_id = ?", resourceID).Count(ctx)
		if err != nil {
			return err
		}
		if refCount > 0 {
			return fmt.Errorf("%w: resource is still referenced", iam.ErrConflict)
		}
		childCount, err := tx.NewSelect().Model((*database.Resource)(nil)).Where("parent_resource_id = ?", resourceID).Where("lifecycle_status = ?", "ready").Count(ctx)
		if err != nil {
			return err
		}
		if childCount > 0 {
			return fmt.Errorf("%w: resource has derived variants", iam.ErrConflict)
		}
		return s.enqueueCleanupTx(ctx, tx, *record)
	}); err != nil {
		return err
	}
	_ = s.RunCleanupSweep(ctx)
	return nil
}

func (s *Service) UpdateResource(ctx context.Context, principal *iam.Principal, workspaceID, resourceID uuid.UUID, input UpdateInput) (*ResourceDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}

	displayName := strings.TrimSpace(input.DisplayName)
	if displayName == "" {
		return nil, fmt.Errorf("%w: display name is required", iam.ErrValidation)
	}

	record, err := s.findResource(ctx, workspaceID, resourceID)
	if err != nil {
		return nil, err
	}

	record.DisplayName = displayName
	record.UpdatedAt = time.Now().UTC()
	record.UpdatedByUserID = &principal.UserID

	if _, err := s.db.NewUpdate().
		Model(record).
		Column("display_name", "updated_at", "updated_by_user_id").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}

	return s.GetResource(ctx, principal, workspaceID, resourceID)
}

func (s *Service) GetDownloadURL(ctx context.Context, principal *iam.Principal, workspaceID, resourceID uuid.UUID) (string, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.view"); err != nil {
		return "", err
	}
	record, err := s.findResource(ctx, workspaceID, resourceID)
	if err != nil {
		return "", err
	}
	return s.storage.SignedURL(ctx, record.StorageKey, SignedURLOptions{
		Filename:    record.OriginalName,
		ContentType: record.MIMEType,
		ExpiresIn:   s.cfg.SignedURLTTL,
	})
}

func (s *Service) SyncReferences(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, entityType, entityID, slot string, refs []ReferenceInput) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return err
	}
	entityType = strings.TrimSpace(entityType)
	entityID = strings.TrimSpace(entityID)
	slot = strings.TrimSpace(slot)
	if entityType == "" || entityID == "" || slot == "" {
		return fmt.Errorf("%w: entity type, entity id, and slot are required", iam.ErrValidation)
	}
	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		var current []database.ResourceReference
		if err := tx.NewSelect().
			Model(&current).
			Where("workspace_id = ?", workspaceID).
			Where("entity_type = ?", entityType).
			Where("entity_id = ?", entityID).
			Where("slot = ?", slot).
			OrderExpr("position ASC").
			Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		currentIDs := make(map[uuid.UUID]struct{}, len(current))
		for _, ref := range current {
			currentIDs[ref.ResourceID] = struct{}{}
		}
		if _, err := tx.NewDelete().
			Model((*database.ResourceReference)(nil)).
			Where("workspace_id = ?", workspaceID).
			Where("entity_type = ?", entityType).
			Where("entity_id = ?", entityID).
			Where("slot = ?", slot).
			Exec(ctx); err != nil {
			return err
		}
		for index, ref := range refs {
			if _, err := s.findResourceTx(ctx, tx, workspaceID, ref.ResourceID); err != nil {
				return err
			}
			payload, err := json.Marshal(ref.Metadata)
			if err != nil {
				return fmt.Errorf("%w: invalid reference metadata", iam.ErrValidation)
			}
			record := &database.ResourceReference{
				ID:          uuid.New(),
				WorkspaceID: workspaceID,
				ResourceID:  ref.ResourceID,
				EntityType:  entityType,
				EntityID:    entityID,
				Slot:        slot,
				Position:    index,
				Metadata:    string(payload),
				CreatedAt:   time.Now().UTC(),
				UpdatedAt:   time.Now().UTC(),
			}
			if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
				return err
			}
			delete(currentIDs, ref.ResourceID)
		}
		for removedID := range currentIDs {
			if err := s.markResourcePendingDeleteIfOrphanedTx(ctx, tx, workspaceID, removedID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) RunCleanupSweep(ctx context.Context) error {
	var jobs []database.ResourceCleanupJob
	if err := s.db.NewSelect().
		Model(&jobs).
		Where("status IN (?)", bun.In([]string{"pending", "failed"})).
		OrderExpr("created_at ASC").
		Limit(50).
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	for _, job := range jobs {
		if err := s.processCleanupJob(ctx, job); err != nil {
			continue
		}
	}
	return nil
}

func CloneMetadata(metadata map[string]any) map[string]any {
	if metadata == nil {
		return nil
	}
	clone := make(map[string]any, len(metadata))
	maps.Copy(clone, metadata)
	return clone
}

func (s *Service) processCleanupJob(ctx context.Context, job database.ResourceCleanupJob) error {
	var payload cleanupPayload
	if err := json.Unmarshal([]byte(job.Payload), &payload); err != nil {
		return s.markCleanupFailed(ctx, job, err)
	}
	for _, key := range payload.Keys {
		if err := s.storage.Delete(ctx, key); err != nil {
			return s.markCleanupFailed(ctx, job, err)
		}
	}
	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewDelete().Model((*database.ResourceReference)(nil)).Where("resource_id = ?", job.ResourceID).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().Model((*database.Resource)(nil)).Where("id = ?", job.ResourceID).Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewDelete().Model((*database.ResourceCleanupJob)(nil)).Where("id = ?", job.ID).Exec(ctx)
		return err
	})
}

func (s *Service) markCleanupFailed(ctx context.Context, job database.ResourceCleanupJob, failure error) error {
	lastError := failure.Error()
	job.AttemptCount++
	job.Status = "failed"
	job.LastError = &lastError
	job.UpdatedAt = time.Now().UTC()
	_, err := s.db.NewUpdate().
		Model(&job).
		Column("attempt_count", "status", "last_error", "updated_at").
		WherePK().
		Exec(ctx)
	if err != nil {
		return err
	}
	return failure
}

func (s *Service) hydrateResources(ctx context.Context, records []database.Resource) ([]ResourceListItem, error) {
	if len(records) == 0 {
		return []ResourceListItem{}, nil
	}
	resourceIDs := make([]uuid.UUID, 0, len(records))
	for _, record := range records {
		resourceIDs = append(resourceIDs, record.ID)
	}

	usageCounts := map[string]int{}
	var usageRows []struct {
		ResourceID uuid.UUID `bun:"resource_id"`
		Count      int       `bun:"count"`
	}
	if err := s.db.NewSelect().
		TableExpr("resource_references").
		Column("resource_id").
		ColumnExpr("COUNT(*) AS count").
		Where("resource_id IN (?)", bun.In(resourceIDs)).
		Group("resource_id").
		Scan(ctx, &usageRows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, row := range usageRows {
		usageCounts[row.ResourceID.String()] = row.Count
	}

	childCounts := map[string]int{}
	var childRows []struct {
		ParentResourceID uuid.UUID `bun:"parent_resource_id"`
		Count            int       `bun:"count"`
	}
	if err := s.db.NewSelect().
		TableExpr("resources").
		Column("parent_resource_id").
		ColumnExpr("COUNT(*) AS count").
		Where("parent_resource_id IN (?)", bun.In(resourceIDs)).
		Where("lifecycle_status = ?", "ready").
		Group("parent_resource_id").
		Scan(ctx, &childRows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, row := range childRows {
		childCounts[row.ParentResourceID.String()] = row.Count
	}

	items := make([]ResourceListItem, 0, len(records))
	for _, record := range records {
		item, err := s.mapResourceRecord(ctx, record, usageCounts[record.ID.String()], childCounts[record.ID.String()])
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) mapResourceRecord(ctx context.Context, record database.Resource, usageCount, childCount int) (ResourceListItem, error) {
	downloadURL, err := s.storage.SignedURL(ctx, record.StorageKey, SignedURLOptions{
		Filename:    record.OriginalName,
		ContentType: record.MIMEType,
		ExpiresIn:   s.cfg.SignedURLTTL,
	})
	if err != nil {
		return ResourceListItem{}, err
	}
	var transform map[string]any
	if strings.TrimSpace(record.TransformRecipe) != "" && record.TransformRecipe != "{}" {
		_ = json.Unmarshal([]byte(record.TransformRecipe), &transform)
	}
	item := ResourceListItem{
		ID:              record.ID.String(),
		WorkspaceID:     record.WorkspaceID.String(),
		MediaKind:       record.MediaKind,
		SourceType:      record.SourceType,
		LifecycleStatus: record.LifecycleStatus,
		DisplayName:     record.DisplayName,
		OriginalName:    record.OriginalName,
		MIMEType:        record.MIMEType,
		FileExtension:   record.FileExtension,
		ChecksumSHA256:  record.ChecksumSHA256,
		SizeBytes:       record.SizeBytes,
		WidthPx:         record.WidthPx,
		HeightPx:        record.HeightPx,
		DurationMS:      record.DurationMS,
		PageCount:       record.PageCount,
		FrameRate:       record.FrameRate,
		HasAudio:        record.HasAudio,
		Optimized:       record.Optimized,
		StorageBackend:  record.StorageBackend,
		DownloadURL:     downloadURL,
		PreviewURL:      downloadURL,
		UsageCount:      usageCount,
		ChildCount:      childCount,
		TransformRecipe: transform,
		Compatibility:   evaluateCompatibility(s.capabilities, record),
		CreatedAt:       record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       record.UpdatedAt.Format(time.RFC3339),
	}
	if record.ParentResourceID != nil {
		item.ParentResourceID = record.ParentResourceID.String()
	}
	if record.ProcessingError != nil {
		item.ProcessingError = *record.ProcessingError
	}
	return item, nil
}

func evaluateCompatibility(matrix CapabilityMatrix, resource database.Resource) []ResourceCompatibility {
	results := make([]ResourceCompatibility, 0, len(matrix.Rules))
	for _, rule := range matrix.Rules {
		status := "supported"
		reasons := make([]string, 0, 2)
		if !slices.Contains(rule.Accepts, resource.MediaKind) {
			status = "unsupported"
			reasons = append(reasons, fmt.Sprintf("Accepts %s resources only", strings.Join(rule.Accepts, ", ")))
		}
		if status == "supported" {
			switch rule.Platform + ":" + rule.Surface {
			case "instagram:feed_photo":
				if resource.WidthPx == nil || resource.HeightPx == nil {
					status = "warning"
					reasons = append(reasons, "Image dimensions were not extracted")
				} else {
					ratio := float64(*resource.WidthPx) / float64(*resource.HeightPx)
					if *resource.WidthPx < 320 || *resource.WidthPx > 1080 || ratio < 1.0/3.0 || ratio > 1.91 {
						status = "warning"
						reasons = append(reasons, "May need resizing for Instagram feed constraints")
					}
				}
			case "instagram:reel":
				if resource.WidthPx == nil || resource.HeightPx == nil {
					status = "warning"
					reasons = append(reasons, "Video dimensions were not extracted")
				} else if *resource.WidthPx < 720 && *resource.HeightPx < 720 {
					status = "warning"
					reasons = append(reasons, "Instagram reels expect at least 720px on one side")
				}
			case "facebook:feed_photo":
				if resource.SizeBytes > 15*1024*1024 {
					status = "warning"
					reasons = append(reasons, "Facebook recommends images under 15 MB")
				}
			case "facebook:video":
				if resource.SizeBytes > 4*1024*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds Facebook 4 GB video limit")
				}
			case "linkedin:image_post":
				if resource.WidthPx != nil && resource.HeightPx != nil && int64(*resource.WidthPx)*int64(*resource.HeightPx) > 36152320 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds LinkedIn total pixel limit")
				}
			case "linkedin:video_post":
				if resource.SizeBytes > 500*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds LinkedIn 500 MB video limit")
				}
			case "linkedin:document_post":
				if resource.SizeBytes > 100*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds LinkedIn 100 MB document limit")
				}
				if resource.PageCount != nil && *resource.PageCount > 300 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds LinkedIn 300 page document limit")
				}
			case "x:image_post":
				if resource.MIMEType == "image/gif" {
					if resource.SizeBytes > 15*1024*1024 {
						status = "unsupported"
						reasons = append(reasons, "Exceeds X GIF limit")
					}
				} else if resource.SizeBytes > 5*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds X image limit")
				}
			case "x:video_post":
				if resource.WidthPx != nil && resource.HeightPx != nil && (*resource.WidthPx > 1920 || *resource.HeightPx > 1200) {
					status = "warning"
					reasons = append(reasons, "May require downscaling for X web video limits")
				}
			case "tiktok:photo_post":
				if resource.SizeBytes > 20*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds TikTok 20 MB image limit")
				}
			case "youtube:video":
				if resource.SizeBytes > 256*1024*1024*1024 {
					status = "unsupported"
					reasons = append(reasons, "Exceeds YouTube 256 GB upload limit")
				}
			}
		}
		if len(reasons) == 0 {
			reasons = append(reasons, "Meets the current stored constraints for this surface")
		}
		results = append(results, ResourceCompatibility{
			Platform: rule.Platform,
			Surface:  rule.Surface,
			Status:   status,
			Reasons:  reasons,
		})
	}
	return results
}

func (s *Service) shouldOptimize(input UploadInput) bool {
	if input.Optimize != nil {
		return *input.Optimize
	}
	return s.cfg.OptimizeImagesByDefault
}

func (s *Service) findResource(ctx context.Context, workspaceID, resourceID uuid.UUID) (*database.Resource, error) {
	record := new(database.Resource)
	if err := s.db.NewSelect().
		Model(record).
		Where("id = ?", resourceID).
		Where("workspace_id = ?", workspaceID).
		Where("lifecycle_status != ?", "pending_delete").
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findResourceTx(ctx context.Context, tx bun.Tx, workspaceID, resourceID uuid.UUID) (*database.Resource, error) {
	record := new(database.Resource)
	if err := tx.NewSelect().
		Model(record).
		Where("id = ?", resourceID).
		Where("workspace_id = ?", workspaceID).
		Where("lifecycle_status != ?", "pending_delete").
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) enqueueCleanupTx(ctx context.Context, tx bun.Tx, resource database.Resource) error {
	payloadBytes, err := json.Marshal(cleanupPayload{Keys: []string{resource.StorageKey}})
	if err != nil {
		return err
	}
	resource.LifecycleStatus = "pending_delete"
	resource.UpdatedAt = time.Now().UTC()
	if _, err := tx.NewUpdate().Model(&resource).Column("lifecycle_status", "updated_at").WherePK().Exec(ctx); err != nil {
		return err
	}
	job := &database.ResourceCleanupJob{
		ID:             uuid.New(),
		WorkspaceID:    resource.WorkspaceID,
		ResourceID:     resource.ID,
		StorageBackend: resource.StorageBackend,
		Payload:        string(payloadBytes),
		Status:         "pending",
		AttemptCount:   0,
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}
	_, err = tx.NewInsert().Model(job).Exec(ctx)
	return err
}

func (s *Service) markResourcePendingDeleteIfOrphanedTx(ctx context.Context, tx bun.Tx, workspaceID, resourceID uuid.UUID) error {
	record, err := s.findResourceTx(ctx, tx, workspaceID, resourceID)
	if err != nil {
		if errors.Is(err, iam.ErrNotFound) {
			return nil
		}
		return err
	}
	refCount, err := tx.NewSelect().Model((*database.ResourceReference)(nil)).Where("resource_id = ?", resourceID).Count(ctx)
	if err != nil {
		return err
	}
	if refCount > 0 {
		return nil
	}
	childCount, err := tx.NewSelect().Model((*database.Resource)(nil)).Where("parent_resource_id = ?", resourceID).Where("lifecycle_status = ?", "ready").Count(ctx)
	if err != nil {
		return err
	}
	if childCount > 0 {
		return nil
	}
	return s.enqueueCleanupTx(ctx, tx, *record)
}

func (s *Service) copyToTemp(body io.Reader) (string, []byte, int64, error) {
	tempFile, err := os.CreateTemp("", "heimdall-resource-*")
	if err != nil {
		return "", nil, 0, err
	}
	defer tempFile.Close()

	sniffed := make([]byte, 512)
	n, err := io.ReadFull(body, sniffed)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		_ = os.Remove(tempFile.Name())
		return "", nil, 0, err
	}
	totalWritten, err := tempFile.Write(sniffed[:n])
	if err != nil {
		_ = os.Remove(tempFile.Name())
		return "", nil, 0, err
	}
	copied, err := io.Copy(tempFile, body)
	if err != nil {
		_ = os.Remove(tempFile.Name())
		return "", nil, 0, err
	}
	return tempFile.Name(), sniffed[:n], int64(totalWritten) + copied, nil
}
