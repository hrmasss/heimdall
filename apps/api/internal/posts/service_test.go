package posts

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/resources"
)

func TestResolveEffectiveAssetsInheritAndReplace(t *testing.T) {
	t.Parallel()

	rootAssets := []resources.ResourceListItem{
		{ID: "root-1", DisplayName: "Root one"},
		{ID: "root-2", DisplayName: "Root two"},
	}
	variantAssets := []resources.ResourceListItem{
		{ID: "variant-1", DisplayName: "Variant one"},
		{ID: "root-2", DisplayName: "Duplicate"},
	}

	inherited := resolveEffectiveAssets(rootAssets, variantAssets, "inherit", []string{"root-1"})
	if len(inherited) != 2 {
		t.Fatalf("expected 2 inherited assets, got %d", len(inherited))
	}
	if inherited[0].ID != "root-2" || inherited[1].ID != "variant-1" {
		t.Fatalf("unexpected inherited asset order: %#v", inherited)
	}

	replaced := resolveEffectiveAssets(rootAssets, variantAssets, "replace", nil)
	if len(replaced) != 2 {
		t.Fatalf("expected replace mode to return variant assets only, got %d", len(replaced))
	}
	if replaced[0].ID != "variant-1" {
		t.Fatalf("expected first replaced asset to be variant asset, got %q", replaced[0].ID)
	}
}

func TestAggregateApprovalAndPublicationState(t *testing.T) {
	t.Parallel()

	variants := []PostVariant{
		{
			ApprovalState: "approved",
			LatestPublication: &PublicationPlan{
				PublicationState: "published",
			},
		},
		{
			ApprovalState: "changes_requested",
			LatestPublication: &PublicationPlan{
				PublicationState: "scheduled",
			},
		},
	}

	if state := aggregateApprovalState(variants); state != "changes_requested" {
		t.Fatalf("expected changes_requested aggregate approval, got %q", state)
	}
	if state := aggregatePublicationState(variants); state != "scheduled" {
		t.Fatalf("expected scheduled aggregate publication, got %q", state)
	}
}

func TestAggregateMetricSnapshot(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC()
	later := now.Add(10 * time.Minute)
	variants := []PostVariant{
		{
			MetricSnapshot: []MetricSnapshotItem{
				{
					Code:       "impressions",
					Label:      "Impressions",
					Unit:       "count",
					Rollup:     "sum",
					Value:      120,
					ObservedAt: now.Format(time.RFC3339),
				},
				{
					Code:       "engagement_rate",
					Label:      "Engagement Rate",
					Unit:       "ratio",
					Rollup:     "latest",
					Value:      0.12,
					ObservedAt: now.Format(time.RFC3339),
				},
			},
		},
		{
			MetricSnapshot: []MetricSnapshotItem{
				{
					Code:       "impressions",
					Label:      "Impressions",
					Unit:       "count",
					Rollup:     "sum",
					Value:      80,
					ObservedAt: later.Format(time.RFC3339),
				},
				{
					Code:       "engagement_rate",
					Label:      "Engagement Rate",
					Unit:       "ratio",
					Rollup:     "latest",
					Value:      0.18,
					ObservedAt: later.Format(time.RFC3339),
				},
			},
		},
	}

	snapshot := aggregateMetricSnapshot(variants)
	if len(snapshot) != 2 {
		t.Fatalf("expected 2 aggregate metrics, got %d", len(snapshot))
	}
	if snapshot[0].Code != "engagement_rate" || snapshot[0].Value != 0.18 {
		t.Fatalf("expected latest engagement rate to win, got %#v", snapshot[0])
	}
	if snapshot[1].Code != "impressions" || snapshot[1].Value != 200 {
		t.Fatalf("expected impressions to sum to 200, got %#v", snapshot[1])
	}
}

func TestEnsurePostCollectionsMarshalAsArrays(t *testing.T) {
	t.Parallel()

	detail := PostDetail{
		PostSummary: PostSummary{
			ID:                        "post-1",
			WorkspaceID:               "workspace-1",
			Title:                     "Title",
			ContentKind:               "text",
			AggregateApprovalState:    "draft",
			AggregatePublicationState: "unscheduled",
			MetricSnapshot:            ensureMetricSnapshotItems(nil),
			CreatedAt:                 time.Now().UTC().Format(time.RFC3339),
			UpdatedAt:                 time.Now().UTC().Format(time.RFC3339),
		},
		ContentPayload: map[string]any{"body": "Hello"},
		Assets:         ensureResourceItems(nil),
		Variants:       ensurePostVariants(nil),
	}

	payload, err := json.Marshal(detail)
	if err != nil {
		t.Fatalf("marshal detail: %v", err)
	}

	body := string(payload)
	for _, expected := range []string{
		`"assets":[]`,
		`"variants":[]`,
		`"metricSnapshot":[]`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected marshaled detail to include %s, got %s", expected, body)
		}
	}
}

