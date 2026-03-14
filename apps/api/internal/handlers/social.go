package handlers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/social"
)

func (h *AppHandler) listSocialProviders(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.socialService.ListProviderAvailability(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) listSocialCredentials(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.socialService.ListAppCredentials(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) upsertSocialCredential(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	var body social.UpsertAppCredentialInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.socialService.UpsertAppCredential(c.Context(), principal, workspaceID, c.Params("provider"), body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) startSocialOAuth(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	var body social.StartOAuthInput
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	result, err := h.socialService.StartOAuth(c.Context(), principal, workspaceID, body)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(result)
}

func (h *AppHandler) completeSocialOAuth(c fiber.Ctx) error {
	result, err := h.socialService.CompleteOAuth(c.Context(), c.Params("provider"), c.Query("state"), c.Query("code"))
	if err != nil {
		payload, _ := json.Marshal(map[string]any{
			"type":    "heimdall-social-oauth",
			"success": false,
			"message": err.Error(),
		})
		return c.Type("html").SendString(oauthCallbackHTML("", string(payload), "Connection failed"))
	}
	payload, _ := json.Marshal(map[string]any{
		"type":         "heimdall-social-oauth",
		"success":      true,
		"provider":     result.Provider,
		"message":      result.Message,
		"returnPath":   result.ReturnPath,
		"returnOrigin": result.ReturnOrigin,
	})
	return c.Type("html").SendString(oauthCallbackHTML(result.ReturnOrigin, string(payload), "Account connected"))
}

func (h *AppHandler) listSocialConnections(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	result, err := h.socialService.ListConnections(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(result)
}

func (h *AppHandler) selectSocialTarget(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	targetID, err := uuid.Parse(c.Params("targetId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Selected bool `json:"selected"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		body.Selected = true
	}
	record, err := h.socialService.SelectTarget(c.Context(), principal, workspaceID, targetID, body.Selected)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) validateSocialTarget(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	targetID, err := uuid.Parse(c.Params("targetId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Checkpoint string `json:"checkpoint"`
	}
	_ = c.Bind().JSON(&body)
	record, err := h.socialService.ValidateTarget(c.Context(), principal, workspaceID, targetID, body.Checkpoint)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) previewSocialVariant(c fiber.Ctx) error {
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
	var body struct {
		SocialTargetID string `json:"socialTargetId"`
	}
	_ = c.Bind().JSON(&body)
	var targetID *uuid.UUID
	if strings.TrimSpace(body.SocialTargetID) != "" {
		parsed, err := uuid.Parse(body.SocialTargetID)
		if err != nil {
			return h.writeError(c, iam.ErrValidation)
		}
		targetID = &parsed
	}
	record, err := h.socialService.PreviewVariantPublishability(c.Context(), principal, workspaceID, variantID, targetID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) publishSocialVariant(c fiber.Ctx) error {
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
	var body struct {
		SocialTargetID string `json:"socialTargetId"`
		Source         string `json:"source"`
	}
	if err := c.Bind().JSON(&body); err != nil && !strings.Contains(err.Error(), "EOF") {
		return h.writeError(c, iam.ErrValidation)
	}
	input := social.PublishVariantInput{Source: body.Source}
	if strings.TrimSpace(body.SocialTargetID) != "" {
		parsed, err := uuid.Parse(body.SocialTargetID)
		if err != nil {
			return h.writeError(c, iam.ErrValidation)
		}
		input.SocialTargetID = &parsed
	}
	record, err := h.socialService.PublishVariant(c.Context(), principal, workspaceID, variantID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) syncSocialVariantMetrics(c fiber.Ctx) error {
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
	record, err := h.socialService.SyncPublicationMetrics(c.Context(), principal, workspaceID, variantID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) runDueSocialPublications(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.socialService.PublishDue(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func oauthCallbackHTML(origin, payloadJSON, headline string) string {
	escapedOrigin := strings.ReplaceAll(origin, `"`, "")
	return fmt.Sprintf(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>%s</title></head>
<body style="font-family: sans-serif; padding: 24px;">
<script>
const payload = %s;
try {
	if (window.opener) {
		window.opener.postMessage(payload, %q || "*");
	}
} catch (_) {}
window.close();
</script>
<p>%s</p>
</body>
</html>`, headline, payloadJSON, escapedOrigin, headline)
}
