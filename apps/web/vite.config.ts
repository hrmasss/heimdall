import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function normalizeLocalhostHost(value?: string) {
	if (!value || value === "localhost" || value === "0.0.0.0") {
		return "127.0.0.1";
	}
	return value;
}

function normalizeDevTarget(value: string) {
	// Vite's proxy can resolve localhost to IPv6 on Windows while the Go API
	// is bound to IPv4 only. Normalize localhost to 127.0.0.1 for dev stability.
	return value.replace("://localhost", "://127.0.0.1");
}

function resolveDevApiTarget(env: Record<string, string>) {
	const apiHost = normalizeLocalhostHost(env.API_HOST?.trim());
	const apiPort = env.API_PORT?.trim() || "18080";
	if (apiHost && apiPort) {
		return normalizeDevTarget(`http://${apiHost}:${apiPort}`);
	}

	const configuredBase = env.VITE_API_URL?.trim();
	if (configuredBase) {
		return normalizeDevTarget(configuredBase);
	}

	return "http://127.0.0.1:18080";
}

export default defineConfig(({ mode, isSsrBuild }) => {
	// Load env from root directory
	const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
	const apiProxyTarget = resolveDevApiTarget(env);

	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			port: 5173,
			proxy: {
				"/api": {
					target: apiProxyTarget,
					changeOrigin: true,
				},
			},
		},
		envDir: path.resolve(__dirname, "../.."),
		build: {
			emptyOutDir: !isSsrBuild,
		},
		define: {
			"import.meta.env.VITE_APP_NAME": JSON.stringify(
				env.VITE_APP_NAME || "Heimdall",
			),
		},
	};
});