func TestEnsureVariantCollectionsMarshalAsArrays(t *testing.T) {
	t.Parallel()

	variant := PostVariant{
		ID:                          "variant-1",
		PostID:                      "post-1",
		Platform:                    "facebook",
		Surface:                     "feed_photo",
		ContentMode:                 "inherit",
		AssetMode:                   "inherit",
		RemovedInheritedResourceIDs: ensureStringSlice(nil),
		Assets:                      ensureResourceItems(nil),
		EffectiveAssets:             ensureResourceItems(nil),
		ApprovalState:               "draft",
		ReviewHistory:               ensureReviewRecords(nil),
		MetricSnapshot:              ensureMetricSnapshotItems(nil),
		CreatedAt:                   time.Now().UTC().Format(time.RFC3339),
		UpdatedAt:                   time.Now().UTC().Format(time.RFC3339),
	}

	payload, err := json.Marshal(variant)
	if err != nil {
		t.Fatalf("marshal variant: %v", err)
	}

	body := string(payload)
	for _, expected := range []string{
		`"removedInheritedResourceIds":[]`,
		`"assets":[]`,
		`"effectiveAssets":[]`,
		`"reviewHistory":[]`,
		`"metricSnapshot":[]`,
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected marshaled variant to include %s, got %s", expected, body)
		}
	}
}

func TestEvaluateVariantReadinessRequiresApproval(t *testing.T) {
	t.Parallel()

	readiness := evaluateVariantReadiness(
		database.PostVariant{
			Platform:      "linkedin",
			Surface:       "feed_post",
			ApprovalState: "draft",
		},
		resolvedVariantState{
			contentKind: "text",
			contentPayload: map[string]any{
				"body": "Launch update",
			},
			effectiveAssets: []resources.ResourceListItem{},
		},
		nil,
		true,
		resources.CapabilityMatrix{
			Rules: []resources.CapabilityRule{
				{
					Platform:              "linkedin",
					Surface:               "feed_post",
					Label:                 "LinkedIn post",
					Accepts:               []string{"image", "video", "document"},
					SupportedContentKinds: []string{"text", "article"},
				},
			},
		},
	)

	if len(readiness.ScheduleBlockers) == 0 {
		t.Fatalf("expected approval blocker")
	}
	if readiness.ScheduleBlockers[0].Code != "approval_required" {
		t.Fatalf("expected approval_required blocker, got %#v", readiness.ScheduleBlockers[0])
	}
}

func TestEvaluateVariantReadinessDetectsIncompatibleAssets(t *testing.T) {
	t.Parallel()

	minItems := 1
	readiness := evaluateVariantReadiness(
		database.PostVariant{
			Platform:      "instagram",
			Surface:       "reel",
			ApprovalState: "approved",
		},
		resolvedVariantState{
			contentKind: "text",
			contentPayload: map[string]any{
				"body": "Behind the scenes",
			},
			effectiveAssets: []resources.ResourceListItem{
				{ID: "asset-1", MediaKind: "image"},
			},
		},
		nil,
		false,
		resources.CapabilityMatrix{
			Rules: []resources.CapabilityRule{
				{
					Platform:              "instagram",
					Surface:               "reel",
					Label:                 "Instagram reel",
					Accepts:               []string{"video"},
					SupportedContentKinds: []string{"text"},
					AssetRequired:         true,
					MinItems:              &minItems,
				},
			},
		},
	)

	if len(readiness.PublishBlockers) == 0 {
		t.Fatalf("expected publish blockers")
	}
	found := false
	for _, issue := range readiness.PublishBlockers {
		if issue.Code == "asset_type_incompatible" {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected asset_type_incompatible blocker, got %#v", readiness.PublishBlockers)
	}
}

func TestEvaluateVariantReadinessCoercesArticleToTextWhenFormatSupportsCaptions(t *testing.T) {
	t.Parallel()

	minItems := 1
	readiness := evaluateVariantReadiness(
		database.PostVariant{
			Platform:      "instagram",
			Surface:       "reel",
			ApprovalState: "approved",
		},
		resolvedVariantState{
			contentKind: "article",
			contentPayload: map[string]any{
				"title": "Launch recap",
				"body":  "Behind the scenes from the launch.",
			},
			effectiveAssets: []resources.ResourceListItem{
				{ID: "asset-1", MediaKind: "video"},
			},
		},
		nil,
		false,
		resources.CapabilityMatrix{
			Rules: []resources.CapabilityRule{
				{
					Platform:              "instagram",
					Surface:               "reel",
					Label:                 "Instagram reel",
					Accepts:               []string{"video"},
					SupportedContentKinds: []string{"text"},
					AssetRequired:         true,
					MinItems:              &minItems,
				},
			},
		},
	)

	for _, issue := range readiness.PublishBlockers {
		if issue.Code == "content_kind_unsupported" {
			t.Fatalf("expected article content to be coerced to text caption, got %#v", readiness.PublishBlockers)
		}
	}
}
