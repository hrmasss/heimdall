package resources

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
)

func (s *Service) ListResourceSets(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]ResourceSetSummary, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.view"); err != nil {
		return nil, err
	}

	var records []database.ResourceSet
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	return s.hydrateResourceSets(ctx, records, 4)
}

func (s *Service) GetResourceSet(ctx context.Context, principal *iam.Principal, workspaceID, resourceSetID uuid.UUID) (*ResourceSetDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.view"); err != nil {
		return nil, err
	}

	record, err := s.findResourceSet(ctx, workspaceID, resourceSetID)
	if err != nil {
		return nil, err
	}

	summaries, err := s.hydrateResourceSets(ctx, []database.ResourceSet{*record}, 6)
	if err != nil {
		return nil, err
	}
	if len(summaries) == 0 {
		return nil, iam.ErrNotFound
	}

	detail := &ResourceSetDetail{
		ResourceSetSummary: summaries[0],
		Items:              []ResourceSetItem{},
	}

	if strings.TrimSpace(record.Metadata) != "" && record.Metadata != "{}" {
		var metadata map[string]any
		_ = json.Unmarshal([]byte(record.Metadata), &metadata)
		detail.Metadata = metadata
	}

	itemRecords, err := s.listResourceSetItems(ctx, workspaceID, resourceSetID)
	if err != nil {
		return nil, err
	}

	resourceRecords := make([]database.Resource, 0, len(itemRecords))
	resourceByID := map[uuid.UUID]database.Resource{}
	if len(itemRecords) > 0 {
		resourceIDs := make([]uuid.UUID, 0, len(itemRecords))
		for _, item := range itemRecords {
			resourceIDs = append(resourceIDs, item.ResourceID)
		}
		if err := s.db.NewSelect().
			Model(&resourceRecords).
			Where("workspace_id = ?", workspaceID).
			Where("id IN (?)", bun.In(resourceIDs)).
			Where("lifecycle_status = ?", "ready").
			Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		for _, resource := range resourceRecords {
			resourceByID[resource.ID] = resource
		}
	}

	for _, item := range itemRecords {
		resourceRecord, ok := resourceByID[item.ResourceID]
		if !ok {
			continue
		}
		resourceItem, err := s.mapResourceRecord(ctx, resourceRecord, 0, 0, 0)
		if err != nil {
			return nil, err
		}
		metadata := map[string]any{}
		if strings.TrimSpace(item.Metadata) != "" && item.Metadata != "{}" {
			_ = json.Unmarshal([]byte(item.Metadata), &metadata)
		}
		detail.Items = append(detail.Items, ResourceSetItem{
			ID:         item.ID.String(),
			ResourceID: item.ResourceID.String(),
			Position:   item.Position,
			Role:       item.Role,
			Metadata:   metadata,
			Resource:   resourceItem,
		})
	}

	if record.CoverResourceID != nil {
		for _, item := range detail.Items {
			if item.Resource.ID == record.CoverResourceID.String() {
				resource := item.Resource
				detail.CoverResource = &resource
				break
			}
		}
	}
	if detail.CoverResource == nil && len(detail.Items) > 0 {
		resource := detail.Items[0].Resource
		detail.CoverResource = &resource
	}

	return detail, nil
}

func (s *Service) CreateResourceSet(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input CreateResourceSetInput) (*ResourceSetDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}

	resourceSetID := uuid.New()
	now := time.Now().UTC()
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("%w: set name is required", iam.ErrValidation)
	}
	intentType, intentPlatform, intentSurface, err := normalizeSetIntent(input.IntentType, input.IntentPlatform, input.IntentSurface)
	if err != nil {
		return nil, err
	}
	sourceType := strings.TrimSpace(input.SourceType)
	if sourceType == "" {
		sourceType = "manual"
	}
	metadata, err := marshalMetadata(input.Metadata)
	if err != nil {
		return nil, err
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		coverResourceID, err := s.validateSetItemsTx(ctx, tx, workspaceID, input.Items, input.CoverResourceID)
		if err != nil {
			return err
		}

		record := &database.ResourceSet{
			ID:              resourceSetID,
			WorkspaceID:     workspaceID,
			Name:            name,
			Description:     strings.TrimSpace(input.Description),
			IntentType:      intentType,
			IntentPlatform:  intentPlatform,
			IntentSurface:   intentSurface,
			CoverResourceID: coverResourceID,
			SourceType:      sourceType,
			Metadata:        metadata,
			CreatedByUserID: &principal.UserID,
			UpdatedByUserID: &principal.UserID,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
			return err
		}
		return s.replaceResourceSetItemsTx(ctx, tx, workspaceID, resourceSetID, input.Items, coverResourceID, &principal.UserID)
	}); err != nil {
		return nil, err
	}

	return s.GetResourceSet(ctx, principal, workspaceID, resourceSetID)
}

