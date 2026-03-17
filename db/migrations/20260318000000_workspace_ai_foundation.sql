CREATE TABLE IF NOT EXISTS workspace_business_contexts (
	workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
	narrative text NOT NULL DEFAULT '',
	summary text NOT NULL DEFAULT '',
	understanding_score integer NOT NULL DEFAULT 0,
	missing_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
	decision_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
	extractor_version text NOT NULL DEFAULT '',
	source_hash text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_brand_contexts (
	workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
	narrative text NOT NULL DEFAULT '',
	summary text NOT NULL DEFAULT '',
	design_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
	visual_guardrails jsonb NOT NULL DEFAULT '[]'::jsonb,
	missing_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
	reference_resource_id uuid REFERENCES resources(id) ON DELETE SET NULL,
	processing_status text NOT NULL DEFAULT 'ready',
	extractor_version text NOT NULL DEFAULT '',
	source_hash text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_context_caches (
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	use_case text NOT NULL,
	payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	source_fingerprint text NOT NULL DEFAULT '',
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (workspace_id, use_case)
);

CREATE TABLE IF NOT EXISTS workspace_ai_settings (
	workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
	default_mode text NOT NULL DEFAULT 'native',
	capability_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
	fallback_pool_enabled boolean NOT NULL DEFAULT false,
	usage_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_ai_credentials (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	provider text NOT NULL,
	position integer NOT NULL DEFAULT 0,
	status text NOT NULL DEFAULT 'active',
	api_key_ciphertext text NOT NULL,
	api_key_hint text NOT NULL DEFAULT '',
	allowed_models jsonb NOT NULL DEFAULT '[]'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (workspace_id, provider, position)
);

CREATE INDEX IF NOT EXISTS idx_workspace_ai_credentials_workspace_provider
	ON workspace_ai_credentials (workspace_id, provider, position ASC);

CREATE TABLE IF NOT EXISTS ai_run_events (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	use_case text NOT NULL,
	provider text NOT NULL,
	model text NOT NULL,
	credential_mode text NOT NULL,
	credential_id uuid REFERENCES workspace_ai_credentials(id) ON DELETE SET NULL,
	context_fingerprint text NOT NULL DEFAULT '',
	source_entity_type text NOT NULL DEFAULT '',
	source_entity_id text NOT NULL DEFAULT '',
	status text NOT NULL DEFAULT 'success',
	prompt_tokens integer,
	completion_tokens integer,
	total_tokens integer,
	estimated_cost_micros bigint,
	request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	error_text text,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_run_events_workspace_created
	ON ai_run_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_run_events_workspace_use_case
	ON ai_run_events (workspace_id, use_case, created_at DESC);
