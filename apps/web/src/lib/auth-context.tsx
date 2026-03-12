import {
	type PropsWithChildren,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { ApiError, apiRequest } from "@/lib/api-client";
import type {
	AuthSession,
	Permission,
	WorkspaceMembershipSummary,
} from "@/lib/api-types";

const CUSTOMER_TOKEN_KEY = "heimdall:customer-access-token";
const PLATFORM_TOKEN_KEY = "heimdall:platform-access-token";
const ACTIVE_WORKSPACE_KEY = "heimdall:active-workspace-id";

let customerSessionLoadInFlight: Promise<AuthSession | null> | null = null;
let platformSessionLoadInFlight: Promise<AuthSession | null> | null = null;

type AuthContextValue = {
	bootstrapping: boolean;
	customerSession: AuthSession | null;
	platformSession: AuthSession | null;
	activeWorkspaceId: string | null;
	activeWorkspaceMembership: WorkspaceMembershipSummary | null;
	reloadCustomerSession: () => Promise<AuthSession | null>;
	signInCustomer: (payload: {
		email: string;
		password: string;
	}) => Promise<AuthSession>;
	signUpCustomer: (payload: {
		fullName: string;
		email: string;
		password: string;
		workspaceName: string;
	}) => Promise<AuthSession>;
	signInPlatform: (payload: {
		email: string;
		password: string;
	}) => Promise<AuthSession>;
	logoutCustomer: () => Promise<void>;
	logoutPlatform: () => Promise<void>;
	setActiveWorkspaceId: (workspaceId: string) => void;
	hasCustomerPermission: (code: string, capabilities?: Permission[]) => boolean;
	hasPlatformPermission: (code: string) => boolean;
	customerRequest: <T>(
		path: string,
		options?: { method?: string; body?: unknown; workspaceId?: string | null },
	) => Promise<T>;
	platformRequest: <T>(
		path: string,
		options?: { method?: string; body?: unknown },
	) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(key: string) {
	if (typeof window === "undefined") {
		return null;
	}
	return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null) {
	if (typeof window === "undefined") {
		return;
	}
	if (value === null) {
		window.localStorage.removeItem(key);
		return;
	}
	window.localStorage.setItem(key, value);
}

function resolvePreferredWorkspace(session: AuthSession) {
	if (session.assumedWorkspaceId) {
		return session.assumedWorkspaceId;
	}
	const storedWorkspaceId = readStorage(ACTIVE_WORKSPACE_KEY);
	if (
		storedWorkspaceId &&
		session.workspaceMemberships.some(
			(item) => item.workspaceId === storedWorkspaceId,
		)
	) {
		return storedWorkspaceId;
	}
	return (
		session.workspaceMemberships.find((item) => item.status === "active")
			?.workspaceId ??
		session.workspaceMemberships[0]?.workspaceId ??
		null
	);
}

function preserveAccessToken(
	session: AuthSession | null,
	accessToken: string | null | undefined,
) {
	if (!session || session.accessToken || !accessToken) {
		return session;
	}
	return {
		...session,
		accessToken,
	};
}

function runSingleFlight(
	portal: "customer" | "platform",
	loader: () => Promise<AuthSession | null>,
) {
	const inFlight =
		portal === "customer"
			? customerSessionLoadInFlight
			: platformSessionLoadInFlight;
	if (inFlight) {
		return inFlight;
	}

	const request = loader().finally(() => {
		if (portal === "customer") {
			if (customerSessionLoadInFlight === request) {
				customerSessionLoadInFlight = null;
			}
			return;
		}
		if (platformSessionLoadInFlight === request) {
			platformSessionLoadInFlight = null;
		}
	});

	if (portal === "customer") {
		customerSessionLoadInFlight = request;
	} else {
		platformSessionLoadInFlight = request;
	}

	return request;
}

export function AuthProvider({ children }: PropsWithChildren) {
	const [bootstrapping, setBootstrapping] = useState(true);
	const [customerSession, setCustomerSession] = useState<AuthSession | null>(
		null,
	);
	const [platformSession, setPlatformSession] = useState<AuthSession | null>(
		null,
	);
	const [customerToken, setCustomerToken] = useState<string | null>(
		readStorage(CUSTOMER_TOKEN_KEY),
	);
	const [platformToken, setPlatformToken] = useState<string | null>(
		readStorage(PLATFORM_TOKEN_KEY),
	);
	const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<
		string | null
	>(readStorage(ACTIVE_WORKSPACE_KEY));

	const applyCustomerSession = useCallback((session: AuthSession | null) => {
		setCustomerSession(session);
		const accessToken = session?.accessToken ?? null;
		setCustomerToken(accessToken);
		writeStorage(CUSTOMER_TOKEN_KEY, accessToken);
		const nextWorkspaceId = session ? resolvePreferredWorkspace(session) : null;
		setActiveWorkspaceIdState(nextWorkspaceId);
		writeStorage(ACTIVE_WORKSPACE_KEY, nextWorkspaceId);
	}, []);

	const applyPlatformSession = useCallback((session: AuthSession | null) => {
		setPlatformSession(session);
		const accessToken = session?.accessToken ?? null;
		setPlatformToken(accessToken);
		writeStorage(PLATFORM_TOKEN_KEY, accessToken);
	}, []);

	const loadCustomerSession = useCallback(
		async (
			tokenOverride?: string | null,
			options: { preferExistingToken?: boolean } = {},
		) => {
			return runSingleFlight("customer", async () => {
				const token = tokenOverride ?? readStorage(CUSTOMER_TOKEN_KEY);

				if (options.preferExistingToken && token) {
					try {
						const session = await apiRequest<AuthSession>("/auth/me", {
							token,
						});
						return preserveAccessToken(session, token);
					} catch {
						// Fall back to refresh when the access token is stale.
					}
				}

				try {
					const session = await apiRequest<AuthSession>("/auth/refresh", {
						method: "POST",
					});
					return preserveAccessToken(session, token);
				} catch {
					if (!token) {
						return null;
					}
					try {
						const session = await apiRequest<AuthSession>("/auth/me", {
							token,
						});
						return preserveAccessToken(session, token);
					} catch {
						return null;
					}
				}
			});
		},
		[],
	);

	const loadPlatformSession = useCallback(
		async (
			tokenOverride?: string | null,
			options: { preferExistingToken?: boolean } = {},
		) => {
			return runSingleFlight("platform", async () => {
				const token = tokenOverride ?? readStorage(PLATFORM_TOKEN_KEY);

				if (options.preferExistingToken && token) {
					try {
						const session = await apiRequest<AuthSession>("/platform/me", {
							token,
						});
						return preserveAccessToken(session, token);
					} catch {
						// Fall back to refresh when the access token is stale.
					}
				}

				try {
					const session = await apiRequest<AuthSession>(
						"/platform/auth/refresh",
						{
							method: "POST",
						},
					);
					return preserveAccessToken(session, token);
				} catch {
					if (!token) {
						return null;
					}
					try {
						const session = await apiRequest<AuthSession>("/platform/me", {
							token,
						});
						return preserveAccessToken(session, token);
					} catch {
						return null;
					}
				}
			});
		},
		[],
	);

	useEffect(() => {
		let cancelled = false;

		async function bootstrapSessions() {
			try {
				const pathname =
					typeof window === "undefined" ? "/" : window.location.pathname;
				const shouldRefreshCustomer =
					!pathname.startsWith("/admin") ||
					Boolean(readStorage(CUSTOMER_TOKEN_KEY));
				const shouldRefreshPlatform =
					pathname.startsWith("/admin") ||
					Boolean(readStorage(PLATFORM_TOKEN_KEY));

				const [customer, platform] = await Promise.all([
					shouldRefreshCustomer
						? loadCustomerSession(undefined, { preferExistingToken: true })
						: Promise.resolve(null),
					shouldRefreshPlatform
						? loadPlatformSession(undefined, { preferExistingToken: true })
						: Promise.resolve(null),
				]);

				if (cancelled) {
					return;
				}

				applyCustomerSession(customer);
				applyPlatformSession(platform);
			} finally {
				if (!cancelled) {
					setBootstrapping(false);
				}
			}
		}

		void bootstrapSessions();

		return () => {
			cancelled = true;
		};
	}, [
		applyCustomerSession,
		applyPlatformSession,
		loadCustomerSession,
		loadPlatformSession,
	]);

	const activeWorkspaceMembership = useMemo(() => {
		if (!customerSession || !activeWorkspaceId) {
			return null;
		}
		return (
			customerSession.workspaceMemberships.find(
				(item) => item.workspaceId === activeWorkspaceId,
			) ?? null
		);
	}, [customerSession, activeWorkspaceId]);

	async function signInCustomer(payload: { email: string; password: string }) {
		const session = await apiRequest<AuthSession>("/auth/login", {
			method: "POST",
			body: payload,
		});
		applyCustomerSession(session);
		return session;
	}

	async function signUpCustomer(payload: {
		fullName: string;
		email: string;
		password: string;
		workspaceName: string;
	}) {
		const session = await apiRequest<AuthSession>("/auth/register", {
			method: "POST",
			body: payload,
		});
		applyCustomerSession(session);
		return session;
	}

	async function signInPlatform(payload: { email: string; password: string }) {
		const session = await apiRequest<AuthSession>("/platform/auth/login", {
			method: "POST",
			body: payload,
		});
		applyPlatformSession(session);
		return session;
	}

	async function logoutCustomer() {
		await apiRequest<void>("/auth/logout", { method: "POST" });
		applyCustomerSession(null);
	}

	async function logoutPlatform() {
		await apiRequest<void>("/platform/auth/logout", { method: "POST" });
		applyPlatformSession(null);
	}

	async function reloadCustomerSession() {
		const session = await loadCustomerSession(customerToken);
		applyCustomerSession(session);
		return session;
	}

	async function refreshCustomer() {
		const session = await reloadCustomerSession();
		if (!session) {
			throw new ApiError("Unauthorized", 401);
		}
		return session;
	}

	async function refreshPlatform() {
		const session = await loadPlatformSession(platformToken);
		if (!session) {
			applyPlatformSession(null);
			throw new ApiError("Unauthorized", 401);
		}
		applyPlatformSession(session);
		return session;
	}

	async function customerRequest<T>(
		path: string,
		options: {
			method?: string;
			body?: unknown;
			workspaceId?: string | null;
		} = {},
	): Promise<T> {
		try {
			return await apiRequest<T>(path, {
				method: options.method,
				body: options.body,
				token: customerToken,
				workspaceId: options.workspaceId ?? activeWorkspaceId,
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				const session = await refreshCustomer();
				const resolvedWorkspaceId =
					options.workspaceId ?? resolvePreferredWorkspace(session);
				return apiRequest<T>(path, {
					method: options.method,
					body: options.body,
					token: session.accessToken ?? customerToken ?? null,
					workspaceId: resolvedWorkspaceId,
				});
			}
			throw error;
		}
	}

	async function platformRequest<T>(
		path: string,
		options: { method?: string; body?: unknown } = {},
	): Promise<T> {
		try {
			return await apiRequest<T>(path, {
				method: options.method,
				body: options.body,
				token: platformToken,
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				const session = await refreshPlatform();
				return apiRequest<T>(path, {
					method: options.method,
					body: options.body,
					token: session.accessToken ?? null,
				});
			}
			throw error;
		}
	}

	function setActiveWorkspaceId(workspaceId: string) {
		setActiveWorkspaceIdState(workspaceId);
		writeStorage(ACTIVE_WORKSPACE_KEY, workspaceId);
	}

	function hasCustomerPermission(
		code: string,
		capabilities: Permission[] = [],
	) {
		return capabilities.some((permission) => permission.code === code);
	}

	function hasPlatformPermission(code: string) {
		return (
			platformSession?.platformPermissions.some(
				(permission) => permission.code === code,
			) ?? false
		);
	}

	const value: AuthContextValue = {
		bootstrapping,
		customerSession,
		platformSession,
		activeWorkspaceId,
		activeWorkspaceMembership,
		reloadCustomerSession,
		signInCustomer,
		signUpCustomer,
		signInPlatform,
		logoutCustomer,
		logoutPlatform,
		setActiveWorkspaceId,
		hasCustomerPermission,
		hasPlatformPermission,
		customerRequest,
		platformRequest,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used inside AuthProvider");
	}
	return context;
}