func (s *Service) UpdateResourceSet(ctx context.Context, principal *iam.Principal, workspaceID, resourceSetID uuid.UUID, input UpdateResourceSetInput) (*ResourceSetDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		record, err := s.findResourceSetTx(ctx, tx, workspaceID, resourceSetID)
		if err != nil {
			return err
		}

		name := strings.TrimSpace(input.Name)
		if name == "" {
			return fmt.Errorf("%w: set name is required", iam.ErrValidation)
		}
		intentType, intentPlatform, intentSurface, err := normalizeSetIntent(input.IntentType, input.IntentPlatform, input.IntentSurface)
		if err != nil {
			return err
		}
		metadata, err := marshalMetadata(input.Metadata)
		if err != nil {
			return err
		}

		record.Name = name
		record.Description = strings.TrimSpace(input.Description)
		record.IntentType = intentType
		record.IntentPlatform = intentPlatform
		record.IntentSurface = intentSurface
		record.Metadata = metadata
		record.UpdatedByUserID = &principal.UserID
		record.UpdatedAt = time.Now().UTC()

		if input.ClearCover {
			record.CoverResourceID = nil
		} else if input.CoverResourceID != nil {
			if err := s.validateCoverResourceTx(ctx, tx, workspaceID, resourceSetID, *input.CoverResourceID); err != nil {
				return err
			}
			record.CoverResourceID = input.CoverResourceID
		}

		if _, err := tx.NewUpdate().
			Model(record).
			Column("name", "description", "intent_type", "intent_platform", "intent_surface", "cover_resource_id", "metadata", "updated_by_user_id", "updated_at").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return s.GetResourceSet(ctx, principal, workspaceID, resourceSetID)
}

func (s *Service) ReplaceResourceSetItems(ctx context.Context, principal *iam.Principal, workspaceID, resourceSetID uuid.UUID, items []ResourceSetItemInput) (*ResourceSetDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return nil, err
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		record, err := s.findResourceSetTx(ctx, tx, workspaceID, resourceSetID)
		if err != nil {
			return err
		}

		coverResourceID, err := s.validateSetItemsTx(ctx, tx, workspaceID, items, record.CoverResourceID)
		if err != nil {
			return err
		}

		if err := s.replaceResourceSetItemsTx(ctx, tx, workspaceID, resourceSetID, items, coverResourceID, &principal.UserID); err != nil {
			return err
		}

		record.CoverResourceID = coverResourceID
		record.UpdatedByUserID = &principal.UserID
		record.UpdatedAt = time.Now().UTC()
		_, err = tx.NewUpdate().
			Model(record).
			Column("cover_resource_id", "updated_by_user_id", "updated_at").
			WherePK().
			Exec(ctx)
		return err
	}); err != nil {
		return nil, err
	}

	return s.GetResourceSet(ctx, principal, workspaceID, resourceSetID)
}

func (s *Service) DeleteResourceSet(ctx context.Context, principal *iam.Principal, workspaceID, resourceSetID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.resources.manage"); err != nil {
		return err
	}

	record, err := s.findResourceSet(ctx, workspaceID, resourceSetID)
	if err != nil {
		return err
	}
	_, err = s.db.NewDelete().Model(record).WherePK().Exec(ctx)
	return err
}

func (s *Service) listResourceSetSummariesByResource(ctx context.Context, workspaceID, resourceID uuid.UUID) ([]ResourceSetSummary, error) {
	var setIDs []uuid.UUID
	if err := s.db.NewSelect().
		Model((*database.ResourceSetItem)(nil)).
		Column("resource_set_id").
		Where("resource_id = ?", resourceID).
		OrderExpr("position ASC").
		Scan(ctx, &setIDs); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if len(setIDs) == 0 {
		return []ResourceSetSummary{}, nil
	}

	var records []database.ResourceSet
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		Where("id IN (?)", bun.In(setIDs)).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	return s.hydrateResourceSets(ctx, records, 4)
}

