package automations

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/ai"
	"github.com/heimdall/api/internal/campaigns"
	"github.com/heimdall/api/internal/database"
	"github.com/heimdall/api/internal/iam"
	"github.com/heimdall/api/internal/posts"
	"github.com/heimdall/api/internal/resources"
)

const (
	sourceTypeAutomation = "automation"
	sourceTypeWorkflow   = "workflow"

	triggerTypeManual = "manual"

	runStatusQueued        = "queued"
	runStatusRunning       = "running"
	runStatusWaitingReview = "waiting_review"
	runStatusCompleted     = "completed"
	runStatusFailed        = "failed"
	runStatusCancelled     = "cancelled"

	stepStateDraft         = "draft"
	stepStateQueued        = "queued"
	stepStateRunning       = "running"
	stepStateWaitingReview = "waiting_review"
	stepStateCompleted     = "completed"
	stepStateFailed        = "failed"
	stepStateCancelled     = "cancelled"

	scopeStandalone = "standalone"
	scopeWorkflow   = "workflow"

	stepKindAction  = "action"
	stepKindReview  = "review"
	stepKindPublish = "publish"

	reviewerTypeHuman = "human"
	reviewerTypeAI    = "ai"
	reviewerTypeNone  = "none"

	actionCampaignPlan       = "campaign_plan"
	actionPostGenerate       = "post_generate"
	actionVariationsGenerate = "post_variations_generate"
	actionImageGenerate      = "image_generate"
	actionReelGenerate       = "reel_generate_beta"
	actionLinkedInPDF        = "linkedin_pdf_generate_beta"
	actionReview             = "review"
	actionPublishOrSchedule  = "publish_or_schedule"

	artifactNone         = "none"
	artifactAny          = "any"
	artifactCampaign     = "campaign"
	artifactPostDraft    = "post_draft"
	artifactPostVariants = "post_variants"
	artifactResource     = "resource"
	artifactResourceSet  = "resource_set"
	artifactDocument     = "document_resource"
	artifactVideo        = "video_resource"
	artifactStructured   = "structured_brief"
	artifactPublication  = "publication_plan"

	pollinationsProviderID = "pollinations"
)

type WorkspaceAuthorizer interface {
	RequireWorkspacePermission(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, requiredPermission string) ([]iam.APIPermission, error)
}

type ActionContract struct {
	ActionType           string   `json:"actionType"`
	Label                string   `json:"label"`
	Description          string   `json:"description"`
	AcceptedInputs       []string `json:"acceptedInputs"`
	ProducedOutputs      []string `json:"producedOutputs"`
	RequiredCapabilities []string `json:"requiredCapabilities"`
	ReviewEligible       bool     `json:"reviewEligible"`
	PublishEligible      bool     `json:"publishEligible"`
	SupportsStandalone   bool     `json:"supportsStandalone"`
	Beta                 bool     `json:"beta"`
	DefaultReviewerType  string   `json:"defaultReviewerType,omitempty"`
	DefaultConsumesType  string   `json:"defaultConsumesType"`
	DefaultProducesType  string   `json:"defaultProducesType"`
	DefaultStepKind      string   `json:"defaultStepKind"`
	ProviderCapabilities []string `json:"providerCapabilities,omitempty"`
}

type AutomationTemplate struct {
	ID          string               `json:"id"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Category    string               `json:"category"`
	EntryPoint  string               `json:"entryPoint"`
	Beta        bool                 `json:"beta"`
	Metadata    map[string]any       `json:"metadata,omitempty"`
	Steps       []WorkflowStepRecord `json:"steps"`
}

type CatalogResponse struct {
	Actions   []ActionContract     `json:"actions"`
	Templates []AutomationTemplate `json:"templates"`
}

type AutomationDefinitionRecord struct {
	ID              string         `json:"id"`
	WorkspaceID     string         `json:"workspaceId"`
	Status          string         `json:"status"`
	Scope           string         `json:"scope"`
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	ActionType      string         `json:"actionType"`
	TriggerType     string         `json:"triggerType"`
	InputSchema     map[string]any `json:"inputSchema"`
	DefaultConfig   map[string]any `json:"defaultConfig"`
	OutputSchema    map[string]any `json:"outputSchema"`
	ReviewPolicy    map[string]any `json:"reviewPolicy"`
	CapabilityHints []string       `json:"capabilityHints"`
	Metadata        map[string]any `json:"metadata"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
}

type WorkflowDefinitionRecord struct {
	ID              string               `json:"id"`
	WorkspaceID     string               `json:"workspaceId"`
	Status          string               `json:"status"`
	Scope           string               `json:"scope"`
	Name            string               `json:"name"`
	Description     string               `json:"description"`
	TriggerType     string               `json:"triggerType"`
	InputSchema     map[string]any       `json:"inputSchema"`
	OutputSchema    map[string]any       `json:"outputSchema"`
	ReviewPolicy    map[string]any       `json:"reviewPolicy"`
	CapabilityHints []string             `json:"capabilityHints"`
	Metadata        map[string]any       `json:"metadata"`
	Steps           []WorkflowStepRecord `json:"steps"`
	CreatedAt       string               `json:"createdAt"`
	UpdatedAt       string               `json:"updatedAt"`
}

type WorkflowStepRecord struct {
	ID                   string         `json:"id,omitempty"`
	AutomationID         string         `json:"automationId,omitempty"`
	Position             int            `json:"position"`
	Name                 string         `json:"name"`
	StepKind             string         `json:"stepKind"`
	ActionType           string         `json:"actionType"`
	ConsumesArtifactType string         `json:"consumesArtifactType"`
	ProducesArtifactType string         `json:"producesArtifactType"`
	ReviewerType         string         `json:"reviewerType"`
	RequiredCapabilities []string       `json:"requiredCapabilities"`
	Config               map[string]any `json:"config"`
	Metadata             map[string]any `json:"metadata"`
}

type RunArtifact struct {
	Type          string         `json:"type"`
	Label         string         `json:"label"`
	CampaignID    string         `json:"campaignId,omitempty"`
	PostID        string         `json:"postId,omitempty"`
	VariantIDs    []string       `json:"variantIds,omitempty"`
	ResourceID    string         `json:"resourceId,omitempty"`
	ResourceSetID string         `json:"resourceSetId,omitempty"`
	Data          map[string]any `json:"data,omitempty"`
}

type RunReview struct {
	ID              string   `json:"id"`
	RunID           string   `json:"runId"`
	RunStepID       string   `json:"runStepId,omitempty"`
	ReviewerType    string   `json:"reviewerType"`
	Decision        string   `json:"decision"`
	Status          string   `json:"status"`
	Comment         string   `json:"comment"`
	Findings        []string `json:"findings"`
	ActorUserID     string   `json:"actorUserId,omitempty"`
	AutomationAgent string   `json:"automationAgent"`
	CreatedAt       string   `json:"createdAt"`
}

