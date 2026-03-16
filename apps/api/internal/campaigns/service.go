package campaigns

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	postdomain "github.com/heimdall/api/internal/posts"
)

var validCampaignStatuses = []string{"draft", "planned", "active", "completed", "archived"}

type WorkspaceAuthorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
}

type PostSummaryReader interface {
	ListPosts(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]postdomain.PostSummary, error)
}

type Service struct {
	db         *bun.DB
	authorizer WorkspaceAuthorizer
	postReader PostSummaryReader
}

type UpsertCampaignInput struct {
	Status                 string
	Name                   string
	Objective              string
	TargetAudience         string
	MessageTheme           string
	StartDate              time.Time
	EndDate                time.Time
	Notes                  string
	PrimaryMetricLabel     string
	PrimaryMetricTarget    *float64
	PrimaryMetricUnit      string
	PaidChannels           []string
	BudgetAmountCents      *int64
	ActualSpendAmountCents *int64
	CurrencyCode           string
	UTMCampaign            string
	ExternalDashboardURL   string
	PostIDs                []uuid.UUID
}

type CampaignSummary struct {
	ID                     string   `json:"id"`
	WorkspaceID            string   `json:"workspaceId"`
	Status                 string   `json:"status"`
	Name                   string   `json:"name"`
	Objective              string   `json:"objective,omitempty"`
	TargetAudience         string   `json:"targetAudience,omitempty"`
	MessageTheme           string   `json:"messageTheme,omitempty"`
	StartDate              string   `json:"startDate"`
	EndDate                string   `json:"endDate"`
	Notes                  string   `json:"notes,omitempty"`
	PrimaryMetricLabel     string   `json:"primaryMetricLabel,omitempty"`
	PrimaryMetricTarget    *float64 `json:"primaryMetricTarget,omitempty"`
	PrimaryMetricUnit      string   `json:"primaryMetricUnit,omitempty"`
	PaidChannels           []string `json:"paidChannels"`
	BudgetAmountCents      *int64   `json:"budgetAmountCents,omitempty"`
	ActualSpendAmountCents *int64   `json:"actualSpendAmountCents,omitempty"`
	CurrencyCode           string   `json:"currencyCode,omitempty"`
	UTMCampaign            string   `json:"utmCampaign,omitempty"`
	ExternalDashboardURL   string   `json:"externalDashboardUrl,omitempty"`
	PostCount              int      `json:"postCount"`
	CreatedAt              string   `json:"createdAt"`
	UpdatedAt              string   `json:"updatedAt"`
}

type CampaignDetail struct {
	CampaignSummary
	LinkedPosts    []postdomain.PostSummary        `json:"linkedPosts"`
	MetricSnapshot []postdomain.MetricSnapshotItem `json:"metricSnapshot"`
}

func NewService(db *bun.DB, authorizer WorkspaceAuthorizer, postReader PostSummaryReader) *Service {
	return &Service{
		db:         db,
		authorizer: authorizer,
		postReader: postReader,
	}
}

func (s *Service) ListCampaigns(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]CampaignSummary, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.view"); err != nil {
		return nil, err
	}

	var records []database.Campaign
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("start_date ASC, updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	postCounts, err := s.loadPostCounts(ctx, workspaceID, nil)
	if err != nil {
		return nil, err
	}

	items := make([]CampaignSummary, 0, len(records))
	for _, record := range records {
		items = append(items, mapCampaignSummary(record, postCounts[record.ID.String()]))
	}
	return items, nil
}

func (s *Service) GetCampaign(ctx context.Context, principal *iam.Principal, workspaceID, campaignID uuid.UUID) (*CampaignDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.view"); err != nil {
		return nil, err
	}

	record, err := s.findCampaign(ctx, workspaceID, campaignID)
	if err != nil {
		return nil, err
	}

	postCounts, err := s.loadPostCounts(ctx, workspaceID, []uuid.UUID{campaignID})
	if err != nil {
		return nil, err
	}

	linkedPosts := make([]postdomain.PostSummary, 0)
	if s.postReader != nil {
		postSummaries, err := s.postReader.ListPosts(ctx, principal, workspaceID)
		if err != nil {
			return nil, err
		}
		for _, post := range postSummaries {
			if post.Campaign != nil && post.Campaign.ID == campaignID.String() {
				linkedPosts = append(linkedPosts, post)
			}
		}
	}

	return &CampaignDetail{
		CampaignSummary: mapCampaignSummary(*record, postCounts[campaignID.String()]),
		LinkedPosts:     linkedPosts,
		MetricSnapshot:  aggregatePostMetricSnapshot(linkedPosts),
	}, nil
}

