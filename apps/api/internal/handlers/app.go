package handlers

import (
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/heimdall/api/internal/ai"
	"github.com/heimdall/api/internal/auth"
	"github.com/heimdall/api/internal/automations"
	"github.com/heimdall/api/internal/campaigns"
	"github.com/heimdall/api/internal/config"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
	"github.com/heimdall/api/internal/resources"
	"github.com/heimdall/api/internal/social"
)

type AppHandler struct {
	service           *iam.Service
	aiService         *ai.Service
	resourceService   *resources.Service
	campaignService   *campaigns.Service
	postService       *posts.Service
	socialService     *social.Service
	automationService *automations.Service
	blobServer        resources.SignedBlobServer
	cfg               *config.Config
}

func NewAppHandler(service *iam.Service, aiService *ai.Service, resourceService *resources.Service, campaignService *campaigns.Service, postService *posts.Service, socialService *social.Service, automationService *automations.Service, blobServer resources.SignedBlobServer, cfg *config.Config) *AppHandler {
	return &AppHandler{service: service, aiService: aiService, resourceService: resourceService, campaignService: campaignService, postService: postService, socialService: socialService, automationService: automationService, blobServer: blobServer, cfg: cfg}
}

func (h *AppHandler) Register(app *fiber.App) {
	app.Get("/openapi.yaml", ServeOpenAPISpec)
	app.Get("/reference", ServeScalarReference)

	api := app.Group("/api/v1")
	api.Get("/health", h.HealthCheck)

	api.Post("/auth/register", h.customerRegister)
	api.Post("/auth/login", h.customerLogin)
	api.Post("/auth/refresh", h.customerRefresh)
	api.Post("/auth/logout", h.customerLogout)
	api.Get("/auth/me", h.requireAuth, h.customerMe)

	api.Post("/platform/auth/login", h.platformLogin)
	api.Post("/platform/auth/refresh", h.platformRefresh)
	api.Post("/platform/auth/logout", h.platformLogout)
	api.Get("/platform/me", h.requireAuth, h.platformMe)
	api.Get("/platform/roles", h.requireAuth, h.listPlatformRoles)
	api.Get("/platform/workspace-roles", h.requireAuth, h.listPlatformWorkspaceRoles)
	api.Post("/platform/customer-access", h.requireAuth, h.startPlatformCustomerAccess)
	api.Get("/platform/ai/catalog", h.requireAuth, h.getPlatformAICatalog)
	api.Get("/platform/ai/settings", h.requireAuth, h.getPlatformAISettings)
	api.Patch("/platform/ai/settings", h.requireAuth, h.updatePlatformAISettings)
	api.Post("/platform/ai/credentials", h.requireAuth, h.createPlatformAICredential)
	api.Patch("/platform/ai/credentials/:id", h.requireAuth, h.updatePlatformAICredential)
	api.Delete("/platform/ai/credentials/:id", h.requireAuth, h.deletePlatformAICredential)
	api.Post("/platform/ai/credentials/:id/test", h.requireAuth, h.testPlatformAICredential)

	api.Get("/workspaces", h.requireAuth, h.listWorkspaces)
	api.Post("/workspaces", h.requireAuth, h.createWorkspace)
	api.Get("/workspaces/:id", h.requireAuth, h.getWorkspace)
	api.Patch("/workspaces/:id", h.requireAuth, h.updateWorkspace)
	api.Get("/workspaces/:id/ai/context", h.requireAuth, h.getWorkspaceAIContext)
	api.Patch("/workspaces/:id/ai/context/business", h.requireAuth, h.updateWorkspaceAIBusinessContext)
	api.Patch("/workspaces/:id/ai/context/brand", h.requireAuth, h.updateWorkspaceAIBrandContext)
	api.Get("/workspaces/:id/ai/settings", h.requireAuth, h.getWorkspaceAISettings)
	api.Patch("/workspaces/:id/ai/settings", h.requireAuth, h.updateWorkspaceAISettings)
	api.Get("/workspaces/:id/ai/catalog", h.requireAuth, h.getWorkspaceAICatalog)
	api.Post("/workspaces/:id/ai/post-drafts", h.requireAuth, h.generateWorkspaceAIPostDraft)
	api.Get("/workspaces/:id/automation-catalog", h.requireAuth, h.getAutomationCatalog)
	api.Get("/workspaces/:id/automations", h.requireAuth, h.listAutomations)
	api.Post("/workspaces/:id/automations", h.requireAuth, h.createAutomation)
	api.Get("/workspaces/:id/automations/:automationId", h.requireAuth, h.getAutomation)
	api.Patch("/workspaces/:id/automations/:automationId", h.requireAuth, h.updateAutomation)
	api.Delete("/workspaces/:id/automations/:automationId", h.requireAuth, h.deleteAutomation)
	api.Get("/workspaces/:id/workflows", h.requireAuth, h.listWorkflows)
	api.Post("/workspaces/:id/workflows", h.requireAuth, h.createWorkflow)
	api.Get("/workspaces/:id/workflows/:workflowId", h.requireAuth, h.getWorkflow)
	api.Patch("/workspaces/:id/workflows/:workflowId", h.requireAuth, h.updateWorkflow)
	api.Delete("/workspaces/:id/workflows/:workflowId", h.requireAuth, h.deleteWorkflow)
	api.Post("/workspaces/:id/workflows/:workflowId/duplicate", h.requireAuth, h.duplicateWorkflow)
	api.Post("/workspaces/:id/automations/:automationId/runs", h.requireAuth, h.runAutomation)
	api.Post("/workspaces/:id/workflows/:workflowId/runs", h.requireAuth, h.runWorkflow)
	api.Get("/workspaces/:id/runs", h.requireAuth, h.listAutomationRuns)
	api.Get("/workspaces/:id/runs/:runId", h.requireAuth, h.getAutomationRun)
	api.Post("/workspaces/:id/runs/:runId/reviews", h.requireAuth, h.reviewAutomationRun)
	api.Get("/workspaces/:id/members", h.requireAuth, h.listWorkspaceMembers)
	api.Patch("/workspaces/:id/members/:membershipId", h.requireAuth, h.updateWorkspaceMember)
	api.Get("/workspaces/:id/roles", h.requireAuth, h.listWorkspaceRoles)
	api.Get("/workspaces/:id/invites", h.requireAuth, h.listWorkspaceInvites)
	api.Post("/workspaces/:id/invites", h.requireAuth, h.createWorkspaceInvite)
	api.Delete("/workspaces/:id/invites/:inviteId", h.requireAuth, h.deleteWorkspaceInvite)
	api.Post("/invites/:token/accept", h.requireAuth, h.acceptInvite)
	api.Get("/resource-blobs/:key", h.serveResourceBlob)
	api.Get("/resources/capabilities", h.requireAuth, h.resourceCapabilities)
	api.Post("/resources", h.requireAuth, h.uploadResource)
	api.Get("/resources", h.requireAuth, h.listResources)
	api.Get("/resources/:id/download", h.requireAuth, h.downloadResource)
	api.Post("/resources/:id/variants", h.requireAuth, h.createResourceVariant)
	api.Get("/resources/:id", h.requireAuth, h.getResource)
	api.Patch("/resources/:id", h.requireAuth, h.updateResource)
	api.Delete("/resources/:id", h.requireAuth, h.deleteResource)
	api.Get("/resource-sets", h.requireAuth, h.listResourceSets)
	api.Post("/resource-sets", h.requireAuth, h.createResourceSet)
	api.Get("/resource-sets/:id", h.requireAuth, h.getResourceSet)
	api.Patch("/resource-sets/:id", h.requireAuth, h.updateResourceSet)
	api.Put("/resource-sets/:id/items", h.requireAuth, h.replaceResourceSetItems)
	api.Delete("/resource-sets/:id", h.requireAuth, h.deleteResourceSet)
	api.Get("/campaigns", h.requireAuth, h.listCampaigns)
	api.Post("/campaigns", h.requireAuth, h.createCampaign)
	api.Get("/campaigns/:id", h.requireAuth, h.getCampaign)
	api.Patch("/campaigns/:id", h.requireAuth, h.updateCampaign)
	api.Delete("/campaigns/:id", h.requireAuth, h.deleteCampaign)
	api.Get("/calendar", h.requireAuth, h.listCalendar)
	api.Get("/dashboard/overview-summary", h.requireAuth, h.getDashboardOverviewSummary)
	api.Get("/posts", h.requireAuth, h.listPosts)
	api.Post("/posts", h.requireAuth, h.createPost)
	api.Get("/posts/compose/bootstrap", h.requireAuth, h.getPostComposeBootstrap)
	api.Get("/posts/metric-definitions", h.requireAuth, h.listPostMetricDefinitions)
	api.Post("/posts/:id/variants", h.requireAuth, h.createPostVariant)
	api.Get("/posts/:id", h.requireAuth, h.getPost)
	api.Patch("/posts/:id", h.requireAuth, h.updatePost)
	api.Delete("/posts/:id", h.requireAuth, h.deletePost)
	api.Put("/posts/:id/assets", h.requireAuth, h.syncPostAssets)
	api.Get("/posts/variants/:variantId", h.requireAuth, h.getPostVariant)
	api.Patch("/posts/variants/:variantId", h.requireAuth, h.updatePostVariant)
	api.Delete("/posts/variants/:variantId", h.requireAuth, h.deletePostVariant)
	api.Put("/posts/variants/:variantId/assets", h.requireAuth, h.syncPostVariantAssets)
	api.Post("/posts/variants/:variantId/reviews/submit", h.requireAuth, h.submitPostVariantReview)
	api.Post("/posts/variants/:variantId/reviews/decision", h.requireAuth, h.decidePostVariantReview)
	api.Post("/posts/variants/:variantId/planning", h.requireAuth, h.upsertPostVariantTentativePlan)
	api.Delete("/posts/variants/:variantId/planning", h.requireAuth, h.clearPostVariantTentativePlan)
	api.Post("/posts/variants/:variantId/planning/finalize", h.requireAuth, h.finalizePostVariantTentativePlan)
	api.Post("/posts/variants/:variantId/publication/schedule", h.requireAuth, h.schedulePostVariantPublication)
	api.Post("/posts/variants/:variantId/publication/unschedule", h.requireAuth, h.unschedulePostVariantPublication)
	api.Post("/posts/variants/:variantId/publication/record-published", h.requireAuth, h.recordPostVariantPublication)
	api.Get("/posts/variants/:variantId/metrics", h.requireAuth, h.listPostVariantMetrics)
	api.Post("/posts/variants/:variantId/metrics", h.requireAuth, h.recordPostVariantMetric)
	api.Get("/social/providers", h.requireAuth, h.listSocialProviders)
	api.Get("/social/credentials", h.requireAuth, h.listSocialCredentials)
	api.Put("/social/credentials/:provider", h.requireAuth, h.upsertSocialCredential)
	api.Post("/social/oauth/start", h.requireAuth, h.startSocialOAuth)
	api.Get("/social/oauth/callback/:provider", h.completeSocialOAuth)
	api.Get("/social/connections", h.requireAuth, h.listSocialConnections)
	api.Post("/social/targets/:targetId/select", h.requireAuth, h.selectSocialTarget)
	api.Post("/social/targets/:targetId/validate", h.requireAuth, h.validateSocialTarget)
	api.Post("/social/variants/:variantId/preview", h.requireAuth, h.previewSocialVariant)
	api.Post("/social/variants/:variantId/publish", h.requireAuth, h.publishSocialVariant)
	api.Post("/social/variants/:variantId/metrics/sync", h.requireAuth, h.syncSocialVariantMetrics)
	api.Post("/social/publications/run-due", h.requireAuth, h.runDueSocialPublications)

	api.Post("/platform/users", h.requireAuth, h.createPlatformUser)
	api.Get("/platform/users", h.requireAuth, h.listPlatformUsers)
	api.Get("/platform/users/:id", h.requireAuth, h.getPlatformUser)
	api.Patch("/platform/users/:id", h.requireAuth, h.updatePlatformUser)
	api.Post("/platform/users/:id/impersonate", h.requireAuth, h.impersonatePlatformUser)
	api.Get("/platform/workspaces", h.requireAuth, h.listPlatformWorkspaces)
	api.Post("/platform/workspaces", h.requireAuth, h.createPlatformWorkspace)
	api.Get("/platform/workspaces/:id", h.requireAuth, h.getPlatformWorkspace)
	api.Patch("/platform/workspaces/:id", h.requireAuth, h.updatePlatformWorkspace)
	api.Get("/platform/workspaces/:id/ai/settings", h.requireAuth, h.getPlatformWorkspaceAISettings)
	api.Patch("/platform/workspaces/:id/ai/settings", h.requireAuth, h.updatePlatformWorkspaceAISettings)
	api.Get("/platform/workspaces/:id/members", h.requireAuth, h.listPlatformWorkspaceMembers)
	api.Post("/platform/workspaces/:id/members", h.requireAuth, h.createPlatformWorkspaceMember)
	api.Patch("/platform/workspaces/:id/members/:membershipId", h.requireAuth, h.updatePlatformWorkspaceMember)
	api.Post("/platform/workspaces/:id/assume-access", h.requireAuth, h.assumeWorkspace)
}

