CREATE TABLE IF NOT EXISTS platform_ai_provider_settings (
	provider text PRIMARY KEY,
	default_model text NOT NULL DEFAULT '',
	approved_models jsonb NOT NULL DEFAULT '[]'::jsonb,
	base_url text NOT NULL DEFAULT '',
	strategy text NOT NULL DEFAULT 'first_healthy',
	round_robin_cursor integer NOT NULL DEFAULT 0,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_ai_credentials (
	id uuid PRIMARY KEY,
	provider text NOT NULL,
	label text NOT NULL DEFAULT '',
	position integer NOT NULL DEFAULT 0,
	status text NOT NULL DEFAULT 'active',
	api_key_ciphertext text NOT NULL,
	api_key_hint text NOT NULL DEFAULT '',
	allowed_models jsonb NOT NULL DEFAULT '[]'::jsonb,
	health_status text NOT NULL DEFAULT 'healthy',
	cooldown_until timestamptz,
	request_count integer NOT NULL DEFAULT 0,
	last_used_at timestamptz,
	last_error text,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (provider, position)
);

CREATE INDEX IF NOT EXISTS idx_platform_ai_credentials_provider_position
	ON platform_ai_credentials (provider, position ASC);

CREATE INDEX IF NOT EXISTS idx_platform_ai_credentials_health
	ON platform_ai_credentials (provider, status, health_status, cooldown_until);

CREATE TABLE IF NOT EXISTS platform_ai_fallback_routes (
	id uuid PRIMARY KEY,
	provider text NOT NULL,
	model text NOT NULL DEFAULT '',
	position integer NOT NULL DEFAULT 0,
	enabled boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (position)
);

CREATE INDEX IF NOT EXISTS idx_platform_ai_fallback_routes_position
	ON platform_ai_fallback_routes (enabled, position ASC);