func (s *Service) CreateCampaign(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpsertCampaignInput) (*CampaignDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.manage"); err != nil {
		return nil, err
	}

	record, postIDs, err := normalizeCampaignInput(workspaceID, principal.UserID, input)
	if err != nil {
		return nil, err
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
			return err
		}
		return s.assignPostsTx(ctx, tx, workspaceID, record.ID, postIDs, nil, &principal.UserID)
	}); err != nil {
		return nil, err
	}

	return s.GetCampaign(ctx, principal, workspaceID, record.ID)
}

func (s *Service) UpdateCampaign(ctx context.Context, principal *iam.Principal, workspaceID, campaignID uuid.UUID, input UpsertCampaignInput) (*CampaignDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.manage"); err != nil {
		return nil, err
	}

	_, err := s.findCampaign(ctx, workspaceID, campaignID)
	if err != nil {
		return nil, err
	}

	normalized, postIDs, err := normalizeCampaignInput(workspaceID, principal.UserID, input)
	if err != nil {
		return nil, err
	}
	normalized.ID = campaignID
	normalized.CreatedByUserID = nil
	normalized.CreatedAt = time.Time{}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().
			Model(normalized).
			Column(
				"status",
				"name",
				"objective",
				"target_audience",
				"message_theme",
				"start_date",
				"end_date",
				"notes",
				"primary_metric_label",
				"primary_metric_target",
				"primary_metric_unit",
				"paid_channels",
				"budget_amount_cents",
				"actual_spend_amount_cents",
				"currency_code",
				"utm_campaign",
				"external_dashboard_url",
				"updated_by_user_id",
				"updated_at",
			).
			Where("workspace_id = ?", workspaceID).
			Where("id = ?", campaignID).
			Exec(ctx); err != nil {
			return err
		}
		return s.assignPostsTx(ctx, tx, workspaceID, campaignID, postIDs, &campaignID, &principal.UserID)
	}); err != nil {
		return nil, err
	}

	return s.GetCampaign(ctx, principal, workspaceID, campaignID)
}

func (s *Service) DeleteCampaign(ctx context.Context, principal *iam.Principal, workspaceID, campaignID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.manage"); err != nil {
		return err
	}

	if _, err := s.findCampaign(ctx, workspaceID, campaignID); err != nil {
		return err
	}

	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().
			Model((*database.Post)(nil)).
			Set("campaign_id = NULL").
			Set("updated_by_user_id = ?", principal.UserID).
			Set("updated_at = ?", time.Now().UTC()).
			Where("workspace_id = ?", workspaceID).
			Where("campaign_id = ?", campaignID).
			Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewDelete().
			Model((*database.Campaign)(nil)).
			Where("workspace_id = ?", workspaceID).
			Where("id = ?", campaignID).
			Exec(ctx)
		return err
	})
}

