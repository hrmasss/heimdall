export type Permission = {
	code: string;
	label: string;
	scope: string;
	description: string;
};

export type Role = {
	id: string;
	code: string;
	label: string;
	scope: string;
	permissions: Permission[];
};

export type User = {
	id: string;
	email: string;
	fullName: string;
	status: string;
	createdAt: string;
};

export type WorkspaceMembershipSummary = {
	id: string;
	workspaceId: string;
	workspaceName: string;
	workspaceSlug: string;
	workspaceStatus: string;
	status: string;
	roles: Role[];
};

export type AuthSession = {
	portal: "customer" | "platform";
	accessToken?: string;
	user: User;
	impersonator?: User;
	platformRoles: Role[];
	platformPermissions: Permission[];
	workspaceMemberships: WorkspaceMembershipSummary[];
	assumedWorkspaceId?: string;
};

export type WorkspaceSummary = {
	id: string;
	name: string;
	slug: string;
	status: string;
	capabilities: Permission[];
	membership?: WorkspaceMembershipSummary;
};

export type WorkspaceMemberRecord = {
	membershipId: string;
	user: User;
	status: string;
	roles: Role[];
};

export type WorkspaceInvite = {
	id: string;
	email: string;
	status: string;
	expiresAt: string;
	createdAt: string;
	roles: Role[];
};

export type PlatformUserRecord = {
	user: User;
	platformRoles: Role[];
	workspaceCount: number;
	workspaceMemberships?: WorkspaceMembershipSummary[];
};

export type PlatformWorkspaceRecord = {
	id: string;
	name: string;
	slug: string;
	status: string;
	memberCount: number;
	activeMemberCount: number;
};

export type ApiListResponse<T> = {
	items: T[];
};

export type ResourceCompatibility = {
	platform: string;
	surface: string;
	status: "supported" | "warning" | "unsupported";
	reasons: string[];
};

export type ResourceCapabilityRule = {
	platform: string;
	surface: string;
	label: string;
	accepts: string[];
	hardLimit: string[];
	preferred: string[];
	supportedContentKinds: Array<"text" | "article" | "thread">;
	assetRequired: boolean;
	minItems?: number;
	maxItems?: number;
};

export type ResourceCapabilityMatrix = {
	rules: ResourceCapabilityRule[];
};

export type ResourceRecord = {
	id: string;
	workspaceId: string;
	parentResourceId?: string;
	mediaKind: "image" | "video" | "document";
	sourceType: string;
	lifecycleStatus: string;
	displayName: string;
	originalName: string;
	mimeType: string;
	fileExtension: string;
	checksumSha256: string;
	sizeBytes: number;
	widthPx?: number;
	heightPx?: number;
	durationMs?: number;
	pageCount?: number;
	frameRate?: number;
	hasAudio?: boolean;
	optimized: boolean;
	storageBackend: string;
	downloadUrl: string;
	previewUrl: string;
	usageCount: number;
	childCount: number;
	setCount: number;
	transformRecipe?: Record<string, unknown>;
	compatibility: ResourceCompatibility[];
	processingError?: string;
	createdAt: string;
	updatedAt: string;
};

export type ResourceSetSummary = {
	id: string;
	workspaceId: string;
	name: string;
	description: string;
	intentType: "generic" | "social_surface";
	intentPlatform?: string;
	intentSurface?: string;
	coverResourceId?: string;
	coverPreviewUrl?: string;
	sourceType: string;
	itemCount: number;
	membersPreview: ResourceRecord[];
	createdAt: string;
	updatedAt: string;
};

export type ResourceSetItem = {
	id: string;
	resourceId: string;
	position: number;
	role: string;
	metadata?: Record<string, unknown>;
	resource: ResourceRecord;
};

export type ResourceSetDetail = ResourceSetSummary & {
	metadata?: Record<string, unknown>;
	coverResource?: ResourceRecord;
	items: ResourceSetItem[];
};

