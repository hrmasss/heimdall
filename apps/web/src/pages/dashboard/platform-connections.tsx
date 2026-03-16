import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	KeyRound,
	LoaderCircle,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	Target,
	Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
	formatSocialStatusLabel,
	groupConnectionsByProvider,
	socialStatusBadgeClass,
	summarizeSocialConnections,
} from "@/lib/social-connections";
import { cn } from "@/lib/utils";

type ByokDraft = {
	clientId: string;
	clientSecret: string;
};

export function DashboardPlatformConnectionsPage() {
	const { activeWorkspaceId, customerRequest, hasCustomerPermission } =
		useAuth();
	const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
	const [providers, setProviders] = useState<SocialProviderAvailability[]>([]);
	const [credentials, setCredentials] = useState<SocialAppCredentialRecord[]>(
		[],
	);
	const [connections, setConnections] = useState<SocialConnectionRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [byokDrafts, setByokDrafts] = useState<Record<string, ByokDraft>>({});

	const canManageSettings = hasCustomerPermission(
		"workspace.settings.manage",
		workspace?.capabilities,
	);
	const connectionsByProvider = useMemo(
		() => groupConnectionsByProvider(connections),
		[connections],
	);
	const targets = useMemo(
		() => connections.flatMap((connection) => connection.targets),
		[connections],
	);
	const summary = useMemo(
		() => summarizeSocialConnections({ connections, targets }),
		[connections, targets],
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
				  }
				| undefined;
			if (!payload || payload.type !== "heimdall-social-oauth") {
				return;
			}
			if (payload.success) {
				toast.success(payload.message ?? "Account connected.");
				void loadPage();
				return;
			}
			toast.error(payload.message ?? "Connection failed.");
		}

		window.addEventListener("message", handleOAuthMessage);
		return () => window.removeEventListener("message", handleOAuthMessage);
	}, [loadPage]);

	async function startOAuth(
		provider: string,
		credentialSource: "managed" | "byok",
	) {
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
	}

	async function saveByok(provider: string) {
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
	}

	async function selectTarget(target: SocialTargetRecord, selected: boolean) {
		setBusyKey(`target:${target.id}`);
		try {
			await customerRequest(`/social/targets/${target.id}/select`, {
				method: "POST",
				body: { selected },
			});
			toast.success(
				selected
					? `${target.displayName} is now the active ${formatPlatformLabel(target.provider)} target.`
					: `${target.displayName} deselected.`,
			);
			await loadPage();
		} finally {
			setBusyKey(null);
		}
	}

	async function validateTarget(target: SocialTargetRecord) {
		setBusyKey(`validate:${target.id}`);
		try {
			await customerRequest(`/social/targets/${target.id}/validate`, {
				method: "POST",
				body: { checkpoint: "manual" },
			});
			toast.success(`${target.displayName} validated.`);
			await loadPage();
		} finally {
			setBusyKey(null);
		}
	}

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

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Recommended setup"
				title="Platform connections"
				description="Connect the channels your team posts to so Heimdall can publish on your behalf, schedule into real slots, validate targets, and keep follow-up workflows streamlined."
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
				<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<div className="space-y-5">
						<div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
							<Sparkles className="size-3.5" />
							Heimdall app is the recommended path
						</div>
						<div className="space-y-3">
							<h2 className="text-2xl font-semibold tracking-tight">
								Set up once, then publish and schedule from the rest of the
								workspace.
							</h2>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
								Heimdall is still useful without platform connections for
								planning, reviews, and campaign coordination. Connecting
								platforms unlocks the operational layer: direct posting,
								scheduling, target validation, publishing health, and smoother
								monitoring.
							</p>
						</div>
						<div className="grid gap-3 md:grid-cols-3">
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									1. Connect providers
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Start with the Heimdall-managed app unless your team needs
									custom app ownership.
								</div>
							</SurfaceCard>
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									2. Choose targets
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Select the actual page, organization, or account Heimdall
									should post to.
								</div>
							</SurfaceCard>
							<SurfaceCard tone="muted" className="p-4">
								<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									3. Keep health green
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Revalidate targets, fix reauth issues, and keep the publishing
									layer ready.
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
								{summary.providerCount > 0
									? "Providers already linked to this workspace"
									: "No providers connected yet"}
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Healthy connections
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{summary.healthyConnectionCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								{summary.hasHealthyConnection
									? "At least one provider is ready to publish"
									: "No healthy provider connections yet"}
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Selected targets
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{summary.selectedTargetCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								{summary.selectedTargetCount > 0
									? "These are the posting destinations Heimdall will use"
									: "Choose at least one target after connecting"}
							</div>
						</SurfaceCard>
					</div>
				</div>
			</SurfaceCard>

			<DashboardPanel
				title="Choose your setup path"
				description="Most teams should use the managed app for the fastest path. Your own app credentials are still available when ownership or custom limits matter."
			>
				<div className="grid gap-4 xl:grid-cols-2">
					<SurfaceCard className="p-5">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-lg font-medium">
									<CheckCircle2 className="size-5 text-emerald-600" />
									Use the Heimdall app
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Recommended for most workspaces. This is the fastest route to
									connecting a channel and publishing from posts or the
									calendar.
								</div>
							</div>
							<Badge
								variant="outline"
								className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
							>
								Recommended
							</Badge>
						</div>
					</SurfaceCard>
					<SurfaceCard className="p-5">
						<div className="flex items-start gap-3">
							<div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
								<KeyRound className="size-5" />
							</div>
							<div>
								<div className="text-lg font-medium">
									Use your own app credentials
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Advanced setup for teams that want their own app ownership,
									separate rate limits, or provider-specific governance.
								</div>
							</div>
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Connect providers and choose targets"
				description="Each provider card keeps setup, posting targets, and connection health together so the flow stays easy to understand."
			>
				<div className="grid gap-4 xl:grid-cols-2">
					{providers.map((provider) => {
						const byokCredential = credentials.find(
							(item) =>
								item.provider === provider.provider && item.source === "byok",
						);
						const providerConnections =
							connectionsByProvider[provider.provider] ?? [];
						const draft = byokDrafts[provider.provider] ?? {
							clientId: byokCredential?.clientId ?? "",
							clientSecret: "",
						};

						return (
							<SurfaceCard
								key={provider.provider}
								className="overflow-hidden rounded-[28px] border border-[var(--brand-border-soft)] p-0"
							>
								<div className="border-b border-[var(--brand-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,0.66))] p-5 dark:bg-[linear-gradient(180deg,rgba(41,30,23,0.94),rgba(28,21,17,0.82))]">
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-2">
											<div className="flex items-center gap-3 text-lg font-medium">
												{platformIcon(provider.provider)}
												{provider.label}
											</div>
											<div className="text-sm text-muted-foreground">
												{provider.managedStatusText ??
													"Connect this provider to unlock publishing and scheduling."}
											</div>
										</div>
										<Badge
											variant="outline"
											className={cn(
												"rounded-full",
												socialStatusBadgeClass(provider.managedStatus),
											)}
										>
											{formatSocialStatusLabel(provider.managedStatus)}
										</Badge>
									</div>
								</div>

								<div className="space-y-5 p-5">
									<div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-4">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div className="space-y-1">
												<div className="flex items-center gap-2 text-sm font-medium text-foreground">
													<ShieldCheck className="size-4 text-emerald-600" />
													Use the Heimdall app
												</div>
												<div className="text-sm text-muted-foreground">
													Fastest setup path for teams that want to connect and
													start publishing quickly.
												</div>
											</div>
											<Button
												size="sm"
												className="rounded-full border-0 bg-gradient-brand text-white"
												disabled={
													!canManageSettings ||
													!provider.managedAvailable ||
													busyKey === `oauth:${provider.provider}:managed`
												}
												onClick={() =>
													void startOAuth(provider.provider, "managed")
												}
											>
												{busyKey === `oauth:${provider.provider}:managed` ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<ExternalLink className="size-4" />
												)}
												Connect
											</Button>
										</div>
									</div>

									<Accordion type="single" collapsible>
										<AccordionItem value={`${provider.provider}-advanced`}>
											<AccordionTrigger className="rounded-[20px] px-4 py-3 hover:no-underline">
												<div>
													<div className="text-sm font-medium">
														Use your own app credentials
													</div>
													<div className="mt-1 text-sm font-normal text-muted-foreground">
														Advanced setup for custom app ownership and provider
														control.
													</div>
												</div>
											</AccordionTrigger>
											<AccordionContent className="px-1 pt-2">
												<div className="grid gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
													<div className="space-y-2">
														<Label htmlFor={`${provider.provider}-client-id`}>
															{provider.provider === "tiktok"
																? "Client key"
																: "Client ID"}
														</Label>
														<Input
															id={`${provider.provider}-client-id`}
															value={draft.clientId}
															onChange={(event) =>
																updateByok(provider.provider, {
																	clientId: event.target.value,
																})
															}
															disabled={!canManageSettings}
														/>
													</div>
													<div className="space-y-2">
														<Label
															htmlFor={`${provider.provider}-client-secret`}
														>
															Client secret
														</Label>
														<Input
															id={`${provider.provider}-client-secret`}
															type="password"
															value={draft.clientSecret}
															onChange={(event) =>
																updateByok(provider.provider, {
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
																busyKey === `byok:${provider.provider}`
															}
															onClick={() => void saveByok(provider.provider)}
														>
															{busyKey === `byok:${provider.provider}` ? (
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
																busyKey === `oauth:${provider.provider}:byok`
															}
															onClick={() =>
																void startOAuth(provider.provider, "byok")
															}
														>
															{busyKey === `oauth:${provider.provider}:byok` ? (
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
									</Accordion>

									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 text-sm font-medium">
												<Target className="size-4 text-primary" />
												Connected accounts and targets
											</div>
											<Badge variant="outline" className="rounded-full">
												{providerConnections.length}
											</Badge>
										</div>
										{providerConnections.length === 0 ? (
											<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] bg-background/45 px-4 py-5 text-sm text-muted-foreground">
												Connect {provider.label} first, then choose which page,
												organization, or account Heimdall should use.
											</div>
										) : null}
										{providerConnections.map((connection) => (
											<div
												key={connection.id}
												className="space-y-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4"
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
															{new Date(
																connection.connectedAt,
															).toLocaleString()}
														</div>
													</div>
													<Badge
														variant="outline"
														className={cn(
															"rounded-full",
															socialStatusBadgeClass(connection.healthStatus),
														)}
													>
														{formatSocialStatusLabel(connection.healthStatus)}
													</Badge>
												</div>
												{connection.lastValidationError ? (
													<div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600">
														{connection.lastValidationError}
													</div>
												) : null}
												<div className="flex flex-wrap gap-2">
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
												<div className="space-y-3">
													{connection.targets.map((target) => (
														<div
															key={target.id}
															className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
														>
															<div className="flex items-start justify-between gap-3">
																<div>
																	<div className="font-medium">
																		{target.displayName}
																	</div>
																	<div className="mt-1 text-xs text-muted-foreground">
																		{target.username
																			? `@${target.username} • `
																			: ""}
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
																	{target.isSelected
																		? "Selected"
																		: formatSocialStatusLabel(target.status)}
																</Badge>
															</div>
															<div className="mt-3 flex flex-wrap gap-2">
																{target.scopeSnapshot.map((scope) => (
																	<Badge
																		key={`${target.id}-${scope}`}
																		variant="outline"
																		className="rounded-full"
																	>
																		{scope}
																	</Badge>
																))}
															</div>
															<div className="mt-4 flex flex-wrap gap-2">
																<Button
																	size="sm"
																	variant={
																		target.isSelected ? "secondary" : "outline"
																	}
																	className="rounded-full"
																	disabled={
																		!canManageSettings ||
																		busyKey === `target:${target.id}`
																	}
																	onClick={() =>
																		void selectTarget(
																			target,
																			!target.isSelected,
																		)
																	}
																>
																	{target.isSelected ? (
																		<Unplug className="size-4" />
																	) : (
																		<CheckCircle2 className="size-4" />
																	)}
																	{target.isSelected
																		? "Deselect target"
																		: "Use this target"}
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
																	Validate target
																</Button>
															</div>
															<div className="mt-3 text-xs text-muted-foreground">
																Last checked:{" "}
																{target.lastValidatedAt
																	? new Date(
																			target.lastValidatedAt,
																		).toLocaleString()
																	: "Not yet"}
															</div>
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
							</SurfaceCard>
						);
					})}
				</div>
				{loading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Refreshing provider availability, targets, and connection health...
					</div>
				) : null}
				{!canManageSettings ? (
					<SurfaceCard className="border border-[var(--brand-border-soft)] bg-background/70 p-4 text-sm text-muted-foreground">
						You can review connection health here, but only users with workspace
						settings access can connect providers or change targets.
					</SurfaceCard>
				) : null}
			</DashboardPanel>
		</div>
	);
}
