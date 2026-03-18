CREATE TABLE IF NOT EXISTS automation_definitions (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'active',
	scope text NOT NULL DEFAULT 'workspace',
	name text NOT NULL,
	description text NOT NULL DEFAULT '',
	action_type text NOT NULL,
	trigger_type text NOT NULL DEFAULT 'manual',
	input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
	default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
	output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
	review_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
	capability_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_definitions_workspace_updated
	ON automation_definitions (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_definitions (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'active',
	scope text NOT NULL DEFAULT 'workspace',
	name text NOT NULL,
	description text NOT NULL DEFAULT '',
	trigger_type text NOT NULL DEFAULT 'manual',
	input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
	output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
	review_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
	capability_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_workspace_updated
	ON workflow_definitions (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_steps (
	id uuid PRIMARY KEY,
	workflow_id uuid NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
	automation_id uuid REFERENCES automation_definitions(id) ON DELETE SET NULL,
	position integer NOT NULL,
	name text NOT NULL DEFAULT '',
	step_kind text NOT NULL DEFAULT 'action',
	action_type text NOT NULL,
	consumes_artifact_type text NOT NULL DEFAULT '',
	produces_artifact_type text NOT NULL DEFAULT '',
	reviewer_type text NOT NULL DEFAULT '',
	required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
	config jsonb NOT NULL DEFAULT '{}'::jsonb,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (workflow_id, position)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_position
	ON workflow_steps (workflow_id, position ASC);

CREATE TABLE IF NOT EXISTS automation_runs (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	source_type text NOT NULL,
	automation_id uuid REFERENCES automation_definitions(id) ON DELETE SET NULL,
	workflow_id uuid REFERENCES workflow_definitions(id) ON DELETE SET NULL,
	status text NOT NULL DEFAULT 'draft',
	current_step_position integer,
	trigger_type text NOT NULL DEFAULT 'manual',
	review_required boolean NOT NULL DEFAULT false,
	reviewer_type text NOT NULL DEFAULT '',
	input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	last_error text,
	context_fingerprint text NOT NULL DEFAULT '',
	evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	completed_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace_created
	ON automation_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace_status
	ON automation_runs (workspace_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS automation_run_steps (
	id uuid PRIMARY KEY,
	run_id uuid NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
	workflow_step_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
	position integer NOT NULL,
	name text NOT NULL DEFAULT '',
	step_kind text NOT NULL DEFAULT 'action',
	action_type text NOT NULL,
	state text NOT NULL DEFAULT 'draft',
	reviewer_type text NOT NULL DEFAULT '',
	input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	output_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	artifact_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
	evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
	last_error text,
	started_at timestamptz,
	completed_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (run_id, position)
);

CREATE INDEX IF NOT EXISTS idx_automation_run_steps_run_position
	ON automation_run_steps (run_id, position ASC);

CREATE TABLE IF NOT EXISTS automation_run_reviews (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	run_id uuid NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
	run_step_id uuid REFERENCES automation_run_steps(id) ON DELETE SET NULL,
	reviewer_type text NOT NULL,
	decision text NOT NULL,
	status text NOT NULL DEFAULT 'completed',
	comment text NOT NULL DEFAULT '',
	findings jsonb NOT NULL DEFAULT '[]'::jsonb,
	actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	automation_agent text NOT NULL DEFAULT '',
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_run_reviews_run_created
	ON automation_run_reviews (run_id, created_at DESC);
