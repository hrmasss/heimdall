package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/uptrace/bun"

	"github.com/heimdall/api/internal/auth"
	"github.com/heimdall/api/internal/config"
)

type permissionSeed struct {
	Code        string
	Label       string
	Scope       string
	Description string
}

type roleSeed struct {
	Code            string
	Label           string
	Scope           string
	PermissionCodes []string
}

var permissionSeeds = []permissionSeed{
	{Code: "workspace.members.view", Label: "View members", Scope: "workspace", Description: "View workspace members"},
	{Code: "workspace.members.manage", Label: "Manage members", Scope: "workspace", Description: "Invite and manage workspace members"},
	{Code: "workspace.settings.view", Label: "View workspace settings", Scope: "workspace", Description: "View workspace settings"},
	{Code: "workspace.settings.manage", Label: "Manage workspace settings", Scope: "workspace", Description: "Update workspace settings"},
	{Code: "workspace.billing.view", Label: "View billing", Scope: "workspace", Description: "View workspace billing details"},
	{Code: "workspace.billing.manage", Label: "Manage billing", Scope: "workspace", Description: "Update workspace billing settings"},
	{Code: "content.posts.view", Label: "View posts", Scope: "workspace", Description: "View posts and calendar entries"},
	{Code: "content.posts.manage", Label: "Manage posts", Scope: "workspace", Description: "Create and edit posts"},
	{Code: "content.posts.publish", Label: "Publish posts", Scope: "workspace", Description: "Approve and publish posts"},
	{Code: "content.resources.view", Label: "View resources", Scope: "workspace", Description: "View workspace resource library"},
	{Code: "content.resources.manage", Label: "Manage resources", Scope: "workspace", Description: "Upload and manage workspace resources"},
	{Code: "analytics.view", Label: "View analytics", Scope: "workspace", Description: "View analytics"},
	{Code: "analytics.export", Label: "Export analytics", Scope: "workspace", Description: "Export analytics data"},
	{Code: "automations.view", Label: "View automations", Scope: "workspace", Description: "View automations"},
	{Code: "automations.manage", Label: "Manage automations", Scope: "workspace", Description: "Create and edit automations"},
	{Code: "platform.users.view", Label: "View platform users", Scope: "platform", Description: "View platform user directory"},
	{Code: "platform.users.manage", Label: "Manage platform users", Scope: "platform", Description: "Update platform users"},
	{Code: "platform.workspaces.view", Label: "View workspaces", Scope: "platform", Description: "View workspaces"},
	{Code: "platform.workspaces.manage", Label: "Manage workspaces", Scope: "platform", Description: "Create and update workspaces"},
	{Code: "platform.subscriptions.view", Label: "View subscriptions", Scope: "platform", Description: "View subscriptions"},
	{Code: "platform.subscriptions.manage", Label: "Manage subscriptions", Scope: "platform", Description: "Manage subscriptions"},
	{Code: "platform.support.assume_workspace", Label: "Assume workspace", Scope: "platform", Description: "Assume customer workspace access"},
	{Code: "platform.support.assume_user", Label: "Impersonate users", Scope: "platform", Description: "Impersonate customer users for support"},
	{Code: "platform.audit.view", Label: "View audit logs", Scope: "platform", Description: "View audit logs"},
	{Code: "platform.settings.view", Label: "View platform settings", Scope: "platform", Description: "View platform settings"},
	{Code: "platform.settings.manage", Label: "Manage platform settings", Scope: "platform", Description: "Manage platform settings"},
}

