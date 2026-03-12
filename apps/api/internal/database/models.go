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

	ID        uuid.UUID `bun:"id,pk,type:uuid"`
	Name      string    `bun:"name,notnull"`
	Slug      string    `bun:"slug,notnull"`
	Status    string    `bun:"status,notnull"`
	CreatedAt time.Time `bun:"created_at,notnull"`
	UpdatedAt time.Time `bun:"updated_at,notnull"`
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
