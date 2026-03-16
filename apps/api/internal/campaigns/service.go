package campaigns

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	postdomain "github.com/heimdall/api/internal/posts"
)

var (
	validCampaignStatuses = []string{"draft", "planned", "active", "completed", "archived"}
	validScheduleCadence  = []string{"daily_interval", "weekly"}
	validScheduleWeekdays = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
	healthyTargetStatuses = []string{"active", "connected", "healthy", "ready"}
	localTimePattern      = regexp.MustCompile(`^(?:[01]\d|2[0-3]):[0-5]\d$`)
)

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

type CampaignDeliveryTargetInput struct {
	SocialTargetID uuid.UUID
}

type CampaignScheduleRuleInput struct {
	SocialTargetID uuid.UUID
	Enabled        *bool
	CadenceType    string
	Interval       int
	Weekdays       []string
	TimesLocal     []string
	StartDate      *time.Time
	EndDate        *time.Time
}

type UpsertCampaignInput struct {
	Status                 string
	Name                   string
	Objective              string
	TargetAudience         string
	MessageTheme           string
	StartDate              time.Time
	EndDate                *time.Time
	DefaultTimezone        string
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
	DeliveryTargets        []CampaignDeliveryTargetInput
	ScheduleRules          []CampaignScheduleRuleInput
}

type CampaignDeliveryTarget struct {
	ID             string `json:"id"`
	SocialTargetID string `json:"socialTargetId"`
	Provider       string `json:"provider"`
	DisplayName    string `json:"displayName"`
	Username       string `json:"username,omitempty"`
	TargetType     string `json:"targetType"`
	Status         string `json:"status"`
	IsSelected     bool   `json:"isSelected"`
}

type CampaignScheduleRule struct {
	ID             string   `json:"id"`
	SocialTargetID string   `json:"socialTargetId"`
	Enabled        bool     `json:"enabled"`
	CadenceType    string   `json:"cadenceType"`
	Interval       int      `json:"interval"`
	Weekdays       []string `json:"weekdays"`
	TimesLocal     []string `json:"timesLocal"`
	StartDate      string   `json:"startDate,omitempty"`
	EndDate        string   `json:"endDate,omitempty"`
	Summary        string   `json:"summary"`
}

type CampaignAutomationReadiness struct {
	Ready    bool     `json:"ready"`
	Issues   []string `json:"issues"`
	Warnings []string `json:"warnings"`
}

type CampaignSummary struct {
	ID                     string                      `json:"id"`
	WorkspaceID            string                      `json:"workspaceId"`
	Status                 string                      `json:"status"`
	Name                   string                      `json:"name"`
	Objective              string                      `json:"objective,omitempty"`
	TargetAudience         string                      `json:"targetAudience,omitempty"`
	MessageTheme           string                      `json:"messageTheme,omitempty"`
	StartDate              string                      `json:"startDate"`
	EndDate                string                      `json:"endDate,omitempty"`
	DefaultTimezone        string                      `json:"defaultTimezone"`
	Notes                  string                      `json:"notes,omitempty"`
	PrimaryMetricLabel     string                      `json:"primaryMetricLabel,omitempty"`
	PrimaryMetricTarget    *float64                    `json:"primaryMetricTarget,omitempty"`
	PrimaryMetricUnit      string                      `json:"primaryMetricUnit,omitempty"`
	PaidChannels           []string                    `json:"paidChannels"`
	BudgetAmountCents      *int64                      `json:"budgetAmountCents,omitempty"`
	ActualSpendAmountCents *int64                      `json:"actualSpendAmountCents,omitempty"`
	CurrencyCode           string                      `json:"currencyCode,omitempty"`
	UTMCampaign            string                      `json:"utmCampaign,omitempty"`
	ExternalDashboardURL   string                      `json:"externalDashboardUrl,omitempty"`
	PostCount              int                         `json:"postCount"`
	DeliveryTargetCount    int                         `json:"deliveryTargetCount"`
	ScheduleRuleCount      int                         `json:"scheduleRuleCount"`
	AutomationReadiness    CampaignAutomationReadiness `json:"automationReadiness"`
	CreatedAt              string                      `json:"createdAt"`
	UpdatedAt              string                      `json:"updatedAt"`
}