var roleSeeds = []roleSeed{
	{
		Code:  "workspace_owner",
		Label: "Workspace Owner",
		Scope: "workspace",
		PermissionCodes: []string{
			"workspace.members.view", "workspace.members.manage",
			"workspace.settings.view", "workspace.settings.manage",
			"workspace.billing.view", "workspace.billing.manage",
			"content.posts.view", "content.posts.manage", "content.posts.publish",
			"content.resources.view", "content.resources.manage",
			"analytics.view", "analytics.export",
			"automations.view", "automations.manage",
		},
	},
	{
		Code:  "workspace_admin",
		Label: "Workspace Admin",
		Scope: "workspace",
		PermissionCodes: []string{
			"workspace.members.view", "workspace.members.manage",
			"workspace.settings.view", "workspace.settings.manage",
			"workspace.billing.view",
			"content.posts.view", "content.posts.manage", "content.posts.publish",
			"content.resources.view", "content.resources.manage",
			"analytics.view", "analytics.export",
			"automations.view", "automations.manage",
		},
	},
	{
		Code:  "content_manager",
		Label: "Content Manager",
		Scope: "workspace",
		PermissionCodes: []string{
			"workspace.members.view",
			"workspace.settings.view",
			"content.posts.view", "content.posts.manage", "content.posts.publish",
			"content.resources.view", "content.resources.manage",
			"analytics.view",
			"automations.view", "automations.manage",
		},
	},
	{
		Code:  "analyst",
		Label: "Analyst",
		Scope: "workspace",
		PermissionCodes: []string{
			"content.posts.view",
			"content.resources.view",
			"analytics.view", "analytics.export",
			"automations.view",
		},
	},
	{
		Code:  "billing_manager",
		Label: "Billing Manager",
		Scope: "workspace",
		PermissionCodes: []string{
			"workspace.settings.view",
			"workspace.billing.view", "workspace.billing.manage",
		},
	},
	{
		Code:  "super_admin",
		Label: "Super Admin",
		Scope: "platform",
		PermissionCodes: []string{
			"platform.users.view", "platform.users.manage",
			"platform.workspaces.view", "platform.workspaces.manage",
			"platform.subscriptions.view", "platform.subscriptions.manage",
			"platform.support.assume_workspace", "platform.support.assume_user",
			"platform.audit.view",
			"platform.settings.view", "platform.settings.manage",
		},
	},
	{
		Code:  "ops_admin",
		Label: "Ops Admin",
		Scope: "platform",
		PermissionCodes: []string{
			"platform.users.view", "platform.users.manage",
			"platform.workspaces.view", "platform.workspaces.manage",
			"platform.subscriptions.view", "platform.subscriptions.manage",
			"platform.support.assume_user",
			"platform.audit.view",
		},
	},
	{
		Code:  "support_agent",
		Label: "Support Agent",
		Scope: "platform",
		PermissionCodes: []string{
			"platform.users.view",
			"platform.workspaces.view",
			"platform.support.assume_workspace", "platform.support.assume_user",
			"platform.audit.view",
		},
	},
}

