import {
	type PropsWithChildren,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
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

type SessionLoaderConfig = {
	tokenKey: string;
	mePath: string;
	refreshPath: string;
};

type SessionLoadResult = {
	attemptedToken: string | null;
	session: AuthSession | null;
};

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

async function requestSessionByToken(
	path: string,
	token: string,
): Promise<AuthSession | null> {
	try {
		const session = await apiRequest<AuthSession>(path, {
			token,
		});
		return preserveAccessToken(session, token);
	} catch {
		return null;
	}
}

async function loadSession(
	config: SessionLoaderConfig,
	tokenOverride?: string | null,
	options: { preferExistingToken?: boolean } = {},
): Promise<SessionLoadResult> {
	const attemptedToken = tokenOverride ?? readStorage(config.tokenKey);

	if (options.preferExistingToken && attemptedToken) {
		const session = await requestSessionByToken(config.mePath, attemptedToken);
		if (session) {
			return {
				attemptedToken,
				session,
			};
		}
	}

	try {
		const session = await apiRequest<AuthSession>(config.refreshPath, {
			method: "POST",
		});
		return {
			attemptedToken,
			session: preserveAccessToken(session, attemptedToken),
		};
	} catch {
		if (!attemptedToken) {
			return {
				attemptedToken,
				session: null,
			};
		}
	}

	return {
		attemptedToken,
		session: await requestSessionByToken(config.mePath, attemptedToken),
	};
}

export function AuthProvider({ children }: PropsWithChildren) {
	const customerSessionConfig = useMemo<SessionLoaderConfig>(
		() => ({
			tokenKey: CUSTOMER_TOKEN_KEY,
			mePath: "/auth/me",
			refreshPath: "/auth/refresh",
		}),
		[],
	);
	const platformSessionConfig = useMemo<SessionLoaderConfig>(
		() => ({
			tokenKey: PLATFORM_TOKEN_KEY,
			mePath: "/platform/me",
			refreshPath: "/platform/auth/refresh",
		}),
		[],
	);
	const [bootstrapping, setBootstrapping] = useState(true);
	const [customerSession, setCustomerSession] = useState<AuthSession | null>(
		null,
	);
	const [platformSession, setPlatformSession] = useState<AuthSession | null>(
		null,
	);
	const customerSessionRef = useRef<AuthSession | null>(customerSession);
	const platformSessionRef = useRef<AuthSession | null>(platformSession);
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

	useEffect(() => {
		customerSessionRef.current = customerSession;
	}, [customerSession]);

	useEffect(() => {
		platformSessionRef.current = platformSession;
	}, [platformSession]);

	const syncCustomerSession = useCallback(
		async (
			tokenOverride?: string | null,
			options: { preferExistingToken?: boolean } = {},
		) => {
			const result = await loadSession(
				customerSessionConfig,
				tokenOverride,
				options,
			);
			const latestToken = readStorage(CUSTOMER_TOKEN_KEY);

			if (latestToken && latestToken !== result.attemptedToken) {
				const latestSession = await requestSessionByToken(
					"/auth/me",
					latestToken,
				);
				if (latestSession) {
					applyCustomerSession(latestSession);
					return latestSession;
				}
				return customerSessionRef.current;
			}

			applyCustomerSession(result.session);
			return result.session;
		},
		[applyCustomerSession, customerSessionConfig],
	);

	const syncPlatformSession = useCallback(
		async (
			tokenOverride?: string | null,
			options: { preferExistingToken?: boolean } = {},
		) => {
			const result = await loadSession(
				platformSessionConfig,
				tokenOverride,
				options,
			);
			const latestToken = readStorage(PLATFORM_TOKEN_KEY);

			if (latestToken && latestToken !== result.attemptedToken) {
				const latestSession = await requestSessionByToken(
					"/platform/me",
					latestToken,
				);
				if (latestSession) {
					applyPlatformSession(latestSession);
					return latestSession;
				}
				return platformSessionRef.current;
			}

			applyPlatformSession(result.session);
			return result.session;
		},
		[applyPlatformSession, platformSessionConfig],
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

				await Promise.all([
					shouldRefreshCustomer
						? syncCustomerSession(undefined, { preferExistingToken: true })
						: Promise.resolve(null),
					shouldRefreshPlatform
						? syncPlatformSession(undefined, { preferExistingToken: true })
						: Promise.resolve(null),
				]);

				if (cancelled) {
					return;
				}
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
	}, [syncCustomerSession, syncPlatformSession]);

	useEffect(() => {
		function handleStorage(event: StorageEvent) {
			if (event.storageArea !== window.localStorage || !event.key) {
				return;
			}

			if (event.key === CUSTOMER_TOKEN_KEY) {
				if (event.newValue === customerToken) {
					return;
				}
				if (event.newValue) {
					setCustomerToken(event.newValue);
					void syncCustomerSession(event.newValue, {
						preferExistingToken: true,
					});
					return;
				}
				applyCustomerSession(null);
				return;
			}

			if (event.key === PLATFORM_TOKEN_KEY) {
				if (event.newValue === platformToken) {
					return;
				}
				if (event.newValue) {
					setPlatformToken(event.newValue);
					void syncPlatformSession(event.newValue, {
						preferExistingToken: true,
					});
					return;
				}
				applyPlatformSession(null);
				return;
			}

			if (event.key === ACTIVE_WORKSPACE_KEY) {
				setActiveWorkspaceIdState(event.newValue);
			}
		}

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [
		applyCustomerSession,
		applyPlatformSession,
		customerToken,
		platformToken,
		syncCustomerSession,
		syncPlatformSession,
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
		return syncCustomerSession(customerToken);
	}

	async function refreshCustomer() {
		const session = await reloadCustomerSession();
		if (!session) {
			throw new ApiError("Unauthorized", 401);
		}
		return session;
	}

	async function refreshPlatform() {
		const session = await syncPlatformSession(platformToken);
		if (!session) {
			throw new ApiError("Unauthorized", 401);
		}
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
