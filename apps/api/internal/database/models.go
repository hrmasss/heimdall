package database

import (
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"
)

type User struct {
	bun.BaseModel `bun:"table:users"`

	ID           uuid.UUID `bun:"id,pk,type:uuid"`
	Email        string    `bun:"email,notnull"`
	FullName     string    `bun:"full_name,notnull"`
	PasswordHash string    `bun:"password_hash,notnull"`
	Status       string    `bun:"status,notnull"`
	CreatedAt    time.Time `bun:"created_at,notnull"`
	UpdatedAt    time.Time `bun:"updated_at,notnull"`
}

type Workspace struct {
	bun.BaseModel `bun:"table:workspaces"`

	ID                  uuid.UUID `bun:"id,pk,type:uuid"`
	Name                string    `bun:"name,notnull"`
	Slug                string    `bun:"slug,notnull"`
	Status              string    `bun:"status,notnull"`
	RequirePostApproval bool      `bun:"require_post_approval,notnull"`
	CreatedAt           time.Time `bun:"created_at,notnull"`
	UpdatedAt           time.Time `bun:"updated_at,notnull"`
}

type WorkspaceMembership struct {
	bun.BaseModel `bun:"table:workspace_memberships"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID     uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	UserID          uuid.UUID  `bun:"user_id,notnull,type:uuid"`
	Status          string     `bun:"status,notnull"`
	InvitedByUserID *uuid.UUID `bun:"invited_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type Role struct {
	bun.BaseModel `bun:"table:roles"`

	ID        uuid.UUID `bun:"id,pk,type:uuid"`
	Code      string    `bun:"code,notnull"`
	Label     string    `bun:"label,notnull"`
	Scope     string    `bun:"scope,notnull"`
	System    bool      `bun:"system,notnull"`
	CreatedAt time.Time `bun:"created_at,notnull"`
}

type Permission struct {
	bun.BaseModel `bun:"table:permissions"`

	ID          uuid.UUID `bun:"id,pk,type:uuid"`
	Code        string    `bun:"code,notnull"`
	Label       string    `bun:"label,notnull"`
	Scope       string    `bun:"scope,notnull"`
	Description string    `bun:"description,notnull"`
	CreatedAt   time.Time `bun:"created_at,notnull"`
}

type RolePermission struct {
	bun.BaseModel `bun:"table:role_permissions"`

	RoleID       uuid.UUID `bun:"role_id,pk,type:uuid"`
	PermissionID uuid.UUID `bun:"permission_id,pk,type:uuid"`
}

type WorkspaceMembershipRole struct {
	bun.BaseModel `bun:"table:workspace_membership_roles"`

	MembershipID uuid.UUID `bun:"membership_id,pk,type:uuid"`
	RoleID       uuid.UUID `bun:"role_id,pk,type:uuid"`
}

type PlatformUserRole struct {
	bun.BaseModel `bun:"table:platform_user_roles"`

	UserID uuid.UUID `bun:"user_id,pk,type:uuid"`
	RoleID uuid.UUID `bun:"role_id,pk,type:uuid"`
}

