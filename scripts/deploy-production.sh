#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/opt/heimdall"
COMPOSE_FILE="$APP_ROOT/docker-compose.prod.yml"
ENV_FILE="$APP_ROOT/.env"
CURRENT_IMAGE_FILE="$APP_ROOT/current-image"
KNOWN_GOOD_FILE="$APP_ROOT/known-good-image"
BACKUP_DIR="$APP_ROOT/backups"
CONTAINER_NAME="heimdall-app"
NEW_IMAGE="${1:?usage: deploy-production.sh <image>}"

require_env() {
	local name="$1"
	if [[ -z "${!name:-}" ]]; then
		echo "Missing required environment variable: $name" >&2
		exit 1
	fi
}

ensure_paths() {
	mkdir -p "$APP_ROOT" "$APP_ROOT/data/postgres" "$APP_ROOT/data/storage" "$BACKUP_DIR" /etc/caddy/conf.d
	chmod 700 "$APP_ROOT"
}

write_env_file() {
	printf '%s' "$PROD_ENV_FILE_B64" | base64 -d >"$ENV_FILE"
	chmod 600 "$ENV_FILE"
}

ensure_host_caddy() {
	if ! grep -q 'import /etc/caddy/conf.d/\*.caddy' /etc/caddy/Caddyfile; then
		printf '\nimport /etc/caddy/conf.d/*.caddy\n' >>/etc/caddy/Caddyfile
	fi

cat >/etc/caddy/conf.d/heimdall.caddy <<'EOF'
heimdall.social, www.heimdall.social, app.heimdall.social, api.heimdall.social {
	reverse_proxy 127.0.0.1:18081
}
EOF

	systemctl reload caddy
}

docker_compose() {
	HEIMDALL_IMAGE="$HEIMDALL_IMAGE" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

wait_for_health() {
	local attempts=30
	for _ in $(seq 1 "$attempts"); do
		if curl -fsS -H "Host: api.heimdall.social" http://127.0.0.1:18081/api/v1/health | grep -q '"status":"healthy"'; then
			return 0
		fi
		sleep 2
	done
	return 1
}

create_backup() {
	BACKUP_FILE=""
	if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
		return 0
	fi

	BACKUP_FILE="$BACKUP_DIR/$(date -u +%Y%m%d%H%M%S)-predeploy.sql.gz"
	echo "Creating database backup at $BACKUP_FILE"
	docker exec "$CONTAINER_NAME" sh -lc 'pg_dump --clean --if-exists --no-owner --no-privileges "$DATABASE_URL"' | gzip -c >"$BACKUP_FILE"
}

restore_backup() {
	if [[ -z "${BACKUP_FILE:-}" || ! -f "$BACKUP_FILE" ]]; then
		return 0
	fi

	echo "Restoring database backup from $BACKUP_FILE"
	gunzip -c "$BACKUP_FILE" | docker_compose run --rm -T app restore-db
}

prune_images() {
	local repo="${NEW_IMAGE%%:*}"
	local keep_current="$NEW_IMAGE"
	local keep_previous="${PREVIOUS_IMAGE:-}"

	while IFS= read -r image; do
		[[ -z "$image" ]] && continue
		[[ "$image" == "$keep_current" ]] && continue
		[[ -n "$keep_previous" && "$image" == "$keep_previous" ]] && continue
		docker image rm -f "$image" >/dev/null 2>&1 || true
	done < <(docker images "$repo" --format '{{.Repository}}:{{.Tag}}' | sort -u)
}

prune_backups() {
	mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sql.gz' | sort -r)
	if [[ "${#backups[@]}" -le 2 ]]; then
		return 0
	fi
	for backup in "${backups[@]:2}"; do
		rm -f "$backup"
	done
}

rollback() {
	if [[ -z "${PREVIOUS_IMAGE:-}" ]]; then
		echo "No previous image available for rollback." >&2
		return
	fi

	echo "Rolling back to $PREVIOUS_IMAGE"
	HEIMDALL_IMAGE="$PREVIOUS_IMAGE"
	export HEIMDALL_IMAGE
	docker pull "$HEIMDALL_IMAGE" >/dev/null 2>&1 || true
	docker_compose down || true
	restore_backup || true
	docker_compose up -d
	printf '%s\n' "$PREVIOUS_IMAGE" >"$CURRENT_IMAGE_FILE"
	printf '%s\n' "$PREVIOUS_IMAGE" >"$KNOWN_GOOD_FILE"
}

main() {
	require_env PROD_ENV_FILE_B64
	require_env GHCR_USERNAME
	require_env GHCR_TOKEN

	ensure_paths
	write_env_file
	ensure_host_caddy

	PREVIOUS_IMAGE=""
	if [[ -f "$KNOWN_GOOD_FILE" ]]; then
		PREVIOUS_IMAGE="$(tr -d '\r\n' <"$KNOWN_GOOD_FILE")"
	elif [[ -f "$CURRENT_IMAGE_FILE" ]]; then
		PREVIOUS_IMAGE="$(tr -d '\r\n' <"$CURRENT_IMAGE_FILE")"
	fi

	create_backup

	echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin >/dev/null

	HEIMDALL_IMAGE="$NEW_IMAGE"
	export HEIMDALL_IMAGE
	trap rollback ERR

	docker pull "$HEIMDALL_IMAGE"
	docker_compose down || true
	docker_compose run --rm app migrate
	docker_compose run --rm app seed-system
	docker_compose up -d
	wait_for_health

	printf '%s\n' "$HEIMDALL_IMAGE" >"$CURRENT_IMAGE_FILE"
	printf '%s\n' "$HEIMDALL_IMAGE" >"$KNOWN_GOOD_FILE"
	trap - ERR
	prune_images
	prune_backups
}

main "$@"