func (s *Service) findCampaign(ctx context.Context, workspaceID, campaignID uuid.UUID) (*database.Campaign, error) {
	record := new(database.Campaign)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", campaignID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) loadPostCounts(ctx context.Context, workspaceID uuid.UUID, campaignIDs []uuid.UUID) (map[string]int, error) {
	type row struct {
		CampaignID uuid.UUID `bun:"campaign_id"`
		Count      int       `bun:"post_count"`
	}

	result := map[string]int{}
	rows := make([]row, 0)
	query := s.db.NewSelect().
		Table("posts").
		Column("campaign_id").
		ColumnExpr("COUNT(*) AS post_count").
		Where("workspace_id = ?", workspaceID).
		Where("campaign_id IS NOT NULL")
	if len(campaignIDs) > 0 {
		query = query.Where("campaign_id IN (?)", bun.In(campaignIDs))
	}
	if err := query.Group("campaign_id").Scan(ctx, &rows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, item := range rows {
		result[item.CampaignID.String()] = item.Count
	}
	return result, nil
}

func (s *Service) assignPostsTx(
	ctx context.Context,
	tx bun.Tx,
	workspaceID uuid.UUID,
	campaignID uuid.UUID,
	postIDs []uuid.UUID,
	existingCampaignID *uuid.UUID,
	actorUserID *uuid.UUID,
) error {
	if err := s.validatePostAssignmentsTx(ctx, tx, workspaceID, postIDs, existingCampaignID); err != nil {
		return err
	}

	now := time.Now().UTC()
	if existingCampaignID != nil {
		query := tx.NewUpdate().
			Model((*database.Post)(nil)).
			Set("campaign_id = NULL").
			Set("updated_at = ?", now).
			Where("workspace_id = ?", workspaceID).
			Where("campaign_id = ?", *existingCampaignID)
		if actorUserID != nil {
			query = query.Set("updated_by_user_id = ?", *actorUserID)
		}
		if len(postIDs) > 0 {
			query = query.Where("id NOT IN (?)", bun.In(postIDs))
		}
		if _, err := query.Exec(ctx); err != nil {
			return err
		}
	}

	if len(postIDs) == 0 {
		return nil
	}

	query := tx.NewUpdate().
		Model((*database.Post)(nil)).
		Set("campaign_id = ?", campaignID).
		Set("updated_at = ?", now).
		Where("workspace_id = ?", workspaceID).
		Where("id IN (?)", bun.In(postIDs))
	if actorUserID != nil {
		query = query.Set("updated_by_user_id = ?", *actorUserID)
	}
	_, err := query.Exec(ctx)
	return err
}

func (s *Service) validatePostAssignmentsTx(
	ctx context.Context,
	tx bun.Tx,
	workspaceID uuid.UUID,
	postIDs []uuid.UUID,
	existingCampaignID *uuid.UUID,
) error {
	if len(postIDs) == 0 {
		return nil
	}

	uniquePostIDs := dedupeUUIDs(postIDs)
	var records []database.Post
	if err := tx.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		Where("id IN (?)", bun.In(uniquePostIDs)).
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if len(records) != len(uniquePostIDs) {
		return fmt.Errorf("%w: one or more posts could not be found in this workspace", iam.ErrValidation)
	}

	for _, record := range records {
		if record.CampaignID == nil {
			continue
		}
		if existingCampaignID != nil && *record.CampaignID == *existingCampaignID {
			continue
		}
		return fmt.Errorf("%w: post %q already belongs to another campaign", iam.ErrValidation, record.Title)
	}
	return nil
}

func normalizeCampaignInput(
	workspaceID uuid.UUID,
	actorUserID uuid.UUID,
	input UpsertCampaignInput,
) (*database.Campaign, []uuid.UUID, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, nil, fmt.Errorf("%w: campaign name is required", iam.ErrValidation)
	}

	status := strings.TrimSpace(strings.ToLower(input.Status))
	if status == "" {
		status = "draft"
	}
	if !slices.Contains(validCampaignStatuses, status) {
		return nil, nil, fmt.Errorf("%w: invalid campaign status", iam.ErrValidation)
	}

	if input.StartDate.IsZero() || input.EndDate.IsZero() {
		return nil, nil, fmt.Errorf("%w: campaign start and end dates are required", iam.ErrValidation)
	}
	startDate := normalizeDate(input.StartDate)
	endDate := normalizeDate(input.EndDate)
	if endDate.Before(startDate) {
		return nil, nil, fmt.Errorf("%w: campaign end date must be on or after the start date", iam.ErrValidation)
	}

	if input.PrimaryMetricTarget != nil && *input.PrimaryMetricTarget < 0 {
		return nil, nil, fmt.Errorf("%w: campaign metric target must be zero or greater", iam.ErrValidation)
	}
	if input.BudgetAmountCents != nil && *input.BudgetAmountCents < 0 {
		return nil, nil, fmt.Errorf("%w: budget amount must be zero or greater", iam.ErrValidation)
	}
	if input.ActualSpendAmountCents != nil && *input.ActualSpendAmountCents < 0 {
		return nil, nil, fmt.Errorf("%w: actual spend amount must be zero or greater", iam.ErrValidation)
	}

	currencyCode := strings.ToUpper(strings.TrimSpace(input.CurrencyCode))
	if currencyCode != "" && len(currencyCode) != 3 {
		return nil, nil, fmt.Errorf("%w: currency code must be a 3-letter ISO code", iam.ErrValidation)
	}

	externalDashboardURL := strings.TrimSpace(input.ExternalDashboardURL)
	if externalDashboardURL != "" {
		parsed, err := url.Parse(externalDashboardURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return nil, nil, fmt.Errorf("%w: external dashboard URL must be absolute", iam.ErrValidation)
		}
	}

	paidChannels, err := marshalStringSlice(normalizeStringSlice(input.PaidChannels))
	if err != nil {
		return nil, nil, err
	}

	now := time.Now().UTC()
	record := &database.Campaign{
		ID:                     uuid.New(),
		WorkspaceID:            workspaceID,
		Status:                 status,
		Name:                   name,
		Objective:              strings.TrimSpace(input.Objective),
		TargetAudience:         strings.TrimSpace(input.TargetAudience),
		MessageTheme:           strings.TrimSpace(input.MessageTheme),
		StartDate:              startDate,
		EndDate:                endDate,
		Notes:                  strings.TrimSpace(input.Notes),
		PrimaryMetricLabel:     strings.TrimSpace(input.PrimaryMetricLabel),
		PrimaryMetricTarget:    input.PrimaryMetricTarget,
		PrimaryMetricUnit:      strings.TrimSpace(input.PrimaryMetricUnit),
		PaidChannels:           paidChannels,
		BudgetAmountCents:      input.BudgetAmountCents,
		ActualSpendAmountCents: input.ActualSpendAmountCents,
		CurrencyCode:           currencyCode,
		UTMCampaign:            strings.TrimSpace(input.UTMCampaign),
		ExternalDashboardURL:   externalDashboardURL,
		CreatedByUserID:        &actorUserID,
		UpdatedByUserID:        &actorUserID,
		CreatedAt:              now,
		UpdatedAt:              now,
	}
	return record, dedupeUUIDs(input.PostIDs), nil
}

