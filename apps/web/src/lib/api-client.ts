function trimTrailingSlash(value: string) {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function resolveApiBase() {
	const configuredBase = import.meta.env.VITE_API_URL?.trim();
	if (import.meta.env.DEV) {
		// In dev, use the Vite proxy so the browser only talks to the web origin.
		return "";
	}
	return configuredBase ? trimTrailingSlash(configuredBase) : "";
}

const API_BASE = resolveApiBase();
const API_PREFIX = `${API_BASE}/api/v1`;
const MEDIA_URL_KEYS = new Set([
	"previewUrl",
	"downloadUrl",
	"coverPreviewUrl",
	"thumbnailUrl",
]);

export function buildApiUrl(path: string) {
	return `${API_PREFIX}${path}`;
}

function resolveMediaUrl(value: string) {
	const trimmedValue = value.trim();
	if (
		trimmedValue === "" ||
		trimmedValue.startsWith("blob:") ||
		trimmedValue.startsWith("data:") ||
		trimmedValue.startsWith("http://") ||
		trimmedValue.startsWith("https://")
	) {
		return value;
	}

	if (!trimmedValue.startsWith("/")) {
		return value;
	}

	const base =
		API_BASE ||
		(typeof window !== "undefined" ? window.location.origin : "http://localhost");
	return new URL(trimmedValue, base).toString();
}

function normalizeApiPayload<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeApiPayload(item)) as T;
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	const normalizedEntries = Object.entries(value).map(([key, entryValue]) => {
		if (MEDIA_URL_KEYS.has(key) && typeof entryValue === "string") {
			return [key, resolveMediaUrl(entryValue)];
		}
		return [key, normalizeApiPayload(entryValue)];
	});

	return Object.fromEntries(normalizedEntries) as T;
}

export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "ApiError";
		this.status = status;
	}
}

export async function apiRequest<T>(
	path: string,
	options: {
		method?: string;
		body?: unknown;
		token?: string | null;
		workspaceId?: string | null;
	} = {},
): Promise<T> {
	const headers = new Headers();
	const isFormData =
		typeof FormData !== "undefined" && options.body instanceof FormData;
	if (options.body !== undefined && !isFormData) {
		headers.set("Content-Type", "application/json");
	}
	if (options.token) {
		headers.set("Authorization", `Bearer ${options.token}`);
	}
	if (options.workspaceId) {
		headers.set("X-Workspace-ID", options.workspaceId);
	}

	let response: Response;
	try {
		response = await fetch(buildApiUrl(path), {
			method: options.method ?? "GET",
			headers,
			body:
				options.body === undefined
					? undefined
					: isFormData
						? (options.body as FormData)
						: JSON.stringify(options.body),
			credentials: "include",
		});
	} catch (error) {
		const requestTarget = API_BASE ? API_PREFIX : "/api/v1";
		const message =
			error instanceof Error && error.message
				? `Cannot reach the API at ${requestTarget}. Start the backend with \`npm run dev\` from the repo root or \`npm run dev:api\`.`
				: "Cannot reach the API.";
		throw new ApiError(message, 0);
	}

	if (!response.ok) {
		let message = `Request failed with status ${response.status}`;
		try {
			const payload = (await response.json()) as { message?: string };
			if (payload.message) {
				message = payload.message;
			}
		} catch {
			// Ignore non-JSON failures.
		}
		throw new ApiError(message, response.status);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return normalizeApiPayload((await response.json()) as T);
}
