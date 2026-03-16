package campaigns

import (
	"testing"
	"time"

	"github.com/google/uuid"

	postdomain "github.com/heimdall/api/internal/posts"
)

func TestNormalizeCampaignInputRequiresNameAndValidWindow(t *testing.T) {
	t.Parallel()

	workspaceID := uuid.New()
	userID := uuid.New()
	start := time.Date(2026, 3, 16, 12, 0, 0, 0, time.UTC)
	end := start.Add(-24 * time.Hour)

	if _, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		StartDate: start,
	}); err == nil {
		t.Fatalf("expected missing name to fail")
	}

	if _, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:      "Launch",
		StartDate: start,
		EndDate:   &end,
	}); err == nil {
		t.Fatalf("expected invalid window to fail")
	}
}

func TestNormalizeCampaignInputNormalizesDatesChannelsAndPostIDs(t *testing.T) {
	t.Parallel()

	workspaceID := uuid.New()
	userID := uuid.New()
	postID := uuid.New()
	targetID := uuid.New()
	start := time.Date(2026, 3, 16, 12, 45, 0, 0, time.UTC)
	end := time.Date(2026, 3, 19, 1, 5, 0, 0, time.UTC)
	enabled := true

	record, postIDs, deliveryTargetIDs, scheduleRules, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:            "Launch",
		Status:          "active",
		StartDate:       start,
		EndDate:         &end,
		DefaultTimezone: "Asia/Dhaka",
		PaidChannels:    []string{"google_ads", "meta_ads", "google_ads"},
		PostIDs:         []uuid.UUID{postID, postID},
		DeliveryTargets: []CampaignDeliveryTargetInput{{SocialTargetID: targetID}},
		ScheduleRules: []CampaignScheduleRuleInput{{
			SocialTargetID: targetID,
			Enabled:        &enabled,
			CadenceType:    "weekly",
			Interval:       1,
			Weekdays:       []string{"wed", "mon", "wed"},
			TimesLocal:     []string{"09:00", "18:30", "09:00"},
		}},
	})
	if err != nil {
		t.Fatalf("normalizeCampaignInput() error = %v", err)
	}

	if got := formatDate(record.StartDate); got != "2026-03-16" {
		t.Fatalf("expected normalized start date, got %q", got)
	}
	if got := formatDatePtr(record.EndDate); got != "2026-03-19" {
		t.Fatalf("expected normalized end date, got %q", got)
	}
	if record.DefaultTimezone != "Asia/Dhaka" {
		t.Fatalf("expected timezone to normalize, got %q", record.DefaultTimezone)
	}
	if got := parseStringSlice(record.PaidChannels); len(got) != 2 {
		t.Fatalf("expected deduped paid channels, got %#v", got)
	}
	if len(postIDs) != 1 || postIDs[0] != postID {
		t.Fatalf("expected deduped post ids, got %#v", postIDs)
	}
	if len(deliveryTargetIDs) != 1 || deliveryTargetIDs[0] != targetID {
		t.Fatalf("expected deduped delivery targets, got %#v", deliveryTargetIDs)
	}
	if len(scheduleRules) != 1 {
		t.Fatalf("expected one normalized schedule rule, got %#v", scheduleRules)
	}
	if got := scheduleRules[0].Weekdays; len(got) != 2 || got[0] != "mon" || got[1] != "wed" {
		t.Fatalf("expected normalized weekdays, got %#v", got)
	}
	if got := scheduleRules[0].TimesLocal; len(got) != 2 || got[0] != "09:00" || got[1] != "18:30" {
		t.Fatalf("expected normalized times, got %#v", got)
	}
}

func TestNormalizeCampaignInputAllowsOpenEndedCampaignAndRejectsInvalidScheduleBits(t *testing.T) {
	t.Parallel()

	workspaceID := uuid.New()
	userID := uuid.New()
	targetID := uuid.New()
	start := time.Date(2026, 3, 16, 12, 45, 0, 0, time.UTC)

	record, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:            "Evergreen reach",
		StartDate:       start,
		DefaultTimezone: "UTC",
	})
	if err != nil {
		t.Fatalf("expected open-ended campaign to normalize, got %v", err)
	}
	if record.EndDate != nil {
		t.Fatalf("expected nil end date for open-ended campaign")
	}

	if _, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:            "Bad timezone",
		StartDate:       start,
		DefaultTimezone: "Mars/Phobos",
	}); err == nil {
		t.Fatalf("expected invalid timezone to fail")
	}

	if _, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:            "Bad rule",
		StartDate:       start,
		DefaultTimezone: "UTC",
		DeliveryTargets: []CampaignDeliveryTargetInput{{SocialTargetID: targetID}},
		ScheduleRules: []CampaignScheduleRuleInput{{
			SocialTargetID: targetID,
			CadenceType:    "weekly",
			Interval:       1,
			Weekdays:       []string{"monday"},
			TimesLocal:     []string{"09:00"},
		}},
	}); err == nil {
		t.Fatalf("expected invalid weekday to fail")
	}

	if _, _, _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:            "Bad time",
		StartDate:       start,
		DefaultTimezone: "UTC",
		DeliveryTargets: []CampaignDeliveryTargetInput{{SocialTargetID: targetID}},
		ScheduleRules: []CampaignScheduleRuleInput{{
			SocialTargetID: targetID,
			CadenceType:    "daily_interval",
			Interval:       1,
			TimesLocal:     []string{"25:99"},
		}},
	}); err == nil {
		t.Fatalf("expected invalid local time to fail")
	}
}

func TestAggregatePostMetricSnapshotAggregatesSumAndLatest(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 3, 16, 9, 0, 0, 0, time.UTC)
	later := now.Add(30 * time.Minute)

	snapshot := aggregatePostMetricSnapshot([]postdomain.PostSummary{
		{
			MetricSnapshot: []postdomain.MetricSnapshotItem{
				{
					Code:       "impressions",
					Label:      "Impressions",
					Unit:       "count",
					Rollup:     "sum",
					Value:      200,
					ObservedAt: now.Format(time.RFC3339),
				},
				{
					Code:       "engagement_rate",
					Label:      "Engagement rate",
					Unit:       "ratio",
					Rollup:     "latest",
					Value:      0.08,
					ObservedAt: now.Format(time.RFC3339),
				},
			},
		},
		{
			MetricSnapshot: []postdomain.MetricSnapshotItem{
				{
					Code:       "impressions",
					Label:      "Impressions",
					Unit:       "count",
					Rollup:     "sum",
					Value:      180,
					ObservedAt: later.Format(time.RFC3339),
				},
				{
					Code:       "engagement_rate",
					Label:      "Engagement rate",
					Unit:       "ratio",
					Rollup:     "latest",
					Value:      0.11,
					ObservedAt: later.Format(time.RFC3339),
				},
			},
		},
	})

	if len(snapshot) != 2 {
		t.Fatalf("expected 2 metric rows, got %d", len(snapshot))
	}
	if snapshot[0].Code != "engagement_rate" || snapshot[0].Value != 0.11 {
		t.Fatalf("expected latest metric to win, got %#v", snapshot[0])
	}
	if snapshot[1].Code != "impressions" || snapshot[1].Value != 380 {
		t.Fatalf("expected summed impressions, got %#v", snapshot[1])
	}
}
