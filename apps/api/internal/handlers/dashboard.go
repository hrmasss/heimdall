package handlers

import (
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	aisvc "github.com/heimdall/api/internal/ai"
	"github.com/heimdall/api/internal/campaigns"
	"github.com/heimdall/api/internal/iam"
	postsvc "github.com/heimdall/api/internal/posts"
	"github.com/heimdall/api/internal/resources"
	socialsvc "github.com/heimdall/api/internal/social"
)

type dashboardActionLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type dashboardOverviewStatusItem struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Tone  string `json:"tone,omitempty"`
}

type dashboardOverviewPriorityItem struct {
	ID              string               `json:"id"`
	Title           string               `json:"title"`
	Detail          string               `json:"detail"`
	Context         string               `json:"context,omitempty"`
	Tone            string               `json:"tone,omitempty"`
	PrimaryAction   dashboardActionLink  `json:"primaryAction"`
	SecondaryAction *dashboardActionLink `json:"secondaryAction,omitempty"`
}

type dashboardOverviewQueueItem struct {
	ID              string               `json:"id"`
	PostID          string               `json:"postId"`
	Title           string               `json:"title"`
	Detail          string               `json:"detail"`
	PlannedAt       string               `json:"plannedAt,omitempty"`
	Status          string               `json:"status"`
	Tone            string               `json:"tone,omitempty"`
	PrimaryAction   dashboardActionLink  `json:"primaryAction"`
	SecondaryAction *dashboardActionLink `json:"secondaryAction,omitempty"`
}

type dashboardOverviewCard struct {
	Title  string               `json:"title"`
	Detail string               `json:"detail"`
	Action *dashboardActionLink `json:"action,omitempty"`
}

type dashboardPublishingHealth struct {
	Status                 string   `json:"status"`
	Title                  string   `json:"title"`
	Detail                 string   `json:"detail"`
	HealthyConnections     int      `json:"healthyConnections"`
	SelectedTargets        int      `json:"selectedTargets"`
	HealthySelectedTargets int      `json:"healthySelectedTargets"`
	ConnectedProviders     []string `json:"connectedProviders"`
	CoverageLabel          string   `json:"coverageLabel"`
}

type dashboardOverviewSummaryResponse struct {
	StateSentence    string                          `json:"stateSentence"`
	StatusItems      []dashboardOverviewStatusItem   `json:"statusItems"`
	PriorityItems    []dashboardOverviewPriorityItem `json:"priorityItems"`
	QueueItems       []dashboardOverviewQueueItem    `json:"queueItems"`
	PublishingHealth dashboardPublishingHealth       `json:"publishingHealth"`
	NextMove         dashboardOverviewCard           `json:"nextMove"`
	Backlog          dashboardOverviewCard           `json:"backlog"`
	Signals          []dashboardOverviewCard         `json:"signals"`
}

type postComposeResourceLibrarySummary struct {
	ResourceCount    int                            `json:"resourceCount"`
	ResourceSetCount int                            `json:"resourceSetCount"`
	SeedResources    []resources.ResourceListItem   `json:"seedResources"`
	SeedResourceSets []resources.ResourceSetSummary `json:"seedResourceSets"`
}

type postComposeAISummary struct {
	Settings        *aisvc.WorkspaceAISettings `json:"settings,omitempty"`
	Catalog         *aisvc.AIProviderCatalog   `json:"catalog,omitempty"`
	Ready           bool                       `json:"ready"`
	DefaultProvider string                     `json:"defaultProvider,omitempty"`
	DefaultModel    string                     `json:"defaultModel,omitempty"`
}

type postComposeBootstrapResponse struct {
	Campaigns       []campaigns.CampaignSummary       `json:"campaigns"`
	Capabilities    resources.CapabilityMatrix        `json:"capabilities"`
	Social          *socialsvc.ConnectionsResponse    `json:"social"`
	ResourceLibrary postComposeResourceLibrarySummary `json:"resourceLibrary"`
	AI              postComposeAISummary              `json:"ai"`
	Post            *postsvc.PostDetail               `json:"post,omitempty"`
}

