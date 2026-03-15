import {
	Bell,
	CheckCircle2,
	CreditCard,
	KeyRound,
	LoaderCircle,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	Unplug,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
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
import { cn } from "@/lib/utils";

const preferenceCards = [
	{
		icon: Bell,
		title: "Approval notifications",
		description: "Send reminders when posts sit in review over 4 hours.",
	},
	{
		icon: ShieldCheck,
		title: "Governance locks",
		description: "Prevent scheduling when required asset checks are missing.",
	},
	{
		icon: Sparkles,
		title: "AI assistance",
		description:
			"Allow caption and summary suggestions in compose and review surfaces.",
	},
];

type ByokDraft = {
	clientId: string;
	clientSecret: string;
};

function statusBadgeClass(status: string) {
	switch (status) {
		case "healthy":
		case "active":
		case "connected":
		case "ready":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
		case "degraded":
		case "pending":
			return "border-amber-500/20 bg-amber-500/10 text-amber-600";
		case "reauth_required":
		case "revoked":
		case "failed":
			return "border-red-500/20 bg-red-500/10 text-red-600";
		default:
			return "border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground";
	}
}

function formatStatusLabel(status: string) {
	return status
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function groupConnectionsByProvider(connections: SocialConnectionRecord[]) {
	return connections.reduce<Record<string, SocialConnectionRecord[]>>(
		(accumulator, connection) => {
			accumulator[connection.provider] ??= [];
			accumulator[connection.provider].push(connection);
			return accumulator;
		},
		{},
	);
}

export function DashboardSettings() {
	const { activeWorkspaceId, customerRequest, hasCustomerPermission } =
		useAuth();
	const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);
	const [providers, setProviders] = useState<SocialProviderAvailability[]>([]);
	const [credentials, setCredentials] = useState<SocialAppCredentialRecord[]>([]);
	const [connections, setConnections] = useState<SocialConnectionRecord[]>([]);
	const [loadingSocial, setLoadingSocial] = useState(false);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [byokDrafts, setByokDrafts] = useState<Record<string, ByokDraft>>({});

	const loadWorkspace = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		const response = await customerRequest<WorkspaceSummary>(
			`/workspaces/${activeWorkspaceId}`,
		);
		setWorkspace(response);
		setName(response.name);
	}, [activeWorkspaceId, customerRequest]);

	const loadSocial = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoadingSocial(true);
		try {
			const [providerResponse, credentialResponse, connectionResponse] =
				await Promise.all([
					customerRequest<ApiListResponse<SocialProviderAvailability>>(
						"/social/providers",
					),
					customerRequest<ApiListResponse<SocialAppCredentialRecord>>(
						"/social/credentials",
					),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
				]);
			setProviders(providerResponse.items);
			setCredentials(credentialResponse.items);
			setConnections(connectionResponse.connections);
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
			setLoadingSocial(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadWorkspace();
		void loadSocial();
	}, [loadWorkspace, loadSocial]);

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
				void loadSocial();
				return;
			}
			toast.error(payload.message ?? "Connection failed.");
		}

		window.addEventListener("message", handleOAuthMessage);
		return () => window.removeEventListener("message", handleOAuthMessage);
	}, [loadSocial]);

	const canManageSettings = hasCustomerPermission(
		"workspace.settings.manage",
		workspace?.capabilities,
	);
	const canManageBilling = hasCustomerPermission(
		"workspace.billing.manage",
		workspace?.capabilities,
	);
	const connectionsByProvider = useMemo(
		() => groupConnectionsByProvider(connections),
		[connections],
	);

	async function saveProfile() {
		if (!activeWorkspaceId) {
			return;
		}
		setSaving(true);
		try {
			const updated = await customerRequest<WorkspaceSummary>(
				`/workspaces/${activeWorkspaceId}`,
				{
					method: "PATCH",
					body: { name },
				},
			);
			setWorkspace(updated);
			setName(updated.name);
			toast.success("Workspace profile updated.");
		} finally {
			setSaving(false);
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
			toast.success(`${formatPlatformLabel(provider)} BYOK saved.`);
			await loadSocial();
			setByokDrafts((current) => ({
				...current,
				[provider]: { ...current[provider], clientSecret: "" },
			}));
		} finally {
			setBusyKey(null);
		}
	}

	async function startOAuth(provider: string, credentialSource: "managed" | "byok") {
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
						returnPath: "/dashboard/settings",
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
			await loadSocial();
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
			await loadSocial();
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
				eyebrow="Preferences"
				title="Settings"
				description="Workspace profile, social platform connections, governance controls, and billing visibility now live in one role-aware surface."
			/>

			<DashboardPanel
				title="Workspace profile"
				description="Update the workspace name and review the permissions available in the current role bundle."
			>
				<div className="grid gap-4 lg:grid-cols-2">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="space-y-2">
							<label htmlFor="workspace-name" className="text-sm font-medium">
								Workspace name
							</label>
							<Input
								id="workspace-name"
								className="h-10 rounded-2xl"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={!canManageSettings}
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="workspace-slug" className="text-sm font-medium">
								Workspace slug
							</label>
							<Input
								id="workspace-slug"
								className="h-10 rounded-2xl"
								value={workspace?.slug ?? ""}
								readOnly
							/>
						</div>
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
							disabled={!canManageSettings || saving}
							onClick={() => void saveProfile()}
						>
							{saving ? "Saving..." : "Save profile"}
						</Button>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="space-y-4 p-5">
						{preferenceCards.map((item) => (
							<div
								key={item.title}
								className="flex items-start gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
							>
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<item.icon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.description}
									</div>
								</div>
								<div className="pill pill-success">
									{canManageSettings ? "Editable" : "View"}
								</div>
							</div>
						))}
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Social connections"
				description="Connect Meta, LinkedIn, TikTok, and X using Heimdall-managed OAuth or workspace-level BYOK credentials. Targets stay validated and can be rechecked on demand."
			>
				<div className="grid gap-4 xl:grid-cols-3">
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
								tone="muted"
								className="space-y-5 p-5"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-1">
										<div className="flex items-center gap-3">
											{platformIcon(provider.provider)}
											<div className="text-lg font-medium">{provider.label}</div>
										</div>
										<div className="text-sm text-muted-foreground">
											{provider.managedStatusText}
										</div>
									</div>
									<Badge
										variant="outline"
										className={cn(
											"rounded-full",
											statusBadgeClass(provider.managedStatus),
										)}
									>
										{formatStatusLabel(provider.managedStatus)}
									</Badge>
								</div>

								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
									<div className="flex items-center justify-between gap-3">
										<div>
											<div className="font-medium">Managed app</div>
											<div className="mt-1 text-sm text-muted-foreground">
												OAuth with Heimdall credentials for the fastest setup path.
											</div>
										</div>
										<Button
											size="sm"
											className="rounded-full"
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
												<CheckCircle2 className="size-4" />
											)}
											Connect
										</Button>
									</div>
								</div>

								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
									<div className="flex items-center gap-2 text-sm font-medium">
										<KeyRound className="size-4 text-primary" />
										Bring your own app
									</div>
									<div className="mt-3 grid gap-3">
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
											<Label htmlFor={`${provider.provider}-client-secret`}>
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
												Save BYOK
											</Button>
											<Button
												size="sm"
												className="rounded-full"
												disabled={
													!canManageSettings ||
													(!byokCredential && !draft.clientSecret) ||
													busyKey === `oauth:${provider.provider}:byok`
												}
												onClick={() => void startOAuth(provider.provider, "byok")}
											>
												{busyKey === `oauth:${provider.provider}:byok` ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<CheckCircle2 className="size-4" />
												)}
												Connect with BYOK
											</Button>
										</div>
									</div>
								</div>

								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<div className="text-sm font-medium">Connections</div>
										<Badge variant="outline" className="rounded-full">
											{providerConnections.length}
										</Badge>
									</div>
									{providerConnections.length === 0 ? (
										<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] px-4 py-5 text-sm text-muted-foreground">
											No {provider.label} connections yet.
										</div>
									) : null}
									{providerConnections.map((connection) => (
										<div
											key={connection.id}
											className="space-y-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
										>
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="font-medium">
														{connection.authSubjectName}
													</div>
													<div className="mt-1 text-xs text-muted-foreground">
														{connection.credentialSource === "managed"
															? "Managed app"
															: "Workspace BYOK"}{" "}
														• Connected {new Date(connection.connectedAt).toLocaleString()}
													</div>
												</div>
												<Badge
													variant="outline"
													className={cn(
														"rounded-full",
														statusBadgeClass(connection.healthStatus),
													)}
												>
													{formatStatusLabel(connection.healthStatus)}
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
											<div className="space-y-2">
												{connection.targets.map((target) => (
													<div
														key={target.id}
														className="flex flex-col gap-3 rounded-2xl border border-[var(--brand-border-soft)] bg-background/60 p-3"
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
																	statusBadgeClass(target.status),
																)}
															>
																{target.isSelected
																	? "Selected"
																	: formatStatusLabel(target.status)}
															</Badge>
														</div>
														<div className="flex flex-wrap gap-2">
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
														<div className="flex flex-wrap gap-2">
															<Button
																size="sm"
																variant={target.isSelected ? "secondary" : "outline"}
																className="rounded-full"
																disabled={
																	!canManageSettings ||
																	busyKey === `target:${target.id}`
																}
																onClick={() =>
																	void selectTarget(target, !target.isSelected)
																}
															>
																{target.isSelected ? (
																	<Unplug className="size-4" />
																) : (
																	<CheckCircle2 className="size-4" />
																)}
																{target.isSelected ? "Deselect" : "Select target"}
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
																Validate
															</Button>
														</div>
														<div className="text-xs text-muted-foreground">
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
							</SurfaceCard>
						);
					})}
				</div>
				{loadingSocial ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Refreshing provider availability and connection health…
					</div>
				) : null}
			</DashboardPanel>

			<DashboardPanel
				title="Billing and governance"
				description="The billing module is exposed separately so finance access can be combined with other roles without a custom role builder."
			>
				<div className="grid gap-4 md:grid-cols-2">
					<SurfaceCard tone="muted" className="p-5">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<CreditCard className="size-4" />
						</div>
						<div className="mt-4 text-lg font-medium">Billing access</div>
						<div className="mt-2 text-sm text-muted-foreground">
							{canManageBilling
								? "You can manage billing for this workspace."
								: "Your current role bundle does not include billing management."}
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="p-5">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<ShieldCheck className="size-4" />
						</div>
						<div className="mt-4 text-lg font-medium">Granted capabilities</div>
						<div className="mt-2 flex flex-wrap gap-2">
							{workspace?.capabilities.map((permission) => (
								<span key={permission.code} className="pill pill-info">
									{permission.label}
								</span>
							))}
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>
		</div>
	);
}
