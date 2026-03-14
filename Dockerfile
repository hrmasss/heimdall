FROM node:22-bookworm-slim AS web-builder
WORKDIR /app
ARG VITE_API_URL=https://api.heimdall.social
ARG VITE_SITE_URL=https://heimdall.social
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SITE_URL=${VITE_SITE_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web apps/web
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --dir apps/web build

FROM golang:1.25-bookworm AS api-builder
WORKDIR /app

COPY apps/api/go.mod apps/api/go.sum ./apps/api/
RUN cd apps/api && go mod download
COPY apps/api ./apps/api
RUN cd apps/api && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/heimdall-api ./cmd/server

FROM debian:bookworm-slim AS runtime
ENV DEBIAN_FRONTEND=noninteractive
ENV PGDATA=/var/lib/postgresql/data
LABEL org.opencontainers.image.source="https://github.com/hrmasss/heimdall"
LABEL org.opencontainers.image.description="Heimdall production runtime"

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		caddy \
		curl \
		postgresql \
		supervisor \
		tzdata \
	&& rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://atlasbinaries.com/atlas/atlas-linux-amd64-latest -o /usr/local/bin/atlas \
	&& chmod +x /usr/local/bin/atlas

COPY --from=web-builder /app/apps/web/dist /srv/heimdall/web/dist
COPY --from=api-builder /out/heimdall-api /usr/local/bin/heimdall-api
COPY atlas.hcl /srv/heimdall/atlas.hcl
COPY db/migrations /srv/heimdall/db/migrations
COPY docker/Caddyfile.internal /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisor/conf.d/heimdall.conf
COPY docker/heimdall-entrypoint.sh /usr/local/bin/heimdall-entrypoint
COPY docker/start-postgres.sh /usr/local/bin/start-postgres
COPY docker/start-api.sh /usr/local/bin/start-api
COPY docker/start-caddy.sh /usr/local/bin/start-caddy

RUN chmod +x \
	/usr/local/bin/heimdall-entrypoint \
	/usr/local/bin/start-postgres \
	/usr/local/bin/start-api \
	/usr/local/bin/start-caddy

WORKDIR /srv/heimdall
EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
	CMD ["/usr/local/bin/heimdall-api", "healthcheck"]

ENTRYPOINT ["/usr/local/bin/heimdall-entrypoint"]
CMD ["serve"]
