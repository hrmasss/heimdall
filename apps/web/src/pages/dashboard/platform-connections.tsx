import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	KeyRound,
	LoaderCircle,
	RefreshCw,
	ShieldCheck,
	Target,
	Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
	ApiListResponse,
	SocialAppCredentialRecord,
	SocialConnectionRecord,
	SocialConnectionsResponse,
	SocialProviderAvailability,
	SocialTargetRecord,
	WorkspaceSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { formatPlatformLabel, platformIcon } from "@/lib/platforms";
import {
	socialStatusBadgeClass,
	summarizeSocialConnections,
} from "@/lib/social-connections";
import {
	derivePlatformSetupStates,
	type PlatformSetupState,
} from "@/lib/workspace-setup";
import { cn } from "@/lib/utils";

type ByokDraft = {
	clientId: string;
	clientSecret: string;
};

function setupStateBadgeClass(state: PlatformSetupState["state"]) {
	switch (state) {
		case "ready":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
		case "needs_attention":
			return "border-amber-500/20 bg-amber-500/10 text-amber-700";
		default:
			return "border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground";
	}
}

export function DashboardPlatformConnectionsPage() {
	const { activeWorkspaceId, customerRequest, hasCustomerPermission } =
		useAuth();
	const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
	const [providers, setProviders] = useState<SocialProviderAvailability[]>([]);
	const [credentials, setCredentials] = useState<SocialAppCredentialRecord[]>([]);
	const [connections, setConnections] = useState<SocialConnectionRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [byokDrafts, setByokDrafts] = useState<Record<string, ByokDraft>>({});
	const [focusedProvider, setFocusedProvider] = useState<string | null>(null);
	const [advancedVisible, setAdvancedVisible] = useState<Record<string, boolean>>(
		{},
	);
	const autoSelectedKeysRef = useRef<Set<string>>(new Set());

	const canManageSettings = hasCustomerPermission(
		"workspace.settings.manage",
		workspace?.capabilities,
	);

	const summary = useMemo(
		() => summarizeSocialConnections({ connections, targets: connections.flatMap((connection) => connection.targets) }),
		[connections],
	);
	const providerStates = useMemo(
		() => derivePlatformSetupStates({ providers, connections }),
		[connections, providers],
	);

	const loadPage = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		try {
			const [workspaceResponse, providerResponse, credentialResponse, social] =
				await Promise.all([
					customerRequest<WorkspaceSummary>(`/workspaces/${activeWorkspaceId}`),
					customerRequest<ApiListResponse<SocialProviderAvailability>>(
						"/social/providers",
					),
					customerRequest<ApiListResponse<SocialAppCredentialRecord>>(
						"/social/credentials",
					),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
				]);
			setWorkspace(workspaceResponse);
			setProviders(providerResponse.items);
			setCredentials(credentialResponse.items);
			setConnections(social.connections);
			setByokDrafts((current) => {
				const next = { ...current };
				for (const credential of credentialResponse.items) {
					if (credential.source !== "byok") {
						continue;
					}
					next[credential.provider] ??= {
						clientId: credential.clientId,
						clientSecret: "",
					};
				}
				return next;
			});
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadPage();
	}, [loadPage]);

	useEffect(() => {
		function handleOAuthMessage(event: MessageEvent) {
			const payload = event.data as
				| {
						type?: string;
						success?: boolean;
						message?: string;
						provider?: string;
				  }
				| undefined;
			if (!payload || payload.type !== "heimdall-social-oauth") {
				return;
			}
			if (payload.success) {
				if (payload.provider) {
					setFocusedProvider(payload.provider);
				}
				toast.success(payload.message ?? "Account connected.");
				void loadPage();
				return;
			}
			toast.error(payload.message ?? "Connection failed.");
		}

		window.addEventListener("message", handleOAuthMessage);
		return () => window.removeEventListener("message", handleOAuthMessage);
	}, [loadPage]);

	const startOAuth = useCallback(
		async (provider: string, credentialSource: "managed" | "byok") => {
			setBusyKey(`oauth:${provider}:${credentialSource}`);
			try {
				const response = await customerRequest<{ authUrl: string }>(
					"/social/oauth/start",
					{
						method: "POST",
						body: {
							provider,
							credentialSource,
							returnOrigin: window.location.origin,
							returnPath: "/dashboard/settings/platforms",
						},
					},
				);
				window.open(
					response.authUrl,
					`heimdall-social-${provider}`,
					"popup=yes,width=780,height=860",
				);
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Unable to start OAuth.",
				);
			} finally {
				setBusyKey(null);
			}
		},
		[customerRequest],
	);

	const saveByok = useCallback(
		async (provider: string) => {
			const draft = byokDrafts[provider];
			if (!draft?.clientId || !draft?.clientSecret) {
				toast.error("Enter both a client ID and client secret.");
				return;
			}
			setBusyKey(`byok:${provider}`);
			try {
				await customerRequest<SocialAppCredentialRecord>(
					`/social/credentials/${provider}`,
					{
						method: "PUT",
						body: draft,
					},
				);
				toast.success(
					`${formatPlatformLabel(provider)} credentials saved for advanced setup.`,
				);
				await loadPage();
				setByokDrafts((current) => ({
					...current,
					[provider]: { ...current[provider], clientSecret: "" },
				}));
			} finally {
				setBusyKey(null);
			}
		},
		[byokDrafts, customerRequest, loadPage],
	);

	const selectTarget = useCallback(
		async (
			target: SocialTargetRecord,
			selected: boolean,
			options?: { silent?: boolean; successMessage?: string },
		) => {
			setBusyKey(`target:${target.id}`);
			try {
				await customerRequest(`/social/targets/${target.id}/select`, {
					method: "POST",
					body: { selected },
				});
				if (!options?.silent) {
					toast.success(
						options?.successMessage ??
							(selected
								? `${target.displayName} is now the active ${formatPlatformLabel(target.provider)} destination.`
								: `${target.displayName} deselected.`),
					);
				}
				setFocusedProvider(selected ? null : target.provider);
				await loadPage();
			} finally {
				setBusyKey(null);
			}
		},
		[customerRequest, loadPage],
	);

	const validateTarget = useCallback(
		async (target: SocialTargetRecord) => {
			setBusyKey(`validate:${target.id}`);
			try {
				await customerRequest(`/social/targets/${target.id}/validate`, {
					method: "POST",
					body: { checkpoint: "manual" },
				});
				toast.success(`${target.displayName} revalidated.`);
				await loadPage();
			} finally {
				setBusyKey(null);
			}
		},
		[customerRequest, loadPage],
	);

	useEffect(() => {
		if (!canManageSettings || busyKey) {
			return;
		}
		const candidate = providerStates.find(
			(state) =>
				state.selectedTargetCount === 0 && state.healthyTargets.length === 1,
		);
		if (!candidate) {
			return;
		}
		const target = candidate.healthyTargets[0];
		const candidateKey = `${candidate.provider}:${target.id}`;
		if (autoSelectedKeysRef.current.has(candidateKey)) {
			return;
		}
		autoSelectedKeysRef.current.add(candidateKey);
		void selectTarget(target, true, {
			silent: false,
			successMessage: `${target.displayName} was selected automatically so ${candidate.label} is ready to publish.`,
		});
	}, [busyKey, canManageSettings, providerStates, selectTarget]);

	function updateByok(provider: string, patch: Partial<ByokDraft>) {
		setByokDrafts((current) => ({
			...current,
			[provider]: {
				clientId: current[provider]?.clientId ?? "",
				clientSecret: current[provider]?.clientSecret ?? "",
				...patch,
			},
		}));
	}

	function toggleAdvanced(provider: string) {
		setAdvancedVisible((current) => ({
			...current,
			[provider]: !current[provider],
		}));
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Publishing setup"
				title="Platform connections"
				description="Connect one provider, choose one destination, and get Heimdall to a real publish-ready state as fast as possible."
				actions={
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/settings">
							<ArrowLeft className="size-4" />
							Back to settings
						</Link>
					</Button>
				}
			/>

			<SurfaceCard className="overflow-hidden rounded-[32px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(195,123,79,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.78))] p-6 shadow-[0_30px_80px_-48px_rgba(66,32,17,0.45)] md:p-7">
				<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
							<ShieldCheck className="size-3.5" />
							Managed setup first
						</div>
						<div className="space-y-3">
							<h2 className="text-2xl font-semibold tracking-tight">
								Connect the provider, choose the destination, then you are done.
							</h2>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
								The Heimdall-managed app stays on the main path. BYOK, scopes,
								raw health detail, and other operational controls are still here,
								but pushed behind explicit advanced actions.
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									1. Connect
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Start with the Heimdall app unless your team really needs custom credentials.
								</div>
							</SurfaceCard>
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									2. Choose destination
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Pick the page, profile, or organization Heimdall should publish to.
								</div>
							</SurfaceCard>
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									3. Keep it healthy
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Reconnect or revalidate only when the provider needs attention.
								</div>
							</SurfaceCard>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Providers connected
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{summary.providerCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Providers with at least one linked account in this workspace.
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Healthy providers
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{summary.healthyConnectionCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Connections that can currently support publishing.
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Selected destinations
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{summary.selectedTargetCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Destinations Heimdall will publish to by default.
							</div>
						</SurfaceCard>
					</div>
				</div>
			</SurfaceCard>

			<DashboardPanel
				title="Providers"
				description="Each provider card keeps the main path short: connect, choose destination, and fix attention states only when they actually happen."
			>
				<div className="grid gap-4 xl:grid-cols-2">
					{providerStates.map((state) => {
						const provider = providers.find(
							(entry) => entry.provider === state.provider,
						);
						const byokCredential = credentials.find(
							(item) => item.provider === state.provider && item.source === "byok",
						);
						const draft = byokDrafts[state.provider] ?? {
							clientId: byokCredential?.clientId ?? "",
							clientSecret: "",
						};
						const selectedTarget = state.selectedTargets[0] ?? null;
						const showChooser = focusedProvider === state.provider;

						return (
							<SurfaceCard
								key={state.provider}
								className="overflow-hidden rounded-[28px] border border-[var(--brand-border-soft)] p-0"
							>
								<div className="border-b border-[var(--brand-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.66))] p-5 dark:bg-[linear-gradient(180deg,rgba(41,30,23,0.94),rgba(28,21,17,0.82))]">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-2">
											<div className="flex items-center gap-3 text-lg font-medium">
												{platformIcon(state.provider)}
												{state.label}
											</div>
											<div className="text-sm text-muted-foreground">
												{state.summary}
											</div>
										</div>
										<Badge
											variant="outline"
											className={cn("rounded-full", setupStateBadgeClass(state.state))}
										>
											{state.state === "ready"
												? "Ready"
												: state.state === "needs_attention"
													? "Needs attention"
													: "Not connected"}
										</Badge>
									</div>
								</div>

								<div className="space-y-4 p-5">
									<div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-4">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="space-y-1">
												<div className="flex items-center gap-2 text-sm font-medium text-foreground">
													<ShieldCheck className="size-4 text-emerald-600" />
													Use the Heimdall app
												</div>
												<div className="text-sm text-muted-foreground">
													The fastest route to a publish-ready provider.
												</div>
											</div>
											{state.state === "not_connected" ||
											(state.state === "needs_attention" &&
												state.healthyConnectionCount === 0) ? (
												<Button
													size="sm"
													className="rounded-full border-0 bg-gradient-brand text-white"
													disabled={
														!canManageSettings ||
														!provider?.managedAvailable ||
														busyKey === `oauth:${state.provider}:managed`
													}
													onClick={() =>
														void startOAuth(state.provider, "managed")
													}
												>
													{busyKey === `oauth:${state.provider}:managed` ? (
														<LoaderCircle className="size-4 animate-spin" />
													) : (
														<ExternalLink className="size-4" />
													)}
													{state.state === "not_connected" ? "Connect" : "Reconnect"}
												</Button>
											) : (
												<Badge
													variant="outline"
													className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
												>
													Managed path active
												</Badge>
											)}
										</div>
									</div>

									<div className="grid gap-3 md:grid-cols-3">
										<SurfaceCard tone="muted" className="p-4">
											<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
												Connections
											</div>
											<div className="mt-2 text-lg font-semibold">
												{state.connectionCount}
											</div>
										</SurfaceCard>
										<SurfaceCard tone="muted" className="p-4">
											<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
												Healthy
											</div>
											<div className="mt-2 text-lg font-semibold">
												{state.healthyConnectionCount}
											</div>
										</SurfaceCard>
										<SurfaceCard tone="muted" className="p-4">
											<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
												Destinations
											</div>
											<div className="mt-2 text-lg font-semibold">
												{state.selectedTargetCount}
											</div>
										</SurfaceCard>
									</div>

									{selectedTarget ? (
										<SurfaceCard tone="muted" className="space-y-3 p-4">
											<div className="flex items-center justify-between gap-3">
												<div>
													<div className="flex items-center gap-2 text-sm font-medium">
														<Target className="size-4 text-primary" />
														Selected destination
													</div>
													<div className="mt-1 text-base font-medium">
														{selectedTarget.displayName}
													</div>
													<div className="text-xs text-muted-foreground">
														{selectedTarget.username
															? `@${selectedTarget.username} • `
															: ""}
														{selectedTarget.targetType.replaceAll("_", " ")}
													</div>
												</div>
												<Badge
													variant="outline"
													className={cn(
														"rounded-full",
														socialStatusBadgeClass(selectedTarget.status),
													)}
												>
													Selected
												</Badge>
											</div>
										</SurfaceCard>
									) : null}

									<div className="flex flex-wrap gap-2">
										{state.healthyTargets.length > 0 ? (
											<Button
												size="sm"
												variant={showChooser ? "secondary" : "outline"}
												className="rounded-full"
												disabled={!canManageSettings}
												onClick={() =>
													setFocusedProvider(
														showChooser ? null : state.provider,
													)
												}
											>
												<Target className="size-4" />
												Choose destination
											</Button>
										) : null}
										{selectedTarget ? (
											<Button
												size="sm"
												variant="outline"
												className="rounded-full"
												disabled={!canManageSettings || busyKey === `target:${selectedTarget.id}`}
												onClick={() => void selectTarget(selectedTarget, false)}
											>
												<Unplug className="size-4" />
												Deselect
											</Button>
										) : null}
										{state.connections.length > 0 ? (
											<Button
												size="sm"
												variant="outline"
												className="rounded-full"
												disabled={!canManageSettings}
												onClick={() => toggleAdvanced(state.provider)}
											>
												<KeyRound className="size-4" />
												{advancedVisible[state.provider]
													? "Hide advanced"
													: "Show advanced"}
											</Button>
										) : null}
									</div>

									{showChooser && state.healthyTargets.length > 0 ? (
										<SurfaceCard className="space-y-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
											<div>
												<div className="text-sm font-medium">
													Choose where Heimdall should publish
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													Pick one destination for the default publishing path on this provider.
												</div>
											</div>
											<div className="space-y-3">
												{state.healthyTargets.map((target) => (
													<div
														key={target.id}
														className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
													>
														<div className="flex items-start justify-between gap-3">
															<div>
																<div className="font-medium">{target.displayName}</div>
																<div className="mt-1 text-xs text-muted-foreground">
																	{target.username ? `@${target.username} • ` : ""}
																	{target.targetType.replaceAll("_", " ")}
																</div>
															</div>
															<Badge
																variant="outline"
																className={cn(
																	"rounded-full",
																	socialStatusBadgeClass(target.status),
																)}
															>
																{target.isSelected ? "Selected" : "Healthy"}
															</Badge>
														</div>
														<div className="mt-4 flex flex-wrap gap-2">
															<Button
																size="sm"
																className="rounded-full border-0 bg-gradient-brand text-white"
																disabled={
																	!canManageSettings ||
																	target.isSelected ||
																	busyKey === `target:${target.id}`
																}
																onClick={() =>
																	void selectTarget(target, true)
																}
															>
																{busyKey === `target:${target.id}` ? (
																	<LoaderCircle className="size-4 animate-spin" />
																) : (
																	<CheckCircle2 className="size-4" />
																)}
																Use this destination
															</Button>
															<Button
																size="sm"
																variant="outline"
																className="rounded-full"
																disabled={
																	!canManageSettings ||
																	busyKey === `validate:${target.id}`
																}
																onClick={() => void validateTarget(target)}
															>
																{busyKey === `validate:${target.id}` ? (
																	<LoaderCircle className="size-4 animate-spin" />
																) : (
																	<RefreshCw className="size-4" />
																)}
																Revalidate
															</Button>
														</div>
													</div>
												))}
											</div>
										</SurfaceCard>
									) : null}

									{advancedVisible[state.provider] ? (
										<Accordion type="multiple" className="w-full">
											<AccordionItem value={`${state.provider}-byok`}>
												<AccordionTrigger className="rounded-[20px] px-4 py-3 hover:no-underline">
													Use your own app credentials
												</AccordionTrigger>
												<AccordionContent className="px-1 pt-2">
													<div className="grid gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
														<div className="space-y-2">
															<Label htmlFor={`${state.provider}-client-id`}>
																{state.provider === "tiktok" ? "Client key" : "Client ID"}
															</Label>
															<Input
																id={`${state.provider}-client-id`}
																value={draft.clientId}
																onChange={(event) =>
																	updateByok(state.provider, {
																		clientId: event.target.value,
																	})
																}
																disabled={!canManageSettings}
															/>
														</div>
														<div className="space-y-2">
															<Label htmlFor={`${state.provider}-client-secret`}>
																Client secret
															</Label>
															<Input
																id={`${state.provider}-client-secret`}
																type="password"
																value={draft.clientSecret}
																onChange={(event) =>
																	updateByok(state.provider, {
																		clientSecret: event.target.value,
																	})
																}
																placeholder={
																	byokCredential?.clientSecretHint
																		? `Saved: ${byokCredential.clientSecretHint}`
																		: "Enter secret"
																}
																disabled={!canManageSettings}
															/>
														</div>
														<div className="flex flex-wrap gap-2">
															<Button
																size="sm"
																variant="outline"
																className="rounded-full"
																disabled={
																	!canManageSettings ||
																	busyKey === `byok:${state.provider}`
																}
																onClick={() => void saveByok(state.provider)}
															>
																{busyKey === `byok:${state.provider}` ? (
																	<LoaderCircle className="size-4 animate-spin" />
																) : (
																	<KeyRound className="size-4" />
																)}
																Save credentials
															</Button>
															<Button
																size="sm"
																className="rounded-full"
																disabled={
																	!canManageSettings ||
																	(!byokCredential && !draft.clientSecret) ||
																	busyKey === `oauth:${state.provider}:byok`
																}
																onClick={() =>
																	void startOAuth(state.provider, "byok")
																}
															>
																{busyKey === `oauth:${state.provider}:byok` ? (
																	<LoaderCircle className="size-4 animate-spin" />
																) : (
																	<ExternalLink className="size-4" />
																)}
																Connect advanced setup
															</Button>
														</div>
													</div>
												</AccordionContent>
											</AccordionItem>

											<AccordionItem value={`${state.provider}-details`}>
												<AccordionTrigger className="rounded-[20px] px-4 py-3 hover:no-underline">
													Connection details
												</AccordionTrigger>
												<AccordionContent className="px-1 pt-2">
													<div className="space-y-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
														{state.connections.map((connection) => (
															<div
																key={connection.id}
																className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
															>
																<div className="flex items-start justify-between gap-3">
																	<div>
																		<div className="font-medium">
																			{connection.authSubjectName}
																		</div>
																		<div className="mt-1 text-xs text-muted-foreground">
																			{connection.credentialSource === "managed"
																				? "Heimdall app"
																				: "Your own app credentials"}{" "}
																			• Connected{" "}
																			{new Date(connection.connectedAt).toLocaleString()}
																		</div>
																	</div>
																	<Badge
																		variant="outline"
																		className={cn(
																			"rounded-full",
																			socialStatusBadgeClass(connection.healthStatus),
																		)}
																	>
																		{connection.healthStatus}
																	</Badge>
																</div>
																{connection.lastValidationError ? (
																	<div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600">
																		{connection.lastValidationError}
																	</div>
																) : null}
																<div className="mt-3 flex flex-wrap gap-2">
																	{connection.scopes.map((scope) => (
																		<Badge
																			key={`${connection.id}-${scope}`}
																			variant="outline"
																			className="rounded-full"
																		>
																			{scope}
																		</Badge>
																	))}
																</div>
															</div>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
										</Accordion>
									) : null}
								</div>
							</SurfaceCard>
						);
					})}
				</div>

				{loading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Refreshing provider availability, destination selection, and connection health...
					</div>
				) : null}
				{!canManageSettings ? (
					<SurfaceCard className="border border-[var(--brand-border-soft)] bg-background/70 p-4 text-sm text-muted-foreground">
						You can review provider status here, but only users with workspace settings access can connect providers or change destinations.
					</SurfaceCard>
				) : null}
			</DashboardPanel>
		</div>
	);
}
