package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
)

func (h *AppHandler) listCalendar(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	input, err := bindCalendarQuery(c)
	if err != nil {
		return h.writeError(c, err)
	}
	response, err := h.postService.ListCalendar(c.Context(), principal, workspaceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(response)
}

func (h *AppHandler) listPosts(c fiber.Ctx) error {
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
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) getPost(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	postID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	item, err := h.postService.GetPost(c.Context(), principal, workspaceID, postID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(item)
}

func (h *AppHandler) createPost(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	input, err := bindPostInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.CreatePost(c.Context(), principal, workspaceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) updatePost(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	postID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindPostInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.UpdatePost(c.Context(), principal, workspaceID, postID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deletePost(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	postID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.postService.DeletePost(c.Context(), principal, workspaceID, postID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) syncPostAssets(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	postID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindAssetSyncInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.SyncPostAssets(c.Context(), principal, workspaceID, postID, input.ResourceIDs)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) createPostVariant(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	postID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindVariantInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.CreateVariant(c.Context(), principal, workspaceID, postID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) getPostVariant(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.postService.GetVariant(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updatePostVariant(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindVariantInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.UpdateVariant(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deletePostVariant(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.postService.DeleteVariant(c.Context(), principal, workspaceID, variantID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) syncPostVariantAssets(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindAssetSyncInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.SyncVariantAssets(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) submitPostVariantReview(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindReviewInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.SubmitVariantReview(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) decidePostVariantReview(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindDecisionInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.DecideVariantReview(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) upsertPostVariantTentativePlan(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindSchedulePublicationInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.UpsertTentativePlan(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) clearPostVariantTentativePlan(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.postService.ClearTentativePlan(c.Context(), principal, workspaceID, variantID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) finalizePostVariantTentativePlan(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.postService.FinalizeTentativePlan(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) schedulePostVariantPublication(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindSchedulePublicationInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.SchedulePublication(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) unschedulePostVariantPublication(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.postService.UnschedulePublication(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) recordPostVariantPublication(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.postService.RecordPublication(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) listPostVariantMetrics(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	items, err := h.postService.ListMetricObservations(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) recordPostVariantMetric(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	variantID, err := uuid.Parse(c.Params("variantId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindMetricObservationInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.postService.RecordMetricObservation(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) listPostMetricDefinitions(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.postService.ListMetricDefinitions(c.Context(), principal, workspaceID, c.Query("platform"), c.Query("surface"))
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func bindPostInput(c fiber.Ctx) (posts.UpsertPostInput, error) {
	var body struct {
		Title            string         `json:"title"`
		ContentKind      string         `json:"contentKind"`
		ContentPayload   map[string]any `json:"contentPayload"`
		OriginPlatform   string         `json:"originPlatform"`
		OriginSurface    string         `json:"originSurface"`
		RequiresApproval bool           `json:"requiresApproval"`
		Notes            string         `json:"notes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.UpsertPostInput{}, iam.ErrValidation
	}
	return posts.UpsertPostInput(body), nil
}

func bindVariantInput(c fiber.Ctx) (posts.UpsertVariantInput, error) {
	var body struct {
		Platform       string         `json:"platform"`
		Surface        string         `json:"surface"`
		InheritSource  string         `json:"inheritSource"`
		ContentMode    string         `json:"contentMode"`
		ContentKind    string         `json:"contentKind"`
		ContentPayload map[string]any `json:"contentPayload"`
		AssetMode      string         `json:"assetMode"`
		Notes          string         `json:"notes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.UpsertVariantInput{}, iam.ErrValidation
	}
	return posts.UpsertVariantInput(body), nil
}

func bindAssetSyncInput(c fiber.Ctx) (posts.SyncAssetsInput, error) {
	var body struct {
		ResourceIDs                 []string `json:"resourceIds"`
		AssetMode                   string   `json:"assetMode"`
		RemovedInheritedResourceIDs []string `json:"removedInheritedResourceIds"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.SyncAssetsInput{}, iam.ErrValidation
	}
	resourceIDs, err := parseUUIDList(body.ResourceIDs)
	if err != nil {
		return posts.SyncAssetsInput{}, err
	}
	removedIDs, err := parseUUIDList(body.RemovedInheritedResourceIDs)
	if err != nil {
		return posts.SyncAssetsInput{}, err
	}
	return posts.SyncAssetsInput{
		ResourceIDs:                 resourceIDs,
		AssetMode:                   body.AssetMode,
		RemovedInheritedResourceIDs: removedIDs,
	}, nil
}

func bindReviewInput(c fiber.Ctx) (posts.ReviewInput, error) {
	var body struct {
		Comment string `json:"comment"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.ReviewInput{}, iam.ErrValidation
	}
	return posts.ReviewInput{Comment: body.Comment}, nil
}

func bindDecisionInput(c fiber.Ctx) (posts.DecisionInput, error) {
	var body struct {
		ApprovalState string `json:"approvalState"`
		Comment       string `json:"comment"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.DecisionInput{}, iam.ErrValidation
	}
	return posts.DecisionInput(body), nil
}

func bindSchedulePublicationInput(c fiber.Ctx) (posts.SchedulePublicationInput, error) {
	var body struct {
		PlannedAt      string `json:"plannedAt"`
		Source         string `json:"source"`
		SocialTargetID string `json:"socialTargetId"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.SchedulePublicationInput{}, iam.ErrValidation
	}
	var plannedAt *time.Time
	if strings.TrimSpace(body.PlannedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(body.PlannedAt))
		if err != nil {
			return posts.SchedulePublicationInput{}, iam.ErrValidation
		}
		plannedAt = &parsed
	}
	input := posts.SchedulePublicationInput{
		PlannedAt: plannedAt,
		Source:    strings.TrimSpace(body.Source),
	}
	if value := strings.TrimSpace(body.SocialTargetID); value != "" {
		parsed, err := uuid.Parse(value)
		if err != nil {
			return posts.SchedulePublicationInput{}, iam.ErrValidation
		}
		input.SocialTargetID = &parsed
	}
	return input, nil
}

func bindCalendarQuery(c fiber.Ctx) (posts.CalendarQueryInput, error) {
	startRaw := strings.TrimSpace(c.Query("start"))
	endRaw := strings.TrimSpace(c.Query("end"))
	if startRaw == "" || endRaw == "" {
		return posts.CalendarQueryInput{}, iam.ErrValidation
	}
	start, err := time.Parse(time.RFC3339, startRaw)
	if err != nil {
		return posts.CalendarQueryInput{}, iam.ErrValidation
	}
	end, err := time.Parse(time.RFC3339, endRaw)
	if err != nil {
		return posts.CalendarQueryInput{}, iam.ErrValidation
	}
	platforms := []string{}
	if raw := strings.TrimSpace(c.Query("platform")); raw != "" {
		platforms = append(platforms, strings.Split(raw, ",")...)
	}
	return posts.CalendarQueryInput{
		Start:     start,
		End:       end,
		Timezone:  strings.TrimSpace(c.Query("timezone")),
		Platforms: platforms,
	}, nil
}

func bindMetricObservationInput(c fiber.Ctx) (posts.RecordMetricObservationInput, error) {
	var body struct {
		MetricCode string         `json:"metricCode"`
		ObservedAt string         `json:"observedAt"`
		Value      float64        `json:"value"`
		Source     string         `json:"source"`
		Metadata   map[string]any `json:"metadata"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return posts.RecordMetricObservationInput{}, iam.ErrValidation
	}
	var observedAt time.Time
	if strings.TrimSpace(body.ObservedAt) != "" {
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(body.ObservedAt))
		if err != nil {
			return posts.RecordMetricObservationInput{}, iam.ErrValidation
		}
		observedAt = parsed
	}
	return posts.RecordMetricObservationInput{
		MetricCode: body.MetricCode,
		ObservedAt: observedAt,
		Value:      body.Value,
		Source:     body.Source,
		Metadata:   body.Metadata,
	}, nil
}

func parseUUIDList(values []string) ([]uuid.UUID, error) {
	result := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		parsed, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, iam.ErrValidation
		}
		result = append(result, parsed)
	}
	return result, nil
}