type WorkspaceInvite struct {
	bun.BaseModel `bun:"table:workspace_invites"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID     uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Email           string     `bun:"email,notnull"`
	TokenHash       string     `bun:"token_hash,notnull"`
	Status          string     `bun:"status,notnull"`
	InvitedByUserID *uuid.UUID `bun:"invited_by_user_id,type:uuid"`
	ExpiresAt       time.Time  `bun:"expires_at,notnull"`
	AcceptedAt      *time.Time `bun:"accepted_at"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type WorkspaceInviteRole struct {
	bun.BaseModel `bun:"table:workspace_invite_roles"`

	InviteID uuid.UUID `bun:"invite_id,pk,type:uuid"`
	RoleID   uuid.UUID `bun:"role_id,pk,type:uuid"`
}

type AuthSession struct {
	bun.BaseModel `bun:"table:auth_sessions"`

	ID                 uuid.UUID  `bun:"id,pk,type:uuid"`
	UserID             uuid.UUID  `bun:"user_id,notnull,type:uuid"`
	ImpersonatorUserID *uuid.UUID `bun:"impersonator_user_id,type:uuid"`
	Scope              string     `bun:"scope,notnull"`
	RefreshTokenHash   string     `bun:"refresh_token_hash,notnull"`
	ExpiresAt          time.Time  `bun:"expires_at,notnull"`
	RevokedAt          *time.Time `bun:"revoked_at"`
	AssumedWorkspaceID *uuid.UUID `bun:"assumed_workspace_id,type:uuid"`
	CreatedAt          time.Time  `bun:"created_at,notnull"`
	UpdatedAt          time.Time  `bun:"updated_at,notnull"`
}

type AuditLog struct {
	bun.BaseModel `bun:"table:audit_logs"`

	ID          uuid.UUID  `bun:"id,pk,type:uuid"`
	ActorUserID *uuid.UUID `bun:"actor_user_id,type:uuid"`
	Action      string     `bun:"action,notnull"`
	TargetType  string     `bun:"target_type,notnull"`
	TargetID    string     `bun:"target_id"`
	WorkspaceID *uuid.UUID `bun:"workspace_id,type:uuid"`
	Metadata    string     `bun:"metadata,notnull"`
	CreatedAt   time.Time  `bun:"created_at,notnull"`
}

type Resource struct {
	bun.BaseModel `bun:"table:resources"`

	ID               uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID      uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	ParentResourceID *uuid.UUID `bun:"parent_resource_id,type:uuid"`
	MediaKind        string     `bun:"media_kind,notnull"`
	SourceType       string     `bun:"source_type,notnull"`
	LifecycleStatus  string     `bun:"lifecycle_status,notnull"`
	DisplayName      string     `bun:"display_name,notnull"`
	OriginalName     string     `bun:"original_name,notnull"`
	MIMEType         string     `bun:"mime_type,notnull"`
	FileExtension    string     `bun:"file_extension,notnull"`
	ChecksumSHA256   string     `bun:"checksum_sha256,notnull"`
	SizeBytes        int64      `bun:"size_bytes,notnull"`
	WidthPx          *int       `bun:"width_px"`
	HeightPx         *int       `bun:"height_px"`
	DurationMS       *int64     `bun:"duration_ms"`
	PageCount        *int       `bun:"page_count"`
	FrameRate        *float64   `bun:"frame_rate"`
	HasAudio         *bool      `bun:"has_audio"`
	Optimized        bool       `bun:"optimized,notnull"`
	StorageBackend   string     `bun:"storage_backend,notnull"`
	StorageKey       string     `bun:"storage_key,notnull"`
	TransformRecipe  string     `bun:"transform_recipe,notnull"`
	ProcessingError  *string    `bun:"processing_error"`
	CreatedByUserID  *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID  *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt        time.Time  `bun:"created_at,notnull"`
	UpdatedAt        time.Time  `bun:"updated_at,notnull"`
}

type ResourceReference struct {
	bun.BaseModel `bun:"table:resource_references"`

	ID          uuid.UUID `bun:"id,pk,type:uuid"`
	WorkspaceID uuid.UUID `bun:"workspace_id,notnull,type:uuid"`
	ResourceID  uuid.UUID `bun:"resource_id,notnull,type:uuid"`
	EntityType  string    `bun:"entity_type,notnull"`
	EntityID    string    `bun:"entity_id,notnull"`
	Slot        string    `bun:"slot,notnull"`
	Position    int       `bun:"position,notnull"`
	Metadata    string    `bun:"metadata,notnull"`
	CreatedAt   time.Time `bun:"created_at,notnull"`
	UpdatedAt   time.Time `bun:"updated_at,notnull"`
}

type ResourceSet struct {
	bun.BaseModel `bun:"table:resource_sets"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID     uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Name            string     `bun:"name,notnull"`
	Description     string     `bun:"description,notnull"`
	IntentType      string     `bun:"intent_type,notnull"`
	IntentPlatform  *string    `bun:"intent_platform"`
	IntentSurface   *string    `bun:"intent_surface"`
	CoverResourceID *uuid.UUID `bun:"cover_resource_id,type:uuid"`
	SourceType      string     `bun:"source_type,notnull"`
	Metadata        string     `bun:"metadata,notnull"`
	CreatedByUserID *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type ResourceSetItem struct {
	bun.BaseModel `bun:"table:resource_set_items"`

	ID            uuid.UUID `bun:"id,pk,type:uuid"`
	ResourceSetID uuid.UUID `bun:"resource_set_id,notnull,type:uuid"`
	ResourceID    uuid.UUID `bun:"resource_id,notnull,type:uuid"`
	Position      int       `bun:"position,notnull"`
	Role          string    `bun:"role,notnull"`
	Metadata      string    `bun:"metadata,notnull"`
	CreatedAt     time.Time `bun:"created_at,notnull"`
	UpdatedAt     time.Time `bun:"updated_at,notnull"`
}

type ResourceCleanupJob struct {
	bun.BaseModel `bun:"table:resource_cleanup_jobs"`

	ID             uuid.UUID `bun:"id,pk,type:uuid"`
	WorkspaceID    uuid.UUID `bun:"workspace_id,notnull,type:uuid"`
	ResourceID     uuid.UUID `bun:"resource_id,notnull,type:uuid"`
	StorageBackend string    `bun:"storage_backend,notnull"`
	Payload        string    `bun:"payload,notnull"`
	Status         string    `bun:"status,notnull"`
	AttemptCount   int       `bun:"attempt_count,notnull"`
	LastError      *string   `bun:"last_error"`
	CreatedAt      time.Time `bun:"created_at,notnull"`
	UpdatedAt      time.Time `bun:"updated_at,notnull"`
}

type Campaign struct {
	bun.BaseModel `bun:"table:campaigns"`

	ID                     uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID            uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Status                 string     `bun:"status,notnull"`
	Name                   string     `bun:"name,notnull"`
	Objective              string     `bun:"objective,notnull"`
	TargetAudience         string     `bun:"target_audience,notnull"`
	MessageTheme           string     `bun:"message_theme,notnull"`
	StartDate              time.Time  `bun:"start_date,notnull,type:date"`
	EndDate                *time.Time `bun:"end_date,type:date"`
	DefaultTimezone        string     `bun:"default_timezone,notnull"`
	Notes                  string     `bun:"notes,notnull"`
	PrimaryMetricLabel     string     `bun:"primary_metric_label,notnull"`
	PrimaryMetricTarget    *float64   `bun:"primary_metric_target"`
	PrimaryMetricUnit      string     `bun:"primary_metric_unit,notnull"`
	PaidChannels           string     `bun:"paid_channels,notnull"`
	BudgetAmountCents      *int64     `bun:"budget_amount_cents"`
	ActualSpendAmountCents *int64     `bun:"actual_spend_amount_cents"`
	CurrencyCode           string     `bun:"currency_code,notnull"`
	UTMCampaign            string     `bun:"utm_campaign,notnull"`
	ExternalDashboardURL   string     `bun:"external_dashboard_url,notnull"`
	CreatedByUserID        *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID        *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt              time.Time  `bun:"created_at,notnull"`
	UpdatedAt              time.Time  `bun:"updated_at,notnull"`
}

type CampaignDeliveryTarget struct {
	bun.BaseModel `bun:"table:campaign_delivery_targets"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	CampaignID      uuid.UUID  `bun:"campaign_id,notnull,type:uuid"`
	SocialTargetID  uuid.UUID  `bun:"social_target_id,notnull,type:uuid"`
	CreatedByUserID *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type CampaignScheduleRule struct {
	bun.BaseModel `bun:"table:campaign_schedule_rules"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	CampaignID      uuid.UUID  `bun:"campaign_id,notnull,type:uuid"`
	SocialTargetID  uuid.UUID  `bun:"social_target_id,notnull,type:uuid"`
	Enabled         bool       `bun:"enabled,notnull"`
	CadenceType     string     `bun:"cadence_type,notnull"`
	Interval        int        `bun:"interval,notnull"`
	Weekdays        string     `bun:"weekdays,notnull"`
	TimesLocal      string     `bun:"times_local,notnull"`
	StartDate       *time.Time `bun:"start_date,type:date"`
	EndDate         *time.Time `bun:"end_date,type:date"`
	CreatedByUserID *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type Post struct {
	bun.BaseModel `bun:"table:posts"`

	ID               uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID      uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	CampaignID       *uuid.UUID `bun:"campaign_id,type:uuid"`
	Title            string     `bun:"title,notnull"`
	ContentKind      string     `bun:"content_kind,notnull"`
	ContentPayload   string     `bun:"content_payload,notnull"`
	OriginPlatform   *string    `bun:"origin_platform"`
	OriginSurface    *string    `bun:"origin_surface"`
	RequiresApproval bool       `bun:"requires_approval,notnull"`
	Notes            string     `bun:"notes,notnull"`
	CreatedByUserID  *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID  *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt        time.Time  `bun:"created_at,notnull"`
	UpdatedAt        time.Time  `bun:"updated_at,notnull"`
}

type PostVariant struct {
	bun.BaseModel `bun:"table:post_variants"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID     uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	PostID          uuid.UUID  `bun:"post_id,notnull,type:uuid"`
	Platform        string     `bun:"platform,notnull"`
	Surface         string     `bun:"surface,notnull"`
	InheritSource   string     `bun:"inherit_source,notnull"`
	ContentMode     string     `bun:"content_mode,notnull"`
	ContentKind     *string    `bun:"content_kind"`
	ContentPayload  string     `bun:"content_payload,notnull"`
	AssetMode       string     `bun:"asset_mode,notnull"`
	ApprovalState   string     `bun:"approval_state,notnull"`
	Notes           string     `bun:"notes,notnull"`
	CreatedByUserID *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type PostVariantRemovedResource struct {
	bun.BaseModel `bun:"table:post_variant_removed_resources"`

	ID         uuid.UUID `bun:"id,pk,type:uuid"`
	VariantID  uuid.UUID `bun:"variant_id,notnull,type:uuid"`
	ResourceID uuid.UUID `bun:"resource_id,notnull,type:uuid"`
	CreatedAt  time.Time `bun:"created_at,notnull"`
}

type PostVariantReview struct {
	bun.BaseModel `bun:"table:post_variant_reviews"`

	ID            uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID   uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	VariantID     uuid.UUID  `bun:"variant_id,notnull,type:uuid"`
	ApprovalState string     `bun:"approval_state,notnull"`
	Decision      string     `bun:"decision,notnull"`
	Comment       string     `bun:"comment,notnull"`
	ActorUserID   *uuid.UUID `bun:"actor_user_id,type:uuid"`
	CreatedAt     time.Time  `bun:"created_at,notnull"`
}

type PostVariantPublication struct {
	bun.BaseModel `bun:"table:post_variant_publications"`

	ID                uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID       uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	VariantID         uuid.UUID  `bun:"variant_id,notnull,type:uuid"`
	SocialTargetID    *uuid.UUID `bun:"social_target_id,type:uuid"`
	PublicationState  string     `bun:"publication_state,notnull"`
	PlannedAt         *time.Time `bun:"planned_at"`
	PublishedAt       *time.Time `bun:"published_at"`
	ExternalPostID    *string    `bun:"external_post_id"`
	ExternalAccountID *string    `bun:"external_account_id"`
	Source            string     `bun:"source,notnull"`
	LastError         *string    `bun:"last_error"`
	Metadata          string     `bun:"metadata,notnull"`
	CreatedByUserID   *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID   *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt         time.Time  `bun:"created_at,notnull"`
	UpdatedAt         time.Time  `bun:"updated_at,notnull"`
}

type PostVariantTentativePlan struct {
	bun.BaseModel `bun:"table:post_variant_tentative_plans"`

	ID              uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID     uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	VariantID       uuid.UUID  `bun:"variant_id,notnull,type:uuid"`
	PlannedAt       time.Time  `bun:"planned_at,notnull"`
	Source          string     `bun:"source,notnull"`
	CreatedByUserID *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt       time.Time  `bun:"created_at,notnull"`
	UpdatedAt       time.Time  `bun:"updated_at,notnull"`
}

type MetricDefinition struct {
	bun.BaseModel `bun:"table:metric_definitions"`

	ID        uuid.UUID `bun:"id,pk,type:uuid"`
	Code      string    `bun:"code,notnull"`
	Label     string    `bun:"label,notnull"`
	Unit      string    `bun:"unit,notnull"`
	Rollup    string    `bun:"rollup,notnull"`
	Platform  *string   `bun:"platform"`
	Surface   *string   `bun:"surface"`
	CreatedAt time.Time `bun:"created_at,notnull"`
	UpdatedAt time.Time `bun:"updated_at,notnull"`
}

type MetricObservation struct {
	bun.BaseModel `bun:"table:metric_observations"`

	ID                 uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID        uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	PublicationID      uuid.UUID  `bun:"publication_id,notnull,type:uuid"`
	MetricDefinitionID uuid.UUID  `bun:"metric_definition_id,notnull,type:uuid"`
	ObservedAt         time.Time  `bun:"observed_at,notnull"`
	Value              float64    `bun:"value,notnull"`
	Source             string     `bun:"source,notnull"`
	Metadata           string     `bun:"metadata,notnull"`
	CreatedByUserID    *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	CreatedAt          time.Time  `bun:"created_at,notnull"`
}

type ProviderAppCredential struct {
	bun.BaseModel `bun:"table:provider_app_credentials"`

	ID                     uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID            uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Provider               string     `bun:"provider,notnull"`
	Source                 string     `bun:"source,notnull"`
	Status                 string     `bun:"status,notnull"`
	ClientID               string     `bun:"client_id,notnull"`
	ClientSecretCiphertext string     `bun:"client_secret_ciphertext,notnull"`
	ClientSecretHint       string     `bun:"client_secret_hint,notnull"`
	Metadata               string     `bun:"metadata,notnull"`
	CreatedByUserID        *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID        *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt              time.Time  `bun:"created_at,notnull"`
	UpdatedAt              time.Time  `bun:"updated_at,notnull"`
}

type SocialOAuthState struct {
	bun.BaseModel `bun:"table:social_oauth_states"`

	ID                   uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID          uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Provider             string     `bun:"provider,notnull"`
	CredentialSource     string     `bun:"credential_source,notnull"`
	ProviderCredentialID *uuid.UUID `bun:"provider_credential_id,type:uuid"`
	StateToken           string     `bun:"state_token,notnull"`
	CodeVerifier         *string    `bun:"code_verifier"`
	ReturnOrigin         string     `bun:"return_origin,notnull"`
	ReturnPath           string     `bun:"return_path,notnull"`
	Status               string     `bun:"status,notnull"`
	ExpiresAt            time.Time  `bun:"expires_at,notnull"`
	CreatedByUserID      *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	CreatedAt            time.Time  `bun:"created_at,notnull"`
}

type SocialConnection struct {
	bun.BaseModel `bun:"table:social_connections"`

	ID                     uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID            uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Provider               string     `bun:"provider,notnull"`
	CredentialSource       string     `bun:"credential_source,notnull"`
	ProviderCredentialID   *uuid.UUID `bun:"provider_credential_id,type:uuid"`
	Status                 string     `bun:"status,notnull"`
	HealthStatus           string     `bun:"health_status,notnull"`
	AuthSubjectID          string     `bun:"auth_subject_id,notnull"`
	AuthSubjectName        string     `bun:"auth_subject_name,notnull"`
	AccessTokenCiphertext  string     `bun:"access_token_ciphertext,notnull"`
	RefreshTokenCiphertext string     `bun:"refresh_token_ciphertext,notnull"`
	TokenType              string     `bun:"token_type,notnull"`
	Scopes                 string     `bun:"scopes,notnull"`
	Metadata               string     `bun:"metadata,notnull"`
	AccessTokenExpiresAt   *time.Time `bun:"access_token_expires_at"`
	LastValidatedAt        *time.Time `bun:"last_validated_at"`
	LastValidationError    *string    `bun:"last_validation_error"`
	ConnectedAt            time.Time  `bun:"connected_at,notnull"`
	CreatedByUserID        *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID        *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt              time.Time  `bun:"created_at,notnull"`
	UpdatedAt              time.Time  `bun:"updated_at,notnull"`
}

type SocialTarget struct {
	bun.BaseModel `bun:"table:social_targets"`

	ID                    uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID           uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	ConnectionID          uuid.UUID  `bun:"connection_id,notnull,type:uuid"`
	Provider              string     `bun:"provider,notnull"`
	ExternalAccountID     string     `bun:"external_account_id,notnull"`
	ExternalParentID      *string    `bun:"external_parent_id"`
	DisplayName           string     `bun:"display_name,notnull"`
	Username              *string    `bun:"username"`
	TargetType            string     `bun:"target_type,notnull"`
	AccountClassification string     `bun:"account_classification,notnull"`
	Status                string     `bun:"status,notnull"`
	IsSelected            bool       `bun:"is_selected,notnull"`
	ScopeSnapshot         string     `bun:"scope_snapshot,notnull"`
	CapabilitySnapshot    string     `bun:"capability_snapshot,notnull"`
	Metadata              string     `bun:"metadata,notnull"`
	LastValidatedAt       *time.Time `bun:"last_validated_at"`
	LastValidationError   *string    `bun:"last_validation_error"`
	CreatedAt             time.Time  `bun:"created_at,notnull"`
	UpdatedAt             time.Time  `bun:"updated_at,notnull"`
}

type WorkspaceBusinessContext struct {
	bun.BaseModel `bun:"table:workspace_business_contexts"`

	WorkspaceID        uuid.UUID `bun:"workspace_id,pk,type:uuid"`
	Narrative          string    `bun:"narrative,notnull"`
	Summary            string    `bun:"summary,notnull"`
	UnderstandingScore int       `bun:"understanding_score,notnull"`
	MissingGaps        string    `bun:"missing_gaps,notnull"`
	DecisionFacts      string    `bun:"decision_facts,notnull"`
	ExtractorVersion   string    `bun:"extractor_version,notnull"`
	SourceHash         string    `bun:"source_hash,notnull"`
	CreatedAt          time.Time `bun:"created_at,notnull"`
	UpdatedAt          time.Time `bun:"updated_at,notnull"`
}

type WorkspaceBrandContext struct {
	bun.BaseModel `bun:"table:workspace_brand_contexts"`

	WorkspaceID         uuid.UUID  `bun:"workspace_id,pk,type:uuid"`
	Narrative           string     `bun:"narrative,notnull"`
	Summary             string     `bun:"summary,notnull"`
	DesignTokens        string     `bun:"design_tokens,notnull"`
	VisualGuardrails    string     `bun:"visual_guardrails,notnull"`
	MissingGaps         string     `bun:"missing_gaps,notnull"`
	ReferenceResourceID *uuid.UUID `bun:"reference_resource_id,type:uuid"`
	ProcessingStatus    string     `bun:"processing_status,notnull"`
	ExtractorVersion    string     `bun:"extractor_version,notnull"`
	SourceHash          string     `bun:"source_hash,notnull"`
	CreatedAt           time.Time  `bun:"created_at,notnull"`
	UpdatedAt           time.Time  `bun:"updated_at,notnull"`
}

type WorkspaceContextCache struct {
	bun.BaseModel `bun:"table:workspace_context_caches"`

	WorkspaceID       uuid.UUID `bun:"workspace_id,pk,type:uuid"`
	UseCase           string    `bun:"use_case,pk"`
	Payload           string    `bun:"payload,notnull"`
	SourceFingerprint string    `bun:"source_fingerprint,notnull"`
	UpdatedAt         time.Time `bun:"updated_at,notnull"`
}

type WorkspaceAISettings struct {
	bun.BaseModel `bun:"table:workspace_ai_settings"`

	WorkspaceID         uuid.UUID `bun:"workspace_id,pk,type:uuid"`
	DefaultMode         string    `bun:"default_mode,notnull"`
	CapabilityDefaults  string    `bun:"capability_defaults,notnull"`
	FallbackPoolEnabled bool      `bun:"fallback_pool_enabled,notnull"`
	UsagePolicy         string    `bun:"usage_policy,notnull"`
	CreatedAt           time.Time `bun:"created_at,notnull"`
	UpdatedAt           time.Time `bun:"updated_at,notnull"`
}

type WorkspaceAICredential struct {
	bun.BaseModel `bun:"table:workspace_ai_credentials"`

	ID               uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID      uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	Provider         string     `bun:"provider,notnull"`
	Position         int        `bun:"position,notnull"`
	Status           string     `bun:"status,notnull"`
	APIKeyCiphertext string     `bun:"api_key_ciphertext,notnull"`
	APIKeyHint       string     `bun:"api_key_hint,notnull"`
	AllowedModels    string     `bun:"allowed_models,notnull"`
	Metadata         string     `bun:"metadata,notnull"`
	CreatedByUserID  *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	UpdatedByUserID  *uuid.UUID `bun:"updated_by_user_id,type:uuid"`
	CreatedAt        time.Time  `bun:"created_at,notnull"`
	UpdatedAt        time.Time  `bun:"updated_at,notnull"`
}

type AIRunEvent struct {
	bun.BaseModel `bun:"table:ai_run_events"`

	ID                  uuid.UUID  `bun:"id,pk,type:uuid"`
	WorkspaceID         uuid.UUID  `bun:"workspace_id,notnull,type:uuid"`
	UseCase             string     `bun:"use_case,notnull"`
	Provider            string     `bun:"provider,notnull"`
	Model               string     `bun:"model,notnull"`
	CredentialMode      string     `bun:"credential_mode,notnull"`
	CredentialID        *uuid.UUID `bun:"credential_id,type:uuid"`
	ContextFingerprint  string     `bun:"context_fingerprint,notnull"`
	SourceEntityType    string     `bun:"source_entity_type,notnull"`
	SourceEntityID      string     `bun:"source_entity_id,notnull"`
	Status              string     `bun:"status,notnull"`
	PromptTokens        *int       `bun:"prompt_tokens"`
	CompletionTokens    *int       `bun:"completion_tokens"`
	TotalTokens         *int       `bun:"total_tokens"`
	EstimatedCostMicros *int64     `bun:"estimated_cost_micros"`
	RequestPayload      string     `bun:"request_payload,notnull"`
	ResponsePayload     string     `bun:"response_payload,notnull"`
	ErrorText           *string    `bun:"error_text"`
	CreatedByUserID     *uuid.UUID `bun:"created_by_user_id,type:uuid"`
	CreatedAt           time.Time  `bun:"created_at,notnull"`
}
