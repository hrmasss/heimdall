ALTER TABLE campaigns
	ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE campaigns
	ADD COLUMN IF NOT EXISTS default_timezone text NOT NULL DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS campaign_delivery_targets (
	id uuid PRIMARY KEY,
	campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
	social_target_id uuid NOT NULL REFERENCES social_targets(id) ON DELETE CASCADE,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (campaign_id, social_target_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_delivery_targets_campaign
	ON campaign_delivery_targets (campaign_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_campaign_delivery_targets_social_target
	ON campaign_delivery_targets (social_target_id);

CREATE TABLE IF NOT EXISTS campaign_schedule_rules (
	id uuid PRIMARY KEY,
	campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
	social_target_id uuid NOT NULL REFERENCES social_targets(id) ON DELETE CASCADE,
	enabled boolean NOT NULL DEFAULT true,
	cadence_type text NOT NULL,
	interval integer NOT NULL DEFAULT 1,
	weekdays jsonb NOT NULL DEFAULT '[]'::jsonb,
	times_local jsonb NOT NULL DEFAULT '[]'::jsonb,
	start_date date,
	end_date date,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_schedule_rules_campaign
	ON campaign_schedule_rules (campaign_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_campaign_schedule_rules_target
	ON campaign_schedule_rules (social_target_id, cadence_type);