var schemaStatements = []string{
	`CREATE TABLE IF NOT EXISTS users (
		id uuid PRIMARY KEY,
		email text NOT NULL UNIQUE,
		full_name text NOT NULL,
		password_hash text NOT NULL,
		status text NOT NULL DEFAULT 'active',
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS workspaces (
		id uuid PRIMARY KEY,
		name text NOT NULL,
		slug text NOT NULL UNIQUE,
		status text NOT NULL DEFAULT 'active',
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS workspace_memberships (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		status text NOT NULL DEFAULT 'active',
		invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (workspace_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS roles (
		id uuid PRIMARY KEY,
		code text NOT NULL UNIQUE,
		label text NOT NULL,
		scope text NOT NULL,
		system boolean NOT NULL DEFAULT true,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS permissions (
		id uuid PRIMARY KEY,
		code text NOT NULL UNIQUE,
		label text NOT NULL,
		scope text NOT NULL,
		description text NOT NULL DEFAULT '',
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS role_permissions (
		role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
		permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
		PRIMARY KEY (role_id, permission_id)
	)`,
	`CREATE TABLE IF NOT EXISTS workspace_membership_roles (
		membership_id uuid NOT NULL REFERENCES workspace_memberships(id) ON DELETE CASCADE,
		role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
		PRIMARY KEY (membership_id, role_id)
	)`,
	`CREATE TABLE IF NOT EXISTS platform_user_roles (
		user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
		PRIMARY KEY (user_id, role_id)
	)`,
	`CREATE TABLE IF NOT EXISTS workspace_invites (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		email text NOT NULL,
		token_hash text NOT NULL UNIQUE,
		status text NOT NULL DEFAULT 'pending',
		invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		expires_at timestamptz NOT NULL,
		accepted_at timestamptz,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS workspace_invite_roles (
		invite_id uuid NOT NULL REFERENCES workspace_invites(id) ON DELETE CASCADE,
		role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
		PRIMARY KEY (invite_id, role_id)
	)`,
	`CREATE TABLE IF NOT EXISTS auth_sessions (
		id uuid PRIMARY KEY,
		user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		impersonator_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		scope text NOT NULL,
		refresh_token_hash text NOT NULL UNIQUE,
		expires_at timestamptz NOT NULL,
		revoked_at timestamptz,
		assumed_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS audit_logs (
		id uuid PRIMARY KEY,
		actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		action text NOT NULL,
		target_type text NOT NULL,
		target_id text,
		workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS resources (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		parent_resource_id uuid REFERENCES resources(id) ON DELETE RESTRICT,
		media_kind text NOT NULL,
		source_type text NOT NULL DEFAULT 'upload',
		lifecycle_status text NOT NULL DEFAULT 'ready',
		display_name text NOT NULL,
		original_name text NOT NULL,
		mime_type text NOT NULL,
		file_extension text NOT NULL DEFAULT '',
		checksum_sha256 text NOT NULL,
		size_bytes bigint NOT NULL,
		width_px integer,
		height_px integer,
		duration_ms bigint,
		page_count integer,
		frame_rate double precision,
		has_audio boolean,
		optimized boolean NOT NULL DEFAULT false,
		storage_backend text NOT NULL,
		storage_key text NOT NULL UNIQUE,
		transform_recipe jsonb NOT NULL DEFAULT '{}'::jsonb,
		processing_error text,
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_resources_workspace_created ON resources (workspace_id, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_resources_parent ON resources (parent_resource_id)`,
	`CREATE TABLE IF NOT EXISTS resource_sets (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		name text NOT NULL,
		description text NOT NULL DEFAULT '',
		intent_type text NOT NULL DEFAULT 'generic',
		intent_platform text,
		intent_surface text,
		cover_resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
		source_type text NOT NULL DEFAULT 'manual',
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_sets_workspace_created ON resource_sets (workspace_id, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_sets_cover_resource ON resource_sets (cover_resource_id)`,
	`CREATE TABLE IF NOT EXISTS resource_set_items (
		id uuid PRIMARY KEY,
		resource_set_id uuid NOT NULL REFERENCES resource_sets(id) ON DELETE CASCADE,
		resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
		position integer NOT NULL DEFAULT 0,
		role text NOT NULL DEFAULT '',
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (resource_set_id, position),
		UNIQUE (resource_set_id, resource_id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_set_items_set_position ON resource_set_items (resource_set_id, position ASC)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_set_items_resource ON resource_set_items (resource_id)`,
	`CREATE TABLE IF NOT EXISTS resource_references (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
		entity_type text NOT NULL,
		entity_id text NOT NULL,
		slot text NOT NULL,
		position integer NOT NULL DEFAULT 0,
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (workspace_id, entity_type, entity_id, slot, position)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_references_resource ON resource_references (resource_id)`,
	`CREATE TABLE IF NOT EXISTS resource_cleanup_jobs (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
		storage_backend text NOT NULL,
		payload jsonb NOT NULL DEFAULT '{}'::jsonb,
		status text NOT NULL DEFAULT 'pending',
		attempt_count integer NOT NULL DEFAULT 0,
		last_error text,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_resource_cleanup_jobs_status_created ON resource_cleanup_jobs (status, created_at ASC)`,
}

// Bootstrap creates the schema and seeds system permissions/roles/admin.
func Bootstrap(ctx context.Context, db *bun.DB, cfg *config.Config) error {
	for _, statement := range schemaStatements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return fmt.Errorf("exec schema statement: %w", err)
		}
	}
	if _, err := db.ExecContext(ctx, `ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS impersonator_user_id uuid REFERENCES users(id) ON DELETE SET NULL`); err != nil {
		return fmt.Errorf("ensure auth_sessions.impersonator_user_id: %w", err)
	}

	if err := seedPermissions(ctx, db); err != nil {
		return err
	}
	if err := seedRoles(ctx, db); err != nil {
		return err
	}
	if err := seedBootstrapAdmin(ctx, db, cfg); err != nil {
		return err
	}

	return nil
}

func seedPermissions(ctx context.Context, db *bun.DB) error {
	for _, seed := range permissionSeeds {
		var existing Permission
		err := db.NewSelect().
			Model(&existing).
			Where("code = ?", seed.Code).
			Limit(1).
			Scan(ctx)
		if err == nil {
			_, err = db.NewUpdate().
				Model(&Permission{}).
				Set("label = ?", seed.Label).
				Set("scope = ?", seed.Scope).
				Set("description = ?", seed.Description).
				Where("id = ?", existing.ID).
				Exec(ctx)
			if err != nil {
				return fmt.Errorf("update permission %s: %w", seed.Code, err)
			}
			continue
		}

		permission := Permission{
			ID:          uuid.New(),
			Code:        seed.Code,
			Label:       seed.Label,
			Scope:       seed.Scope,
			Description: seed.Description,
			CreatedAt:   time.Now().UTC(),
		}
		if _, err = db.NewInsert().Model(&permission).Exec(ctx); err != nil {
			return fmt.Errorf("insert permission %s: %w", seed.Code, err)
		}
	}
	return nil
}