func (s *Service) hydrateResourceSets(ctx context.Context, records []database.ResourceSet, previewLimit int) ([]ResourceSetSummary, error) {
	if len(records) == 0 {
		return []ResourceSetSummary{}, nil
	}

	setIDs := make([]uuid.UUID, 0, len(records))
	for _, record := range records {
		setIDs = append(setIDs, record.ID)
	}

	itemCounts := map[string]int{}
	var countRows []struct {
		ResourceSetID uuid.UUID `bun:"resource_set_id"`
		Count         int       `bun:"count"`
	}
	if err := s.db.NewSelect().
		Model((*database.ResourceSetItem)(nil)).
		Column("resource_set_id").
		ColumnExpr("COUNT(*) AS count").
		Where("resource_set_id IN (?)", bun.In(setIDs)).
		Group("resource_set_id").
		Scan(ctx, &countRows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, row := range countRows {
		itemCounts[row.ResourceSetID.String()] = row.Count
	}

	summaries := make([]ResourceSetSummary, 0, len(records))
	for _, record := range records {
		summary, err := s.mapResourceSetSummary(ctx, record, itemCounts[record.ID.String()], previewLimit)
		if err != nil {
			return nil, err
		}
		summaries = append(summaries, summary)
	}
	return summaries, nil
}

func (s *Service) mapResourceSetSummary(ctx context.Context, record database.ResourceSet, itemCount, previewLimit int) (ResourceSetSummary, error) {
	summary := ResourceSetSummary{
		ID:          record.ID.String(),
		WorkspaceID: record.WorkspaceID.String(),
		Name:        record.Name,
		Description: record.Description,
		IntentType:  record.IntentType,
		SourceType:  record.SourceType,
		ItemCount:   itemCount,
		CreatedAt:   record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   record.UpdatedAt.Format(time.RFC3339),
	}
	if record.IntentPlatform != nil {
		summary.IntentPlatform = *record.IntentPlatform
	}
	if record.IntentSurface != nil {
		summary.IntentSurface = *record.IntentSurface
	}
	if record.CoverResourceID != nil {
		summary.CoverResourceID = record.CoverResourceID.String()
	}

	var previewItems []database.ResourceSetItem
	query := s.db.NewSelect().
		Model(&previewItems).
		Where("resource_set_id = ?", record.ID).
		OrderExpr("position ASC")
	if previewLimit > 0 {
		query = query.Limit(previewLimit)
	}
	if err := query.Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return ResourceSetSummary{}, err
	}

	if len(previewItems) > 0 {
		resourceIDs := make([]uuid.UUID, 0, len(previewItems))
		for _, item := range previewItems {
			resourceIDs = append(resourceIDs, item.ResourceID)
		}

		var resourceRecords []database.Resource
		if err := s.db.NewSelect().
			Model(&resourceRecords).
			Where("workspace_id = ?", record.WorkspaceID).
			Where("id IN (?)", bun.In(resourceIDs)).
			Where("lifecycle_status = ?", "ready").
			Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
			return ResourceSetSummary{}, err
		}

		resourceByID := make(map[uuid.UUID]database.Resource, len(resourceRecords))
		for _, resource := range resourceRecords {
			resourceByID[resource.ID] = resource
		}

		for _, item := range previewItems {
			resourceRecord, ok := resourceByID[item.ResourceID]
			if !ok {
				continue
			}
			resourceItem, err := s.mapResourceRecord(ctx, resourceRecord, 0, 0, 0)
			if err != nil {
				return ResourceSetSummary{}, err
			}
			if record.CoverResourceID != nil && *record.CoverResourceID == item.ResourceID {
				summary.CoverPreviewURL = resourceItem.PreviewURL
			}
			summary.MembersPreview = append(summary.MembersPreview, resourceItem)
		}

		if summary.CoverPreviewURL == "" && len(summary.MembersPreview) > 0 {
			summary.CoverPreviewURL = summary.MembersPreview[0].PreviewURL
			if summary.CoverResourceID == "" {
				summary.CoverResourceID = summary.MembersPreview[0].ID
			}
		}
	}

	return summary, nil
}

func (s *Service) listResourceSetItems(ctx context.Context, workspaceID, resourceSetID uuid.UUID) ([]database.ResourceSetItem, error) {
	var itemRecords []database.ResourceSetItem
	if err := s.db.NewSelect().
		Model(&itemRecords).
		Where("resource_set_id = ?", resourceSetID).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return itemRecords, nil
}

