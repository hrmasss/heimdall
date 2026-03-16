package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/campaigns"
	"github.com/heimdall/api/internal/iam"
)

func (h *AppHandler) listCampaigns(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.campaignService.ListCampaigns(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) getCampaign(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	campaignID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	item, err := h.campaignService.GetCampaign(c.Context(), principal, workspaceID, campaignID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(item)
}

func (h *AppHandler) createCampaign(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	input, err := bindCampaignInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.campaignService.CreateCampaign(c.Context(), principal, workspaceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) updateCampaign(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	campaignID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := bindCampaignInput(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.campaignService.UpdateCampaign(c.Context(), principal, workspaceID, campaignID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deleteCampaign(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	campaignID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.campaignService.DeleteCampaign(c.Context(), principal, workspaceID, campaignID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func bindCampaignInput(c fiber.Ctx) (campaigns.UpsertCampaignInput, error) {
	var body struct {
		Status                 string   `json:"status"`
		Name                   string   `json:"name"`
		Objective              string   `json:"objective"`
		TargetAudience         string   `json:"targetAudience"`
		MessageTheme           string   `json:"messageTheme"`
		StartDate              string   `json:"startDate"`
		EndDate                string   `json:"endDate"`
		Notes                  string   `json:"notes"`
		PrimaryMetricLabel     string   `json:"primaryMetricLabel"`
		PrimaryMetricTarget    *float64 `json:"primaryMetricTarget"`
		PrimaryMetricUnit      string   `json:"primaryMetricUnit"`
		PaidChannels           []string `json:"paidChannels"`
		BudgetAmountCents      *int64   `json:"budgetAmountCents"`
		ActualSpendAmountCents *int64   `json:"actualSpendAmountCents"`
		CurrencyCode           string   `json:"currencyCode"`
		UTMCampaign            string   `json:"utmCampaign"`
		ExternalDashboardURL   string   `json:"externalDashboardUrl"`
		PostIDs                []string `json:"postIds"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return campaigns.UpsertCampaignInput{}, iam.ErrValidation
	}

	startDate, err := parseDate(body.StartDate)
	if err != nil {
		return campaigns.UpsertCampaignInput{}, err
	}
	endDate, err := parseDate(body.EndDate)
	if err != nil {
		return campaigns.UpsertCampaignInput{}, err
	}
	postIDs, err := parseUUIDList(body.PostIDs)
	if err != nil {
		return campaigns.UpsertCampaignInput{}, err
	}

	return campaigns.UpsertCampaignInput{
		Status:                 strings.TrimSpace(body.Status),
		Name:                   body.Name,
		Objective:              body.Objective,
		TargetAudience:         body.TargetAudience,
		MessageTheme:           body.MessageTheme,
		StartDate:              startDate,
		EndDate:                endDate,
		Notes:                  body.Notes,
		PrimaryMetricLabel:     body.PrimaryMetricLabel,
		PrimaryMetricTarget:    body.PrimaryMetricTarget,
		PrimaryMetricUnit:      body.PrimaryMetricUnit,
		PaidChannels:           body.PaidChannels,
		BudgetAmountCents:      body.BudgetAmountCents,
		ActualSpendAmountCents: body.ActualSpendAmountCents,
		CurrencyCode:           body.CurrencyCode,
		UTMCampaign:            body.UTMCampaign,
		ExternalDashboardURL:   body.ExternalDashboardURL,
		PostIDs:                postIDs,
	}, nil
}

func parseDate(value string) (time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return time.Time{}, iam.ErrValidation
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return time.Time{}, iam.ErrValidation
	}
	return parsed, nil
}
