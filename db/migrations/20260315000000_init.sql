CREATE TABLE IF NOT EXISTS users (
	id uuid PRIMARY KEY,
	email text NOT NULL UNIQUE,
	full_name text NOT NULL,
	password_hash text NOT NULL,
	status text NOT NULL DEFAULT 'active',
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
	id uuid PRIMARY KEY,
	name text NOT NULL,
	slug text NOT NULL UNIQUE,
	status text NOT NULL DEFAULT 'active',
	require_post_approval boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'active',
	invited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS roles (
	id uuid PRIMARY KEY,
	code text NOT NULL UNIQUE,
	label text NOT NULL,
	scope text NOT NULL,
	system boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
	id uuid PRIMARY KEY,
	code text NOT NULL UNIQUE,
	label text NOT NULL,
	scope text NOT NULL,
	description text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
	role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
	PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS workspace_membership_roles (
	membership_id uuid NOT NULL REFERENCES workspace_memberships(id) ON DELETE CASCADE,
	role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	PRIMARY KEY (membership_id, role_id)
);

CREATE TABLE IF NOT EXISTS platform_user_roles (
	user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS workspace_invites (
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
);

CREATE TABLE IF NOT EXISTS workspace_invite_roles (
	invite_id uuid NOT NULL REFERENCES workspace_invites(id) ON DELETE CASCADE,
	role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	PRIMARY KEY (invite_id, role_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
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
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id uuid PRIMARY KEY,
	actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	action text NOT NULL,
	target_type text NOT NULL,
	target_id text,
	workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
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
);

CREATE INDEX IF NOT EXISTS idx_resources_workspace_created ON resources (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_parent ON resources (parent_resource_id);

CREATE TABLE IF NOT EXISTS resource_sets (
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
);

CREATE INDEX IF NOT EXISTS idx_resource_sets_workspace_created ON resource_sets (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_sets_cover_resource ON resource_sets (cover_resource_id);

CREATE TABLE IF NOT EXISTS resource_set_items (
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
);

CREATE INDEX IF NOT EXISTS idx_resource_set_items_set_position ON resource_set_items (resource_set_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_resource_set_items_resource ON resource_set_items (resource_id);

CREATE TABLE IF NOT EXISTS resource_references (
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
);

CREATE INDEX IF NOT EXISTS idx_resource_references_resource ON resource_references (resource_id);

CREATE TABLE IF NOT EXISTS resource_cleanup_jobs (
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
);

CREATE INDEX IF NOT EXISTS idx_resource_cleanup_jobs_status_created ON resource_cleanup_jobs (status, created_at ASC);

CREATE TABLE IF NOT EXISTS posts (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	title text NOT NULL,
	content_kind text NOT NULL,
	content_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	origin_platform text,
	origin_surface text,
	requires_approval boolean NOT NULL DEFAULT false,
	notes text NOT NULL DEFAULT '',
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_workspace_updated ON posts (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS post_variants (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
	platform text NOT NULL,
	surface text NOT NULL,
	inherit_source text NOT NULL DEFAULT 'shared',
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
);

CREATE INDEX IF NOT EXISTS idx_post_variants_post_updated ON post_variants (post_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS post_variant_removed_resources (
	id uuid PRIMARY KEY,
	variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
	resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (variant_id, resource_id)
);

CREATE TABLE IF NOT EXISTS post_variant_reviews (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
	approval_state text NOT NULL,
	decision text NOT NULL,
	comment text NOT NULL DEFAULT '',
	actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_variant_reviews_variant_created ON post_variant_reviews (variant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_variant_publications (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
	social_target_id uuid,
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
);

CREATE INDEX IF NOT EXISTS idx_post_variant_publications_workspace_planned ON post_variant_publications (workspace_id, planned_at ASC);

CREATE TABLE IF NOT EXISTS post_variant_tentative_plans (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	variant_id uuid NOT NULL REFERENCES post_variants(id) ON DELETE CASCADE,
	planned_at timestamptz NOT NULL,
	source text NOT NULL DEFAULT 'manual',
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (variant_id)
);

CREATE INDEX IF NOT EXISTS idx_post_variant_tentative_plans_workspace_planned ON post_variant_tentative_plans (workspace_id, planned_at ASC);

CREATE TABLE IF NOT EXISTS metric_definitions (
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
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_scope ON metric_definitions (platform, surface, code);

CREATE TABLE IF NOT EXISTS metric_observations (
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
);

CREATE INDEX IF NOT EXISTS idx_metric_observations_publication_metric_observed ON metric_observations (publication_id, metric_definition_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS provider_app_credentials (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	provider text NOT NULL,
	source text NOT NULL DEFAULT 'byok',
	status text NOT NULL DEFAULT 'active',
	client_id text NOT NULL,
	client_secret_ciphertext text NOT NULL,
	client_secret_hint text NOT NULL DEFAULT '',
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE NULLS NOT DISTINCT (workspace_id, provider, source)
);

CREATE INDEX IF NOT EXISTS idx_provider_app_credentials_workspace_provider ON provider_app_credentials (workspace_id, provider);

CREATE TABLE IF NOT EXISTS social_oauth_states (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	provider text NOT NULL,
	credential_source text NOT NULL,
	provider_credential_id uuid REFERENCES provider_app_credentials(id) ON DELETE SET NULL,
	state_token text NOT NULL UNIQUE,
	code_verifier text,
	return_origin text NOT NULL DEFAULT '',
	return_path text NOT NULL DEFAULT '/dashboard/settings',
	status text NOT NULL DEFAULT 'pending',
	expires_at timestamptz NOT NULL,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_oauth_states_workspace_provider ON social_oauth_states (workspace_id, provider, created_at DESC);

CREATE TABLE IF NOT EXISTS social_connections (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	provider text NOT NULL,
	credential_source text NOT NULL,
	provider_credential_id uuid REFERENCES provider_app_credentials(id) ON DELETE SET NULL,
	status text NOT NULL DEFAULT 'connected',
	health_status text NOT NULL DEFAULT 'healthy',
	auth_subject_id text NOT NULL,
	auth_subject_name text NOT NULL DEFAULT '',
	access_token_ciphertext text NOT NULL,
	refresh_token_ciphertext text NOT NULL DEFAULT '',
	token_type text NOT NULL DEFAULT 'Bearer',
	scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	access_token_expires_at timestamptz,
	last_validated_at timestamptz,
	last_validation_error text,
	connected_at timestamptz NOT NULL DEFAULT now(),
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE NULLS NOT DISTINCT (workspace_id, provider, auth_subject_id, credential_source)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_workspace_provider ON social_connections (workspace_id, provider, updated_at DESC);

CREATE TABLE IF NOT EXISTS social_targets (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	connection_id uuid NOT NULL REFERENCES social_connections(id) ON DELETE CASCADE,
	provider text NOT NULL,
	external_account_id text NOT NULL,
	external_parent_id text,
	display_name text NOT NULL,
	username text,
	target_type text NOT NULL,
	account_classification text NOT NULL DEFAULT 'business',
	status text NOT NULL DEFAULT 'healthy',
	is_selected boolean NOT NULL DEFAULT false,
	scope_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
	capability_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	last_validated_at timestamptz,
	last_validation_error text,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE NULLS NOT DISTINCT (workspace_id, provider, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_targets_workspace_provider ON social_targets (workspace_id, provider, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_targets_connection ON social_targets (connection_id, updated_at DESC);

ALTER TABLE post_variant_publications
	ADD CONSTRAINT post_variant_publications_social_target_id_fkey
	FOREIGN KEY (social_target_id) REFERENCES social_targets(id) ON DELETE SET NULL;