type AutomationRunStepRecord struct {
	ID              string         `json:"id"`
	WorkflowStepID  string         `json:"workflowStepId,omitempty"`
	Position        int            `json:"position"`
	Name            string         `json:"name"`
	StepKind        string         `json:"stepKind"`
	ActionType      string         `json:"actionType"`
	State           string         `json:"state"`
	ReviewerType    string         `json:"reviewerType"`
	InputPayload    map[string]any `json:"inputPayload"`
	OutputPayload   map[string]any `json:"outputPayload"`
	ArtifactPayload []RunArtifact  `json:"artifactPayload"`
	EvidencePayload map[string]any `json:"evidencePayload"`
	LastError       string         `json:"lastError,omitempty"`
	StartedAt       string         `json:"startedAt,omitempty"`
	CompletedAt     string         `json:"completedAt,omitempty"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
}

type AutomationRunRecord struct {
	ID                  string                    `json:"id"`
	WorkspaceID         string                    `json:"workspaceId"`
	SourceType          string                    `json:"sourceType"`
	AutomationID        string                    `json:"automationId,omitempty"`
	WorkflowID          string                    `json:"workflowId,omitempty"`
	Status              string                    `json:"status"`
	CurrentStepPosition *int                      `json:"currentStepPosition,omitempty"`
	TriggerType         string                    `json:"triggerType"`
	ReviewRequired      bool                      `json:"reviewRequired"`
	ReviewerType        string                    `json:"reviewerType"`
	InputPayload        map[string]any            `json:"inputPayload"`
	OutputPayload       map[string]any            `json:"outputPayload"`
	LastError           string                    `json:"lastError,omitempty"`
	ContextFingerprint  string                    `json:"contextFingerprint"`
	EvidencePayload     map[string]any            `json:"evidencePayload"`
	Steps               []AutomationRunStepRecord `json:"steps"`
	Reviews             []RunReview               `json:"reviews"`
	CompletedAt         string                    `json:"completedAt,omitempty"`
	CreatedAt           string                    `json:"createdAt"`
	UpdatedAt           string                    `json:"updatedAt"`
}

type CreateAutomationInput struct {
	Status          string         `json:"status"`
	Scope           string         `json:"scope"`
	Name            string         `json:"name"`
	Description     string         `json:"description"`
	ActionType      string         `json:"actionType"`
	TriggerType     string         `json:"triggerType"`
	InputSchema     map[string]any `json:"inputSchema"`
	DefaultConfig   map[string]any `json:"defaultConfig"`
	OutputSchema    map[string]any `json:"outputSchema"`
	ReviewPolicy    map[string]any `json:"reviewPolicy"`
	CapabilityHints []string       `json:"capabilityHints"`
	Metadata        map[string]any `json:"metadata"`
}

type CreateWorkflowInput struct {
	Status          string               `json:"status"`
	Scope           string               `json:"scope"`
	Name            string               `json:"name"`
	Description     string               `json:"description"`
	TriggerType     string               `json:"triggerType"`
	InputSchema     map[string]any       `json:"inputSchema"`
	OutputSchema    map[string]any       `json:"outputSchema"`
	ReviewPolicy    map[string]any       `json:"reviewPolicy"`
	CapabilityHints []string             `json:"capabilityHints"`
	Metadata        map[string]any       `json:"metadata"`
	Steps           []WorkflowStepRecord `json:"steps"`
}

type UpdateAutomationInput struct {
	Status          *string         `json:"status"`
	Scope           *string         `json:"scope"`
	Name            *string         `json:"name"`
	Description     *string         `json:"description"`
	ActionType      *string         `json:"actionType"`
	TriggerType     *string         `json:"triggerType"`
	InputSchema     *map[string]any `json:"inputSchema"`
	DefaultConfig   *map[string]any `json:"defaultConfig"`
	OutputSchema    *map[string]any `json:"outputSchema"`
	ReviewPolicy    *map[string]any `json:"reviewPolicy"`
	CapabilityHints *[]string       `json:"capabilityHints"`
	Metadata        *map[string]any `json:"metadata"`
}

type UpdateWorkflowInput struct {
	Status          *string               `json:"status"`
	Scope           *string               `json:"scope"`
	Name            *string               `json:"name"`
	Description     *string               `json:"description"`
	TriggerType     *string               `json:"triggerType"`
	InputSchema     *map[string]any       `json:"inputSchema"`
	OutputSchema    *map[string]any       `json:"outputSchema"`
	ReviewPolicy    *map[string]any       `json:"reviewPolicy"`
	CapabilityHints *[]string             `json:"capabilityHints"`
	Metadata        *map[string]any       `json:"metadata"`
	Steps           *[]WorkflowStepRecord `json:"steps"`
}

type DuplicateWorkflowInput struct {
	Name string `json:"name"`
}

type RunRequest struct {
	Input map[string]any `json:"input"`
}

type ReviewRunInput struct {
	Decision string   `json:"decision"`
	Comment  string   `json:"comment"`
	Findings []string `json:"findings"`
}

type researchResult struct {
	Summary       string           `json:"summary"`
	SourceURLs    []string         `json:"sourceUrls"`
	Facts         []map[string]any `json:"facts"`
	EvidenceNotes []string         `json:"evidenceNotes"`
}

type textGenerationRequest struct {
	UseCase      string
	SystemPrompt string
	Prompt       string
	PromptScope  string
	CampaignID   *uuid.UUID
	Provider     string
	Model        string
	Mode         string
}

type imageGenerationRequest struct {
	Prompt string
	Width  int
	Height int
	Seed   string
	Model  string
}

type imageGenerationResult struct {
	Provider    string
	Model       string
	Prompt      string
	ContentType string
	FileName    string
	Data        []byte
}

type mediaCompositionRequest struct {
	SourceResourceID uuid.UUID
	Title            string
	Caption          string
	Style            string
	Effects          []string
}

type mediaCompositionResult struct {
	ResourceSet *resources.ResourceSetDetail
	Blueprint   map[string]any
}

type documentRenderRequest struct {
	Title           string
	Subtitle        string
	Pages           []string
	CreatePostDraft bool
}

type documentRenderResult struct {
	FileName         string
	ContentType      string
	Data             []byte
	SuggestedCaption string
}

type executionResult struct {
	Output    map[string]any
	Artifacts []RunArtifact
	Evidence  map[string]any
}

type automationProviderRegistry struct {
	text     map[string]textGenerationProvider
	research map[string]researchProvider
	image    map[string]imageGenerationProvider
	media    map[string]mediaCompositionProvider
	document map[string]documentRenderingProvider
}

type textGenerationProvider interface {
	Generate(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request textGenerationRequest) (*ai.GeneratedStructuredArtifact, error)
}

type researchProvider interface {
	Research(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request textGenerationRequest) (*researchResult, error)
}

type imageGenerationProvider interface {
	Generate(ctx context.Context, request imageGenerationRequest) (*imageGenerationResult, error)
}

type mediaCompositionProvider interface {
	Compose(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request mediaCompositionRequest) (*mediaCompositionResult, error)
}

type documentRenderingProvider interface {
	Render(ctx context.Context, request documentRenderRequest) (*documentRenderResult, error)
}

type Service struct {
	db         *bun.DB
	authorizer WorkspaceAuthorizer
	ai         *ai.Service
	resources  *resources.Service
	campaigns  *campaigns.Service
	posts      *posts.Service
	httpClient *http.Client
	providers  automationProviderRegistry
}

func NewService(
	db *bun.DB,
	authorizer WorkspaceAuthorizer,
	aiService *ai.Service,
	resourceService *resources.Service,
	campaignService *campaigns.Service,
	postService *posts.Service,
) *Service {
	service := &Service{
		db:         db,
		authorizer: authorizer,
		ai:         aiService,
		resources:  resourceService,
		campaigns:  campaignService,
		posts:      postService,
		httpClient: &http.Client{Timeout: 45 * time.Second},
		providers: automationProviderRegistry{
			text:     map[string]textGenerationProvider{},
			research: map[string]researchProvider{},
			image:    map[string]imageGenerationProvider{},
			media:    map[string]mediaCompositionProvider{},
			document: map[string]documentRenderingProvider{},
		},
	}
	service.registerDefaults()
	return service
}

func (s *Service) registerDefaults() {
	s.providers.text["workspace_ai"] = aiTextGenerationProvider{ai: s.ai}
	s.providers.research["workspace_ai"] = aiResearchProvider{ai: s.ai}
	s.providers.image[pollinationsProviderID] = pollinationsImageProvider{client: s.httpClient}
	s.providers.media["reel_blueprint"] = reelBlueprintProvider{resources: s.resources}
	s.providers.document["linkedin_pdf"] = linkedInPDFProvider{}
}

func (s *Service) GetCatalog(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) (*CatalogResponse, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	return &CatalogResponse{
		Actions:   s.actionCatalog(),
		Templates: s.templates(),
	}, nil
}

func (s *Service) ListAutomations(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]AutomationDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	var records []database.AutomationDefinition
	if err := s.db.NewSelect().
		Model(&records).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	result := make([]AutomationDefinitionRecord, 0, len(records))
	for _, record := range records {
		result = append(result, mapAutomationDefinition(record))
	}
	return result, nil
}

func (s *Service) CreateAutomation(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input CreateAutomationInput) (*AutomationDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return nil, err
	}
	contract, ok := s.findActionContract(strings.TrimSpace(input.ActionType))
	if !ok {
		return nil, fmt.Errorf("%w: unsupported automation action type", iam.ErrValidation)
	}
	now := time.Now().UTC()
	record := &database.AutomationDefinition{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		Status:          defaultString(strings.TrimSpace(strings.ToLower(input.Status)), "active"),
		Scope:           defaultString(strings.TrimSpace(strings.ToLower(input.Scope)), scopeStandalone),
		Name:            strings.TrimSpace(input.Name),
		Description:     strings.TrimSpace(input.Description),
		ActionType:      contract.ActionType,
		TriggerType:     defaultString(strings.TrimSpace(strings.ToLower(input.TriggerType)), triggerTypeManual),
		InputSchema:     marshalJSON(input.InputSchema),
		DefaultConfig:   marshalJSON(input.DefaultConfig),
		OutputSchema:    marshalJSON(input.OutputSchema),
		ReviewPolicy:    marshalJSON(input.ReviewPolicy),
		CapabilityHints: marshalJSON(normalizeStringSlice(input.CapabilityHints)),
		Metadata:        marshalJSON(input.Metadata),
		CreatedByUserID: &principal.UserID,
		UpdatedByUserID: &principal.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if record.Name == "" {
		return nil, fmt.Errorf("%w: automation name is required", iam.ErrValidation)
	}
	if _, err := s.db.NewInsert().Model(record).Exec(ctx); err != nil {
		return nil, err
	}
	mapped := mapAutomationDefinition(*record)
	return &mapped, nil
}

func (s *Service) GetAutomation(ctx context.Context, principal *iam.Principal, workspaceID, automationID uuid.UUID) (*AutomationDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	record, err := s.findAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return nil, err
	}
	mapped := mapAutomationDefinition(*record)
	return &mapped, nil
}

func (s *Service) UpdateAutomation(ctx context.Context, principal *iam.Principal, workspaceID, automationID uuid.UUID, input UpdateAutomationInput) (*AutomationDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return nil, err
	}
	record, err := s.findAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return nil, err
	}
	if input.ActionType != nil {
		contract, ok := s.findActionContract(strings.TrimSpace(*input.ActionType))
		if !ok {
			return nil, fmt.Errorf("%w: unsupported automation action type", iam.ErrValidation)
		}
		record.ActionType = contract.ActionType
	}
	if input.Status != nil {
		record.Status = defaultString(strings.TrimSpace(strings.ToLower(*input.Status)), record.Status)
	}
	if input.Scope != nil {
		record.Scope = defaultString(strings.TrimSpace(strings.ToLower(*input.Scope)), record.Scope)
	}
	if input.Name != nil {
		record.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		record.Description = strings.TrimSpace(*input.Description)
	}
	if input.TriggerType != nil {
		record.TriggerType = defaultString(strings.TrimSpace(strings.ToLower(*input.TriggerType)), record.TriggerType)
	}
	if input.InputSchema != nil {
		record.InputSchema = marshalJSON(*input.InputSchema)
	}
	if input.DefaultConfig != nil {
		record.DefaultConfig = marshalJSON(*input.DefaultConfig)
	}
	if input.OutputSchema != nil {
		record.OutputSchema = marshalJSON(*input.OutputSchema)
	}
	if input.ReviewPolicy != nil {
		record.ReviewPolicy = marshalJSON(*input.ReviewPolicy)
	}
	if input.CapabilityHints != nil {
		record.CapabilityHints = marshalJSON(normalizeStringSlice(*input.CapabilityHints))
	}
	if input.Metadata != nil {
		record.Metadata = marshalJSON(*input.Metadata)
	}
	if strings.TrimSpace(record.Name) == "" {
		return nil, fmt.Errorf("%w: automation name is required", iam.ErrValidation)
	}
	record.UpdatedAt = time.Now().UTC()
	record.UpdatedByUserID = &principal.UserID
	if _, err := s.db.NewUpdate().
		Model(record).
		Column("status", "scope", "name", "description", "action_type", "trigger_type", "input_schema", "default_config", "output_schema", "review_policy", "capability_hints", "metadata", "updated_by_user_id", "updated_at").
		WherePK().
		Exec(ctx); err != nil {
		return nil, err
	}
	mapped := mapAutomationDefinition(*record)
	return &mapped, nil
}

func (s *Service) DeleteAutomation(ctx context.Context, principal *iam.Principal, workspaceID, automationID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return err
	}
	record, err := s.findAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return err
	}
	_, err = s.db.NewDelete().Model(record).WherePK().Exec(ctx)
	return err
}

func (s *Service) ListWorkflows(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]WorkflowDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	var workflows []database.WorkflowDefinition
	if err := s.db.NewSelect().
		Model(&workflows).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("updated_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	if len(workflows) == 0 {
		return []WorkflowDefinitionRecord{}, nil
	}
	stepsByWorkflow, err := s.loadWorkflowSteps(ctx, workflowIDs(workflows))
	if err != nil {
		return nil, err
	}
	result := make([]WorkflowDefinitionRecord, 0, len(workflows))
	for _, workflow := range workflows {
		result = append(result, mapWorkflowDefinition(workflow, stepsByWorkflow[workflow.ID.String()]))
	}
	return result, nil
}

func (s *Service) CreateWorkflow(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, input CreateWorkflowInput) (*WorkflowDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Name) == "" {
		return nil, fmt.Errorf("%w: workflow name is required", iam.ErrValidation)
	}
	steps, err := s.normalizeWorkflowSteps(input.Steps)
	if err != nil {
		return nil, err
	}
	if err := s.validateWorkflowSteps(steps); err != nil {
		return nil, err
	}
	if workflowContainsPublish(steps) {
		if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
			return nil, err
		}
	}
	now := time.Now().UTC()
	record := &database.WorkflowDefinition{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		Status:          defaultString(strings.TrimSpace(strings.ToLower(input.Status)), "active"),
		Scope:           defaultString(strings.TrimSpace(strings.ToLower(input.Scope)), scopeWorkflow),
		Name:            strings.TrimSpace(input.Name),
		Description:     strings.TrimSpace(input.Description),
		TriggerType:     defaultString(strings.TrimSpace(strings.ToLower(input.TriggerType)), triggerTypeManual),
		InputSchema:     marshalJSON(input.InputSchema),
		OutputSchema:    marshalJSON(input.OutputSchema),
		ReviewPolicy:    marshalJSON(input.ReviewPolicy),
		CapabilityHints: marshalJSON(normalizeStringSlice(input.CapabilityHints)),
		Metadata:        marshalJSON(input.Metadata),
		CreatedByUserID: &principal.UserID,
		UpdatedByUserID: &principal.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	dbSteps := make([]*database.WorkflowStep, 0, len(steps))
	for _, step := range steps {
		dbSteps = append(dbSteps, &database.WorkflowStep{
			ID:                   uuid.New(),
			WorkflowID:           record.ID,
			AutomationID:         parseUUIDPointer(step.AutomationID),
			Position:             step.Position,
			Name:                 step.Name,
			StepKind:             step.StepKind,
			ActionType:           step.ActionType,
			ConsumesArtifactType: step.ConsumesArtifactType,
			ProducesArtifactType: step.ProducesArtifactType,
			ReviewerType:         step.ReviewerType,
			RequiredCapabilities: marshalJSON(normalizeStringSlice(step.RequiredCapabilities)),
			Config:               marshalJSON(step.Config),
			Metadata:             marshalJSON(step.Metadata),
			CreatedAt:            now,
			UpdatedAt:            now,
		})
	}
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(record).Exec(ctx); err != nil {
			return err
		}
		if len(dbSteps) > 0 {
			if _, err := tx.NewInsert().Model(&dbSteps).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	result := mapWorkflowDefinition(*record, dbSteps)
	return &result, nil
}

func (s *Service) GetWorkflow(ctx context.Context, principal *iam.Principal, workspaceID, workflowID uuid.UUID) (*WorkflowDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	record, err := s.findWorkflow(ctx, workspaceID, workflowID)
	if err != nil {
		return nil, err
	}
	steps, err := s.loadWorkflowStepRecords(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	mapped := mapWorkflowDefinition(*record, steps)
	return &mapped, nil
}

func (s *Service) UpdateWorkflow(ctx context.Context, principal *iam.Principal, workspaceID, workflowID uuid.UUID, input UpdateWorkflowInput) (*WorkflowDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return nil, err
	}
	record, err := s.findWorkflow(ctx, workspaceID, workflowID)
	if err != nil {
		return nil, err
	}
	existingSteps, err := s.loadWorkflowStepRecords(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	steps := recordsToStepDTOs(existingSteps)
	if input.Steps != nil {
		steps, err = s.normalizeWorkflowSteps(*input.Steps)
		if err != nil {
			return nil, err
		}
	}
	if err := s.validateWorkflowSteps(steps); err != nil {
		return nil, err
	}
	if workflowContainsPublish(steps) {
		if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
			return nil, err
		}
	}
	if input.Status != nil {
		record.Status = defaultString(strings.TrimSpace(strings.ToLower(*input.Status)), record.Status)
	}
	if input.Scope != nil {
		record.Scope = defaultString(strings.TrimSpace(strings.ToLower(*input.Scope)), record.Scope)
	}
	if input.Name != nil {
		record.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		record.Description = strings.TrimSpace(*input.Description)
	}
	if input.TriggerType != nil {
		record.TriggerType = defaultString(strings.TrimSpace(strings.ToLower(*input.TriggerType)), record.TriggerType)
	}
	if input.InputSchema != nil {
		record.InputSchema = marshalJSON(*input.InputSchema)
	}
	if input.OutputSchema != nil {
		record.OutputSchema = marshalJSON(*input.OutputSchema)
	}
	if input.ReviewPolicy != nil {
		record.ReviewPolicy = marshalJSON(*input.ReviewPolicy)
	}
	if input.CapabilityHints != nil {
		record.CapabilityHints = marshalJSON(normalizeStringSlice(*input.CapabilityHints))
	}
	if input.Metadata != nil {
		record.Metadata = marshalJSON(*input.Metadata)
	}
	if strings.TrimSpace(record.Name) == "" {
		return nil, fmt.Errorf("%w: workflow name is required", iam.ErrValidation)
	}
	now := time.Now().UTC()
	record.UpdatedAt = now
	record.UpdatedByUserID = &principal.UserID
	dbSteps := make([]*database.WorkflowStep, 0, len(steps))
	for _, step := range steps {
		dbSteps = append(dbSteps, &database.WorkflowStep{
			ID:                   uuid.New(),
			WorkflowID:           workflowID,
			AutomationID:         parseUUIDPointer(step.AutomationID),
			Position:             step.Position,
			Name:                 step.Name,
			StepKind:             step.StepKind,
			ActionType:           step.ActionType,
			ConsumesArtifactType: step.ConsumesArtifactType,
			ProducesArtifactType: step.ProducesArtifactType,
			ReviewerType:         step.ReviewerType,
			RequiredCapabilities: marshalJSON(normalizeStringSlice(step.RequiredCapabilities)),
			Config:               marshalJSON(step.Config),
			Metadata:             marshalJSON(step.Metadata),
			CreatedAt:            now,
			UpdatedAt:            now,
		})
	}
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewUpdate().
			Model(record).
			Column("status", "scope", "name", "description", "trigger_type", "input_schema", "output_schema", "review_policy", "capability_hints", "metadata", "updated_by_user_id", "updated_at").
			WherePK().
			Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewDelete().
			Model((*database.WorkflowStep)(nil)).
			Where("workflow_id = ?", workflowID).
			Exec(ctx); err != nil {
			return err
		}
		if len(dbSteps) > 0 {
			if _, err := tx.NewInsert().Model(&dbSteps).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	result := mapWorkflowDefinition(*record, dbSteps)
	return &result, nil
}

func (s *Service) DeleteWorkflow(ctx context.Context, principal *iam.Principal, workspaceID, workflowID uuid.UUID) error {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return err
	}
	record, err := s.findWorkflow(ctx, workspaceID, workflowID)
	if err != nil {
		return err
	}
	_, err = s.db.NewDelete().Model(record).WherePK().Exec(ctx)
	return err
}

func (s *Service) DuplicateWorkflow(ctx context.Context, principal *iam.Principal, workspaceID, workflowID uuid.UUID, input DuplicateWorkflowInput) (*WorkflowDefinitionRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.manage"); err != nil {
		return nil, err
	}
	record, err := s.findWorkflow(ctx, workspaceID, workflowID)
	if err != nil {
		return nil, err
	}
	steps, err := s.loadWorkflowStepRecords(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	return s.CreateWorkflow(ctx, principal, workspaceID, CreateWorkflowInput{
		Status:          record.Status,
		Scope:           record.Scope,
		Name:            firstNonEmptyString(strings.TrimSpace(input.Name), strings.TrimSpace(record.Name)+" Copy"),
		Description:     record.Description,
		TriggerType:     record.TriggerType,
		InputSchema:     parseJSONMap(record.InputSchema),
		OutputSchema:    parseJSONMap(record.OutputSchema),
		ReviewPolicy:    parseJSONMap(record.ReviewPolicy),
		CapabilityHints: parseJSONStringSlice(record.CapabilityHints),
		Metadata:        parseJSONMap(record.Metadata),
		Steps:           recordsToStepDTOs(steps),
	})
}

func (s *Service) RunAutomation(ctx context.Context, principal *iam.Principal, workspaceID, automationID uuid.UUID, request RunRequest) (*AutomationRunRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.run"); err != nil {
		return nil, err
	}
	automation, err := s.findAutomation(ctx, workspaceID, automationID)
	if err != nil {
		return nil, err
	}
	contract, ok := s.findActionContract(automation.ActionType)
	if !ok {
		return nil, fmt.Errorf("%w: unsupported automation action", iam.ErrValidation)
	}
	now := time.Now().UTC()
	steps := []*database.WorkflowStep{{
		ID:                   uuid.New(),
		AutomationID:         &automation.ID,
		Position:             1,
		Name:                 automation.Name,
		StepKind:             contract.DefaultStepKind,
		ActionType:           automation.ActionType,
		ConsumesArtifactType: contract.DefaultConsumesType,
		ProducesArtifactType: contract.DefaultProducesType,
		ReviewerType:         contract.DefaultReviewerType,
		RequiredCapabilities: automation.CapabilityHints,
		Config:               automation.DefaultConfig,
		Metadata:             automation.Metadata,
		CreatedAt:            now,
		UpdatedAt:            now,
	}}
	return s.createAndExecuteRun(ctx, principal, workspaceID, sourceTypeAutomation, automation.ID, uuid.Nil, automation.TriggerType, request.Input, steps)
}

func (s *Service) RunWorkflow(ctx context.Context, principal *iam.Principal, workspaceID, workflowID uuid.UUID, request RunRequest) (*AutomationRunRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.run"); err != nil {
		return nil, err
	}
	workflow, err := s.findWorkflow(ctx, workspaceID, workflowID)
	if err != nil {
		return nil, err
	}
	steps, err := s.loadWorkflowStepRecords(ctx, workflow.ID)
	if err != nil {
		return nil, err
	}
	if err := s.validateWorkflowSteps(recordsToStepDTOs(steps)); err != nil {
		return nil, err
	}
	if workflowContainsPublish(recordsToStepDTOs(steps)) {
		if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
			return nil, err
		}
	}
	return s.createAndExecuteRun(ctx, principal, workspaceID, sourceTypeWorkflow, uuid.Nil, workflow.ID, workflow.TriggerType, request.Input, steps)
}

func (s *Service) ListRuns(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID) ([]AutomationRunRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	var runs []database.AutomationRun
	if err := s.db.NewSelect().
		Model(&runs).
		Where("workspace_id = ?", workspaceID).
		OrderExpr("created_at DESC").
		Limit(100).
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return s.hydrateRuns(ctx, runs)
}

func (s *Service) GetRun(ctx context.Context, principal *iam.Principal, workspaceID, runID uuid.UUID) (*AutomationRunRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.view"); err != nil {
		return nil, err
	}
	run, err := s.findRun(ctx, workspaceID, runID)
	if err != nil {
		return nil, err
	}
	items, err := s.hydrateRuns(ctx, []database.AutomationRun{*run})
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, iam.ErrNotFound
	}
	return &items[0], nil
}

func (s *Service) ReviewRun(ctx context.Context, principal *iam.Principal, workspaceID, runID uuid.UUID, input ReviewRunInput) (*AutomationRunRecord, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.automations.run"); err != nil {
		return nil, err
	}
	run, err := s.findRun(ctx, workspaceID, runID)
	if err != nil {
		return nil, err
	}
	if run.Status != runStatusWaitingReview {
		return nil, fmt.Errorf("%w: run is not waiting for review", iam.ErrConflict)
	}
	steps, err := s.loadRunSteps(ctx, []uuid.UUID{run.ID})
	if err != nil {
		return nil, err
	}
	runSteps := steps[run.ID.String()]
	var waitingStep *database.AutomationRunStep
	waitingIndex := -1
	for index := range runSteps {
		if runSteps[index].State == stepStateWaitingReview {
			waitingStep = runSteps[index]
			waitingIndex = index
			break
		}
	}
	if waitingStep == nil {
		return nil, fmt.Errorf("%w: run review step was not found", iam.ErrConflict)
	}
	decision := strings.TrimSpace(strings.ToLower(input.Decision))
	if decision == "" {
		decision = "approved"
	}
	if !slices.Contains([]string{"approved", "changes_requested"}, decision) {
		return nil, fmt.Errorf("%w: decision must be approved or changes_requested", iam.ErrValidation)
	}
	now := time.Now().UTC()
	review := &database.AutomationRunReview{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		RunID:           run.ID,
		RunStepID:       &waitingStep.ID,
		ReviewerType:    reviewerTypeHuman,
		Decision:        decision,
		Status:          "completed",
		Comment:         strings.TrimSpace(input.Comment),
		Findings:        marshalJSON(normalizeStringSlice(input.Findings)),
		ActorUserID:     &principal.UserID,
		AutomationAgent: reviewerTypeHuman,
		CreatedAt:       now,
	}
	if err := s.applyReviewToArtifacts(ctx, principal, workspaceID, parseRunArtifacts(waitingStep.ArtifactPayload), decision, strings.TrimSpace(input.Comment)); err != nil {
		return nil, err
	}
	waitingStep.State = stepStateCompleted
	waitingStep.CompletedAt = &now
	waitingStep.UpdatedAt = now
	if decision != "approved" {
		waitingStep.LastError = stringPointer("review requested changes")
		run.Status = runStatusFailed
		run.LastError = stringPointer("review requested changes")
		run.CompletedAt = &now
		run.UpdatedAt = now
		run.ReviewRequired = false
		run.ReviewerType = reviewerTypeHuman
		if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
			if _, err := tx.NewInsert().Model(review).Exec(ctx); err != nil {
				return err
			}
			if _, err := tx.NewUpdate().Model(waitingStep).Column("state", "completed_at", "updated_at", "last_error").WherePK().Exec(ctx); err != nil {
				return err
			}
			_, err := tx.NewUpdate().Model(run).Column("status", "last_error", "completed_at", "updated_at", "review_required", "reviewer_type").WherePK().Exec(ctx)
			return err
		}); err != nil {
			return nil, err
		}
		return s.GetRun(ctx, principal, workspaceID, runID)
	}

	nextArtifacts := parseRunArtifacts(waitingStep.ArtifactPayload)
	nextEvidence := parseJSONMap(waitingStep.EvidencePayload)
	run.Status = runStatusRunning
	run.ReviewRequired = false
	run.ReviewerType = reviewerTypeNone
	run.LastError = nil
	run.UpdatedAt = now
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(review).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.NewUpdate().Model(waitingStep).Column("state", "completed_at", "updated_at", "last_error").WherePK().Exec(ctx); err != nil {
			return err
		}
		_, err := tx.NewUpdate().Model(run).Column("status", "review_required", "reviewer_type", "last_error", "updated_at").WherePK().Exec(ctx)
		return err
	}); err != nil {
		return nil, err
	}
	if err := s.executePendingRunSteps(ctx, principal, workspaceID, run, runSteps, waitingIndex+1, nextArtifacts, nextEvidence); err != nil {
		return nil, err
	}
	return s.GetRun(ctx, principal, workspaceID, runID)
}

func (s *Service) createAndExecuteRun(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	sourceType string,
	automationID uuid.UUID,
	workflowID uuid.UUID,
	triggerType string,
	input map[string]any,
	steps []*database.WorkflowStep,
) (*AutomationRunRecord, error) {
	now := time.Now().UTC()
	fingerprint := buildFingerprint(sourceType, input)
	run := &database.AutomationRun{
		ID:                 uuid.New(),
		WorkspaceID:        workspaceID,
		SourceType:         sourceType,
		Status:             runStatusQueued,
		TriggerType:        defaultString(strings.TrimSpace(triggerType), triggerTypeManual),
		ReviewRequired:     false,
		ReviewerType:       reviewerTypeNone,
		InputPayload:       marshalJSON(input),
		OutputPayload:      marshalJSON(map[string]any{"artifacts": []RunArtifact{}}),
		ContextFingerprint: fingerprint,
		EvidencePayload:    marshalJSON(map[string]any{}),
		CreatedByUserID:    &principal.UserID,
		UpdatedByUserID:    &principal.UserID,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if automationID != uuid.Nil {
		run.AutomationID = &automationID
	}
	if workflowID != uuid.Nil {
		run.WorkflowID = &workflowID
	}
	runSteps := make([]*database.AutomationRunStep, 0, len(steps))
	for _, step := range steps {
		runSteps = append(runSteps, &database.AutomationRunStep{
			ID:              uuid.New(),
			RunID:           run.ID,
			WorkflowStepID:  stepWorkflowPointer(step),
			Position:        step.Position,
			Name:            step.Name,
			StepKind:        step.StepKind,
			ActionType:      step.ActionType,
			State:           stepStateQueued,
			ReviewerType:    normalizeReviewerType(step.ReviewerType),
			InputPayload:    marshalJSON(map[string]any{"config": parseJSONMap(step.Config)}),
			OutputPayload:   marshalJSON(map[string]any{}),
			ArtifactPayload: marshalJSON([]RunArtifact{}),
			EvidencePayload: marshalJSON(map[string]any{}),
			CreatedAt:       now,
			UpdatedAt:       now,
		})
	}
	if err := s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if _, err := tx.NewInsert().Model(run).Exec(ctx); err != nil {
			return err
		}
		if len(runSteps) > 0 {
			if _, err := tx.NewInsert().Model(&runSteps).Exec(ctx); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	if err := s.executePendingRunSteps(ctx, principal, workspaceID, run, runSteps, 0, nil, map[string]any{}); err != nil {
		return nil, err
	}
	return s.GetRun(ctx, principal, workspaceID, run.ID)
}

func (s *Service) executePendingRunSteps(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	run *database.AutomationRun,
	runSteps []*database.AutomationRunStep,
	startIndex int,
	currentArtifacts []RunArtifact,
	currentEvidence map[string]any,
) error {
	artifacts := append([]RunArtifact{}, currentArtifacts...)
	evidence := cloneMap(currentEvidence)
	for index := startIndex; index < len(runSteps); index++ {
		step := runSteps[index]
		now := time.Now().UTC()
		run.Status = runStatusRunning
		run.CurrentStepPosition = &step.Position
		run.UpdatedAt = now
		step.State = stepStateRunning
		step.StartedAt = &now
		step.UpdatedAt = now
		baseInput := parseJSONMap(step.InputPayload)
		step.InputPayload = marshalJSON(map[string]any{
			"config":         mapValue(baseInput["config"]),
			"runtimeInput":   parseJSONMap(run.InputPayload),
			"priorArtifacts": artifacts,
		})
		if err := s.updateRunAndStep(ctx, run, step, "status", "current_step_position", "updated_at", "state", "started_at", "updated_at", "input_payload"); err != nil {
			return err
		}
		result, waiting, err := s.executeStep(ctx, principal, workspaceID, run, step, artifacts, evidence)
		if err != nil {
			failNow := time.Now().UTC()
			step.State = stepStateFailed
			step.LastError = stringPointer(err.Error())
			step.CompletedAt = &failNow
			step.UpdatedAt = failNow
			run.Status = runStatusFailed
			run.LastError = stringPointer(err.Error())
			run.CompletedAt = &failNow
			run.UpdatedAt = failNow
			run.OutputPayload = marshalJSON(map[string]any{"artifacts": artifacts})
			run.EvidencePayload = marshalJSON(evidence)
			return s.updateRunAndStep(ctx, run, step, "status", "last_error", "completed_at", "updated_at", "output_payload", "evidence_payload", "state", "last_error", "completed_at", "updated_at")
		}
		artifacts = result.Artifacts
		evidence = mergeMaps(evidence, result.Evidence)
		step.OutputPayload = marshalJSON(result.Output)
		step.ArtifactPayload = marshalJSON(result.Artifacts)
		step.EvidencePayload = marshalJSON(result.Evidence)
		run.OutputPayload = marshalJSON(map[string]any{"artifacts": artifacts})
		run.EvidencePayload = marshalJSON(evidence)
		if waiting {
			step.State = stepStateWaitingReview
			run.Status = runStatusWaitingReview
			run.ReviewRequired = true
			run.ReviewerType = normalizeReviewerType(step.ReviewerType)
			step.UpdatedAt = time.Now().UTC()
			run.UpdatedAt = step.UpdatedAt
			if err := s.updateRunAndStep(ctx, run, step, "status", "current_step_position", "review_required", "reviewer_type", "output_payload", "evidence_payload", "updated_at", "state", "output_payload", "artifact_payload", "evidence_payload", "updated_at"); err != nil {
				return err
			}
			return nil
		}
		doneAt := time.Now().UTC()
		step.State = stepStateCompleted
		step.CompletedAt = &doneAt
		step.UpdatedAt = doneAt
		run.UpdatedAt = doneAt
		if err := s.updateRunAndStep(ctx, run, step, "status", "current_step_position", "output_payload", "evidence_payload", "updated_at", "state", "output_payload", "artifact_payload", "evidence_payload", "completed_at", "updated_at"); err != nil {
			return err
		}
	}
	finished := time.Now().UTC()
	run.Status = runStatusCompleted
	run.ReviewRequired = false
	run.ReviewerType = reviewerTypeNone
	run.CompletedAt = &finished
	run.UpdatedAt = finished
	return s.updateRun(ctx, run, "status", "review_required", "reviewer_type", "completed_at", "updated_at", "output_payload", "evidence_payload")
}

func (s *Service) executeStep(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	run *database.AutomationRun,
	step *database.AutomationRunStep,
	currentArtifacts []RunArtifact,
	currentEvidence map[string]any,
) (*executionResult, bool, error) {
	stepInput := parseJSONMap(step.InputPayload)
	stepConfig := mapValue(stepInput["config"])
	runInput := parseJSONMap(run.InputPayload)
	switch step.ActionType {
	case actionCampaignPlan:
		return s.executeCampaignPlan(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionPostGenerate:
		return s.executePostGenerate(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionVariationsGenerate:
		return s.executeVariationGenerate(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionImageGenerate:
		return s.executeImageGenerate(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionReelGenerate:
		return s.executeReelGenerate(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionLinkedInPDF:
		return s.executeLinkedInPDFGenerate(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	case actionReview:
		return s.executeReviewStep(ctx, principal, workspaceID, run, step, stepConfig, currentArtifacts, currentEvidence)
	case actionPublishOrSchedule:
		return s.executePublishOrSchedule(ctx, principal, workspaceID, runInput, stepConfig, currentArtifacts)
	default:
		return nil, false, fmt.Errorf("%w: unsupported workflow action %s", iam.ErrValidation, step.ActionType)
	}
}

func (s *Service) executeCampaignPlan(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	prompt := firstNonEmptyString(
		stringValue(runInput["prompt"]),
		stringValue(runInput["goal"]),
		stringValue(stepConfig["prompt"]),
		"Create a campaign plan with audience, positioning, channel recommendations, and next-best post angles.",
	)
	research, err := s.providers.research["workspace_ai"].Research(ctx, principal, workspaceID, textGenerationRequest{
		UseCase:      "campaign_planning",
		SystemPrompt: "Return strict JSON with summary, sourceUrls, facts, and evidenceNotes for campaign planning research. Use empty arrays when unsure.",
		PromptScope:  ai.PromptScopeAutomations,
		Prompt:       prompt,
	})
	if err != nil {
		return nil, false, err
	}
	artifact, err := s.providers.text["workspace_ai"].Generate(ctx, principal, workspaceID, textGenerationRequest{
		UseCase:      "campaign_planning",
		SystemPrompt: "Return strict JSON with campaignName, objective, targetAudience, messageTheme, notes, primaryChannels, postAngles, and callToAction.",
		PromptScope:  ai.PromptScopeAutomations,
		Prompt:       fmt.Sprintf("%s\n\nResearch summary:\n%s", prompt, research.Summary),
	})
	if err != nil {
		return nil, false, err
	}
	payload := artifact.Payload
	campaignName := firstNonEmptyString(stringValue(payload["campaignName"]), stringValue(runInput["name"]), "AI Campaign Plan")
	defaultTimezone := firstNonEmptyString(stringValue(runInput["defaultTimezone"]), stringValue(stepConfig["defaultTimezone"]), "UTC")
	startDate := time.Now().UTC()
	if raw := stringValue(runInput["startDate"]); raw != "" {
		if parsed, parseErr := time.Parse(time.RFC3339, raw); parseErr == nil {
			startDate = parsed
		}
	}
	createCampaign := boolValue(stepConfig["persist"])
	if !hasKey(stepConfig, "persist") {
		createCampaign = true
	}
	output := cloneMap(payload)
	artifacts := []RunArtifact{{
		Type:  artifactStructured,
		Label: campaignName,
		Data:  cloneMap(payload),
	}}
	if createCampaign {
		record, err := s.campaigns.CreateCampaign(ctx, principal, workspaceID, campaigns.UpsertCampaignInput{
			Status:          "draft",
			Name:            campaignName,
			Objective:       stringValue(payload["objective"]),
			TargetAudience:  stringValue(payload["targetAudience"]),
			MessageTheme:    stringValue(payload["messageTheme"]),
			Notes:           strings.TrimSpace(strings.Join(append([]string{stringValue(payload["notes"])}, research.EvidenceNotes...), "\n")),
			StartDate:       startDate,
			DefaultTimezone: defaultTimezone,
		})
		if err != nil {
			return nil, false, err
		}
		output["campaignId"] = record.ID
		artifacts = append([]RunArtifact{{
			Type:       artifactCampaign,
			Label:      record.Name,
			CampaignID: record.ID,
			Data: map[string]any{
				"name":           record.Name,
				"objective":      record.Objective,
				"targetAudience": record.TargetAudience,
				"messageTheme":   record.MessageTheme,
				"notes":          record.Notes,
			},
		}}, artifacts...)
	}
	_ = currentArtifacts
	return &executionResult{
		Output:    output,
		Artifacts: artifacts,
		Evidence: map[string]any{
			"research": research,
			"generator": map[string]any{
				"provider": artifact.Provider,
				"model":    artifact.Model,
			},
		},
	}, false, nil
}

func (s *Service) executePostGenerate(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	prompt := firstNonEmptyString(
		stringValue(runInput["prompt"]),
		stringValue(stepConfig["prompt"]),
		derivePostPrompt(currentArtifacts),
		"Create a social post draft with a strong hook, useful body, and concise CTA.",
	)
	research, err := s.providers.research["workspace_ai"].Research(ctx, principal, workspaceID, textGenerationRequest{
		UseCase:      "post_generation",
		SystemPrompt: "Return strict JSON with summary, sourceUrls, facts, and evidenceNotes that help a social post stay relevant and credible. Use empty arrays when unsure.",
		PromptScope:  ai.PromptScopeAutomations,
		Prompt:       prompt,
	})
	if err != nil {
		return nil, false, err
	}
	draft, err := s.ai.GeneratePostDraft(ctx, principal, workspaceID, ai.GeneratePostDraftInput{
		Prompt:      fmt.Sprintf("%s\n\nUse this research:\n%s", prompt, research.Summary),
		PromptScope: ai.PromptScopeAutomations,
	})
	if err != nil {
		return nil, false, err
	}
	createPost := boolValue(stepConfig["persist"])
	if !hasKey(stepConfig, "persist") {
		createPost = true
	}
	output := map[string]any{
		"title":          draft.Title,
		"contentKind":    draft.ContentKind,
		"contentPayload": draft.ContentPayload,
		"warnings":       draft.Warnings,
	}
	artifactItem := RunArtifact{
		Type:  artifactPostDraft,
		Label: firstNonEmptyString(draft.Title, "Generated post draft"),
		Data:  cloneMap(output),
	}
	if createPost {
		var campaignID *uuid.UUID
		if campaignArtifact := firstArtifactOfType(currentArtifacts, artifactCampaign); campaignArtifact != nil {
			campaignID = parseUUIDPointer(campaignArtifact.CampaignID)
		}
		if campaignID == nil {
			campaignID = parseUUIDPointer(stringValue(runInput["campaignId"]))
		}
		postRecord, err := s.posts.CreatePost(ctx, principal, workspaceID, posts.UpsertPostInput{
			Title:            firstNonEmptyString(draft.Title, stringValue(runInput["title"]), "AI generated post"),
			ContentKind:      draft.ContentKind,
			ContentPayload:   draft.ContentPayload,
			OriginPlatform:   firstNonEmptyString(stringValue(stepConfig["originPlatform"]), stringValue(runInput["originPlatform"])),
			OriginSurface:    firstNonEmptyString(stringValue(stepConfig["originSurface"]), stringValue(runInput["originSurface"])),
			CampaignID:       campaignID,
			RequiresApproval: boolValue(stepConfig["requiresApproval"]) || boolValue(runInput["requiresApproval"]),
			Notes:            strings.TrimSpace(strings.Join(research.EvidenceNotes, "\n")),
		})
		if err != nil {
			return nil, false, err
		}
		output["postId"] = postRecord.ID
		artifactItem.PostID = postRecord.ID
	}
	return &executionResult{
		Output:    map[string]any{"draft": output},
		Artifacts: []RunArtifact{artifactItem},
		Evidence: map[string]any{
			"research": research,
			"generator": map[string]any{
				"provider": draft.Provider,
				"model":    draft.Model,
			},
		},
	}, false, nil
}

func (s *Service) executeVariationGenerate(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	baseArtifact := firstArtifactOfType(currentArtifacts, artifactPostDraft)
	if baseArtifact == nil {
		return nil, false, fmt.Errorf("%w: variation generation requires a post draft artifact", iam.ErrValidation)
	}
	targets := normalizeTargets(stepConfig["targets"])
	if len(targets) == 0 {
		targets = normalizeTargets(runInput["targets"])
	}
	if len(targets) == 0 {
		targets = []map[string]string{
			{"platform": "linkedin", "surface": "feed_post"},
			{"platform": "x", "surface": "thread"},
			{"platform": "instagram", "surface": "feed_post"},
		}
	}
	baseTitle := stringValue(baseArtifact.Data["title"])
	contentPayload := mapValue(baseArtifact.Data["contentPayload"])
	baseBody := stringValue(contentPayload["body"])
	targetDescriptions := make([]string, 0, len(targets))
	for _, target := range targets {
		targetDescriptions = append(targetDescriptions, fmt.Sprintf("%s:%s", target["platform"], target["surface"]))
	}
	artifact, err := s.providers.text["workspace_ai"].Generate(ctx, principal, workspaceID, textGenerationRequest{
		UseCase:      "variation_generation",
		SystemPrompt: "Return strict JSON with variants as an array of objects. Each variant must include platform, surface, title, body, tags, and contentKind.",
		PromptScope:  ai.PromptScopeAutomations,
		Prompt:       fmt.Sprintf("Base title: %s\nBase body: %s\nCreate variations for %s.", baseTitle, baseBody, strings.Join(targetDescriptions, ", ")),
	})
	if err != nil {
		return nil, false, err
	}
	variantItems := make([]map[string]any, 0)
	variantIDs := make([]string, 0)
	postID := firstNonEmptyString(baseArtifact.PostID, stringValue(runInput["postId"]))
	for _, raw := range anySlice(artifact.Payload["variants"]) {
		item, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		platform := firstNonEmptyString(stringValue(item["platform"]), "linkedin")
		surface := firstNonEmptyString(stringValue(item["surface"]), "feed_post")
		contentKind := firstNonEmptyString(stringValue(item["contentKind"]), "text")
		customPayload := map[string]any{"body": stringValue(item["body"]), "tags": stringSlice(item["tags"])}
		if contentKind == "article" {
			customPayload["title"] = firstNonEmptyString(stringValue(item["title"]), baseTitle)
		}
		entry := map[string]any{
			"platform":       platform,
			"surface":        surface,
			"title":          firstNonEmptyString(stringValue(item["title"]), baseTitle),
			"contentKind":    contentKind,
			"contentPayload": customPayload,
		}
		if postID != "" {
			created, err := s.posts.CreateVariant(ctx, principal, workspaceID, mustParseUUID(postID), posts.UpsertVariantInput{
				Platform:       platform,
				Surface:        surface,
				InheritSource:  "shared",
				ContentMode:    "custom",
				ContentKind:    contentKind,
				ContentPayload: customPayload,
				AssetMode:      "inherit",
				Notes:          "Generated by automation variation step.",
			})
			if err != nil {
				return nil, false, err
			}
			entry["variantId"] = created.ID
			variantIDs = append(variantIDs, created.ID)
		}
		variantItems = append(variantItems, entry)
	}
	return &executionResult{
		Output: map[string]any{"variants": variantItems},
		Artifacts: []RunArtifact{{
			Type:       artifactPostVariants,
			Label:      fmt.Sprintf("%d generated variants", len(variantItems)),
			PostID:     postID,
			VariantIDs: variantIDs,
			Data:       map[string]any{"variants": variantItems},
		}},
		Evidence: map[string]any{
			"generator": map[string]any{
				"provider": artifact.Provider,
				"model":    artifact.Model,
			},
		},
	}, false, nil
}

func (s *Service) executeImageGenerate(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	prompt := firstNonEmptyString(
		stringValue(runInput["prompt"]),
		stringValue(stepConfig["prompt"]),
		deriveImagePrompt(currentArtifacts),
		"Generate a social-ready image with a strong focal point and clean composition.",
	)
	promptScope := firstNonEmptyString(stringValue(runInput["promptScope"]), ai.PromptScopeAutomations)
	if systemPrompt, err := s.ai.ComposeExecutionSystemPrompt(ctx, workspaceID, promptScope, ""); err == nil && strings.TrimSpace(systemPrompt) != "" {
		prompt = fmt.Sprintf("%s\n\nCreative brief:\n%s", systemPrompt, prompt)
	}
	imageCount := intValue(stepConfig["count"], 1)
	if imageCount < 1 {
		imageCount = 1
	}
	generatedResources := make([]resources.ResourceDetail, 0, imageCount)
	artifacts := make([]RunArtifact, 0, imageCount)
	for index := 0; index < imageCount; index++ {
		result, err := s.providers.image[pollinationsProviderID].Generate(ctx, imageGenerationRequest{
			Prompt: prompt,
			Width:  intValue(stepConfig["width"], 1280),
			Height: intValue(stepConfig["height"], 1280),
			Seed:   firstNonEmptyString(stringValue(stepConfig["seed"]), stringValue(runInput["seed"]), fmt.Sprintf("seed-%d", index+1)),
			Model:  firstNonEmptyString(stringValue(stepConfig["model"]), "flux"),
		})
		if err != nil {
			return nil, false, err
		}
		upload, err := s.resources.UploadResource(ctx, principal, workspaceID, resources.UploadInput{
			DisplayName:  firstNonEmptyString(stringValue(stepConfig["displayName"]), fmt.Sprintf("Generated image %d", index+1)),
			OriginalName: result.FileName,
			ContentType:  result.ContentType,
			SourceType:   "automation_generated",
			Body:         bytes.NewReader(result.Data),
		})
		if err != nil {
			return nil, false, err
		}
		generatedResources = append(generatedResources, upload.Resource)
		artifacts = append(artifacts, RunArtifact{
			Type:       artifactResource,
			Label:      upload.Resource.DisplayName,
			ResourceID: upload.Resource.ID,
			Data: map[string]any{
				"mediaKind":   upload.Resource.MediaKind,
				"previewUrl":  upload.Resource.PreviewURL,
				"downloadUrl": upload.Resource.DownloadURL,
				"provider":    result.Provider,
				"model":       result.Model,
				"prompt":      result.Prompt,
			},
		})
	}
	output := map[string]any{"resources": generatedResources}
	if len(generatedResources) > 1 {
		items := make([]resources.ResourceSetItemInput, 0, len(generatedResources))
		for _, resource := range generatedResources {
			items = append(items, resources.ResourceSetItemInput{ResourceID: mustParseUUID(resource.ID), Role: "generated_asset", Metadata: map[string]any{}})
		}
		resourceSet, err := s.resources.CreateResourceSet(ctx, principal, workspaceID, resources.CreateResourceSetInput{
			Name:        firstNonEmptyString(stringValue(stepConfig["setName"]), "Generated image set"),
			Description: "Automation-generated image batch.",
			IntentType:  "generic",
			SourceType:  "automation_generated",
			Items:       items,
			Metadata:    map[string]any{"prompt": prompt},
		})
		if err != nil {
			return nil, false, err
		}
		artifacts = append([]RunArtifact{{
			Type:          artifactResourceSet,
			Label:         resourceSet.Name,
			ResourceSetID: resourceSet.ID,
			Data:          map[string]any{"itemCount": resourceSet.ItemCount},
		}}, artifacts...)
		output["resourceSet"] = resourceSet
	}
	return &executionResult{
		Output:    output,
		Artifacts: artifacts,
		Evidence: map[string]any{
			"provider": pollinationsProviderID,
			"prompt":   prompt,
			"count":    imageCount,
		},
	}, false, nil
}

func (s *Service) executeReelGenerate(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	videoResourceID := firstNonEmptyString(stringValue(runInput["videoResourceId"]), stringValue(stepConfig["videoResourceId"]))
	if videoResourceID == "" {
		if resourceArtifact := firstArtifactOfType(currentArtifacts, artifactResource); resourceArtifact != nil {
			videoResourceID = resourceArtifact.ResourceID
		}
	}
	if videoResourceID == "" {
		return nil, false, fmt.Errorf("%w: reel generation requires a source video resource", iam.ErrValidation)
	}
	promptScope := firstNonEmptyString(stringValue(runInput["promptScope"]), ai.PromptScopeAutomations)
	style := firstNonEmptyString(stringValue(stepConfig["style"]), "kinetic")
	if systemPrompt, err := s.ai.ComposeExecutionSystemPrompt(ctx, workspaceID, promptScope, ""); err == nil && strings.TrimSpace(systemPrompt) != "" {
		style = firstNonEmptyString(stringValue(stepConfig["style"]), systemPrompt, "kinetic")
	}
	result, err := s.providers.media["reel_blueprint"].Compose(ctx, principal, workspaceID, mediaCompositionRequest{
		SourceResourceID: mustParseUUID(videoResourceID),
		Title:            firstNonEmptyString(stringValue(stepConfig["title"]), "Reel draft"),
		Caption:          firstNonEmptyString(stringValue(runInput["caption"]), stringValue(stepConfig["caption"]), deriveCaption(currentArtifacts)),
		Style:            style,
		Effects:          stringSlice(stepConfig["effects"]),
	})
	if err != nil {
		return nil, false, err
	}
	return &executionResult{
		Output: map[string]any{
			"resourceSet": result.ResourceSet,
			"blueprint":   result.Blueprint,
		},
		Artifacts: []RunArtifact{{
			Type:          artifactResourceSet,
			Label:         result.ResourceSet.Name,
			ResourceSetID: result.ResourceSet.ID,
			Data:          result.Blueprint,
		}},
		Evidence: map[string]any{
			"beta":      true,
			"blueprint": result.Blueprint,
		},
	}, false, nil
}

func (s *Service) executeLinkedInPDFGenerate(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	title := firstNonEmptyString(stringValue(runInput["title"]), stringValue(stepConfig["title"]), derivePDFTitle(currentArtifacts), "LinkedIn PDF")
	pages := derivePDFPages(runInput, stepConfig, currentArtifacts)
	subtitle := firstNonEmptyString(stringValue(stepConfig["subtitle"]), stringValue(runInput["subtitle"]))
	promptScope := firstNonEmptyString(stringValue(runInput["promptScope"]), ai.PromptScopeAutomations)
	if systemPrompt, err := s.ai.ComposeExecutionSystemPrompt(ctx, workspaceID, promptScope, ""); err == nil && strings.TrimSpace(systemPrompt) != "" {
		subtitle = firstNonEmptyString(subtitle, systemPrompt)
	}
	result, err := s.providers.document["linkedin_pdf"].Render(ctx, documentRenderRequest{
		Title:           title,
		Subtitle:        subtitle,
		Pages:           pages,
		CreatePostDraft: boolValue(stepConfig["createPostDraft"]),
	})
	if err != nil {
		return nil, false, err
	}
	upload, err := s.resources.UploadResource(ctx, principal, workspaceID, resources.UploadInput{
		DisplayName:  title,
		OriginalName: result.FileName,
		ContentType:  result.ContentType,
		SourceType:   "automation_generated",
		Body:         bytes.NewReader(result.Data),
	})
	if err != nil {
		return nil, false, err
	}
	var postID string
	if boolValue(stepConfig["createPostDraft"]) {
		record, err := s.posts.CreatePost(ctx, principal, workspaceID, posts.UpsertPostInput{
			Title:            title,
			ContentKind:      "article",
			ContentPayload:   map[string]any{"title": title, "body": strings.Join(pages, "\n\n"), "tags": []string{"linkedin", "document"}},
			OriginPlatform:   "linkedin",
			OriginSurface:    "document_post",
			RequiresApproval: true,
			Notes:            "Generated by LinkedIn PDF automation.",
		})
		if err != nil {
			return nil, false, err
		}
		postID = record.ID
	}
	return &executionResult{
		Output: map[string]any{
			"resource": upload.Resource,
			"caption":  result.SuggestedCaption,
			"postId":   postID,
		},
		Artifacts: []RunArtifact{{
			Type:       artifactDocument,
			Label:      upload.Resource.DisplayName,
			ResourceID: upload.Resource.ID,
			PostID:     postID,
			Data: map[string]any{
				"mediaKind":   upload.Resource.MediaKind,
				"previewUrl":  upload.Resource.PreviewURL,
				"downloadUrl": upload.Resource.DownloadURL,
				"caption":     result.SuggestedCaption,
			},
		}},
		Evidence: map[string]any{
			"beta":  true,
			"pages": len(pages),
		},
	}, false, nil
}

func (s *Service) executeReviewStep(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	run *database.AutomationRun,
	step *database.AutomationRunStep,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
	currentEvidence map[string]any,
) (*executionResult, bool, error) {
	if len(currentArtifacts) == 0 {
		return nil, false, fmt.Errorf("%w: review step requires an artifact to review", iam.ErrValidation)
	}
	reviewerType := normalizeReviewerType(firstNonEmptyString(stringValue(stepConfig["reviewerType"]), step.ReviewerType))
	if reviewerType == reviewerTypeHuman {
		if err := s.prepareArtifactsForHumanReview(ctx, principal, workspaceID, currentArtifacts); err != nil {
			return nil, false, err
		}
		pendingReview := &database.AutomationRunReview{
			ID:              uuid.New(),
			WorkspaceID:     workspaceID,
			RunID:           run.ID,
			RunStepID:       &step.ID,
			ReviewerType:    reviewerTypeHuman,
			Decision:        "pending",
			Status:          "pending",
			Comment:         firstNonEmptyString(stringValue(stepConfig["comment"]), "Waiting for review."),
			Findings:        marshalJSON([]string{}),
			AutomationAgent: reviewerTypeHuman,
			CreatedAt:       time.Now().UTC(),
		}
		if _, err := s.db.NewInsert().Model(pendingReview).Exec(ctx); err != nil {
			return nil, false, err
		}
		return &executionResult{
			Output:    map[string]any{"status": "waiting_review"},
			Artifacts: currentArtifacts,
			Evidence:  currentEvidence,
		}, true, nil
	}
	reviewArtifact, err := s.providers.text["workspace_ai"].Generate(ctx, principal, workspaceID, textGenerationRequest{
		UseCase:      "post_generation",
		SystemPrompt: "You are an automation QA reviewer. Return strict JSON with decision, comment, and findings array. decision must be approved or changes_requested.",
		PromptScope:  ai.PromptScopeAutomations,
		Prompt:       fmt.Sprintf("Review these automation artifacts for clarity, safety, factuality, and platform readiness:\n%s", marshalJSON(currentArtifacts)),
	})
	if err != nil {
		return nil, false, err
	}
	decision := firstNonEmptyString(stringValue(reviewArtifact.Payload["decision"]), "approved")
	if !slices.Contains([]string{"approved", "changes_requested"}, decision) {
		decision = "approved"
	}
	comment := stringValue(reviewArtifact.Payload["comment"])
	findings := stringSlice(reviewArtifact.Payload["findings"])
	review := &database.AutomationRunReview{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		RunID:           run.ID,
		RunStepID:       &step.ID,
		ReviewerType:    reviewerTypeAI,
		Decision:        decision,
		Status:          "completed",
		Comment:         comment,
		Findings:        marshalJSON(findings),
		AutomationAgent: reviewerTypeAI,
		CreatedAt:       time.Now().UTC(),
	}
	if _, err := s.db.NewInsert().Model(review).Exec(ctx); err != nil {
		return nil, false, err
	}
	if err := s.applyReviewToArtifacts(ctx, principal, workspaceID, currentArtifacts, decision, comment); err != nil {
		return nil, false, err
	}
	if decision != "approved" {
		return nil, false, fmt.Errorf("%w: ai review requested changes", iam.ErrConflict)
	}
	return &executionResult{
		Output: map[string]any{
			"decision": decision,
			"comment":  comment,
			"findings": findings,
		},
		Artifacts: currentArtifacts,
		Evidence: mergeMaps(currentEvidence, map[string]any{
			"review": map[string]any{
				"reviewerType": reviewerTypeAI,
				"decision":     decision,
				"comment":      comment,
				"findings":     findings,
			},
		}),
	}, false, nil
}

func (s *Service) executePublishOrSchedule(
	ctx context.Context,
	principal *iam.Principal,
	workspaceID uuid.UUID,
	runInput map[string]any,
	stepConfig map[string]any,
	currentArtifacts []RunArtifact,
) (*executionResult, bool, error) {
	if _, err := s.authorizer.RequireWorkspacePermission(ctx, principal, workspaceID, "content.posts.publish"); err != nil {
		return nil, false, err
	}
	variantIDs := collectVariantIDs(currentArtifacts)
	if len(variantIDs) == 0 {
		return nil, false, fmt.Errorf("%w: publish or schedule requires post variants", iam.ErrValidation)
	}
	results := make([]map[string]any, 0, len(variantIDs))
	plannedAt := time.Now().UTC().Add(2 * time.Hour)
	if raw := firstNonEmptyString(stringValue(runInput["plannedAt"]), stringValue(stepConfig["plannedAt"])); raw != "" {
		if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
			plannedAt = parsed
		}
	}
	publishNow := boolValue(stepConfig["publishNow"]) || boolValue(runInput["publishNow"])
	for _, variantID := range variantIDs {
		if publishNow {
			record, err := s.posts.RecordPublication(ctx, principal, workspaceID, mustParseUUID(variantID))
			if err != nil {
				return nil, false, err
			}
			results = append(results, map[string]any{
				"variantId":   variantID,
				"state":       record.PublicationState,
				"publishedAt": record.PublishedAt,
			})
			continue
		}
		record, err := s.posts.SchedulePublication(ctx, principal, workspaceID, mustParseUUID(variantID), posts.SchedulePublicationInput{
			PlannedAt: &plannedAt,
			Source:    "automation",
		})
		if err != nil {
			return nil, false, err
		}
		results = append(results, map[string]any{
			"variantId": variantID,
			"state":     record.PublicationState,
			"plannedAt": record.PlannedAt,
		})
	}
	return &executionResult{
		Output: map[string]any{"plans": results},
		Artifacts: []RunArtifact{{
			Type:       artifactPublication,
			Label:      fmt.Sprintf("%d publication plans", len(results)),
			VariantIDs: variantIDs,
			Data:       map[string]any{"plans": results},
		}},
		Evidence: map[string]any{"publishNow": publishNow},
	}, false, nil
}

func (s *Service) prepareArtifactsForHumanReview(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, artifacts []RunArtifact) error {
	for _, artifact := range artifacts {
		for _, variantID := range artifact.VariantIDs {
			if _, err := s.posts.SubmitVariantReview(ctx, principal, workspaceID, mustParseUUID(variantID), posts.ReviewInput{
				Comment: "Submitted by automation workflow review step.",
			}); err != nil && !errors.Is(err, iam.ErrConflict) {
				return err
			}
		}
	}
	return nil
}

func (s *Service) applyReviewToArtifacts(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, artifacts []RunArtifact, decision, comment string) error {
	approvalState := "approved"
	if decision != "approved" {
		approvalState = "changes_requested"
	}
	for _, artifact := range artifacts {
		for _, variantID := range artifact.VariantIDs {
			if _, err := s.posts.DecideVariantReview(ctx, principal, workspaceID, mustParseUUID(variantID), posts.DecisionInput{
				ApprovalState: approvalState,
				Comment:       comment,
			}); err != nil && !errors.Is(err, iam.ErrConflict) {
				return err
			}
		}
	}
	return nil
}

func (s *Service) hydrateRuns(ctx context.Context, runs []database.AutomationRun) ([]AutomationRunRecord, error) {
	if len(runs) == 0 {
		return []AutomationRunRecord{}, nil
	}
	runIDs := make([]uuid.UUID, 0, len(runs))
	for _, run := range runs {
		runIDs = append(runIDs, run.ID)
	}
	stepsByRun, err := s.loadRunSteps(ctx, runIDs)
	if err != nil {
		return nil, err
	}
	reviewsByRun, err := s.loadRunReviews(ctx, runIDs)
	if err != nil {
		return nil, err
	}
	result := make([]AutomationRunRecord, 0, len(runs))
	for _, run := range runs {
		result = append(result, mapRun(run, stepsByRun[run.ID.String()], reviewsByRun[run.ID.String()]))
	}
	return result, nil
}

func (s *Service) loadWorkflowSteps(ctx context.Context, workflowIDs []uuid.UUID) (map[string][]*database.WorkflowStep, error) {
	result := map[string][]*database.WorkflowStep{}
	if len(workflowIDs) == 0 {
		return result, nil
	}
	var steps []*database.WorkflowStep
	if err := s.db.NewSelect().
		Model(&steps).
		Where("workflow_id IN (?)", bun.In(workflowIDs)).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, step := range steps {
		result[step.WorkflowID.String()] = append(result[step.WorkflowID.String()], step)
	}
	return result, nil
}

func (s *Service) loadWorkflowStepRecords(ctx context.Context, workflowID uuid.UUID) ([]*database.WorkflowStep, error) {
	var steps []*database.WorkflowStep
	if err := s.db.NewSelect().
		Model(&steps).
		Where("workflow_id = ?", workflowID).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return steps, nil
}

func (s *Service) loadRunSteps(ctx context.Context, runIDs []uuid.UUID) (map[string][]*database.AutomationRunStep, error) {
	result := map[string][]*database.AutomationRunStep{}
	if len(runIDs) == 0 {
		return result, nil
	}
	var steps []*database.AutomationRunStep
	if err := s.db.NewSelect().
		Model(&steps).
		Where("run_id IN (?)", bun.In(runIDs)).
		OrderExpr("position ASC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, step := range steps {
		result[step.RunID.String()] = append(result[step.RunID.String()], step)
	}
	return result, nil
}

func (s *Service) loadRunReviews(ctx context.Context, runIDs []uuid.UUID) (map[string][]database.AutomationRunReview, error) {
	result := map[string][]database.AutomationRunReview{}
	if len(runIDs) == 0 {
		return result, nil
	}
	var reviews []database.AutomationRunReview
	if err := s.db.NewSelect().
		Model(&reviews).
		Where("run_id IN (?)", bun.In(runIDs)).
		OrderExpr("created_at DESC").
		Scan(ctx); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	for _, review := range reviews {
		result[review.RunID.String()] = append(result[review.RunID.String()], review)
	}
	return result, nil
}

func (s *Service) findAutomation(ctx context.Context, workspaceID, automationID uuid.UUID) (*database.AutomationDefinition, error) {
	record := new(database.AutomationDefinition)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", automationID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findWorkflow(ctx context.Context, workspaceID, workflowID uuid.UUID) (*database.WorkflowDefinition, error) {
	record := new(database.WorkflowDefinition)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", workflowID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) findRun(ctx context.Context, workspaceID, runID uuid.UUID) (*database.AutomationRun, error) {
	record := new(database.AutomationRun)
	if err := s.db.NewSelect().
		Model(record).
		Where("workspace_id = ?", workspaceID).
		Where("id = ?", runID).
		Limit(1).
		Scan(ctx); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, iam.ErrNotFound
		}
		return nil, err
	}
	return record, nil
}

func (s *Service) updateRunAndStep(ctx context.Context, run *database.AutomationRun, step *database.AutomationRunStep, columns ...string) error {
	separator := len(columns)
	for index, column := range columns {
		if column == "state" {
			separator = index
			break
		}
	}
	return s.db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
		if separator > 0 {
			if _, err := tx.NewUpdate().Model(run).Column(columns[:separator]...).WherePK().Exec(ctx); err != nil {
				return err
			}
		}
		if separator < len(columns) {
			_, err := tx.NewUpdate().Model(step).Column(columns[separator:]...).WherePK().Exec(ctx)
			return err
		}
		return nil
	})
}

func (s *Service) updateRun(ctx context.Context, run *database.AutomationRun, columns ...string) error {
	_, err := s.db.NewUpdate().Model(run).Column(columns...).WherePK().Exec(ctx)
	return err
}

func (s *Service) normalizeWorkflowSteps(input []WorkflowStepRecord) ([]WorkflowStepRecord, error) {
	if len(input) == 0 {
		return nil, fmt.Errorf("%w: workflow requires at least one step", iam.ErrValidation)
	}
	result := make([]WorkflowStepRecord, 0, len(input))
	for index, step := range input {
		contract, ok := s.findActionContract(step.ActionType)
		if !ok {
			return nil, fmt.Errorf("%w: unsupported action type %s", iam.ErrValidation, step.ActionType)
		}
		position := step.Position
		if position <= 0 {
			position = index + 1
		}
		name := strings.TrimSpace(step.Name)
		if name == "" {
			name = contract.Label
		}
		stepKind := strings.TrimSpace(step.StepKind)
		if stepKind == "" {
			stepKind = contract.DefaultStepKind
		}
		result = append(result, WorkflowStepRecord{
			ID:                   strings.TrimSpace(step.ID),
			AutomationID:         strings.TrimSpace(step.AutomationID),
			Position:             position,
			Name:                 name,
			StepKind:             stepKind,
			ActionType:           contract.ActionType,
			ConsumesArtifactType: defaultString(strings.TrimSpace(step.ConsumesArtifactType), contract.DefaultConsumesType),
			ProducesArtifactType: defaultString(strings.TrimSpace(step.ProducesArtifactType), contract.DefaultProducesType),
			ReviewerType:         normalizeReviewerType(firstNonEmptyString(step.ReviewerType, contract.DefaultReviewerType)),
			RequiredCapabilities: normalizeStringSlice(append(contract.RequiredCapabilities, step.RequiredCapabilities...)),
			Config:               normalizeMap(step.Config),
			Metadata:             normalizeMap(step.Metadata),
		})
	}
	slices.SortFunc(result, func(a, b WorkflowStepRecord) int {
		return a.Position - b.Position
	})
	for index := range result {
		result[index].Position = index + 1
	}
	return result, nil
}

func (s *Service) validateWorkflowSteps(steps []WorkflowStepRecord) error {
	if len(steps) == 0 {
		return fmt.Errorf("%w: workflow requires at least one step", iam.ErrValidation)
	}
	currentOutput := artifactNone
	for index, step := range steps {
		contract, ok := s.findActionContract(step.ActionType)
		if !ok {
			return fmt.Errorf("%w: unsupported action type %s", iam.ErrValidation, step.ActionType)
		}
		if !compatibleInput(step.ConsumesArtifactType, currentOutput, contract.AcceptedInputs) {
			return fmt.Errorf("%w: step %d (%s) cannot consume %s after %s", iam.ErrValidation, index+1, step.Name, step.ConsumesArtifactType, currentOutput)
		}
		if step.StepKind == stepKindReview && normalizeReviewerType(step.ReviewerType) == reviewerTypeNone {
			return fmt.Errorf("%w: review step requires a reviewer type", iam.ErrValidation)
		}
		currentOutput = step.ProducesArtifactType
		if step.ActionType == actionReview {
			currentOutput = step.ConsumesArtifactType
		}
	}
	return nil
}

func (s *Service) actionCatalog() []ActionContract {
	return []ActionContract{
		{ActionType: actionCampaignPlan, Label: "Campaign Planning", Description: "Researches context and drafts a campaign brief that can be persisted as a campaign.", AcceptedInputs: []string{artifactNone, artifactStructured}, ProducedOutputs: []string{artifactCampaign, artifactStructured}, RequiredCapabilities: []string{"text_generation", "research"}, ReviewEligible: true, SupportsStandalone: true, DefaultConsumesType: artifactNone, DefaultProducesType: artifactCampaign, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"text_generation", "research"}},
		{ActionType: actionPostGenerate, Label: "Post Generation", Description: "Creates a post draft with research-backed context and can persist it into posts.", AcceptedInputs: []string{artifactNone, artifactCampaign, artifactStructured}, ProducedOutputs: []string{artifactPostDraft}, RequiredCapabilities: []string{"text_generation", "research"}, ReviewEligible: true, SupportsStandalone: true, DefaultConsumesType: artifactNone, DefaultProducesType: artifactPostDraft, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"text_generation", "research"}},
		{ActionType: actionVariationsGenerate, Label: "Variation Generation", Description: "Repurposes a base post into multiple platform-specific variants.", AcceptedInputs: []string{artifactPostDraft}, ProducedOutputs: []string{artifactPostVariants}, RequiredCapabilities: []string{"text_generation"}, ReviewEligible: true, SupportsStandalone: true, DefaultConsumesType: artifactPostDraft, DefaultProducesType: artifactPostVariants, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"text_generation"}},
		{ActionType: actionImageGenerate, Label: "Image Generation", Description: "Generates images and saves them to the asset library using a pluggable provider.", AcceptedInputs: []string{artifactNone, artifactPostDraft, artifactStructured}, ProducedOutputs: []string{artifactResource, artifactResourceSet}, RequiredCapabilities: []string{"image_generation"}, ReviewEligible: true, SupportsStandalone: true, DefaultConsumesType: artifactNone, DefaultProducesType: artifactResource, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"image_generation"}},
		{ActionType: actionReelGenerate, Label: "Reel Generation (Beta)", Description: "Creates a reel blueprint from a user-provided looped video, captions, and motion settings.", AcceptedInputs: []string{artifactNone, artifactResource, artifactStructured}, ProducedOutputs: []string{artifactResourceSet, artifactVideo}, RequiredCapabilities: []string{"media_composition"}, ReviewEligible: true, SupportsStandalone: true, Beta: true, DefaultConsumesType: artifactNone, DefaultProducesType: artifactResourceSet, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"media_composition"}},
		{ActionType: actionLinkedInPDF, Label: "LinkedIn PDF (Beta)", Description: "Generates a reusable PDF asset for LinkedIn document workflows and optional supporting post copy.", AcceptedInputs: []string{artifactNone, artifactPostDraft, artifactStructured}, ProducedOutputs: []string{artifactDocument}, RequiredCapabilities: []string{"document_rendering", "text_generation"}, ReviewEligible: true, SupportsStandalone: true, Beta: true, DefaultConsumesType: artifactNone, DefaultProducesType: artifactDocument, DefaultStepKind: stepKindAction, ProviderCapabilities: []string{"document_rendering", "text_generation"}},
		{ActionType: actionReview, Label: "Review", Description: "Routes content through a human or AI quality gate before publish or handoff.", AcceptedInputs: []string{artifactAny}, ProducedOutputs: []string{artifactAny}, SupportsStandalone: false, DefaultReviewerType: reviewerTypeHuman, DefaultConsumesType: artifactAny, DefaultProducesType: artifactAny, DefaultStepKind: stepKindReview},
		{ActionType: actionPublishOrSchedule, Label: "Publish or Schedule", Description: "Schedules or records publication for approved variants.", AcceptedInputs: []string{artifactPostVariants}, ProducedOutputs: []string{artifactPublication}, RequiredCapabilities: []string{"publishing"}, PublishEligible: true, SupportsStandalone: false, DefaultConsumesType: artifactPostVariants, DefaultProducesType: artifactPublication, DefaultStepKind: stepKindPublish},
	}
}

func (s *Service) templates() []AutomationTemplate {
	return []AutomationTemplate{
		{ID: "campaign-content-pipeline", Name: "Campaign Content Pipeline", Description: "Plan a campaign, generate a post, repurpose it into channel variations, review it, and schedule it.", Category: "workflow", EntryPoint: "/dashboard/campaigns", Steps: []WorkflowStepRecord{{Name: "Plan campaign", ActionType: actionCampaignPlan}, {Name: "Generate post", ActionType: actionPostGenerate, ConsumesArtifactType: artifactCampaign}, {Name: "Create variations", ActionType: actionVariationsGenerate, ConsumesArtifactType: artifactPostDraft}, {Name: "Review", ActionType: actionReview, ConsumesArtifactType: artifactPostVariants, ReviewerType: reviewerTypeHuman}, {Name: "Schedule", ActionType: actionPublishOrSchedule, ConsumesArtifactType: artifactPostVariants}}},
		{ID: "post-image-pipeline", Name: "Post + Image Flow", Description: "Generate a post and a supporting image asset in one streamlined workflow.", Category: "workflow", EntryPoint: "/dashboard/posts/new", Steps: []WorkflowStepRecord{{Name: "Generate post", ActionType: actionPostGenerate}, {Name: "Generate image", ActionType: actionImageGenerate, ConsumesArtifactType: artifactPostDraft}}},
		{ID: "reel-studio-beta", Name: "Reel Studio Beta", Description: "Turn a looped video into a caption-ready reel blueprint and send it through review.", Category: "studio", EntryPoint: "/dashboard/studio", Beta: true, Steps: []WorkflowStepRecord{{Name: "Create reel blueprint", ActionType: actionReelGenerate}, {Name: "Review", ActionType: actionReview, ConsumesArtifactType: artifactResourceSet, ReviewerType: reviewerTypeHuman}}},
		{ID: "linkedin-pdf-beta", Name: "LinkedIn PDF Beta", Description: "Generate a document-post-ready PDF and review it before publishing.", Category: "studio", EntryPoint: "/dashboard/studio", Beta: true, Steps: []WorkflowStepRecord{{Name: "Generate PDF", ActionType: actionLinkedInPDF}, {Name: "Review", ActionType: actionReview, ConsumesArtifactType: artifactDocument, ReviewerType: reviewerTypeHuman}}},
	}
}

func (s *Service) findActionContract(actionType string) (ActionContract, bool) {
	for _, item := range s.actionCatalog() {
		if item.ActionType == strings.TrimSpace(actionType) {
			return item, true
		}
	}
	return ActionContract{}, false
}

type aiTextGenerationProvider struct {
	ai *ai.Service
}

func (p aiTextGenerationProvider) Generate(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request textGenerationRequest) (*ai.GeneratedStructuredArtifact, error) {
	return p.ai.GenerateStructuredArtifact(ctx, principal, workspaceID, ai.GenerateStructuredArtifactInput{
		UseCase:      request.UseCase,
		SystemPrompt: request.SystemPrompt,
		PromptScope:  request.PromptScope,
		Prompt:       request.Prompt,
		CampaignID:   request.CampaignID,
		Provider:     request.Provider,
		Model:        request.Model,
		Mode:         request.Mode,
	})
}

type aiResearchProvider struct {
	ai *ai.Service
}

func (p aiResearchProvider) Research(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request textGenerationRequest) (*researchResult, error) {
	artifact, err := p.ai.GenerateStructuredArtifact(ctx, principal, workspaceID, ai.GenerateStructuredArtifactInput{
		UseCase:      request.UseCase,
		SystemPrompt: request.SystemPrompt,
		PromptScope:  request.PromptScope,
		Prompt:       request.Prompt,
		CampaignID:   request.CampaignID,
		Provider:     request.Provider,
		Model:        request.Model,
		Mode:         request.Mode,
	})
	if err != nil {
		return nil, err
	}
	return &researchResult{
		Summary:       stringValue(artifact.Payload["summary"]),
		SourceURLs:    stringSlice(artifact.Payload["sourceUrls"]),
		Facts:         mapSlice(artifact.Payload["facts"]),
		EvidenceNotes: stringSlice(artifact.Payload["evidenceNotes"]),
	}, nil
}

type pollinationsImageProvider struct {
	client *http.Client
}

func (p pollinationsImageProvider) Generate(ctx context.Context, request imageGenerationRequest) (*imageGenerationResult, error) {
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, fmt.Errorf("image prompt is required")
	}
	width := request.Width
	if width <= 0 {
		width = 1280
	}
	height := request.Height
	if height <= 0 {
		height = 1280
	}
	endpoint := fmt.Sprintf(
		"https://image.pollinations.ai/prompt/%s?width=%d&height=%d&model=%s&seed=%s&nologo=true",
		url.PathEscape(request.Prompt),
		width,
		height,
		url.QueryEscape(defaultString(strings.TrimSpace(request.Model), "flux")),
		url.QueryEscape(defaultString(strings.TrimSpace(request.Seed), "heimdall")),
	)
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	response, err := p.client.Do(httpRequest)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		raw, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return nil, fmt.Errorf("pollinations image generation failed: %s", strings.TrimSpace(string(raw)))
	}
	data, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	contentType := strings.TrimSpace(response.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "image/jpeg"
	}
	extension := ".jpg"
	if strings.Contains(contentType, "png") {
		extension = ".png"
	}
	return &imageGenerationResult{Provider: pollinationsProviderID, Model: defaultString(strings.TrimSpace(request.Model), "flux"), Prompt: request.Prompt, ContentType: contentType, FileName: "generated-image" + extension, Data: data}, nil
}

type reelBlueprintProvider struct {
	resources *resources.Service
}

func (p reelBlueprintProvider) Compose(ctx context.Context, principal *iam.Principal, workspaceID uuid.UUID, request mediaCompositionRequest) (*mediaCompositionResult, error) {
	source, err := p.resources.GetResource(ctx, principal, workspaceID, request.SourceResourceID)
	if err != nil {
		return nil, err
	}
	if source.MediaKind != "video" {
		return nil, fmt.Errorf("%w: reel generation requires a video resource", iam.ErrValidation)
	}
	blueprint := map[string]any{
		"title":         defaultString(strings.TrimSpace(request.Title), "Reel blueprint"),
		"caption":       strings.TrimSpace(request.Caption),
		"style":         defaultString(strings.TrimSpace(request.Style), "kinetic"),
		"effects":       request.Effects,
		"sourceVideoId": request.SourceResourceID.String(),
		"previewUrl":    source.PreviewURL,
		"mode":          "beta_blueprint",
	}
	setDetail, err := p.resources.CreateResourceSet(ctx, principal, workspaceID, resources.CreateResourceSetInput{
		Name:            firstNonEmptyString(strings.TrimSpace(request.Title), "Reel blueprint"),
		Description:     "Beta reel composition blueprint generated from an uploaded looped video.",
		IntentType:      "generic",
		SourceType:      "automation_generated",
		Items:           []resources.ResourceSetItemInput{{ResourceID: request.SourceResourceID, Role: "source_video", Metadata: blueprint}},
		Metadata:        blueprint,
		CoverResourceID: &request.SourceResourceID,
	})
	if err != nil {
		return nil, err
	}
	return &mediaCompositionResult{ResourceSet: setDetail, Blueprint: blueprint}, nil
}

type linkedInPDFProvider struct{}

func (p linkedInPDFProvider) Render(_ context.Context, request documentRenderRequest) (*documentRenderResult, error) {
	title := firstNonEmptyString(strings.TrimSpace(request.Title), "LinkedIn PDF")
	subtitle := strings.TrimSpace(request.Subtitle)
	pages := append([]string{}, request.Pages...)
	if len(pages) == 0 {
		pages = []string{"Outline\nAdd your talking points here."}
	}
	data := buildSimplePDF(title, subtitle, pages)
	caption := firstNonEmptyString(subtitle, "Document post ready for LinkedIn.")
	return &documentRenderResult{
		FileName:         sanitizeFileName(title) + ".pdf",
		ContentType:      "application/pdf",
		Data:             data,
		SuggestedCaption: caption,
	}, nil
}

func mapAutomationDefinition(record database.AutomationDefinition) AutomationDefinitionRecord {
	return AutomationDefinitionRecord{
		ID:              record.ID.String(),
		WorkspaceID:     record.WorkspaceID.String(),
		Status:          record.Status,
		Scope:           record.Scope,
		Name:            record.Name,
		Description:     record.Description,
		ActionType:      record.ActionType,
		TriggerType:     record.TriggerType,
		InputSchema:     parseJSONMap(record.InputSchema),
		DefaultConfig:   parseJSONMap(record.DefaultConfig),
		OutputSchema:    parseJSONMap(record.OutputSchema),
		ReviewPolicy:    parseJSONMap(record.ReviewPolicy),
		CapabilityHints: parseJSONStringSlice(record.CapabilityHints),
		Metadata:        parseJSONMap(record.Metadata),
		CreatedAt:       formatTime(record.CreatedAt),
		UpdatedAt:       formatTime(record.UpdatedAt),
	}
}

func mapWorkflowDefinition(record database.WorkflowDefinition, steps []*database.WorkflowStep) WorkflowDefinitionRecord {
	mappedSteps := make([]WorkflowStepRecord, 0, len(steps))
	for _, step := range steps {
		mappedSteps = append(mappedSteps, mapWorkflowStep(step))
	}
	return WorkflowDefinitionRecord{
		ID:              record.ID.String(),
		WorkspaceID:     record.WorkspaceID.String(),
		Status:          record.Status,
		Scope:           record.Scope,
		Name:            record.Name,
		Description:     record.Description,
		TriggerType:     record.TriggerType,
		InputSchema:     parseJSONMap(record.InputSchema),
		OutputSchema:    parseJSONMap(record.OutputSchema),
		ReviewPolicy:    parseJSONMap(record.ReviewPolicy),
		CapabilityHints: parseJSONStringSlice(record.CapabilityHints),
		Metadata:        parseJSONMap(record.Metadata),
		Steps:           mappedSteps,
		CreatedAt:       formatTime(record.CreatedAt),
		UpdatedAt:       formatTime(record.UpdatedAt),
	}
}

func mapWorkflowStep(step *database.WorkflowStep) WorkflowStepRecord {
	record := WorkflowStepRecord{
		ID:                   step.ID.String(),
		Position:             step.Position,
		Name:                 step.Name,
		StepKind:             step.StepKind,
		ActionType:           step.ActionType,
		ConsumesArtifactType: step.ConsumesArtifactType,
		ProducesArtifactType: step.ProducesArtifactType,
		ReviewerType:         step.ReviewerType,
		RequiredCapabilities: parseJSONStringSlice(step.RequiredCapabilities),
		Config:               parseJSONMap(step.Config),
		Metadata:             parseJSONMap(step.Metadata),
	}
	if step.AutomationID != nil {
		record.AutomationID = step.AutomationID.String()
	}
	return record
}

func mapRun(record database.AutomationRun, steps []*database.AutomationRunStep, reviews []database.AutomationRunReview) AutomationRunRecord {
	mappedSteps := make([]AutomationRunStepRecord, 0, len(steps))
	for _, step := range steps {
		mappedSteps = append(mappedSteps, mapRunStep(step))
	}
	mappedReviews := make([]RunReview, 0, len(reviews))
	for _, review := range reviews {
		mappedReviews = append(mappedReviews, mapRunReview(review))
	}
	result := AutomationRunRecord{
		ID:                  record.ID.String(),
		WorkspaceID:         record.WorkspaceID.String(),
		SourceType:          record.SourceType,
		Status:              record.Status,
		CurrentStepPosition: record.CurrentStepPosition,
		TriggerType:         record.TriggerType,
		ReviewRequired:      record.ReviewRequired,
		ReviewerType:        record.ReviewerType,
		InputPayload:        parseJSONMap(record.InputPayload),
		OutputPayload:       parseJSONMap(record.OutputPayload),
		LastError:           dereferenceString(record.LastError),
		ContextFingerprint:  record.ContextFingerprint,
		EvidencePayload:     parseJSONMap(record.EvidencePayload),
		Steps:               mappedSteps,
		Reviews:             mappedReviews,
		CompletedAt:         formatTimePointer(record.CompletedAt),
		CreatedAt:           formatTime(record.CreatedAt),
		UpdatedAt:           formatTime(record.UpdatedAt),
	}
	if record.AutomationID != nil {
		result.AutomationID = record.AutomationID.String()
	}
	if record.WorkflowID != nil {
		result.WorkflowID = record.WorkflowID.String()
	}
	return result
}

func mapRunStep(step *database.AutomationRunStep) AutomationRunStepRecord {
	record := AutomationRunStepRecord{
		ID:              step.ID.String(),
		Position:        step.Position,
		Name:            step.Name,
		StepKind:        step.StepKind,
		ActionType:      step.ActionType,
		State:           step.State,
		ReviewerType:    step.ReviewerType,
		InputPayload:    parseJSONMap(step.InputPayload),
		OutputPayload:   parseJSONMap(step.OutputPayload),
		ArtifactPayload: parseRunArtifacts(step.ArtifactPayload),
		EvidencePayload: parseJSONMap(step.EvidencePayload),
		LastError:       dereferenceString(step.LastError),
		StartedAt:       formatTimePointer(step.StartedAt),
		CompletedAt:     formatTimePointer(step.CompletedAt),
		CreatedAt:       formatTime(step.CreatedAt),
		UpdatedAt:       formatTime(step.UpdatedAt),
	}
	if step.WorkflowStepID != nil {
		record.WorkflowStepID = step.WorkflowStepID.String()
	}
	return record
}

func mapRunReview(review database.AutomationRunReview) RunReview {
	record := RunReview{
		ID:              review.ID.String(),
		RunID:           review.RunID.String(),
		ReviewerType:    review.ReviewerType,
		Decision:        review.Decision,
		Status:          review.Status,
		Comment:         review.Comment,
		Findings:        parseJSONStringSlice(review.Findings),
		AutomationAgent: review.AutomationAgent,
		CreatedAt:       formatTime(review.CreatedAt),
	}
	if review.RunStepID != nil {
		record.RunStepID = review.RunStepID.String()
	}
	if review.ActorUserID != nil {
		record.ActorUserID = review.ActorUserID.String()
	}
	return record
}

func compatibleInput(consumesType, currentOutput string, accepted []string) bool {
	if len(accepted) == 0 {
		accepted = []string{consumesType}
	}
	if slices.Contains(accepted, artifactAny) || consumesType == artifactAny {
		return true
	}
	if currentOutput == "" {
		currentOutput = artifactNone
	}
	if consumesType == "" {
		consumesType = currentOutput
	}
	if currentOutput == artifactNone {
		return slices.Contains(accepted, artifactNone)
	}
	if consumesType == currentOutput {
		return slices.Contains(accepted, consumesType)
	}
	return slices.Contains(accepted, currentOutput)
}

func buildSimplePDF(title, subtitle string, pages []string) []byte {
	lines := []string{title}
	if subtitle != "" {
		lines = append(lines, subtitle)
	}
	lines = append(lines, "")
	lines = append(lines, pages...)
	content := strings.Join(lines, "\n")
	stream := fmt.Sprintf(
		"BT /F1 18 Tf 50 780 Td (%s) Tj ET\nBT /F1 11 Tf 50 748 Td (%s) Tj ET\nBT /F1 10 Tf 50 708 Td (%s) Tj ET\n",
		escapePDFText(title),
		escapePDFText(subtitle),
		escapePDFText(strings.ReplaceAll(content, "\n", " | ")),
	)
	objects := []string{
		"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
		"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
		"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
		"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
		fmt.Sprintf("5 0 obj << /Length %d >> stream\n%sendstream endobj\n", len(stream), stream),
	}
	var buffer bytes.Buffer
	buffer.WriteString("%PDF-1.4\n")
	offsets := []int{0}
	for _, object := range objects {
		offsets = append(offsets, buffer.Len())
		buffer.WriteString(object)
	}
	xrefOffset := buffer.Len()
	buffer.WriteString(fmt.Sprintf("xref\n0 %d\n", len(offsets)))
	buffer.WriteString("0000000000 65535 f \n")
	for _, offset := range offsets[1:] {
		buffer.WriteString(fmt.Sprintf("%010d 00000 n \n", offset))
	}
	buffer.WriteString(fmt.Sprintf("trailer << /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF", len(offsets), xrefOffset))
	return buffer.Bytes()
}

func escapePDFText(value string) string {
	replacer := strings.NewReplacer("\\", "\\\\", "(", "\\(", ")", "\\)")
	return replacer.Replace(value)
}

func derivePostPrompt(currentArtifacts []RunArtifact) string {
	if campaign := firstArtifactOfType(currentArtifacts, artifactCampaign); campaign != nil {
		return fmt.Sprintf(
			"Create a post for the campaign \"%s\". Objective: %s. Audience: %s. Theme: %s.",
			stringValue(campaign.Data["name"]),
			stringValue(campaign.Data["objective"]),
			stringValue(campaign.Data["targetAudience"]),
			stringValue(campaign.Data["messageTheme"]),
		)
	}
	return ""
}

func deriveImagePrompt(currentArtifacts []RunArtifact) string {
	if postDraft := firstArtifactOfType(currentArtifacts, artifactPostDraft); postDraft != nil {
		contentPayload := mapValue(postDraft.Data["contentPayload"])
		return fmt.Sprintf(
			"Create a branded social image inspired by this post title and copy. Title: %s. Body: %s.",
			stringValue(postDraft.Data["title"]),
			stringValue(contentPayload["body"]),
		)
	}
	if brief := firstArtifactOfType(currentArtifacts, artifactStructured); brief != nil {
		return fmt.Sprintf("Create a social asset based on this brief: %s", stringValue(brief.Data["notes"]))
	}
	return ""
}

func deriveCaption(currentArtifacts []RunArtifact) string {
	if postDraft := firstArtifactOfType(currentArtifacts, artifactPostDraft); postDraft != nil {
		contentPayload := mapValue(postDraft.Data["contentPayload"])
		return stringValue(contentPayload["body"])
	}
	return ""
}

func derivePDFTitle(currentArtifacts []RunArtifact) string {
	if postDraft := firstArtifactOfType(currentArtifacts, artifactPostDraft); postDraft != nil {
		return firstNonEmptyString(stringValue(postDraft.Data["title"]), "LinkedIn PDF")
	}
	return "LinkedIn PDF"
}

func derivePDFPages(runInput, stepConfig map[string]any, currentArtifacts []RunArtifact) []string {
	if pages := stringSlice(stepConfig["pages"]); len(pages) > 0 {
		return pages
	}
	if pages := stringSlice(runInput["pages"]); len(pages) > 0 {
		return pages
	}
	if postDraft := firstArtifactOfType(currentArtifacts, artifactPostDraft); postDraft != nil {
		contentPayload := mapValue(postDraft.Data["contentPayload"])
		body := stringValue(contentPayload["body"])
		if body != "" {
			return splitIntoPages(body, 420)
		}
	}
	return []string{"Intro", "Key point", "Takeaway"}
}

func splitIntoPages(body string, limit int) []string {
	body = strings.TrimSpace(body)
	if body == "" {
		return []string{"Add content"}
	}
	words := strings.Fields(body)
	pages := make([]string, 0)
	var current strings.Builder
	for _, word := range words {
		next := strings.TrimSpace(current.String() + " " + word)
		if current.Len() > 0 && len(next) > limit {
			pages = append(pages, strings.TrimSpace(current.String()))
			current.Reset()
			current.WriteString(word)
			continue
		}
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(word)
	}
	if strings.TrimSpace(current.String()) != "" {
		pages = append(pages, strings.TrimSpace(current.String()))
	}
	return pages
}

func collectVariantIDs(artifacts []RunArtifact) []string {
	seen := map[string]struct{}{}
	result := make([]string, 0)
	for _, artifact := range artifacts {
		for _, variantID := range artifact.VariantIDs {
			if strings.TrimSpace(variantID) == "" {
				continue
			}
			if _, ok := seen[variantID]; ok {
				continue
			}
			seen[variantID] = struct{}{}
			result = append(result, variantID)
		}
	}
	return result
}

func workflowContainsPublish(steps []WorkflowStepRecord) bool {
	for _, step := range steps {
		if step.ActionType == actionPublishOrSchedule {
			return true
		}
	}
	return false
}

func recordsToStepDTOs(steps []*database.WorkflowStep) []WorkflowStepRecord {
	result := make([]WorkflowStepRecord, 0, len(steps))
	for _, step := range steps {
		result = append(result, mapWorkflowStep(step))
	}
	return result
}

func stepWorkflowPointer(step *database.WorkflowStep) *uuid.UUID {
	if step.ID == uuid.Nil || step.WorkflowID == uuid.Nil {
		return nil
	}
	return &step.ID
}

func workflowIDs(records []database.WorkflowDefinition) []uuid.UUID {
	result := make([]uuid.UUID, 0, len(records))
	for _, record := range records {
		result = append(result, record.ID)
	}
	return result
}

func buildFingerprint(sourceType string, payload map[string]any) string {
	sum := sha256.Sum256([]byte(sourceType + ":" + marshalJSON(payload)))
	return hex.EncodeToString(sum[:12])
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func formatTimePointer(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func marshalJSON(value any) string {
	if value == nil {
		value = map[string]any{}
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(raw)
}

func parseJSONMap(raw string) map[string]any {
	if strings.TrimSpace(raw) == "" {
		return map[string]any{}
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(raw), &payload); err != nil || payload == nil {
		return map[string]any{}
	}
	return payload
}

func parseRunArtifacts(raw string) []RunArtifact {
	if strings.TrimSpace(raw) == "" {
		return []RunArtifact{}
	}
	var payload []RunArtifact
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return []RunArtifact{}
	}
	return payload
}

func parseJSONStringSlice(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{}
	}
	var payload []string
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return []string{}
	}
	return normalizeStringSlice(payload)
}

func normalizeStringSlice(values []string) []string {
	result := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func normalizeTargets(raw any) []map[string]string {
	items := make([]map[string]string, 0)
	for _, value := range anySlice(raw) {
		record, ok := value.(map[string]any)
		if !ok {
			continue
		}
		platform := strings.TrimSpace(stringValue(record["platform"]))
		surface := strings.TrimSpace(stringValue(record["surface"]))
		if platform == "" || surface == "" {
			continue
		}
		items = append(items, map[string]string{"platform": platform, "surface": surface})
	}
	return items
}

func normalizeReviewerType(value string) string {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case reviewerTypeHuman:
		return reviewerTypeHuman
	case reviewerTypeAI:
		return reviewerTypeAI
	default:
		return reviewerTypeNone
	}
}

func normalizeMap(value map[string]any) map[string]any {
	if value == nil {
		return map[string]any{}
	}
	return value
}

func cloneMap(value map[string]any) map[string]any {
	result := map[string]any{}
	for key, item := range value {
		result[key] = item
	}
	return result
}

func mergeMaps(base, next map[string]any) map[string]any {
	result := cloneMap(base)
	for key, value := range next {
		result[key] = value
	}
	return result
}

func firstArtifactOfType(artifacts []RunArtifact, artifactType string) *RunArtifact {
	for index := range artifacts {
		if artifacts[index].Type == artifactType {
			return &artifacts[index]
		}
	}
	return nil
}

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return ""
	}
}

func boolValue(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "true")
	default:
		return false
	}
}

func intValue(value any, fallback int) int {
	switch typed := value.(type) {
	case int:
		return typed
	case float64:
		return int(typed)
	case string:
		var parsed int
		if _, err := fmt.Sscanf(strings.TrimSpace(typed), "%d", &parsed); err == nil {
			return parsed
		}
	}
	return fallback
}

func anySlice(value any) []any {
	switch typed := value.(type) {
	case []any:
		return typed
	case []map[string]any:
		result := make([]any, 0, len(typed))
		for _, item := range typed {
			result = append(result, item)
		}
		return result
	case []string:
		result := make([]any, 0, len(typed))
		for _, item := range typed {
			result = append(result, item)
		}
		return result
	default:
		return []any{}
	}
}

func stringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return normalizeStringSlice(typed)
	case []any:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			if value := stringValue(item); value != "" {
				result = append(result, value)
			}
		}
		return normalizeStringSlice(result)
	default:
		return []string{}
	}
}

func mapSlice(value any) []map[string]any {
	switch typed := value.(type) {
	case []map[string]any:
		return typed
	case []any:
		result := make([]map[string]any, 0, len(typed))
		for _, item := range typed {
			if record, ok := item.(map[string]any); ok {
				result = append(result, record)
			}
		}
		return result
	default:
		return []map[string]any{}
	}
}

func mapValue(value any) map[string]any {
	if typed, ok := value.(map[string]any); ok && typed != nil {
		return typed
	}
	return map[string]any{}
}

func hasKey(value map[string]any, key string) bool {
	_, ok := value[key]
	return ok
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func dereferenceString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringPointer(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func parseUUIDPointer(value string) *uuid.UUID {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return nil
	}
	return &parsed
}

func mustParseUUID(value string) uuid.UUID {
	parsed, _ := uuid.Parse(strings.TrimSpace(value))
	return parsed
}

func sanitizeFileName(value string) string {
	safe := strings.ToLower(strings.TrimSpace(value))
	safe = strings.ReplaceAll(safe, " ", "-")
	safe = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			return r
		case r >= '0' && r <= '9':
			return r
		case r == '-':
			return r
		default:
			return -1
		}
	}, safe)
	if safe == "" {
		safe = "document"
	}
	return filepath.Clean(safe)
}