export type ResourceDetail = ResourceRecord & {
	variants: ResourceRecord[];
	sets?: ResourceSetSummary[];
};

export type ResourceUploadResponse = {
	resource: ResourceDetail;
	optimization?: {
		applied: boolean;
		originalSizeBytes: number;
		storedSizeBytes: number;
		savedBytes: number;
	};
};

export type MetricSnapshotItem = {
	code: string;
	label: string;
	unit: string;
	rollup: string;
	value: number;
	observedAt: string;
};

export type CampaignLink = {
	id: string;
	name: string;
	status: "draft" | "planned" | "active" | "completed" | "archived";
	startDate: string;
	endDate?: string;
};

export type CampaignDeliveryTarget = {
	id: string;
	socialTargetId: string;
	provider: string;
	displayName: string;
	username?: string;
	targetType: string;
	status: string;
	isSelected: boolean;
};

export type CampaignScheduleRule = {
	id: string;
	socialTargetId: string;
	enabled: boolean;
	cadenceType: "daily_interval" | "weekly";
	interval: number;
	weekdays: string[];
	timesLocal: string[];
	startDate?: string;
	endDate?: string;
	summary: string;
};

export type CampaignAutomationReadiness = {
	ready: boolean;
	issues: string[];
	warnings: string[];
};

export type CampaignSummary = {
	id: string;
	workspaceId: string;
	status: CampaignLink["status"];
	name: string;
	objective?: string;
	targetAudience?: string;
	messageTheme?: string;
	startDate: string;
	endDate?: string;
	defaultTimezone: string;
	notes?: string;
	primaryMetricLabel?: string;
	primaryMetricTarget?: number;
	primaryMetricUnit?: string;
	paidChannels: string[];
	budgetAmountCents?: number;
	actualSpendAmountCents?: number;
	currencyCode?: string;
	utmCampaign?: string;
	externalDashboardUrl?: string;
	postCount: number;
	deliveryTargetCount: number;
	scheduleRuleCount: number;
	automationReadiness: CampaignAutomationReadiness;
	createdAt: string;
	updatedAt: string;
};

export type CampaignDetail = CampaignSummary & {
	deliveryTargets: CampaignDeliveryTarget[];
	scheduleRules: CampaignScheduleRule[];
	linkedPosts: PostSummary[];
	metricSnapshot: MetricSnapshotItem[];
};

export type CalendarCampaignEntry = {
	id: string;
	name: string;
	status: CampaignLink["status"];
	startDate: string;
	endDate?: string;
	postCount: number;
};

export type ReviewRecord = {
	id: string;
	variantId: string;
	approvalState: "draft" | "in_review" | "approved" | "changes_requested";
	decision: string;
	comment?: string;
	actorUserId?: string;
	createdAt: string;
};

