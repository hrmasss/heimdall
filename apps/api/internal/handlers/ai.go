package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/ai"
	"github.com/heimdall/api/internal/iam"
)

func (h *AppHandler) getWorkspaceAIContext(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.GetContext(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updateWorkspaceAIBusinessContext(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body ai.UpdateBusinessContextInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.UpdateBusinessContext(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updateWorkspaceAIBrandContext(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body ai.UpdateBrandContextInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.UpdateBrandContext(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) getWorkspaceAISettings(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.GetSettings(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updateWorkspaceAISettings(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body ai.UpdateWorkspaceAISettingsInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.UpdateSettings(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) getWorkspaceAICatalog(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.GetCatalog(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) getPlatformWorkspaceAISettings(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.GetPlatformWorkspaceSettings(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) generateWorkspaceAIPostDraft(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body ai.GeneratePostDraftInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.GeneratePostDraft(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updatePlatformWorkspaceAISettings(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body ai.UpdatePlatformWorkspaceAISettingsInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.aiService.UpdatePlatformWorkspaceSettings(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}