func seedRoles(ctx context.Context, db *bun.DB) error {
	permissionIDs := map[string]uuid.UUID{}
	var permissions []Permission
	if err := db.NewSelect().Model(&permissions).Scan(ctx); err != nil {
		return fmt.Errorf("load permissions: %w", err)
	}
	for _, permission := range permissions {
		permissionIDs[permission.Code] = permission.ID
	}

	for _, seed := range roleSeeds {
		var role Role
		err := db.NewSelect().
			Model(&role).
			Where("code = ?", seed.Code).
			Limit(1).
			Scan(ctx)
		if err != nil {
			role = Role{
				ID:        uuid.New(),
				Code:      seed.Code,
				Label:     seed.Label,
				Scope:     seed.Scope,
				System:    true,
				CreatedAt: time.Now().UTC(),
			}
			if _, err = db.NewInsert().Model(&role).Exec(ctx); err != nil {
				return fmt.Errorf("insert role %s: %w", seed.Code, err)
			}
		} else {
			if _, err = db.NewUpdate().
				Model(&Role{}).
				Set("label = ?", seed.Label).
				Set("scope = ?", seed.Scope).
				Set("system = ?", true).
				Where("id = ?", role.ID).
				Exec(ctx); err != nil {
				return fmt.Errorf("update role %s: %w", seed.Code, err)
			}
		}

		if _, err = db.NewDelete().Model((*RolePermission)(nil)).Where("role_id = ?", role.ID).Exec(ctx); err != nil {
			return fmt.Errorf("reset role permissions %s: %w", seed.Code, err)
		}

		for _, permissionCode := range seed.PermissionCodes {
			permissionID, ok := permissionIDs[permissionCode]
			if !ok {
				return fmt.Errorf("permission %s not found for role %s", permissionCode, seed.Code)
			}
			link := RolePermission{RoleID: role.ID, PermissionID: permissionID}
			if _, err = db.NewInsert().Model(&link).Exec(ctx); err != nil {
				return fmt.Errorf("link role %s to permission %s: %w", seed.Code, permissionCode, err)
			}
		}
	}

	return nil
}

func seedBootstrapAdmin(ctx context.Context, db *bun.DB, cfg *config.Config) error {
	if cfg.Bootstrap.AdminEmail == "" || cfg.Bootstrap.AdminPassword == "" {
		return nil
	}

	var superAdminRole Role
	if err := db.NewSelect().
		Model(&superAdminRole).
		Where("code = ?", "super_admin").
		Limit(1).
		Scan(ctx); err != nil {
		return fmt.Errorf("load super admin role: %w", err)
	}

	count, err := db.NewSelect().
		Model((*PlatformUserRole)(nil)).
		Where("role_id = ?", superAdminRole.ID).
		Count(ctx)
	if err != nil {
		return fmt.Errorf("count super admins: %w", err)
	}
	if count > 0 {
		return nil
	}

	passwordHash, err := auth.HashPassword(cfg.Bootstrap.AdminPassword)
	if err != nil {
		return fmt.Errorf("hash bootstrap admin password: %w", err)
	}

	var user User
	err = db.NewSelect().
		Model(&user).
		Where("email = ?", cfg.Bootstrap.AdminEmail).
		Limit(1).
		Scan(ctx)
	if err != nil {
		user = User{
			ID:           uuid.New(),
			Email:        cfg.Bootstrap.AdminEmail,
			FullName:     cfg.Bootstrap.AdminName,
			PasswordHash: passwordHash,
			Status:       "active",
			CreatedAt:    time.Now().UTC(),
			UpdatedAt:    time.Now().UTC(),
		}
		if _, err = db.NewInsert().Model(&user).Exec(ctx); err != nil {
			return fmt.Errorf("insert bootstrap admin: %w", err)
		}
	}

	link := PlatformUserRole{UserID: user.ID, RoleID: superAdminRole.ID}
	if _, err = db.NewInsert().Model(&link).Ignore().Exec(ctx); err != nil {
		return fmt.Errorf("link bootstrap admin role: %w", err)
	}
	return nil
}