type CampaignDetail struct {
	CampaignSummary
	DeliveryTargets []CampaignDeliveryTarget        `json:"deliveryTargets"`
	ScheduleRules   []CampaignScheduleRule          `json:"scheduleRules"`
	LinkedPosts     []postdomain.PostSummary        `json:"linkedPosts"`
	MetricSnapshot  []postdomain.MetricSnapshotItem `json:"metricSnapshot"`
}

type normalizedCampaignScheduleRule struct {
	SocialTargetID uuid.UUID
	Enabled        bool
	CadenceType    string
	Interval       int
	Weekdays       []string
	TimesLocal     []string
	StartDate      *time.Time
	EndDate        *time.Time
}

type campaignDeliveryTargetRow struct {
	CampaignID     uuid.UUID `bun:"campaign_id"`
	ID             uuid.UUID `bun:"id"`
	SocialTargetID uuid.UUID `bun:"social_target_id"`
	Provider       string    `bun:"provider"`
	DisplayName    string    `bun:"display_name"`
	Username       *string   `bun:"username"`
	TargetType     string    `bun:"target_type"`
	Status         string    `bun:"status"`
	IsSelected     bool      `bun:"is_selected"`
}

type campaignScheduleRuleRow struct {
	CampaignID     uuid.UUID  `bun:"campaign_id"`
	ID             uuid.UUID  `bun:"id"`
	SocialTargetID uuid.UUID  `bun:"social_target_id"`
	Enabled        bool       `bun:"enabled"`
	CadenceType    string     `bun:"cadence_type"`
	Interval       int        `bun:"interval"`
	Weekdays       string     `bun:"weekdays"`
	TimesLocal     string     `bun:"times_local"`
	StartDate      *time.Time `bun:"start_date"`
	EndDate        *time.Time `bun:"end_date"`
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

	campaignIDs := make([]uuid.UUID, 0, len(records))
	for _, record := range records {
		campaignIDs = append(campaignIDs, record.ID)
	}
	deliveryTargetsByCampaign, err := s.loadCampaignDeliveryTargets(ctx, workspaceID, campaignIDs)
	if err != nil {
		return nil, err
	}
	scheduleRulesByCampaign, err := s.loadCampaignScheduleRules(ctx, workspaceID, campaignIDs)
	if err != nil {
		return nil, err
	}

	items := make([]CampaignSummary, 0, len(records))
	for _, record := range records {
		items = append(items, mapCampaignSummary(
			record,
			postCounts[record.ID.String()],
			deliveryTargetsByCampaign[record.ID.String()],
			scheduleRulesByCampaign[record.ID.String()],
		))
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
	deliveryTargetsByCampaign, err := s.loadCampaignDeliveryTargets(ctx, workspaceID, []uuid.UUID{campaignID})
	if err != nil {
		return nil, err
	}
	scheduleRulesByCampaign, err := s.loadCampaignScheduleRules(ctx, workspaceID, []uuid.UUID{campaignID})
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
		CampaignSummary: mapCampaignSummary(
			*record,
			postCounts[campaignID.String()],
			deliveryTargetsByCampaign[campaignID.String()],
			scheduleRulesByCampaign[campaignID.String()],
		),
		DeliveryTargets: ensureCampaignDeliveryTargets(deliveryTargetsByCampaign[campaignID.String()]),
		ScheduleRules:   ensureCampaignScheduleRules(scheduleRulesByCampaign[campaignID.String()]),
		LinkedPosts:     linkedPosts,
		MetricSnapshot:  aggregatePostMetricSnapshot(linkedPosts),
	}, nil
}