export type PublicationPlan = {
	id: string;
	variantId: string;
	socialTargetId?: string;
	publicationState:
		| "unscheduled"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	plannedAt?: string;
	publishedAt?: string;
	externalPostId?: string;
	externalPostUrl?: string;
	externalAccountId?: string;
	source: string;
	lastError?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type SocialProviderAvailability = {
	provider: string;
	label: string;
	managedAvailable: boolean;
	supportsByok: boolean;
	connectionModes: string[];
	managedStatus: string;
	managedStatusText?: string;
};

export type SocialAppCredentialRecord = {
	id: string;
	workspaceId?: string;
	provider: string;
	source: "managed" | "byok";
	status: string;
	clientId: string;
	clientIdMasked: string;
	clientSecretHint?: string;
	metadata?: Record<string, unknown>;
	createdAt?: string;
	updatedAt?: string;
};

export type SocialTargetRecord = {
	id: string;
	connectionId: string;
	provider: string;
	externalAccountId: string;
	externalParentId?: string;
	displayName: string;
	username?: string;
	targetType: string;
	accountClassification: string;
	status: string;
	isSelected: boolean;
	scopeSnapshot: string[];
	capabilitySnapshot: Record<string, unknown>;
	metadata?: Record<string, unknown>;
	lastValidatedAt?: string;
	lastValidationError?: string;
};

export type SocialConnectionRecord = {
	id: string;
	provider: string;
	credentialSource: "managed" | "byok";
	status: string;
	healthStatus: string;
	authSubjectId: string;
	authSubjectName: string;
	scopes: string[];
	metadata?: Record<string, unknown>;
	accessTokenExpiresAt?: string;
	lastValidatedAt?: string;
	lastValidationError?: string;
	connectedAt: string;
	createdAt: string;
	updatedAt: string;
	targets: SocialTargetRecord[];
};

export type SocialConnectionsResponse = {
	connections: SocialConnectionRecord[];
	targets: SocialTargetRecord[];
};

export type PublishabilityPreview = {
	ready: boolean;
	provider: string;
	target?: SocialTargetRecord;
	issues: ReadinessIssue[];
	warnings: ReadinessIssue[];
	capabilitySnapshot?: Record<string, unknown>;
	publicationMetadata?: Record<string, unknown>;
};

export type TikTokPublishOptions = {
	privacyLevel?: string;
	allowComment?: boolean;
	allowDuet?: boolean;
	allowStitch?: boolean;
	brandContent?: boolean;
	brandedContent?: boolean;
};

export type SyncMetricsResult = {
	publicationId: string;
	variantId: string;
	metrics: Record<string, number>;
	syncedAt: string;
};

export type TentativePlan = {
	id: string;
	variantId: string;
	plannedAt: string;
	source: string;
	createdAt: string;
	updatedAt: string;
};

export type ReadinessIssue = {
	code: string;
	message: string;
};

export type VariantReadiness = {
	draftIssues: ReadinessIssue[];
	scheduleBlockers: ReadinessIssue[];
	publishBlockers: ReadinessIssue[];
};

export type MetricDefinition = {
	id: string;
	code: string;
	label: string;
	unit: string;
	rollup: string;
	platform?: string;
	surface?: string;
};

export type MetricObservation = {
	id: string;
	publicationId: string;
	metricCode: string;
	label: string;
	unit: string;
	rollup: string;
	observedAt: string;
	value: number;
	source: string;
	metadata?: Record<string, unknown>;
};

export type PostVariant = {
	id: string;
	postId: string;
	platform: string;
	surface: string;
	inheritSource: string;
	contentMode: "inherit" | "custom";
	contentKind?: "text" | "article" | "thread";
	contentPayload?: Record<string, unknown>;
	assetMode: "inherit" | "replace";
	removedInheritedResourceIds: string[];
	assets: ResourceRecord[];
	effectiveAssets: ResourceRecord[];
	approvalState: "draft" | "in_review" | "approved" | "changes_requested";
	latestReview?: ReviewRecord;
	reviewHistory: ReviewRecord[];
	latestPublication?: PublicationPlan;
	latestTentativePlan?: TentativePlan;
	readiness: VariantReadiness;
	metricSnapshot: MetricSnapshotItem[];
	notes?: string;
	createdAt: string;
	updatedAt: string;
};

export type PostSummary = {
	id: string;
	workspaceId: string;
	title: string;
	contentKind: "text" | "article" | "thread";
	campaign?: CampaignLink;
	originPlatform?: string;
	originSurface?: string;
	requiresApproval: boolean;
	aggregateApprovalState:
		| "draft"
		| "in_review"
		| "approved"
		| "changes_requested";
	aggregatePublicationState:
		| "unscheduled"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	variantCount: number;
	latestPlannedAt?: string;
	metricSnapshot: MetricSnapshotItem[];
	createdAt: string;
	updatedAt: string;
};

export type PostDetail = PostSummary & {
	contentPayload: Record<string, unknown>;
	assets: ResourceRecord[];
	variants: PostVariant[];
	legacyVariants: PostVariant[];
	notes?: string;
};

export type CalendarRange = {
	start: string;
	end: string;
	timezone: string;
};

export type CalendarPlatformLane = {
	platform: string;
	label: string;
	scheduledCount: number;
	backlogCount: number;
};

export type CalendarEntry = {
	variantId: string;
	postId: string;
	title: string;
	campaign?: CampaignLink;
	platform: string;
	surface: string;
	plannedAt: string;
	planningState:
		| "unscheduled"
		| "tentative"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	approvalState: "draft" | "in_review" | "approved" | "changes_requested";
	publicationState:
		| "unscheduled"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	requiresApproval: boolean;
	finalizable: boolean;
	readiness: VariantReadiness;
	excerpt: string;
	assetCount: number;
	notes?: string;
	contentKind?: "text" | "article" | "thread";
	createdAt: string;
	updatedAt: string;
};

export type CalendarBacklogItem = {
	variantId: string;
	postId: string;
	title: string;
	campaign?: CampaignLink;
	platform: string;
	surface: string;
	planningState:
		| "unscheduled"
		| "tentative"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	approvalState: "draft" | "in_review" | "approved" | "changes_requested";
	publicationState:
		| "unscheduled"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	requiresApproval: boolean;
	finalizable: boolean;
	readiness: VariantReadiness;
	excerpt: string;
	assetCount: number;
	notes?: string;
	contentKind?: "text" | "article" | "thread";
	createdAt: string;
	updatedAt: string;
};

export type CalendarResponse = {
	entries: CalendarEntry[];
	backlog: CalendarBacklogItem[];
	campaigns: CalendarCampaignEntry[];
	platforms: CalendarPlatformLane[];
	range: CalendarRange;
};

export type ContextFact = {
	key: string;
	label: string;
	value: string;
	appliesTo: string[];
	importance: "low" | "medium" | "high";
};

export type WorkspaceBusinessContext = {
	narrative: string;
	summary: string;
	understandingScore: number;
	missingGaps: string[];
	facts: ContextFact[];
	extractorVersion: string;
	sourceHash: string;
	updatedAt?: string;
};

export type WorkspaceBrandContext = {
	narrative: string;
	summary: string;
	designTokens: Record<string, unknown>;
	visualGuardrails: string[];
	missingGaps: string[];
	referenceResourceId?: string;
	processingStatus: string;
	extractorVersion: string;
	sourceHash: string;
	updatedAt?: string;
};

export type WorkspaceIntelligenceReadiness = {
	hasBusinessContext: boolean;
	hasBrandContext: boolean;
	hasAiAccess: boolean;
	complete: boolean;
	missing: string[];
};

export type WorkspaceContextResponse = {
	business: WorkspaceBusinessContext;
	brand: WorkspaceBrandContext;
	readiness: WorkspaceIntelligenceReadiness;
};

export type AIModelSelection = {
	provider: string;
	model: string;
};

export type AIProviderCredentialRecord = {
	id: string;
	provider: string;
	position: number;
	status: string;
	keyHint: string;
	allowedModels: string[];
	updatedAt?: string;
};

export type WorkspaceAISettings = {
	defaultMode: "native" | "byok";
	capabilityDefaults: Record<string, AIModelSelection>;
	fallbackPoolEnabled: boolean;
	usagePolicy: Record<string, unknown>;
	credentials: AIProviderCredentialRecord[];
};

export type AIProviderCatalogEntry = {
	provider: string;
	label: string;
	approvedModels: string[];
	defaultModel: string;
	nativeAvailable: boolean;
	configuredCredentialCount: number;
	supportsByok: boolean;
	supportsImages: boolean;
};

export type AIProviderCatalog = {
	providers: AIProviderCatalogEntry[];
};

export type AIRunEventSummary = {
	id: string;
	useCase: string;
	provider: string;
	model: string;
	credentialMode: string;
	contextFingerprint: string;
	status: string;
	createdAt: string;
};

export type AIGeneratedPostDraft = {
	title: string;
	contentKind: "text" | "article" | "thread";
	contentPayload: Record<string, unknown>;
	provider: string;
	model: string;
	credentialMode: "native" | "byok";
	contextFingerprint: string;
	warnings: string[];
	runEvent?: AIRunEventSummary;
};

export type AutomationActionContract = {
	actionType: string;
	label: string;
	description: string;
	acceptedInputs: string[];
	producedOutputs: string[];
	requiredCapabilities: string[];
	reviewEligible: boolean;
	publishEligible: boolean;
	supportsStandalone: boolean;
	beta: boolean;
	defaultReviewerType?: string;
	defaultConsumesType: string;
	defaultProducesType: string;
	defaultStepKind: string;
	providerCapabilities?: string[];
};

export type WorkflowStep = {
	id?: string;
	automationId?: string;
	position: number;
	name: string;
	stepKind: string;
	actionType: string;
	consumesArtifactType: string;
	producesArtifactType: string;
	reviewerType: string;
	requiredCapabilities: string[];
	config: Record<string, unknown>;
	metadata: Record<string, unknown>;
};

export type AutomationTemplate = {
	id: string;
	name: string;
	description: string;
	category: string;
	entryPoint: string;
	beta: boolean;
	metadata?: Record<string, unknown>;
	steps: WorkflowStep[];
};

export type AutomationCatalogResponse = {
	actions: AutomationActionContract[];
	templates: AutomationTemplate[];
};

export type AutomationDefinition = {
	id: string;
	workspaceId: string;
	status: string;
	scope: string;
	name: string;
	description: string;
	actionType: string;
	triggerType: string;
	inputSchema: Record<string, unknown>;
	defaultConfig: Record<string, unknown>;
	outputSchema: Record<string, unknown>;
	reviewPolicy: Record<string, unknown>;
	capabilityHints: string[];
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

export type WorkflowDefinition = {
	id: string;
	workspaceId: string;
	status: string;
	scope: string;
	name: string;
	description: string;
	triggerType: string;
	inputSchema: Record<string, unknown>;
	outputSchema: Record<string, unknown>;
	reviewPolicy: Record<string, unknown>;
	capabilityHints: string[];
	metadata: Record<string, unknown>;
	steps: WorkflowStep[];
	createdAt: string;
	updatedAt: string;
};

export type RunArtifact = {
	type: string;
	label: string;
	campaignId?: string;
	postId?: string;
	variantIds?: string[];
	resourceId?: string;
	resourceSetId?: string;
	data?: Record<string, unknown>;
};

export type RunReview = {
	id: string;
	runId: string;
	runStepId?: string;
	reviewerType: string;
	decision: string;
	status: string;
	comment: string;
	findings: string[];
	actorUserId?: string;
	automationAgent: string;
	createdAt: string;
};

export type AutomationRunStep = {
	id: string;
	workflowStepId?: string;
	position: number;
	name: string;
	stepKind: string;
	actionType: string;
	state: string;
	reviewerType: string;
	inputPayload: Record<string, unknown>;
	outputPayload: Record<string, unknown>;
	artifactPayload: RunArtifact[];
	evidencePayload: Record<string, unknown>;
	lastError?: string;
	startedAt?: string;
	completedAt?: string;
	createdAt: string;
	updatedAt: string;
};

export type AutomationRun = {
	id: string;
	workspaceId: string;
	sourceType: string;
	automationId?: string;
	workflowId?: string;
	status: string;
	currentStepPosition?: number;
	triggerType: string;
	reviewRequired: boolean;
	reviewerType: string;
	inputPayload: Record<string, unknown>;
	outputPayload: Record<string, unknown>;
	lastError?: string;
	contextFingerprint: string;
	evidencePayload: Record<string, unknown>;
	steps: AutomationRunStep[];
	reviews: RunReview[];
	completedAt?: string;
	createdAt: string;
	updatedAt: string;
};