func mapCampaignSummary(record database.Campaign, postCount int) CampaignSummary {
	paidChannels := ensureStringSlice(parseStringSlice(record.PaidChannels))
	return CampaignSummary{
		ID:                     record.ID.String(),
		WorkspaceID:            record.WorkspaceID.String(),
		Status:                 record.Status,
		Name:                   record.Name,
		Objective:              record.Objective,
		TargetAudience:         record.TargetAudience,
		MessageTheme:           record.MessageTheme,
		StartDate:              formatDate(record.StartDate),
		EndDate:                formatDate(record.EndDate),
		Notes:                  record.Notes,
		PrimaryMetricLabel:     record.PrimaryMetricLabel,
		PrimaryMetricTarget:    record.PrimaryMetricTarget,
		PrimaryMetricUnit:      record.PrimaryMetricUnit,
		PaidChannels:           paidChannels,
		BudgetAmountCents:      record.BudgetAmountCents,
		ActualSpendAmountCents: record.ActualSpendAmountCents,
		CurrencyCode:           record.CurrencyCode,
		UTMCampaign:            record.UTMCampaign,
		ExternalDashboardURL:   record.ExternalDashboardURL,
		PostCount:              postCount,
		CreatedAt:              record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:              record.UpdatedAt.Format(time.RFC3339),
	}
}

func aggregatePostMetricSnapshot(posts []postdomain.PostSummary) []postdomain.MetricSnapshotItem {
	type accumulator struct {
		code       string
		label      string
		unit       string
		rollup     string
		value      float64
		observedAt time.Time
	}

	accumulators := map[string]accumulator{}
	for _, post := range posts {
		for _, metric := range post.MetricSnapshot {
			observedAt, err := time.Parse(time.RFC3339, metric.ObservedAt)
			if err != nil {
				observedAt = time.Time{}
			}
			current, exists := accumulators[metric.Code]
			if !exists {
				accumulators[metric.Code] = accumulator{
					code:       metric.Code,
					label:      metric.Label,
					unit:       metric.Unit,
					rollup:     metric.Rollup,
					value:      metric.Value,
					observedAt: observedAt,
				}
				continue
			}
			switch metric.Rollup {
			case "sum":
				current.value += metric.Value
				if observedAt.After(current.observedAt) {
					current.observedAt = observedAt
				}
			default:
				if observedAt.After(current.observedAt) || current.observedAt.IsZero() {
					current.value = metric.Value
					current.observedAt = observedAt
				}
			}
			accumulators[metric.Code] = current
		}
	}

	items := make([]postdomain.MetricSnapshotItem, 0, len(accumulators))
	for _, item := range accumulators {
		items = append(items, postdomain.MetricSnapshotItem{
			Code:       item.code,
			Label:      item.label,
			Unit:       item.unit,
			Rollup:     item.rollup,
			Value:      item.value,
			ObservedAt: item.observedAt.Format(time.RFC3339),
		})
	}
	slices.SortFunc(items, func(left, right postdomain.MetricSnapshotItem) int {
		if left.Label != right.Label {
			return strings.Compare(left.Label, right.Label)
		}
		return strings.Compare(left.Code, right.Code)
	})
	return items
}

func normalizeDate(value time.Time) time.Time {
	return time.Date(value.UTC().Year(), value.UTC().Month(), value.UTC().Day(), 0, 0, 0, 0, time.UTC)
}

func formatDate(value time.Time) string {
	return value.UTC().Format("2006-01-02")
}

func dedupeUUIDs(values []uuid.UUID) []uuid.UUID {
	result := make([]uuid.UUID, 0, len(values))
	seen := map[uuid.UUID]struct{}{}
	for _, value := range values {
		if value == uuid.Nil {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func normalizeStringSlice(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			continue
		}
		key := strings.ToLower(normalized)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, normalized)
	}
	slices.Sort(result)
	return result
}

func marshalStringSlice(values []string) (string, error) {
	payload, err := json.Marshal(values)
	if err != nil {
		return "", fmt.Errorf("%w: invalid paid channels payload", iam.ErrValidation)
	}
	return string(payload), nil
}

func parseStringSlice(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}
	var items []string
	if err := json.Unmarshal([]byte(value), &items); err != nil {
		return []string{}
	}
	return items
}

func ensureStringSlice(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}