func (s *Service) CreateCampaign(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input UpsertCampaignInput) (*CampaignDetail, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.campaigns.manage"); err != nil {
		return nil, err
	}

	record, postIDs, deliveryTargetIDs, scheduleRules, err := normalizeCampaignInput(workspaceID, principal.UserID, input)
	if err != nil {
		return nil, err
	}
	if err := s.validateCampaignTargetsAndRules(ctx, workspaceID, deliveryTargetIDs, scheduleRules); err != nil {
		return nil, err
	}

	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
			return err
		}
		if err := s.replaceCampaignDeliveryTargetsTx(ctx, tx, record.ID, deliveryTargetIDs, principal.UserID); err != nil {
			return err
		}
		if err := s.replaceCampaignScheduleRulesTx(ctx, tx, record.ID, scheduleRules, principal.UserID); err != nil {
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

	normalized, postIDs, deliveryTargetIDs, scheduleRules, err := normalizeCampaignInput(workspaceID, principal.UserID, input)
	if err != nil {
		return nil, err
	}
	if err := s.validateCampaignTargetsAndRules(ctx, workspaceID, deliveryTargetIDs, scheduleRules); err != nil {
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
				"default_timezone",
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
		if err := s.replaceCampaignDeliveryTargetsTx(ctx, tx, campaignID, deliveryTargetIDs, principal.UserID); err != nil {
			return err
		}
		if err := s.replaceCampaignScheduleRulesTx(ctx, tx, campaignID, scheduleRules, principal.UserID); err != nil {
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

func (s *Service) loadCampaignDeliveryTargets(ctx context.Context, workspaceID uuid.UUID, campaignIDs []uuid.UUID) (map[string][]CampaignDeliveryTarget, error) {
	result := map[string][]CampaignDeliveryTarget{}
	if len(campaignIDs) == 0 {
		return result, nil
	}

	rows := make([]campaignDeliveryTargetRow, 0)
	if err := s.db.NewSelect().
		TableExpr("campaign_delivery_targets AS cdt").
		Join("JOIN campaigns AS c ON c.id = cdt.campaign_id").
		Join("JOIN social_targets AS st ON st.id = cdt.social_target_id").
		ColumnExpr("cdt.campaign_id").
		ColumnExpr("cdt.id").
		ColumnExpr("cdt.social_target_id").
		ColumnExpr("st.provider").
		ColumnExpr("st.display_name").
		ColumnExpr("st.username").
		ColumnExpr("st.target_type").
		ColumnExpr("st.status").
		ColumnExpr("st.is_selected").
		Where("c.workspace_id = ?", workspaceID).
		Where("cdt.campaign_id IN (?)", bun.In(campaignIDs)).
		OrderExpr("st.provider ASC, st.display_name ASC").
		Scan(ctx, &rows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	for _, row := range rows {
		item := CampaignDeliveryTarget{
			ID:             row.ID.String(),
			SocialTargetID: row.SocialTargetID.String(),
			Provider:       row.Provider,
			DisplayName:    row.DisplayName,
			TargetType:     row.TargetType,
			Status:         row.Status,
			IsSelected:     row.IsSelected,
		}
		if row.Username != nil {
			item.Username = *row.Username
		}
		result[row.CampaignID.String()] = append(result[row.CampaignID.String()], item)
	}
	return result, nil
}

func (s *Service) loadCampaignScheduleRules(ctx context.Context, workspaceID uuid.UUID, campaignIDs []uuid.UUID) (map[string][]CampaignScheduleRule, error) {
	result := map[string][]CampaignScheduleRule{}
	if len(campaignIDs) == 0 {
		return result, nil
	}

	rows := make([]campaignScheduleRuleRow, 0)
	if err := s.db.NewSelect().
		TableExpr("campaign_schedule_rules AS csr").
		Join("JOIN campaigns AS c ON c.id = csr.campaign_id").
		ColumnExpr("csr.campaign_id").
		ColumnExpr("csr.id").
		ColumnExpr("csr.social_target_id").
		ColumnExpr("csr.enabled").
		ColumnExpr("csr.cadence_type").
		ColumnExpr("csr.interval").
		ColumnExpr("csr.weekdays").
		ColumnExpr("csr.times_local").
		ColumnExpr("csr.start_date").
		ColumnExpr("csr.end_date").
		Where("c.workspace_id = ?", workspaceID).
		Where("csr.campaign_id IN (?)", bun.In(campaignIDs)).
		OrderExpr("csr.social_target_id ASC, csr.created_at ASC").
		Scan(ctx, &rows); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	for _, row := range rows {
		weekdays := ensureStringSlice(parseStringSlice(row.Weekdays))
		timesLocal := ensureStringSlice(parseStringSlice(row.TimesLocal))
		item := CampaignScheduleRule{
			ID:             row.ID.String(),
			SocialTargetID: row.SocialTargetID.String(),
			Enabled:        row.Enabled,
			CadenceType:    row.CadenceType,
			Interval:       row.Interval,
			Weekdays:       weekdays,
			TimesLocal:     timesLocal,
			Summary:        summarizeCampaignScheduleRule(row.CadenceType, row.Interval, weekdays, timesLocal),
		}
		if row.StartDate != nil {
			item.StartDate = formatDate(*row.StartDate)
		}
		if row.EndDate != nil {
			item.EndDate = formatDate(*row.EndDate)
		}
		result[row.CampaignID.String()] = append(result[row.CampaignID.String()], item)
	}
	return result, nil
}

func (s *Service) validateCampaignTargetsAndRules(ctx context.Context, workspaceID uuid.UUID, deliveryTargetIDs []uuid.UUID, scheduleRules []normalizedCampaignScheduleRule) error {
	if len(deliveryTargetIDs) == 0 && len(scheduleRules) > 0 {
		return fmt.Errorf("%w: attach at least one delivery target before adding schedule rules", iam.ErrValidation)
	}

	allowedTargets := map[uuid.UUID]struct{}{}
	for _, targetID := range deliveryTargetIDs {
		allowedTargets[targetID] = struct{}{}
	}
	if len(deliveryTargetIDs) > 0 {
		count, err := s.db.NewSelect().
			Table("social_targets").
			Where("workspace_id = ?", workspaceID).
			Where("id IN (?)", bun.In(deliveryTargetIDs)).
			Count(ctx)
		if err != nil {
			return err
		}
		if count != len(deliveryTargetIDs) {
			return fmt.Errorf("%w: one or more delivery targets could not be found in this workspace", iam.ErrValidation)
		}
	}

	for _, rule := range scheduleRules {
		if _, ok := allowedTargets[rule.SocialTargetID]; !ok {
			return fmt.Errorf("%w: every schedule rule must reference an attached delivery target", iam.ErrValidation)
		}
	}
	return nil
}

func (s *Service) replaceCampaignDeliveryTargetsTx(ctx context.Context, tx bun.Tx, campaignID uuid.UUID, deliveryTargetIDs []uuid.UUID, actorUserID uuid.UUID) error {
	if _, err := tx.NewDelete().
		Model((*database.CampaignDeliveryTarget)(nil)).
		Where("campaign_id = ?", campaignID).
		Exec(ctx); err != nil {
		return err
	}
	if len(deliveryTargetIDs) == 0 {
		return nil
	}

	now := time.Now().UTC()
	records := make([]database.CampaignDeliveryTarget, 0, len(deliveryTargetIDs))
	for _, targetID := range deliveryTargetIDs {
		records = append(records, database.CampaignDeliveryTarget{
			ID:              uuid.New(),
			CampaignID:      campaignID,
			SocialTargetID:  targetID,
			CreatedByUserID: &actorUserID,
			UpdatedByUserID: &actorUserID,
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}
	_, err := tx.NewInsert().Model(&records).Exec(ctx)
	return err
}

func (s *Service) replaceCampaignScheduleRulesTx(ctx context.Context, tx bun.Tx, campaignID uuid.UUID, scheduleRules []normalizedCampaignScheduleRule, actorUserID uuid.UUID) error {
	if _, err := tx.NewDelete().
		Model((*database.CampaignScheduleRule)(nil)).
		Where("campaign_id = ?", campaignID).
		Exec(ctx); err != nil {
		return err
	}
	if len(scheduleRules) == 0 {
		return nil
	}

	now := time.Now().UTC()
	records := make([]database.CampaignScheduleRule, 0, len(scheduleRules))
	for _, rule := range scheduleRules {
		weekdays, err := marshalStringSlice(rule.Weekdays, "schedule weekdays")
		if err != nil {
			return err
		}
		timesLocal, err := marshalStringSlice(rule.TimesLocal, "schedule times")
		if err != nil {
			return err
		}
		records = append(records, database.CampaignScheduleRule{
			ID:              uuid.New(),
			CampaignID:      campaignID,
			SocialTargetID:  rule.SocialTargetID,
			Enabled:         rule.Enabled,
			CadenceType:     rule.CadenceType,
			Interval:        rule.Interval,
			Weekdays:        weekdays,
			TimesLocal:      timesLocal,
			StartDate:       rule.StartDate,
			EndDate:         rule.EndDate,
			CreatedByUserID: &actorUserID,
			UpdatedByUserID: &actorUserID,
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}
	_, err := tx.NewInsert().Model(&records).Exec(ctx)
	return err
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
) (*database.Campaign, []uuid.UUID, []uuid.UUID, []normalizedCampaignScheduleRule, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, nil, nil, nil, fmt.Errorf("%w: campaign name is required", iam.ErrValidation)
	}

	status := strings.TrimSpace(strings.ToLower(input.Status))
	if status == "" {
		status = "draft"
	}
	if !slices.Contains(validCampaignStatuses, status) {
		return nil, nil, nil, nil, fmt.Errorf("%w: invalid campaign status", iam.ErrValidation)
	}

	if input.StartDate.IsZero() {
		return nil, nil, nil, nil, fmt.Errorf("%w: campaign start date is required", iam.ErrValidation)
	}
	startDate := normalizeDate(input.StartDate)
	var endDate *time.Time
	if input.EndDate != nil && !input.EndDate.IsZero() {
		normalizedEndDate := normalizeDate(*input.EndDate)
		endDate = &normalizedEndDate
		if normalizedEndDate.Before(startDate) {
			return nil, nil, nil, nil, fmt.Errorf("%w: campaign end date must be on or after the start date", iam.ErrValidation)
		}
	}

	if input.PrimaryMetricTarget != nil && *input.PrimaryMetricTarget < 0 {
		return nil, nil, nil, nil, fmt.Errorf("%w: campaign metric target must be zero or greater", iam.ErrValidation)
	}
	if input.BudgetAmountCents != nil && *input.BudgetAmountCents < 0 {
		return nil, nil, nil, nil, fmt.Errorf("%w: budget amount must be zero or greater", iam.ErrValidation)
	}
	if input.ActualSpendAmountCents != nil && *input.ActualSpendAmountCents < 0 {
		return nil, nil, nil, nil, fmt.Errorf("%w: actual spend amount must be zero or greater", iam.ErrValidation)
	}

	currencyCode := strings.ToUpper(strings.TrimSpace(input.CurrencyCode))
	if currencyCode != "" && len(currencyCode) != 3 {
		return nil, nil, nil, nil, fmt.Errorf("%w: currency code must be a 3-letter ISO code", iam.ErrValidation)
	}

	defaultTimezone := strings.TrimSpace(input.DefaultTimezone)
	if defaultTimezone == "" {
		defaultTimezone = "UTC"
	}
	if _, err := time.LoadLocation(defaultTimezone); err != nil {
		return nil, nil, nil, nil, fmt.Errorf("%w: campaign timezone must be a valid IANA timezone", iam.ErrValidation)
	}

	externalDashboardURL := strings.TrimSpace(input.ExternalDashboardURL)
	if externalDashboardURL != "" {
		parsed, err := url.Parse(externalDashboardURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			return nil, nil, nil, nil, fmt.Errorf("%w: external dashboard URL must be absolute", iam.ErrValidation)
		}
	}

	paidChannels, err := marshalStringSlice(normalizeStringSlice(input.PaidChannels), "paid channels")
	if err != nil {
		return nil, nil, nil, nil, err
	}

	deliveryTargetIDs := make([]uuid.UUID, 0, len(input.DeliveryTargets))
	for _, target := range input.DeliveryTargets {
		if target.SocialTargetID == uuid.Nil {
			return nil, nil, nil, nil, fmt.Errorf("%w: delivery targets require a social target id", iam.ErrValidation)
		}
		deliveryTargetIDs = append(deliveryTargetIDs, target.SocialTargetID)
	}
	deliveryTargetIDs = dedupeUUIDs(deliveryTargetIDs)

	scheduleRules, err := normalizeCampaignScheduleRules(input.ScheduleRules, startDate, endDate)
	if err != nil {
		return nil, nil, nil, nil, err
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
		DefaultTimezone:        defaultTimezone,
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
	return record, dedupeUUIDs(input.PostIDs), deliveryTargetIDs, scheduleRules, nil
}

func normalizeCampaignScheduleRules(inputs []CampaignScheduleRuleInput, campaignStart time.Time, campaignEnd *time.Time) ([]normalizedCampaignScheduleRule, error) {
	result := make([]normalizedCampaignScheduleRule, 0, len(inputs))
	for _, input := range inputs {
		if input.SocialTargetID == uuid.Nil {
			return nil, fmt.Errorf("%w: schedule rules require a social target id", iam.ErrValidation)
		}
		cadenceType := strings.TrimSpace(strings.ToLower(input.CadenceType))
		if !slices.Contains(validScheduleCadence, cadenceType) {
			return nil, fmt.Errorf("%w: invalid schedule cadence type", iam.ErrValidation)
		}
		if input.Interval < 1 {
			return nil, fmt.Errorf("%w: schedule interval must be at least 1", iam.ErrValidation)
		}

		weekdays, err := normalizeWeekdays(input.Weekdays)
		if err != nil {
			return nil, err
		}
		if cadenceType == "weekly" && len(weekdays) == 0 {
			return nil, fmt.Errorf("%w: weekly schedules require at least one weekday", iam.ErrValidation)
		}
		if cadenceType != "weekly" {
			weekdays = []string{}
		}

		timesLocal, err := normalizeLocalTimes(input.TimesLocal)
		if err != nil {
			return nil, err
		}
		if len(timesLocal) == 0 {
			return nil, fmt.Errorf("%w: schedule rules require at least one local time", iam.ErrValidation)
		}

		var startDate *time.Time
		if input.StartDate != nil && !input.StartDate.IsZero() {
			normalizedStartDate := normalizeDate(*input.StartDate)
			startDate = &normalizedStartDate
			if normalizedStartDate.Before(campaignStart) {
				return nil, fmt.Errorf("%w: schedule rule start date must be on or after the campaign start date", iam.ErrValidation)
			}
		}

		var endDate *time.Time
		if input.EndDate != nil && !input.EndDate.IsZero() {
			normalizedEndDate := normalizeDate(*input.EndDate)
			endDate = &normalizedEndDate
			if normalizedEndDate.Before(campaignStart) {
				return nil, fmt.Errorf("%w: schedule rule end date must be on or after the campaign start date", iam.ErrValidation)
			}
		}
		if startDate != nil && endDate != nil && endDate.Before(*startDate) {
			return nil, fmt.Errorf("%w: schedule rule end date must be on or after the start date", iam.ErrValidation)
		}
		if campaignEnd != nil {
			if startDate != nil && startDate.After(*campaignEnd) {
				return nil, fmt.Errorf("%w: schedule rule start date must fall within the campaign window", iam.ErrValidation)
			}
			if endDate != nil && endDate.After(*campaignEnd) {
				return nil, fmt.Errorf("%w: schedule rule end date must fall within the campaign window", iam.ErrValidation)
			}
		}

		enabled := true
		if input.Enabled != nil {
			enabled = *input.Enabled
		}
		result = append(result, normalizedCampaignScheduleRule{
			SocialTargetID: input.SocialTargetID,
			Enabled:        enabled,
			CadenceType:    cadenceType,
			Interval:       input.Interval,
			Weekdays:       weekdays,
			TimesLocal:     timesLocal,
			StartDate:      startDate,
			EndDate:        endDate,
		})
	}
	return result, nil
}

func mapCampaignSummary(
	record database.Campaign,
	postCount int,
	deliveryTargets []CampaignDeliveryTarget,
	scheduleRules []CampaignScheduleRule,
) CampaignSummary {
	paidChannels := ensureStringSlice(parseStringSlice(record.PaidChannels))
	readiness := buildCampaignAutomationReadiness(deliveryTargets, scheduleRules)
	return CampaignSummary{
		ID:                     record.ID.String(),
		WorkspaceID:            record.WorkspaceID.String(),
		Status:                 record.Status,
		Name:                   record.Name,
		Objective:              record.Objective,
		TargetAudience:         record.TargetAudience,
		MessageTheme:           record.MessageTheme,
		StartDate:              formatDate(record.StartDate),
		EndDate:                formatDatePtr(record.EndDate),
		DefaultTimezone:        record.DefaultTimezone,
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
		DeliveryTargetCount:    len(deliveryTargets),
		ScheduleRuleCount:      len(scheduleRules),
		AutomationReadiness:    readiness,
		CreatedAt:              record.CreatedAt.Format(time.RFC3339),
		UpdatedAt:              record.UpdatedAt.Format(time.RFC3339),
	}
}

func buildCampaignAutomationReadiness(deliveryTargets []CampaignDeliveryTarget, scheduleRules []CampaignScheduleRule) CampaignAutomationReadiness {
	issues := make([]string, 0, 2)
	warnings := make([]string, 0)
	if len(deliveryTargets) == 0 {
		issues = append(issues, "Add at least one delivery target to prepare this campaign for automation.")
	}
	if len(scheduleRules) == 0 {
		issues = append(issues, "Add at least one posting cadence before automation can run this campaign.")
	}

	seenWarnings := map[string]struct{}{}
	for _, target := range deliveryTargets {
		if !target.IsSelected {
			message := fmt.Sprintf("%s is attached but not selected as an active publishing target.", target.DisplayName)
			if _, exists := seenWarnings[message]; !exists {
				seenWarnings[message] = struct{}{}
				warnings = append(warnings, message)
			}
		}
		if !slices.Contains(healthyTargetStatuses, strings.ToLower(target.Status)) {
			message := fmt.Sprintf("%s currently reports %s status and may block future automation runs.", target.DisplayName, target.Status)
			if _, exists := seenWarnings[message]; !exists {
				seenWarnings[message] = struct{}{}
				warnings = append(warnings, message)
			}
		}
	}

	return CampaignAutomationReadiness{
		Ready:    len(issues) == 0,
		Issues:   ensureStringSlice(issues),
		Warnings: ensureStringSlice(warnings),
	}
}

func summarizeCampaignScheduleRule(cadenceType string, interval int, weekdays, timesLocal []string) string {
	timeSummary := strings.Join(timesLocal, ", ")
	switch cadenceType {
	case "weekly":
		weekdayLabels := make([]string, 0, len(weekdays))
		for _, weekday := range weekdays {
			weekdayLabels = append(weekdayLabels, formatWeekdayLabel(weekday))
		}
		if interval == 1 {
			return fmt.Sprintf("Every week on %s at %s", strings.Join(weekdayLabels, ", "), timeSummary)
		}
		return fmt.Sprintf("Every %d weeks on %s at %s", interval, strings.Join(weekdayLabels, ", "), timeSummary)
	default:
		if interval == 1 {
			return fmt.Sprintf("Every day at %s", timeSummary)
		}
		return fmt.Sprintf("Every %d days at %s", interval, timeSummary)
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

func formatDatePtr(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return formatDate(*value)
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

func normalizeWeekdays(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		normalized := strings.TrimSpace(strings.ToLower(value))
		if normalized == "" {
			continue
		}
		if !slices.Contains(validScheduleWeekdays, normalized) {
			return nil, fmt.Errorf("%w: invalid schedule weekday", iam.ErrValidation)
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	slices.SortFunc(result, func(left, right string) int {
		return slices.Index(validScheduleWeekdays, left) - slices.Index(validScheduleWeekdays, right)
	})
	return result, nil
}

func normalizeLocalTimes(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		normalized := strings.TrimSpace(value)
		if normalized == "" {
			continue
		}
		if !localTimePattern.MatchString(normalized) {
			return nil, fmt.Errorf("%w: schedule times must use HH:MM 24-hour format", iam.ErrValidation)
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	slices.Sort(result)
	return result, nil
}

func marshalStringSlice(values []string, fieldName string) (string, error) {
	payload, err := json.Marshal(values)
	if err != nil {
		return "", fmt.Errorf("%w: invalid %s payload", iam.ErrValidation, fieldName)
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

func ensureCampaignDeliveryTargets(values []CampaignDeliveryTarget) []CampaignDeliveryTarget {
	if values == nil {
		return []CampaignDeliveryTarget{}
	}
	return values
}

func ensureCampaignScheduleRules(values []CampaignScheduleRule) []CampaignScheduleRule {
	if values == nil {
		return []CampaignScheduleRule{}
	}
	return values
}

func formatWeekdayLabel(value string) string {
	switch value {
	case "mon":
		return "Mon"
	case "tue":
		return "Tue"
	case "wed":
		return "Wed"
	case "thu":
		return "Thu"
	case "fri":
		return "Fri"
	case "sat":
		return "Sat"
	case "sun":
		return "Sun"
	default:
		return value
	}
}
