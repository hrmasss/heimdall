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
	transformRecipe?: Record<string, unknown>;
	compatibility: ResourceCompatibility[];
	processingError?: string;
	createdAt: string;
	updatedAt: string;
};

export type ResourceDetail = ResourceRecord & {
	variants: ResourceRecord[];
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
