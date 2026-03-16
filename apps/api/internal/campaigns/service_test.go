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

	if _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		StartDate: start,
		EndDate:   start,
	}); err == nil {
		t.Fatalf("expected missing name to fail")
	}

	if _, _, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:      "Launch",
		StartDate: start,
		EndDate:   end,
	}); err == nil {
		t.Fatalf("expected invalid window to fail")
	}
}

func TestNormalizeCampaignInputNormalizesDatesChannelsAndPostIDs(t *testing.T) {
	t.Parallel()

	workspaceID := uuid.New()
	userID := uuid.New()
	postID := uuid.New()
	start := time.Date(2026, 3, 16, 12, 45, 0, 0, time.UTC)
	end := time.Date(2026, 3, 19, 1, 5, 0, 0, time.UTC)

	record, postIDs, err := normalizeCampaignInput(workspaceID, userID, UpsertCampaignInput{
		Name:         "Launch",
		Status:       "active",
		StartDate:    start,
		EndDate:      end,
		PaidChannels: []string{"google_ads", "meta_ads", "google_ads"},
		PostIDs:      []uuid.UUID{postID, postID},
	})
	if err != nil {
		t.Fatalf("normalizeCampaignInput() error = %v", err)
	}

	if got := formatDate(record.StartDate); got != "2026-03-16" {
		t.Fatalf("expected normalized start date, got %q", got)
	}
	if got := formatDate(record.EndDate); got != "2026-03-19" {
		t.Fatalf("expected normalized end date, got %q", got)
	}
	if got := parseStringSlice(record.PaidChannels); len(got) != 2 {
		t.Fatalf("expected deduped paid channels, got %#v", got)
	}
	if len(postIDs) != 1 || postIDs[0] != postID {
		t.Fatalf("expected deduped post ids, got %#v", postIDs)
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
