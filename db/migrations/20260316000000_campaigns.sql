CREATE TABLE IF NOT EXISTS campaigns (
	id uuid PRIMARY KEY,
	workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	status text NOT NULL DEFAULT 'draft',
	name text NOT NULL,
	objective text NOT NULL DEFAULT '',
	target_audience text NOT NULL DEFAULT '',
	message_theme text NOT NULL DEFAULT '',
	start_date date NOT NULL,
	end_date date NOT NULL,
	notes text NOT NULL DEFAULT '',
	primary_metric_label text NOT NULL DEFAULT '',
	primary_metric_target double precision,
	primary_metric_unit text NOT NULL DEFAULT '',
	paid_channels jsonb NOT NULL DEFAULT '[]'::jsonb,
	budget_amount_cents bigint,
	actual_spend_amount_cents bigint,
	currency_code text NOT NULL DEFAULT '',
	utm_campaign text NOT NULL DEFAULT '',
	external_dashboard_url text NOT NULL DEFAULT '',
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_updated ON campaigns (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_window ON campaigns (workspace_id, start_date ASC, end_date ASC);

ALTER TABLE posts
	ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_campaign ON posts (workspace_id, campaign_id, updated_at DESC);