func (s *Service) replaceResourceSetItemsTx(ctx context.Context, tx bun.Tx, workspaceID, resourceSetID uuid.UUID, items []ResourceSetItemInput, coverResourceID *uuid.UUID, actorUserID *uuid.UUID) error {
	if _, err := tx.NewDelete().
		Model((*database.ResourceSetItem)(nil)).
		Where("resource_set_id = ?", resourceSetID).
		Exec(ctx); err != nil {
		return err
	}

	now := time.Now().UTC()
	for index, item := range items {
		payload, err := marshalMetadata(item.Metadata)
		if err != nil {
			return err
		}
		record := &database.ResourceSetItem{
			ID:            uuid.New(),
			ResourceSetID: resourceSetID,
			ResourceID:    item.ResourceID,
			Position:      index,
			Role:          strings.TrimSpace(item.Role),
			Metadata:      payload,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
		if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
			return err
		}
	}

	record, err := s.findResourceSetTx(ctx, tx, workspaceID, resourceSetID)
	if err != nil {
		return err
	}
	record.CoverResourceID = coverResourceID
	record.UpdatedAt = now
	record.UpdatedByUserID = actorUserID
	_, err = tx.NewUpdate().
		Model(record).
		Column("cover_resource_id", "updated_at", "updated_by_user_id").
		WherePK().
		Exec(ctx)
	return err
}

func (s *Service) validateSetItemsTx(ctx context.Context, tx bun.Tx, workspaceID uuid.UUID, items []ResourceSetItemInput, requestedCover *uuid.UUID) (*uuid.UUID, error) {
	seen := make(map[uuid.UUID]struct{}, len(items))
	for _, item := range items {
		if item.ResourceID == uuid.Nil {
			return nil, fmt.Errorf("%w: resource id is required for each set item", iam.ErrValidation)
		}
		if _, exists := seen[item.ResourceID]; exists {
			return nil, fmt.Errorf("%w: duplicate resource in asset set", iam.ErrValidation)
		}
		seen[item.ResourceID] = struct{}{}
		if _, err := s.findResourceTx(ctx, tx, workspaceID, item.ResourceID); err != nil {
			return nil, err
		}
	}

	if requestedCover != nil {
		if _, ok := seen[*requestedCover]; !ok {
			return nil, fmt.Errorf("%w: cover resource must be a member of the asset set", iam.ErrValidation)
		}
		return requestedCover, nil
	}
	if len(items) == 0 {
		return nil, nil
	}
	coverID := items[0].ResourceID
	return &coverID, nil
}

func (s *Service) validateCoverResourceTx(ctx context.Context, tx bun.Tx, workspaceID, resourceSetID, coverResourceID uuid.UUID) error {
	if _, err := s.findResourceTx(ctx, tx, workspaceID, coverResourceID); err != nil {
		return err
	}
	count, err := tx.NewSelect().
		Model((*database.ResourceSetItem)(nil)).
		Where("resource_set_id = ?", resourceSetID).
		Where("resource_id = ?", coverResourceID).
		Count(ctx)
	if err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("%w: cover resource must already belong to the asset set", iam.ErrValidation)
	}
	return nil
}

func (s *Service) findResourceSet(ctx context.Context, workspaceID, resourceSetID uuid.UUID) (*database.ResourceSet, error) {
	record := new(database.ResourceSet)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", resourceSetID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findResourceSetTx(ctx context.Context, tx bun.Tx, workspaceID, resourceSetID uuid.UUID) (*database.ResourceSet, error) {
	record := new(database.ResourceSet)
	if err := tx.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", resourceSetID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
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

func normalizeSetIntent(intentType, intentPlatform, intentSurface string) (string, *string, *string, error) {
	intentType = strings.TrimSpace(intentType)
	intentPlatform = strings.TrimSpace(intentPlatform)
	intentSurface = strings.TrimSpace(intentSurface)

	if intentType == "" {
		if intentPlatform != "" || intentSurface != "" {
			intentType = "social_surface"
		} else {
			intentType = "generic"
		}
	}
	if !slices.Contains([]string{"generic", "social_surface"}, intentType) {
		return "", nil, nil, fmt.Errorf("%w: intent type must be generic or social_surface", iam.ErrValidation)
	}
	if intentType == "generic" {
		return intentType, nil, nil, nil
	}
	if intentPlatform == "" || intentSurface == "" {
		return "", nil, nil, fmt.Errorf("%w: intent platform and surface are required for social surface sets", iam.ErrValidation)
	}
	return intentType, &intentPlatform, &intentSurface, nil
}