func (h *AppHandler) getDashboardOverviewSummary(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.postService.ListPosts(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	social, err := h.socialService.ListConnections(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(buildDashboardOverviewSummary(items, social))
}

func (h *AppHandler) getPostComposeBootstrap(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}

	campaignItems, err := h.campaignService.ListCampaigns(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	social, err := h.socialService.ListConnections(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceItems, err := h.resourceService.ListResources(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceSetItems, err := h.resourceService.ListResourceSets(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	settings, err := h.aiService.GetSettings(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	catalog, err := h.aiService.GetCatalog(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}

	var postDetail *postsvc.PostDetail
	if requestedPostID := strings.TrimSpace(c.Query("postId")); requestedPostID != "" {
		postID, err := uuid.Parse(requestedPostID)
		if err != nil {
			return h.writeError(c, iam.ErrValidation)
		}
		postDetail, err = h.postService.GetPost(c.Context(), principal, workspaceID, postID)
		if err != nil {
			return h.writeError(c, err)
		}
	}

	seedResources := compactResourceSeed(resourceItems, postDetail, 8)
	seedSets := slices.Clone(resourceSetItems)
	if len(seedSets) > 4 {
		seedSets = seedSets[:4]
	}

	defaultProvider, defaultModel := resolveDefaultAISelection(settings, catalog)
	return c.JSON(postComposeBootstrapResponse{
		Campaigns:    campaignItems,
		Capabilities: h.resourceService.Capabilities(),
		Social:       social,
		ResourceLibrary: postComposeResourceLibrarySummary{
			ResourceCount:    len(resourceItems),
			ResourceSetCount: len(resourceSetItems),
			SeedResources:    seedResources,
			SeedResourceSets: seedSets,
		},
		AI: postComposeAISummary{
			Settings:        settings,
			Catalog:         catalog,
			Ready:           defaultProvider != "" && defaultModel != "",
			DefaultProvider: defaultProvider,
			DefaultModel:    defaultModel,
		},
		Post: postDetail,
	})
}

func buildDashboardOverviewSummary(items []postsvc.PostSummary, social *socialsvc.ConnectionsResponse) dashboardOverviewSummaryResponse {
	now := time.Now().UTC()
	healthyConnections := 0
	selectedTargets := 0
	healthySelectedTargets := 0
	connectedProviders := map[string]struct{}{}
	connectionHealthyByID := map[string]bool{}
	for _, connection := range social.Connections {
		connectedProviders[connection.Provider] = struct{}{}
		healthy := isHealthySocialStatus(connection.HealthStatus)
		connectionHealthyByID[connection.ID] = healthy
		if healthy {
			healthyConnections++
		}
	}
	for _, target := range social.Targets {
		if !target.IsSelected {
			continue
		}
		selectedTargets++
		if isHealthySocialStatus(target.Status) && connectionHealthyByID[target.ConnectionID] {
			healthySelectedTargets++
		}
	}
	providerLabels := make([]string, 0, len(connectedProviders))
	for provider := range connectedProviders {
		providerLabels = append(providerLabels, provider)
	}
	sort.Strings(providerLabels)

	reviewPosts := make([]postsvc.PostSummary, 0)
	backlogPosts := make([]postsvc.PostSummary, 0)
	scheduledPosts := make([]postsvc.PostSummary, 0)
	failedPosts := make([]postsvc.PostSummary, 0)
	for _, item := range items {
		if item.AggregatePublicationState == "failed" {
			failedPosts = append(failedPosts, item)
		}
		if item.AggregateApprovalState == "draft" || item.AggregateApprovalState == "in_review" || item.AggregateApprovalState == "changes_requested" {
			reviewPosts = append(reviewPosts, item)
		}
		if strings.TrimSpace(item.LatestPlannedAt) == "" || item.AggregatePublicationState == "unscheduled" {
			backlogPosts = append(backlogPosts, item)
			continue
		}
		if item.AggregatePublicationState == "scheduled" || item.AggregatePublicationState == "publishing" {
			scheduledPosts = append(scheduledPosts, item)
		}
	}
	sortPostsByUpdated(reviewPosts)
	sortPostsByUpdated(backlogPosts)
	sortPostsByPlanned(scheduledPosts)
	sortPostsByUpdated(failedPosts)

	scheduledTodayCount := 0
	for _, item := range scheduledPosts {
		if plannedAt, ok := parseTimestamp(item.LatestPlannedAt); ok && sameDayUTC(plannedAt, now) {
			scheduledTodayCount++
		}
	}

	priorityItems := make([]dashboardOverviewPriorityItem, 0, 5)
	if healthySelectedTargets == 0 {
		priorityItems = append(priorityItems, dashboardOverviewPriorityItem{
			ID:      "connect-platforms",
			Title:   "Finish one healthy publishing path before scheduling live posts.",
			Detail:  "Your daily queue stays lightweight once at least one selected destination is healthy.",
			Context: "Publishing setup",
			Tone:    "warning",
			PrimaryAction: dashboardActionLink{
				Label: "Connect platforms",
				Href:  "/dashboard/settings/platforms",
			},
			SecondaryAction: &dashboardActionLink{
				Label: "Open setup",
				Href:  "/dashboard/setup",
			},
		})
	}
	if len(failedPosts) > 0 {
		item := failedPosts[0]
		priorityItems = append(priorityItems, dashboardOverviewPriorityItem{
			ID:      "failed-" + item.ID,
			Title:   "Resolve the last failed post before it slips out of view.",
			Detail:  item.Title,
			Context: "Publishing issue",
			Tone:    "danger",
			PrimaryAction: dashboardActionLink{
				Label: "Open post",
				Href:  "/dashboard/posts/" + item.ID,
			},
			SecondaryAction: &dashboardActionLink{
				Label: "View calendar",
				Href:  "/dashboard/calendar",
			},
		})
	}
	if len(reviewPosts) > 0 {
		item := reviewPosts[0]
		actionLabel := "Resume draft"
		if item.AggregateApprovalState == "in_review" {
			actionLabel = "Review post"
		}
		priorityItems = append(priorityItems, dashboardOverviewPriorityItem{
			ID:      "review-" + item.ID,
			Title:   "Clear the next review decision while the context is fresh.",
			Detail:  item.Title,
			Context: "Needs attention",
			Tone:    "info",
			PrimaryAction: dashboardActionLink{
				Label: actionLabel,
				Href:  "/dashboard/posts/" + item.ID + "/edit",
			},
			SecondaryAction: &dashboardActionLink{
				Label: "View all posts",
				Href:  "/dashboard/posts",
			},
		})
	}
	if len(backlogPosts) > 0 {
		item := backlogPosts[0]
		priorityItems = append(priorityItems, dashboardOverviewPriorityItem{
			ID:      "schedule-" + item.ID,
			Title:   "Schedule the next ready draft so the week stays covered.",
			Detail:  item.Title,
			Context: "Backlog",
			Tone:    "muted",
			PrimaryAction: dashboardActionLink{
				Label: "Schedule draft",
				Href:  "/dashboard/posts/" + item.ID + "/edit",
			},
			SecondaryAction: &dashboardActionLink{
				Label: "Open calendar",
				Href:  "/dashboard/calendar",
			},
		})
	}
	if len(priorityItems) == 0 {
		priorityItems = append(priorityItems, dashboardOverviewPriorityItem{
			ID:      "create-next",
			Title:   "Your queue looks healthy. Create the next post while you have momentum.",
			Detail:  "A short compose session now keeps the next few days from turning into a scramble.",
			Context: "Next move",
			Tone:    "success",
			PrimaryAction: dashboardActionLink{
				Label: "Create post",
				Href:  "/dashboard/posts/new",
			},
			SecondaryAction: &dashboardActionLink{
				Label: "Open calendar",
				Href:  "/dashboard/calendar",
			},
		})
	}
	if len(priorityItems) > 5 {
		priorityItems = priorityItems[:5]
	}

	queueItems := make([]dashboardOverviewQueueItem, 0, 4)
	for _, item := range scheduledPosts {
		detail := "Scheduled post"
		if item.Campaign != nil && strings.TrimSpace(item.Campaign.Name) != "" {
			detail = item.Campaign.Name
		}
		primaryLabel := "Open post"
		if item.AggregateApprovalState == "draft" || item.AggregateApprovalState == "in_review" {
			primaryLabel = "Review"
		}
		queueItems = append(queueItems, dashboardOverviewQueueItem{
			ID:        "queue-" + item.ID,
			PostID:    item.ID,
			Title:     item.Title,
			Detail:    detail,
			PlannedAt: item.LatestPlannedAt,
			Status:    item.AggregatePublicationState,
			Tone:      queueTone(item.AggregateApprovalState, item.AggregatePublicationState),
			PrimaryAction: dashboardActionLink{
				Label: primaryLabel,
				Href:  "/dashboard/posts/" + item.ID + "/edit",
			},
			SecondaryAction: &dashboardActionLink{
				Label: "Open calendar",
				Href:  "/dashboard/calendar",
			},
		})
		if len(queueItems) == 4 {
			break
		}
	}
	if len(queueItems) == 0 {
		for _, item := range reviewPosts {
			queueItems = append(queueItems, dashboardOverviewQueueItem{
				ID:     "queue-fallback-" + item.ID,
				PostID: item.ID,
				Title:  item.Title,
				Detail: "Waiting for a decision before it can move forward.",
				Status: item.AggregateApprovalState,
				Tone:   queueTone(item.AggregateApprovalState, item.AggregatePublicationState),
				PrimaryAction: dashboardActionLink{
					Label: "Resume draft",
					Href:  "/dashboard/posts/" + item.ID + "/edit",
				},
				SecondaryAction: &dashboardActionLink{
					Label: "View all posts",
					Href:  "/dashboard/posts",
				},
			})
			if len(queueItems) == 4 {
				break
			}
		}
	}

	stateSentence := "Clear the next blocker, confirm the live queue, and get back out of the app."
	if healthySelectedTargets == 0 {
		stateSentence = "Finish one publishing path first, then the rest of the daily flow gets much lighter."
	} else if len(reviewPosts) == 0 && scheduledTodayCount > 0 {
		stateSentence = "Today is mostly covered. Use the next few minutes to top up the queue, not manage it."
	}

	backlogCount := len(backlogPosts)
	coverageLabel := "Queue needs attention"
	switch {
	case scheduledTodayCount >= 3:
		coverageLabel = "Today is covered"
	case len(scheduledPosts) >= 5:
		coverageLabel = "Week is taking shape"
	case len(scheduledPosts) > 0:
		coverageLabel = "A few live posts are lined up"
	}

	return dashboardOverviewSummaryResponse{
		StateSentence: stateSentence,
		StatusItems: []dashboardOverviewStatusItem{
			{Label: "Needs attention", Value: itoa(len(priorityItems)), Tone: "warning"},
			{Label: "Scheduled today", Value: itoa(scheduledTodayCount), Tone: "success"},
			{Label: "Platform issues", Value: itoa(max(selectedTargets-healthySelectedTargets, 0)), Tone: "warning"},
			{Label: "Backlog", Value: itoa(backlogCount), Tone: "muted"},
		},
		PriorityItems: priorityItems,
		QueueItems:    queueItems,
		PublishingHealth: dashboardPublishingHealth{
			Status:                 healthStatusLabel(healthySelectedTargets, selectedTargets),
			Title:                  healthTitle(healthySelectedTargets, selectedTargets),
			Detail:                 healthDetail(providerLabels, healthyConnections, selectedTargets),
			HealthyConnections:     healthyConnections,
			SelectedTargets:        selectedTargets,
			HealthySelectedTargets: healthySelectedTargets,
			ConnectedProviders:     providerLabels,
			CoverageLabel:          coverageLabel,
		},
		NextMove: dashboardOverviewCard{
			Title:  nextMoveTitle(healthySelectedTargets, backlogCount, len(reviewPosts)),
			Detail: nextMoveDetail(healthySelectedTargets, backlogCount, len(reviewPosts)),
			Action: &dashboardActionLink{
				Label: nextMoveActionLabel(healthySelectedTargets, backlogCount, len(reviewPosts)),
				Href:  nextMoveHref(healthySelectedTargets, backlogCount, len(reviewPosts)),
			},
		},
		Backlog: dashboardOverviewCard{
			Title:  "Backlog coverage",
			Detail: backlogDetail(backlogCount, len(scheduledPosts)),
			Action: &dashboardActionLink{
				Label: "Open posts",
				Href:  "/dashboard/posts",
			},
		},
		Signals: []dashboardOverviewCard{
			{
				Title:  "Keep the first session narrow",
				Detail: "Use this page to clear the next 1 to 3 actions, not to audit every metric.",
			},
			{
				Title:  "Drafts are only helpful once they have a slot",
				Detail: "If the backlog is growing faster than the schedule, top up the calendar before creating more.",
				Action: &dashboardActionLink{
					Label: "Open calendar",
					Href:  "/dashboard/calendar",
				},
			},
		},
	}
}

func compactResourceSeed(items []resources.ResourceListItem, postDetail *postsvc.PostDetail, limit int) []resources.ResourceListItem {
	resourceByID := map[string]resources.ResourceListItem{}
	for _, item := range items {
		resourceByID[item.ID] = item
	}
	seed := make([]resources.ResourceListItem, 0, limit)
	appendUnique := func(item resources.ResourceListItem) {
		if _, exists := resourceByID[item.ID]; !exists {
			resourceByID[item.ID] = item
		}
		for _, current := range seed {
			if current.ID == item.ID {
				return
			}
		}
		seed = append(seed, item)
	}
	if postDetail != nil {
		for _, item := range postDetail.Assets {
			appendUnique(item)
		}
		for _, variant := range postDetail.Variants {
			for _, item := range variant.Assets {
				appendUnique(item)
			}
			for _, item := range variant.EffectiveAssets {
				appendUnique(item)
			}
		}
	}
	for _, item := range items {
		appendUnique(item)
		if len(seed) >= limit {
			break
		}
	}
	return seed
}

func resolveDefaultAISelection(settings *aisvc.WorkspaceAISettings, catalog *aisvc.AIProviderCatalog) (string, string) {
	if settings != nil {
		if selection, ok := settings.CapabilityDefaults["post_generation"]; ok {
			return selection.Provider, selection.Model
		}
	}
	if catalog == nil || len(catalog.Providers) == 0 {
		return "", ""
	}
	entry := catalog.Providers[0]
	if entry.DefaultModel != "" {
		return entry.Provider, entry.DefaultModel
	}
	if len(entry.ApprovedModels) > 0 {
		return entry.Provider, entry.ApprovedModels[0]
	}
	return "", ""
}

func isHealthySocialStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "healthy", "active", "connected", "ready":
		return true
	default:
		return false
	}
}

func sortPostsByUpdated(items []postsvc.PostSummary) {
	sort.Slice(items, func(left, right int) bool {
		leftTime, leftOK := parseTimestamp(items[left].UpdatedAt)
		rightTime, rightOK := parseTimestamp(items[right].UpdatedAt)
		if !leftOK {
			return false
		}
		if !rightOK {
			return true
		}
		return leftTime.After(rightTime)
	})
}

func sortPostsByPlanned(items []postsvc.PostSummary) {
	sort.Slice(items, func(left, right int) bool {
		leftTime, leftOK := parseTimestamp(items[left].LatestPlannedAt)
		rightTime, rightOK := parseTimestamp(items[right].LatestPlannedAt)
		if !leftOK {
			return false
		}
		if !rightOK {
			return true
		}
		return leftTime.Before(rightTime)
	})
}

func parseTimestamp(value string) (time.Time, bool) {
	if strings.TrimSpace(value) == "" {
		return time.Time{}, false
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func sameDayUTC(left, right time.Time) bool {
	left = left.UTC()
	right = right.UTC()
	return left.Year() == right.Year() && left.YearDay() == right.YearDay()
}

func queueTone(approvalState, publicationState string) string {
	if publicationState == "failed" {
		return "danger"
	}
	if approvalState == "draft" || approvalState == "in_review" || approvalState == "changes_requested" {
		return "warning"
	}
	if publicationState == "scheduled" || publicationState == "publishing" || publicationState == "published" {
		return "success"
	}
	return "muted"
}

func healthStatusLabel(healthySelectedTargets, selectedTargets int) string {
	switch {
	case healthySelectedTargets == 0:
		return "attention"
	case healthySelectedTargets < selectedTargets:
		return "warning"
	default:
		return "ready"
	}
}

func healthTitle(healthySelectedTargets, selectedTargets int) string {
	switch {
	case healthySelectedTargets == 0:
		return "Publishing is not fully ready yet."
	case healthySelectedTargets < selectedTargets:
		return "Publishing works, but one or more selected destinations still need a check."
	default:
		return "Publishing is ready for the daily workflow."
	}
}

func healthDetail(providers []string, healthyConnections, selectedTargets int) string {
	if len(providers) == 0 {
		return "No live providers are connected yet. Finish one publishing path before leaning on the scheduler."
	}
	return "Connected providers: " + strings.Join(providers, ", ") + ". " +
		strconv.Itoa(healthyConnections) + " healthy connection(s) and " + strconv.Itoa(selectedTargets) + " selected destination(s) are in the active queue."
}

func nextMoveTitle(healthySelectedTargets, backlogCount, reviewCount int) string {
	switch {
	case healthySelectedTargets == 0:
		return "Unlock live publishing first"
	case reviewCount > 0:
		return "Clear one review decision"
	case backlogCount > 0:
		return "Turn the backlog into scheduled work"
	default:
		return "Create the next post while context is fresh"
	}
}

func nextMoveDetail(healthySelectedTargets, backlogCount, reviewCount int) string {
	switch {
	case healthySelectedTargets == 0:
		return "Once one destination is healthy and selected, scheduling and publishing stop feeling risky."
	case reviewCount > 0:
		return "A quick decision now prevents unfinished drafts from piling up across the week."
	case backlogCount > 0:
		return "You already have material to work with. Scheduling it is usually the highest-leverage next move."
	default:
		return "A short compose session now keeps tomorrow from starting with an empty queue."
	}
}

func nextMoveActionLabel(healthySelectedTargets, backlogCount, reviewCount int) string {
	switch {
	case healthySelectedTargets == 0:
		return "Manage platforms"
	case reviewCount > 0:
		return "Open posts"
	case backlogCount > 0:
		return "Open calendar"
	default:
		return "Create post"
	}
}

func nextMoveHref(healthySelectedTargets, backlogCount, reviewCount int) string {
	switch {
	case healthySelectedTargets == 0:
		return "/dashboard/settings/platforms"
	case reviewCount > 0:
		return "/dashboard/posts"
	case backlogCount > 0:
		return "/dashboard/calendar"
	default:
		return "/dashboard/posts/new"
	}
}

func backlogDetail(backlogCount, scheduledCount int) string {
	switch {
	case backlogCount == 0 && scheduledCount > 0:
		return "The current queue is mostly scheduled already. Keep new work lightweight."
	case backlogCount == 0:
		return "There is no visible backlog yet, which usually means the next post should be created soon."
	default:
		return itoa(backlogCount) + " draft(s) still need a slot. Converting even one or two into scheduled work reduces daily decision load."
	}
}

func itoa(value int) string {
	return strconv.Itoa(value)
}

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}
