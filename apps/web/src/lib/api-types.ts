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
	externalAccountId?: string;
	source: string;
	lastError?: string;
	metadata?: Record<string, unknown>;
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
