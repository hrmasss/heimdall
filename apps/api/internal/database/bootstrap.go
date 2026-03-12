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

type metricDefinitionSeed struct {
	Code     string
	Label    string
	Unit     string
	Rollup   string
	Platform string
	Surface  string
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

var metricDefinitionSeeds = []metricDefinitionSeed{
	{Code: "impressions", Label: "Impressions", Unit: "count", Rollup: "sum"},
	{Code: "reach", Label: "Reach", Unit: "count", Rollup: "sum"},
	{Code: "engagements", Label: "Engagements", Unit: "count", Rollup: "sum"},
	{Code: "clicks", Label: "Clicks", Unit: "count", Rollup: "sum"},
	{Code: "likes", Label: "Likes", Unit: "count", Rollup: "sum"},
	{Code: "comments", Label: "Comments", Unit: "count", Rollup: "sum"},
	{Code: "shares", Label: "Shares", Unit: "count", Rollup: "sum"},
	{Code: "saves", Label: "Saves", Unit: "count", Rollup: "sum"},
	{Code: "engagement_rate", Label: "Engagement Rate", Unit: "ratio", Rollup: "latest"},
	{Code: "video_views", Label: "Video Views", Unit: "count", Rollup: "sum"},
	{Code: "video_completion_rate", Label: "Video Completion Rate", Unit: "ratio", Rollup: "latest"},
	{Code: "document_opens", Label: "Document Opens", Unit: "count", Rollup: "sum", Platform: "linkedin", Surface: "document_post"},
	{Code: "reposts", Label: "Reposts", Unit: "count", Rollup: "sum", Platform: "x", Surface: "image_post"},
	{Code: "reposts", Label: "Reposts", Unit: "count", Rollup: "sum", Platform: "x", Surface: "video_post"},
	{Code: "thread_reads", Label: "Thread Reads", Unit: "count", Rollup: "sum", Platform: "x", Surface: "image_post"},
	{Code: "thread_reads", Label: "Thread Reads", Unit: "count", Rollup: "sum", Platform: "x", Surface: "video_post"},
	{Code: "profile_visits", Label: "Profile Visits", Unit: "count", Rollup: "sum", Platform: "instagram", Surface: "feed_photo"},
	{Code: "profile_visits", Label: "Profile Visits", Unit: "count", Rollup: "sum", Platform: "instagram", Surface: "carousel"},
	{Code: "profile_visits", Label: "Profile Visits", Unit: "count", Rollup: "sum", Platform: "instagram", Surface: "reel"},
	{Code: "watch_time_ms", Label: "Watch Time", Unit: "ms", Rollup: "sum", Platform: "youtube", Surface: "video"},
	{Code: "watch_time_ms", Label: "Watch Time", Unit: "ms", Rollup: "sum", Platform: "youtube", Surface: "short"},
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
	`CREATE TABLE IF NOT EXISTS posts (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		title text NOT NULL,
		content_kind text NOT NULL,
		content_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
		origin_platform text,
		origin_surface text,
		notes text NOT NULL DEFAULT '',
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_posts_workspace_updated ON posts (workspace_id, updated_at DESC)`,
	`CREATE TABLE IF NOT EXISTS post_variants (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
		platform text NOT NULL,
		surface text NOT NULL,
		content_mode text NOT NULL DEFAULT 'inherit',
		content_kind text,
		content_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
		asset_mode text NOT NULL DEFAULT 'inherit',
		approval_state text NOT NULL DEFAULT 'draft',
		notes text NOT NULL DEFAULT '',
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (workspace_id, post_id, platform, surface)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_post_variants_post_updated ON post_variants (post_id, updated_at DESC)`,
	`CREATE TABLE IF NOT EXISTS post_variant_removed_resources (
		id uuid PRIMARY KEY,
		variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
		resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
		created_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (variant_id, resource_id)
	)`,
	`CREATE TABLE IF NOT EXISTS post_variant_reviews (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
		approval_state text NOT NULL,
		decision text NOT NULL,
		comment text NOT NULL DEFAULT '',
		actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_post_variant_reviews_variant_created ON post_variant_reviews (variant_id, created_at DESC)`,
	`CREATE TABLE IF NOT EXISTS post_variant_publications (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
		publication_state text NOT NULL DEFAULT 'unscheduled',
		planned_at timestamptz,
		published_at timestamptz,
		external_post_id text,
		external_account_id text,
		source text NOT NULL DEFAULT 'manual',
		last_error text,
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (variant_id)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_post_variant_publications_workspace_planned ON post_variant_publications (workspace_id, planned_at ASC)`,
	`CREATE TABLE IF NOT EXISTS metric_definitions (
		id uuid PRIMARY KEY,
		code text NOT NULL,
		label text NOT NULL,
		unit text NOT NULL,
		rollup text NOT NULL DEFAULT 'sum',
		platform text,
		surface text,
		created_at timestamptz NOT NULL DEFAULT now(),
		updated_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE NULLS NOT DISTINCT (code, platform, surface)
	)`,
	`CREATE INDEX IF NOT EXISTS idx_metric_definitions_scope ON metric_definitions (platform, surface, code)`,
	`CREATE TABLE IF NOT EXISTS metric_observations (
		id uuid PRIMARY KEY,
		workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
		publication_id uuid NOT NULL REFERENCES post_variant_publications(id) ON DELETE CASCADE,
		metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
		observed_at timestamptz NOT NULL,
		value double precision NOT NULL,
		source text NOT NULL DEFAULT 'manual',
		metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
		created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
		created_at timestamptz NOT NULL DEFAULT now()
	)`,
	`CREATE INDEX IF NOT EXISTS idx_metric_observations_publication_metric_observed ON metric_observations (publication_id, metric_definition_id, observed_at DESC)`,
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
	if err := seedMetricDefinitions(ctx, db); err != nil {
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

func seedMetricDefinitions(ctx context.Context, db *bun.DB) error {
	for _, seed := range metricDefinitionSeeds {
		var existing MetricDefinition
		query := db.NewSelect().
			Model(&existing).
			Where("code = ?", seed.Code)
		if seed.Platform == "" {
			query = query.Where("platform IS NULL")
		} else {
			query = query.Where("platform = ?", seed.Platform)
		}
		if seed.Surface == "" {
			query = query.Where("surface IS NULL")
		} else {
			query = query.Where("surface = ?", seed.Surface)
		}
		err := query.Limit(1).Scan(ctx)

		now := time.Now().UTC()
		if err == nil {
			existing.Label = seed.Label
			existing.Unit = seed.Unit
			existing.Rollup = seed.Rollup
			if seed.Platform == "" {
				existing.Platform = nil
			} else {
				existing.Platform = &seed.Platform
			}
			if seed.Surface == "" {
				existing.Surface = nil
			} else {
				existing.Surface = &seed.Surface
			}
			existing.UpdatedAt = now
			if _, err := db.NewUpdate().
				Model(&existing).
				Column("label", "unit", "rollup", "platform", "surface", "updated_at").
				WherePK().
				Exec(ctx); err != nil {
				return fmt.Errorf("update metric definition %s: %w", seed.Code, err)
			}
			continue
		}

		record := MetricDefinition{
			ID:        uuid.New(),
			Code:      seed.Code,
			Label:     seed.Label,
			Unit:      seed.Unit,
			Rollup:    seed.Rollup,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if seed.Platform != "" {
			record.Platform = &seed.Platform
		}
		if seed.Surface != "" {
			record.Surface = &seed.Surface
		}
		if _, err := db.NewInsert().Model(&record).Exec(ctx); err != nil {
			return fmt.Errorf("insert metric definition %s: %w", seed.Code, err)
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
