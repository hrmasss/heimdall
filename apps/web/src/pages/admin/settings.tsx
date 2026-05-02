import {
	Bell,
	Globe,
	Key,
	Lock,
	Plus,
	RefreshCw,
	Save,
	Server,
	Shield,
	Trash2,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
	PlatformAICredential,
	PlatformAIFallbackRoute,
	PlatformAIProvider,
	PlatformAISettings,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const settingsSections = [
	{ id: "general", label: "General", icon: Globe },
	{ id: "security", label: "Security", icon: Shield },
	{ id: "notifications", label: "Notifications", icon: Bell },
	{ id: "integrations", label: "Integrations", icon: Server },
];

type CredentialDraft = {
	provider: string;
	label: string;
	apiKey: string;
	position: number;
	allowedModels: string;
	status: string;
};

const emptyCredentialDraft: CredentialDraft = {
	provider: "openai",
	label: "",
	apiKey: "",
	position: 0,
	allowedModels: "",
	status: "active",
};

function splitModels(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function providerTone(provider: PlatformAIProvider) {
	if (provider.healthyCount > 0) {
		return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
	}
	if (provider.credentialCount > 0) {
		return "bg-amber-500/10 text-amber-600 border-amber-500/20";
	}
	return "bg-muted text-muted-foreground";
}

export function AdminSettings() {
	const [activeSection, setActiveSection] = useState("general");
	const { platformRequest } = useAuth();
	const [aiSettings, setAISettings] = useState<PlatformAISettings | null>(null);
	const [loadingAI, setLoadingAI] = useState(false);
	const [savingAI, setSavingAI] = useState(false);
	const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
	const [credentialDraft, setCredentialDraft] =
		useState<CredentialDraft>(emptyCredentialDraft);

	const providerOptions = aiSettings?.providers ?? [];
	const credentialsByProvider = useMemo(() => {
		const result: Record<string, PlatformAICredential[]> = {};
		for (const credential of aiSettings?.credentials ?? []) {
			result[credential.provider] = [
				...(result[credential.provider] ?? []),
				credential,
			];
		}
		return result;
	}, [aiSettings]);

	useEffect(() => {
		if (activeSection !== "integrations" || aiSettings) {
			return;
		}
		void loadAISettings();
	}, [activeSection, aiSettings]);

	async function loadAISettings() {
		setLoadingAI(true);
		try {
			const response = await platformRequest<PlatformAISettings>(
				"/platform/ai/settings",
			);
			setAISettings(response);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to load AI settings.",
			);
		} finally {
			setLoadingAI(false);
		}
	}

	async function saveAISettings(nextSettings = aiSettings) {
		if (!nextSettings) {
			return;
		}
		setSavingAI(true);
		try {
			const response = await platformRequest<PlatformAISettings>(
				"/platform/ai/settings",
				{
					method: "PATCH",
					body: {
						providers: nextSettings.providers.map((provider) => ({
							provider: provider.provider,
							defaultModel: provider.defaultModel,
							approvedModels: provider.approvedModels,
							baseUrl: provider.baseUrl,
							strategy: provider.strategy,
						})),
						fallbackRoutes: nextSettings.fallbackRoutes.map((route) => ({
							id: route.id,
							provider: route.provider,
							model: route.model,
							position: route.position,
							enabled: route.enabled,
						})),
					},
				},
			);
			setAISettings(response);
			toast.success("AI inference routing updated.");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to save AI settings.",
			);
		} finally {
			setSavingAI(false);
		}
	}

	async function createCredential() {
		setSavingAI(true);
		try {
			await platformRequest<PlatformAICredential>("/platform/ai/credentials", {
				method: "POST",
				body: {
					provider: credentialDraft.provider,
					label: credentialDraft.label,
					apiKey: credentialDraft.apiKey,
					position: credentialDraft.position,
					allowedModels: splitModels(credentialDraft.allowedModels),
					status: credentialDraft.status,
				},
			});
			setCredentialDialogOpen(false);
			setCredentialDraft(emptyCredentialDraft);
			await loadAISettings();
			toast.success("Credential added.");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to add credential.",
			);
		} finally {
			setSavingAI(false);
		}
	}

	async function deleteCredential(credential: PlatformAICredential) {
		setSavingAI(true);
		try {
			await platformRequest(`/platform/ai/credentials/${credential.id}`, {
				method: "DELETE",
			});
			await loadAISettings();
			toast.success("Credential removed.");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to remove credential.",
			);
		} finally {
			setSavingAI(false);
		}
	}

	async function testCredential(credential: PlatformAICredential) {
		setSavingAI(true);
		try {
			await platformRequest<PlatformAICredential>(
				`/platform/ai/credentials/${credential.id}/test`,
				{ method: "POST" },
			);
			await loadAISettings();
			toast.success("Credential test succeeded.");
		} catch (error) {
			await loadAISettings();
			toast.error(
				error instanceof Error ? error.message : "Credential test failed.",
			);
		} finally {
			setSavingAI(false);
		}
	}

	function updateProvider(
		providerId: string,
		updater: (provider: PlatformAIProvider) => PlatformAIProvider,
	) {
		setAISettings((current) =>
			current
				? {
						...current,
						providers: current.providers.map((provider) =>
							provider.provider === providerId ? updater(provider) : provider,
						),
					}
				: current,
		);
	}

	function updateRoute(
		route: PlatformAIFallbackRoute,
		patch: Partial<PlatformAIFallbackRoute>,
	) {
		setAISettings((current) =>
			current
				? {
						...current,
						fallbackRoutes: current.fallbackRoutes.map((item) =>
							item.id === route.id ? { ...item, ...patch } : item,
						),
					}
				: current,
		);
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Configuration"
				title="Admin Settings"
				description="Configure system-wide settings and preferences"
			/>

			<div className="grid gap-6 lg:grid-cols-[240px_1fr]">
				<SurfaceCard className="h-fit p-3">
					<nav className="space-y-1">
						{settingsSections.map((section) => (
							<button
								key={section.id}
								type="button"
								onClick={() => setActiveSection(section.id)}
								className={cn(
									"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
									activeSection === section.id
										? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
										: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
								)}
							>
								<section.icon className="size-4" />
								{section.label}
							</button>
						))}
					</nav>
				</SurfaceCard>

				<div className="space-y-6">
					{activeSection === "general" && (
						<>
							<DashboardPanel
								title="Site Settings"
								description="Basic configuration for the platform"
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="grid gap-2">
										<Label htmlFor="site-name">Site name</Label>
										<Input
											id="site-name"
											defaultValue="Heimdall"
											className="rounded-xl"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="site-url">Site URL</Label>
										<Input
											id="site-url"
											defaultValue="https://heimdall.io"
											className="rounded-xl"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="support-email">Support email</Label>
										<Input
											id="support-email"
											defaultValue="support@heimdall.io"
											className="rounded-xl"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="timezone">Default timezone</Label>
										<NativeSelect defaultValue="utc" className="rounded-xl">
											<NativeSelectOption value="utc">UTC</NativeSelectOption>
											<NativeSelectOption value="est">
												Eastern Time
											</NativeSelectOption>
											<NativeSelectOption value="pst">
												Pacific Time
											</NativeSelectOption>
											<NativeSelectOption value="gmt">GMT</NativeSelectOption>
										</NativeSelect>
									</div>
								</div>
								<div className="mt-4 flex justify-end">
									<Button className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
										<Save className="size-4" />
										Save Changes
									</Button>
								</div>
							</DashboardPanel>

							<DashboardPanel
								title="Maintenance Mode"
								description="Temporarily disable access to the platform"
							>
								<div className="flex items-center justify-between rounded-xl border border-[var(--brand-border-soft)] p-4">
									<div>
										<div className="font-medium">Enable maintenance mode</div>
										<div className="text-sm text-muted-foreground">
											Users will see a maintenance page instead of the app
										</div>
									</div>
									<Switch />
								</div>
							</DashboardPanel>
						</>
					)}

					{activeSection === "security" && (
						<>
							<DashboardPanel
								title="Authentication"
								description="Configure login and access settings"
							>
								<div className="space-y-4">
									<div className="flex items-center justify-between rounded-xl border border-[var(--brand-border-soft)] p-4">
										<div className="flex items-center gap-3">
											<div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
												<Lock className="size-5" />
											</div>
											<div>
												<div className="font-medium">
													Require 2FA for admins
												</div>
												<div className="text-sm text-muted-foreground">
													All admin accounts must have two-factor authentication
												</div>
											</div>
										</div>
										<Switch defaultChecked />
									</div>

									<div className="flex items-center justify-between rounded-xl border border-[var(--brand-border-soft)] p-4">
										<div className="flex items-center gap-3">
											<div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
												<Users className="size-5" />
											</div>
											<div>
												<div className="font-medium">Allow SSO login</div>
												<div className="text-sm text-muted-foreground">
													Enable Google and Microsoft SSO for users
												</div>
											</div>
										</div>
										<Switch defaultChecked />
									</div>

									<div className="flex items-center justify-between rounded-xl border border-[var(--brand-border-soft)] p-4">
										<div className="flex items-center gap-3">
											<div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
												<Key className="size-5" />
											</div>
											<div>
												<div className="font-medium">Password requirements</div>
												<div className="text-sm text-muted-foreground">
													Minimum 12 characters with special characters
												</div>
											</div>
										</div>
										<NativeSelect
											defaultValue="strong"
											className="w-32 rounded-xl"
										>
											<NativeSelectOption value="basic">
												Basic
											</NativeSelectOption>
											<NativeSelectOption value="strong">
												Strong
											</NativeSelectOption>
											<NativeSelectOption value="strict">
												Strict
											</NativeSelectOption>
										</NativeSelect>
									</div>
								</div>
							</DashboardPanel>

							<DashboardPanel
								title="Session Management"
								description="Control user session behavior"
							>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="grid gap-2">
										<Label htmlFor="session-timeout">
											Session timeout (minutes)
										</Label>
										<Input
											id="session-timeout"
											type="number"
											defaultValue="60"
											className="rounded-xl"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="max-sessions">
											Max concurrent sessions
										</Label>
										<Input
											id="max-sessions"
											type="number"
											defaultValue="5"
											className="rounded-xl"
										/>
									</div>
								</div>
							</DashboardPanel>
						</>
					)}

					{activeSection === "notifications" && (
						<DashboardPanel
							title="Email Notifications"
							description="Configure system email settings"
						>
							<div className="space-y-4">
								{[
									{
										title: "New user registrations",
										description: "Get notified when a new user signs up",
									},
									{
										title: "Failed payment attempts",
										description: "Alert when subscription payments fail",
									},
									{
										title: "Security alerts",
										description: "Suspicious login attempts or breaches",
									},
									{
										title: "Daily digest",
										description: "Summary of platform activity",
									},
									{
										title: "Weekly reports",
										description: "Analytics and growth metrics",
									},
								].map((item, index) => (
									<div
										key={item.title}
										className="flex items-center justify-between rounded-xl border border-[var(--brand-border-soft)] p-4"
									>
										<div>
											<div className="font-medium">{item.title}</div>
											<div className="text-sm text-muted-foreground">
												{item.description}
											</div>
										</div>
										<Switch defaultChecked={index < 3} />
									</div>
								))}
							</div>
						</DashboardPanel>
					)}

					{activeSection === "integrations" && (
						<DashboardPanel
							title="AI Inference"
							description="Manage native provider credentials, fallback order, and cooldown-aware routing for customer workspaces."
							action={
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										className="rounded-full"
										disabled={loadingAI || savingAI}
										onClick={() => void loadAISettings()}
									>
										<RefreshCw className="size-4" />
										Refresh
									</Button>
									<Button
										className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
										disabled={!aiSettings || savingAI}
										onClick={() => void saveAISettings()}
									>
										<Save className="size-4" />
										Save routing
									</Button>
								</div>
							}
						>
							{loadingAI && !aiSettings ? (
								<div className="rounded-xl border border-[var(--brand-border-soft)] p-4 text-sm text-muted-foreground">
									Loading AI inference settings...
								</div>
							) : aiSettings ? (
								<div className="space-y-5">
									<div className="grid gap-4 xl:grid-cols-3">
										{aiSettings.providers.map((provider) => (
											<div
												key={provider.provider}
												className="space-y-4 rounded-xl border border-[var(--brand-border-soft)] p-4"
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<div className="font-medium">{provider.label}</div>
														<div className="mt-1 text-sm text-muted-foreground">
															{provider.defaultModel}
														</div>
													</div>
													<Badge
														variant="outline"
														className={cn(
															"rounded-full",
															providerTone(provider),
														)}
													>
														{provider.healthyCount}/{provider.credentialCount}{" "}
														healthy
													</Badge>
												</div>
												<div className="grid gap-3">
													<div className="grid gap-2">
														<Label>Default model</Label>
														<Input
															value={provider.defaultModel}
															onChange={(event) =>
																updateProvider(provider.provider, (item) => ({
																	...item,
																	defaultModel: event.target.value,
																}))
															}
															className="rounded-xl"
														/>
													</div>
													<div className="grid gap-2">
														<Label>Base URL</Label>
														<Input
															value={provider.baseUrl}
															onChange={(event) =>
																updateProvider(provider.provider, (item) => ({
																	...item,
																	baseUrl: event.target.value,
																}))
															}
															className="rounded-xl"
														/>
													</div>
													<div className="grid gap-2">
														<Label>Approved models</Label>
														<Input
															value={provider.approvedModels.join(", ")}
															onChange={(event) =>
																updateProvider(provider.provider, (item) => ({
																	...item,
																	approvedModels: splitModels(
																		event.target.value,
																	),
																}))
															}
															className="rounded-xl"
														/>
													</div>
													<div className="grid gap-2">
														<Label>Routing</Label>
														<ToggleGroup
															type="single"
															value={provider.strategy}
															onValueChange={(value) =>
																value
																	? updateProvider(
																			provider.provider,
																			(item) => ({
																				...item,
																				strategy:
																					value as PlatformAIProvider["strategy"],
																			}),
																		)
																	: undefined
															}
															className="rounded-xl border border-[var(--brand-border-soft)]"
															variant="outline"
														>
															<ToggleGroupItem value="first_healthy">
																First healthy
															</ToggleGroupItem>
															<ToggleGroupItem value="round_robin">
																Round robin
															</ToggleGroupItem>
														</ToggleGroup>
													</div>
												</div>
												<div className="space-y-2">
													<div className="flex items-center justify-between">
														<Label>Credentials</Label>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => {
																setCredentialDraft({
																	...emptyCredentialDraft,
																	provider: provider.provider,
																	position:
																		(credentialsByProvider[provider.provider]
																			?.length ?? 0) + 1,
																});
																setCredentialDialogOpen(true);
															}}
														>
															<Plus className="size-4" />
															Add
														</Button>
													</div>
													<div className="space-y-2">
														{(
															credentialsByProvider[provider.provider] ?? []
														).map((credential) => (
															<div
																key={credential.id}
																className="flex items-center justify-between gap-3 rounded-xl border border-[var(--brand-border-soft)] px-3 py-2"
															>
																<div className="min-w-0">
																	<div className="truncate text-sm font-medium">
																		{credential.label}
																	</div>
																	<div className="truncate font-mono text-xs text-muted-foreground">
																		{credential.keyHint} -{" "}
																		{credential.healthStatus}
																	</div>
																</div>
																<div className="flex shrink-0 gap-1">
																	<Button
																		variant="ghost"
																		size="icon-sm"
																		disabled={savingAI}
																		onClick={() =>
																			void testCredential(credential)
																		}
																	>
																		<RefreshCw className="size-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="icon-sm"
																		disabled={savingAI}
																		onClick={() =>
																			void deleteCredential(credential)
																		}
																	>
																		<Trash2 className="size-4" />
																	</Button>
																</div>
															</div>
														))}
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="rounded-xl border border-[var(--brand-border-soft)] p-4">
										<div className="mb-4 flex items-center justify-between gap-3">
											<div>
												<div className="font-medium">
													Cross-provider fallback
												</div>
												<div className="text-sm text-muted-foreground">
													Used only after native same-provider credentials are
													exhausted.
												</div>
											</div>
											<Button
												type="button"
												variant="outline"
												className="rounded-full"
												onClick={() =>
													setAISettings((current) =>
														current
															? {
																	...current,
																	fallbackRoutes: [
																		...current.fallbackRoutes,
																		{
																			id: `new-${Date.now()}`,
																			provider:
																				providerOptions[0]?.provider ??
																				"openai",
																			model:
																				providerOptions[0]?.defaultModel ?? "",
																			position: current.fallbackRoutes.length,
																			enabled: true,
																		},
																	],
																}
															: current,
													)
												}
											>
												<Plus className="size-4" />
												Add route
											</Button>
										</div>
										<div className="space-y-3">
											{aiSettings.fallbackRoutes.map((route, index) => {
												const provider = providerOptions.find(
													(item) => item.provider === route.provider,
												);
												return (
													<div
														key={route.id}
														className="grid gap-3 rounded-xl border border-[var(--brand-border-soft)] p-3 md:grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_90px]"
													>
														<NativeSelect
															value={route.enabled ? "enabled" : "disabled"}
															onChange={(event) =>
																updateRoute(route, {
																	enabled: event.target.value === "enabled",
																})
															}
															className="rounded-xl"
														>
															<NativeSelectOption value="enabled">
																Enabled
															</NativeSelectOption>
															<NativeSelectOption value="disabled">
																Disabled
															</NativeSelectOption>
														</NativeSelect>
														<NativeSelect
															value={route.provider}
															onChange={(event) => {
																const nextProvider = providerOptions.find(
																	(item) =>
																		item.provider === event.target.value,
																);
																updateRoute(route, {
																	provider: event.target.value,
																	model:
																		nextProvider?.defaultModel ?? route.model,
																});
															}}
															className="rounded-xl"
														>
															{providerOptions.map((item) => (
																<NativeSelectOption
																	key={item.provider}
																	value={item.provider}
																>
																	{item.label}
																</NativeSelectOption>
															))}
														</NativeSelect>
														<Input
															value={
																route.model || provider?.defaultModel || ""
															}
															onChange={(event) =>
																updateRoute(route, {
																	model: event.target.value,
																})
															}
															className="rounded-xl"
														/>
														<Input
															type="number"
															value={route.position || index}
															onChange={(event) =>
																updateRoute(route, {
																	position: Number(event.target.value),
																})
															}
															className="rounded-xl"
														/>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							) : (
								<div className="rounded-xl border border-[var(--brand-border-soft)] p-4 text-sm text-muted-foreground">
									AI inference settings are unavailable.
								</div>
							)}

							<Dialog
								open={credentialDialogOpen}
								onOpenChange={setCredentialDialogOpen}
							>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Add AI Credential</DialogTitle>
									</DialogHeader>
									<div className="grid gap-4 py-2">
										<div className="grid gap-2">
											<Label>Provider</Label>
											<NativeSelect
												value={credentialDraft.provider}
												onChange={(event) =>
													setCredentialDraft((current) => ({
														...current,
														provider: event.target.value,
													}))
												}
												className="rounded-xl"
											>
												{providerOptions.map((provider) => (
													<NativeSelectOption
														key={provider.provider}
														value={provider.provider}
													>
														{provider.label}
													</NativeSelectOption>
												))}
											</NativeSelect>
										</div>
										<div className="grid gap-2">
											<Label>Label</Label>
											<Input
												value={credentialDraft.label}
												onChange={(event) =>
													setCredentialDraft((current) => ({
														...current,
														label: event.target.value,
													}))
												}
												placeholder="Production pool key"
												className="rounded-xl"
											/>
										</div>
										<div className="grid gap-2">
											<Label>Token</Label>
											<Input
												value={credentialDraft.apiKey}
												type="password"
												onChange={(event) =>
													setCredentialDraft((current) => ({
														...current,
														apiKey: event.target.value,
													}))
												}
												placeholder="Paste provider token"
												className="rounded-xl"
											/>
										</div>
										<div className="grid gap-2">
											<Label>Allowed models</Label>
											<Input
												value={credentialDraft.allowedModels}
												onChange={(event) =>
													setCredentialDraft((current) => ({
														...current,
														allowedModels: event.target.value,
													}))
												}
												placeholder="Comma-separated, blank uses provider defaults"
												className="rounded-xl"
											/>
										</div>
									</div>
									<DialogFooter>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={() => setCredentialDialogOpen(false)}
										>
											Cancel
										</Button>
										<Button
											className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
											disabled={
												savingAI || credentialDraft.apiKey.trim() === ""
											}
											onClick={() => void createCredential()}
										>
											Add credential
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</DashboardPanel>
					)}
				</div>
			</div>
		</div>
	);
}
