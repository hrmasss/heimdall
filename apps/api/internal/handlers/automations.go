package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/automations"
	"github.com/heimdall/api/internal/iam"
)

func (h *AppHandler) getAutomationCatalog(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.automationService.GetCatalog(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) listAutomations(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.automationService.ListAutomations(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createAutomation(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	var body automations.CreateAutomationInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.CreateAutomation(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) getAutomation(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	automationID, err := uuid.Parse(c.Params("automationId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.GetAutomation(c.Context(), principal, workspaceID, automationID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updateAutomation(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	automationID, err := uuid.Parse(c.Params("automationId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.UpdateAutomationInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.UpdateAutomation(c.Context(), principal, workspaceID, automationID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deleteAutomation(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	automationID, err := uuid.Parse(c.Params("automationId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.automationService.DeleteAutomation(c.Context(), principal, workspaceID, automationID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) listWorkflows(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.automationService.ListWorkflows(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	var body automations.CreateWorkflowInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.CreateWorkflow(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) getWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workflowID, err := uuid.Parse(c.Params("workflowId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.GetWorkflow(c.Context(), principal, workspaceID, workflowID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updateWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workflowID, err := uuid.Parse(c.Params("workflowId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.UpdateWorkflowInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.UpdateWorkflow(c.Context(), principal, workspaceID, workflowID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deleteWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workflowID, err := uuid.Parse(c.Params("workflowId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.automationService.DeleteWorkflow(c.Context(), principal, workspaceID, workflowID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) duplicateWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workflowID, err := uuid.Parse(c.Params("workflowId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.DuplicateWorkflowInput
	if err := c.Bind().JSON(&body); err != nil && c.Body() != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.DuplicateWorkflow(c.Context(), principal, workspaceID, workflowID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) runAutomation(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	automationID, err := uuid.Parse(c.Params("automationId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.RunRequest
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.RunAutomation(c.Context(), principal, workspaceID, automationID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) runWorkflow(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workflowID, err := uuid.Parse(c.Params("workflowId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.RunRequest
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.RunWorkflow(c.Context(), principal, workspaceID, workflowID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) listAutomationRuns(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.automationService.ListRuns(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) getAutomationRun(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	runID, err := uuid.Parse(c.Params("runId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.GetRun(c.Context(), principal, workspaceID, runID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) reviewAutomationRun(c fiber.Ctx) error {
	workspaceID, principal, err := h.resolveAutomationContext(c)
	if err != nil {
		return h.writeError(c, err)
	}
	runID, err := uuid.Parse(c.Params("runId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body automations.ReviewRunInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.automationService.ReviewRun(c.Context(), principal, workspaceID, runID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) resolveAutomationContext(c fiber.Ctx) (uuid.UUID, *iam.Principal, error) {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, nil, iam.ErrValidation
	}
	principal, err := h.principal(c)
	if err != nil {
		return uuid.Nil, nil, err
	}
	return workspaceID, principal, nil
}