func (h *AppHandler) requireAuth(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	c.Locals("principal", principal)
	return c.Next()
}

func (h *AppHandler) customerRegister(c fiber.Ctx) error {
	var body struct {
		FullName      string `json:"fullName"`
		Email         string `json:"email"`
		Password      string `json:"password"`
		WorkspaceName string `json:"workspaceName"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	session, refreshToken, err := h.service.Register(c.Context(), body.FullName, body.Email, body.Password, body.WorkspaceName)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.Status(fiber.StatusCreated).JSON(session)
}

func (h *AppHandler) customerLogin(c fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	session, refreshToken, err := h.service.CustomerLogin(c.Context(), body.Email, body.Password)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) customerRefresh(c fiber.Ctx) error {
	session, refreshToken, err := h.service.RefreshSession(c.Context(), auth.PortalCustomer, c.Cookies(h.cfg.Auth.CustomerCookieName))
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) customerLogout(c fiber.Ctx) error {
	if err := h.service.LogoutSession(c.Context(), c.Cookies(h.cfg.Auth.CustomerCookieName)); err != nil {
		return h.writeError(c, err)
	}
	h.clearRefreshCookie(c, auth.PortalCustomer)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) customerMe(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	session, err := h.service.Me(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(session)
}

func (h *AppHandler) platformLogin(c fiber.Ctx) error {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	session, refreshToken, err := h.service.PlatformLogin(c.Context(), body.Email, body.Password)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalPlatform, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) platformRefresh(c fiber.Ctx) error {
	session, refreshToken, err := h.service.RefreshSession(c.Context(), auth.PortalPlatform, c.Cookies(h.cfg.Auth.PlatformCookieName))
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalPlatform, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) platformLogout(c fiber.Ctx) error {
	if err := h.service.LogoutSession(c.Context(), c.Cookies(h.cfg.Auth.PlatformCookieName)); err != nil {
		return h.writeError(c, err)
	}
	h.clearRefreshCookie(c, auth.PortalPlatform)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) platformMe(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	session, err := h.service.PlatformMe(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(session)
}

func (h *AppHandler) listPlatformRoles(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListPlatformRoles(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) listPlatformWorkspaceRoles(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListPlatformWorkspaceRoles(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) startPlatformCustomerAccess(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	session, refreshToken, err := h.service.StartPlatformCustomerAccess(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) listWorkspaces(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaces, err := h.service.ListWorkspaces(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": workspaces})
}

func (h *AppHandler) createWorkspace(c fiber.Ctx) error {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspace, err := h.service.CreateWorkspace(c.Context(), principal, body.Name)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(workspace)
}

func (h *AppHandler) getWorkspace(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspace, err := h.service.GetWorkspace(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(workspace)
}

func (h *AppHandler) updateWorkspace(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspace, err := h.service.UpdateWorkspace(c.Context(), principal, workspaceID, body.Name, body.Status)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(workspace)
}

func (h *AppHandler) listWorkspaceMembers(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListWorkspaceMembers(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) updateWorkspaceMember(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	membershipID, err := uuid.Parse(c.Params("membershipId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Status    string   `json:"status"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.service.UpdateWorkspaceMember(c.Context(), principal, workspaceID, membershipID, body.Status, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) listWorkspaceRoles(c fiber.Ctx) error {
	items, err := h.service.ListWorkspaceRoles(c.Context())
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) listWorkspaceInvites(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListWorkspaceInvites(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createWorkspaceInvite(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Email     string   `json:"email"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	invite, token, err := h.service.CreateWorkspaceInvite(c.Context(), principal, workspaceID, body.Email, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"invite": invite, "token": token})
}

func (h *AppHandler) deleteWorkspaceInvite(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	inviteID, err := uuid.Parse(c.Params("inviteId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	if err := h.service.DeleteWorkspaceInvite(c.Context(), principal, workspaceID, inviteID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) acceptInvite(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	summary, err := h.service.AcceptInvite(c.Context(), principal, c.Params("token"))
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(summary)
}

func (h *AppHandler) resourceCapabilities(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	if _, err := h.resolveWorkspaceID(c, principal); err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(h.resourceService.Capabilities())
}

func (h *AppHandler) listResources(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.resourceService.ListResources(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) getResource(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	item, err := h.resourceService.GetResource(c.Context(), principal, workspaceID, resourceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(item)
}

func (h *AppHandler) uploadResource(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	input, err := h.bindResourceUpload(c)
	if err != nil {
		return h.writeError(c, err)
	}
	if closer, ok := input.Body.(io.Closer); ok {
		defer closer.Close()
	}
	response, err := h.resourceService.UploadResource(c.Context(), principal, workspaceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(response)
}

func (h *AppHandler) createResourceVariant(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := h.bindResourceUpload(c)
	if err != nil {
		return h.writeError(c, err)
	}
	if closer, ok := input.Body.(io.Closer); ok {
		defer closer.Close()
	}
	response, err := h.resourceService.CreateVariant(c.Context(), principal, workspaceID, resourceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(response)
}

func (h *AppHandler) downloadResource(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	downloadURL, err := h.resourceService.GetDownloadURL(c.Context(), principal, workspaceID, resourceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Redirect().To(downloadURL)
}

func (h *AppHandler) deleteResource(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.resourceService.DeleteResource(c.Context(), principal, workspaceID, resourceID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) updateResource(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		DisplayName string `json:"displayName"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.resourceService.UpdateResource(c.Context(), principal, workspaceID, resourceID, resources.UpdateInput{
		DisplayName: body.DisplayName,
	})
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) listResourceSets(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.resourceService.ListResourceSets(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) getResourceSet(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceSetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	item, err := h.resourceService.GetResourceSet(c.Context(), principal, workspaceID, resourceSetID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(item)
}

func (h *AppHandler) createResourceSet(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	input, err := h.bindCreateResourceSet(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.resourceService.CreateResourceSet(c.Context(), principal, workspaceID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) updateResourceSet(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceSetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := h.bindUpdateResourceSet(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.resourceService.UpdateResourceSet(c.Context(), principal, workspaceID, resourceSetID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) replaceResourceSetItems(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceSetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	input, err := h.bindResourceSetItems(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.resourceService.ReplaceResourceSetItems(c.Context(), principal, workspaceID, resourceSetID, input)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) deleteResourceSet(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := h.resolveWorkspaceID(c, principal)
	if err != nil {
		return h.writeError(c, err)
	}
	resourceSetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	if err := h.resourceService.DeleteResourceSet(c.Context(), principal, workspaceID, resourceSetID); err != nil {
		return h.writeError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *AppHandler) serveResourceBlob(c fiber.Ctx) error {
	if h.blobServer == nil {
		return c.SendStatus(fiber.StatusNotFound)
	}
	expiresUnix, err := strconv.ParseInt(c.Query("expires"), 10, 64)
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	// Parse optional width parameter for thumbnail generation
	width := 0
	if w := c.Query("w"); w != "" {
		if parsedWidth, parseErr := strconv.Atoi(w); parseErr == nil {
			width = parsedWidth
		}
	}
	blob, err := h.blobServer.OpenSigned(c.Context(), c.Params("key"), c.Query("filename"), expiresUnix, c.Query("sig"), width)
	if err != nil {
		return h.writeError(c, fmt.Errorf("%w: invalid or expired resource link", iam.ErrUnauthorized))
	}
	c.Set("Content-Type", blob.ContentType)
	c.Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", blob.Filename))
	// Cache thumbnails for 1 year (they're immutable based on content)
	if width > 0 {
		c.Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	return c.SendStream(blob.Reader, int(blob.Size))
}

func (h *AppHandler) bindResourceUpload(c fiber.Ctx) (resources.UploadInput, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil || fileHeader == nil {
		return resources.UploadInput{}, fmt.Errorf("%w: file is required", iam.ErrValidation)
	}
	file, err := fileHeader.Open()
	if err != nil {
		return resources.UploadInput{}, err
	}
	optimizeValue := strings.TrimSpace(c.FormValue("optimize"))
	var optimize *bool
	if optimizeValue != "" {
		parsed, parseErr := strconv.ParseBool(optimizeValue)
		if parseErr != nil {
			file.Close()
			return resources.UploadInput{}, fmt.Errorf("%w: optimize must be true or false", iam.ErrValidation)
		}
		optimize = &parsed
	}
	return resources.UploadInput{
		DisplayName:     strings.TrimSpace(c.FormValue("displayName")),
		OriginalName:    fileHeader.Filename,
		ContentType:     fileHeader.Header.Get("Content-Type"),
		SourceType:      strings.TrimSpace(c.FormValue("sourceType")),
		Optimize:        optimize,
		TransformRecipe: strings.TrimSpace(c.FormValue("transformRecipe")),
		Body:            file,
	}, nil
}

func (h *AppHandler) bindCreateResourceSet(c fiber.Ctx) (resources.CreateResourceSetInput, error) {
	var body struct {
		Name            string           `json:"name"`
		Description     string           `json:"description"`
		IntentType      string           `json:"intentType"`
		IntentPlatform  string           `json:"intentPlatform"`
		IntentSurface   string           `json:"intentSurface"`
		CoverResourceID string           `json:"coverResourceId"`
		SourceType      string           `json:"sourceType"`
		Metadata        map[string]any   `json:"metadata"`
		Items           []map[string]any `json:"items"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return resources.CreateResourceSetInput{}, iam.ErrValidation
	}
	items, err := parseResourceSetItems(body.Items)
	if err != nil {
		return resources.CreateResourceSetInput{}, err
	}
	var coverResourceID *uuid.UUID
	if strings.TrimSpace(body.CoverResourceID) != "" {
		parsed, err := uuid.Parse(body.CoverResourceID)
		if err != nil {
			return resources.CreateResourceSetInput{}, iam.ErrValidation
		}
		coverResourceID = &parsed
	}
	return resources.CreateResourceSetInput{
		Name:            body.Name,
		Description:     body.Description,
		IntentType:      body.IntentType,
		IntentPlatform:  body.IntentPlatform,
		IntentSurface:   body.IntentSurface,
		CoverResourceID: coverResourceID,
		SourceType:      body.SourceType,
		Metadata:        body.Metadata,
		Items:           items,
	}, nil
}

func (h *AppHandler) bindUpdateResourceSet(c fiber.Ctx) (resources.UpdateResourceSetInput, error) {
	var body struct {
		Name            string         `json:"name"`
		Description     string         `json:"description"`
		IntentType      string         `json:"intentType"`
		IntentPlatform  string         `json:"intentPlatform"`
		IntentSurface   string         `json:"intentSurface"`
		CoverResourceID *string        `json:"coverResourceId"`
		ClearCover      bool           `json:"clearCover"`
		Metadata        map[string]any `json:"metadata"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return resources.UpdateResourceSetInput{}, iam.ErrValidation
	}
	var coverResourceID *uuid.UUID
	if body.CoverResourceID != nil && strings.TrimSpace(*body.CoverResourceID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*body.CoverResourceID))
		if err != nil {
			return resources.UpdateResourceSetInput{}, iam.ErrValidation
		}
		coverResourceID = &parsed
	}
	return resources.UpdateResourceSetInput{
		Name:            body.Name,
		Description:     body.Description,
		IntentType:      body.IntentType,
		IntentPlatform:  body.IntentPlatform,
		IntentSurface:   body.IntentSurface,
		CoverResourceID: coverResourceID,
		ClearCover:      body.ClearCover,
		Metadata:        body.Metadata,
	}, nil
}

func (h *AppHandler) bindResourceSetItems(c fiber.Ctx) ([]resources.ResourceSetItemInput, error) {
	var body struct {
		Items []map[string]any `json:"items"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return nil, iam.ErrValidation
	}
	return parseResourceSetItems(body.Items)
}

func parseResourceSetItems(rawItems []map[string]any) ([]resources.ResourceSetItemInput, error) {
	items := make([]resources.ResourceSetItemInput, 0, len(rawItems))
	for _, raw := range rawItems {
		idValue, ok := raw["resourceId"].(string)
		if !ok || strings.TrimSpace(idValue) == "" {
			return nil, fmt.Errorf("%w: resourceId is required for each item", iam.ErrValidation)
		}
		resourceID, err := uuid.Parse(strings.TrimSpace(idValue))
		if err != nil {
			return nil, iam.ErrValidation
		}
		role, _ := raw["role"].(string)
		metadata := map[string]any{}
		if parsedMetadata, ok := raw["metadata"].(map[string]any); ok {
			metadata = parsedMetadata
		}
		items = append(items, resources.ResourceSetItemInput{
			ResourceID: resourceID,
			Role:       role,
			Metadata:   metadata,
		})
	}
	return items, nil
}

func (h *AppHandler) listPlatformUsers(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListPlatformUsers(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createPlatformUser(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	var body struct {
		FullName  string   `json:"fullName"`
		Email     string   `json:"email"`
		Password  string   `json:"password"`
		Status    string   `json:"status"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.service.CreatePlatformUser(c.Context(), principal, body.FullName, body.Email, body.Password, body.Status, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) getPlatformUser(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.service.GetPlatformUser(c.Context(), principal, userID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updatePlatformUser(c fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		FullName  string   `json:"fullName"`
		Status    string   `json:"status"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.service.UpdatePlatformUser(c.Context(), principal, userID, body.FullName, body.Status, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) impersonatePlatformUser(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	session, refreshToken, err := h.service.ImpersonateUser(c.Context(), principal, userID)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) listPlatformWorkspaces(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListPlatformWorkspaces(c.Context(), principal)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createPlatformWorkspace(c fiber.Ctx) error {
	var body struct {
		Name string `json:"name"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.service.CreatePlatformWorkspace(c.Context(), principal, body.Name)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) getPlatformWorkspace(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.service.GetPlatformWorkspace(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) updatePlatformWorkspace(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	record, err := h.service.UpdatePlatformWorkspace(c.Context(), principal, workspaceID, body.Name, body.Status)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) listPlatformWorkspaceMembers(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	items, err := h.service.ListPlatformWorkspaceMembers(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(fiber.Map{"items": items})
}

func (h *AppHandler) createPlatformWorkspaceMember(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		FullName  string   `json:"fullName"`
		Email     string   `json:"email"`
		Password  string   `json:"password"`
		Status    string   `json:"status"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.service.CreatePlatformWorkspaceMember(c.Context(), principal, workspaceID, body.FullName, body.Email, body.Password, body.Status, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(record)
}

func (h *AppHandler) updatePlatformWorkspaceMember(c fiber.Ctx) error {
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	membershipID, err := uuid.Parse(c.Params("membershipId"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	var body struct {
		Status    string   `json:"status"`
		RoleCodes []string `json:"roleCodes"`
	}
	if err := c.Bind().JSON(&body); err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	record, err := h.service.UpdatePlatformWorkspaceMember(c.Context(), principal, workspaceID, membershipID, body.Status, body.RoleCodes)
	if err != nil {
		return h.writeError(c, err)
	}
	return c.JSON(record)
}

func (h *AppHandler) assumeWorkspace(c fiber.Ctx) error {
	workspaceID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return h.writeError(c, iam.ErrValidation)
	}
	principal, err := h.principal(c)
	if err != nil {
		return h.writeError(c, err)
	}
	session, refreshToken, err := h.service.AssumeWorkspace(c.Context(), principal, workspaceID)
	if err != nil {
		return h.writeError(c, err)
	}
	h.setRefreshCookie(c, auth.PortalCustomer, refreshToken)
	return c.JSON(session)
}

func (h *AppHandler) principal(c fiber.Ctx) (*iam.Principal, error) {
	if principal, ok := c.Locals("principal").(*iam.Principal); ok && principal != nil {
		return principal, nil
	}

	header := strings.TrimSpace(c.Get("Authorization"))
	if header == "" {
		return nil, iam.ErrUnauthorized
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	if token == header {
		token = strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
	}
	if token == "" || token == header {
		return nil, iam.ErrUnauthorized
	}

	principal, err := h.service.BuildPrincipal(token)
	if err != nil {
		return nil, err
	}
	c.Locals("principal", principal)
	return principal, nil
}

func (h *AppHandler) resolveWorkspaceID(c fiber.Ctx, principal *iam.Principal) (uuid.UUID, error) {
	return h.service.ResolveWorkspaceID(principal, c.Get("X-Workspace-ID"))
}

func (h *AppHandler) setRefreshCookie(c fiber.Ctx, portal, token string) {
	name := h.cfg.Auth.CustomerCookieName
	if portal == auth.PortalPlatform {
		name = h.cfg.Auth.PlatformCookieName
	}
	c.Cookie(&fiber.Cookie{
		Name:     name,
		Value:    token,
		HTTPOnly: true,
		Secure:   h.cfg.Auth.CookieSecure,
		SameSite: fiber.CookieSameSiteLaxMode,
		Path:     "/",
		Expires:  time.Now().UTC().Add(h.cfg.Auth.RefreshTokenTTL),
	})
}

func (h *AppHandler) clearRefreshCookie(c fiber.Ctx, portal string) {
	name := h.cfg.Auth.CustomerCookieName
	if portal == auth.PortalPlatform {
		name = h.cfg.Auth.PlatformCookieName
	}
	c.Cookie(&fiber.Cookie{
		Name:     name,
		Value:    "",
		HTTPOnly: true,
		Secure:   h.cfg.Auth.CookieSecure,
		SameSite: fiber.CookieSameSiteLaxMode,
		Path:     "/",
		Expires:  time.Unix(0, 0),
	})
}

func (h *AppHandler) writeError(c fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	switch {
	case errors.Is(err, iam.ErrUnauthorized):
		status = fiber.StatusUnauthorized
	case errors.Is(err, iam.ErrForbidden):
		status = fiber.StatusForbidden
	case errors.Is(err, iam.ErrNotFound):
		status = fiber.StatusNotFound
	case errors.Is(err, iam.ErrConflict), errors.Is(err, iam.ErrLastWorkspaceOwner):
		status = fiber.StatusConflict
	case errors.Is(err, iam.ErrValidation):
		status = fiber.StatusBadRequest
	}
	return c.Status(status).JSON(fiber.Map{
		"error":   true,
		"message": err.Error(),
	})
}
