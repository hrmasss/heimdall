import {
	AlertTriangle,
	ArrowRight,
	BrainCircuit,
	CheckCircle2,
	KeyRound,
	Palette,
	Plus,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
	AIModelSelection,
	AIProviderCatalog,
	ApiListResponse,
	ContextFact,
	ResourceRecord,
	WorkspaceAISettings,
	WorkspaceContextResponse,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const useCaseOptions = [
	{ value: "post_generation", label: "Post generation" },
	{ value: "campaign_planning", label: "Campaign planning" },
	{ value: "image_generation", label: "Image generation" },
	{ value: "reel_generation", label: "Reel generation" },
] as const;

type CredentialDraft = {
	id?: string;
	position: number;
	status: string;
	apiKey: string;
	keyHint?: string;
};

function createBlankFact(): ContextFact {
	return {
		key: "",
		label: "",
		value: "",
		appliesTo: ["post_generation"],
		importance: "medium",
	};
}

function createBlankCredential(position = 0): CredentialDraft {
	return {
		position,
		status: "active",
		apiKey: "",
		keyHint: "",
	};
}

function splitLines(value: string) {
	return value
		.split(/\r?\n|,/g)
		.map((item) => item.trim())
		.filter(Boolean);
}

function tokenValue(source: Record<string, unknown>, key: string) {
	const value = source[key];
	return typeof value === "string" ? value : "";
}

function setTokenValue(
	source: Record<string, unknown>,
	key: string,
	value: string,
) {
	const next = { ...source };
	if (value.trim()) {
		next[key] = value.trim();
	} else {
		delete next[key];
	}
	return next;
}

function groupCredentialDrafts(
	settings: WorkspaceAISettings,
	providers: string[],
) {
	const grouped = Object.fromEntries(
		providers.map((provider) => [provider, [createBlankCredential()]]),
	) as Record<string, CredentialDraft[]>;

	for (const credential of settings.credentials) {
		const current = grouped[credential.provider] ?? [];
		current.push({
			id: credential.id,
			position: credential.position,
			status: credential.status,
			apiKey: "",
			keyHint: credential.keyHint,
		});
		grouped[credential.provider] =
			current[0]?.id === undefined && current.length > 1 ? current.slice(1) : current;
	}

	return grouped;
}

function normalizeCapabilityDefaults(
	catalog: AIProviderCatalog | null,
	defaults: Record<string, AIModelSelection>,
) {
	const providers = catalog?.providers ?? [];
	const fallbackProvider = providers[0]?.provider ?? "openai";
	const fallbackModel =
		providers[0]?.defaultModel ?? providers[0]?.approvedModels[0] ?? "";
	const result: Record<string, AIModelSelection> = {};

	for (const item of useCaseOptions) {
		const existing = defaults[item.value];
		const provider =
			existing?.provider && providers.some((entry) => entry.provider === existing.provider)
				? existing.provider
				: fallbackProvider;
		const providerConfig = providers.find((entry) => entry.provider === provider);
		result[item.value] = {
			provider,
			model:
				existing?.model &&
				providerConfig?.approvedModels.includes(existing.model)
					? existing.model
					: providerConfig?.defaultModel ??
						providerConfig?.approvedModels[0] ??
						fallbackModel,
		};
	}

	return result;
}

export function DashboardSettingsIntelligencePage() {
	const [searchParams] = useSearchParams();
	const onboardingMode = searchParams.get("onboarding") === "1";
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [activeTab, setActiveTab] = useState("business");
	const [loading, setLoading] = useState(true);
	const [savingBusiness, setSavingBusiness] = useState(false);
	const [savingBrand, setSavingBrand] = useState(false);
	const [savingAI, setSavingAI] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [context, setContext] = useState<WorkspaceContextResponse | null>(null);
	const [catalog, setCatalog] = useState<AIProviderCatalog | null>(null);
	const [settings, setSettings] = useState<WorkspaceAISettings | null>(null);
	const [resources, setResources] = useState<ResourceRecord[]>([]);

	const [businessNarrative, setBusinessNarrative] = useState("");
	const [businessSummary, setBusinessSummary] = useState("");
	const [understandingScore, setUnderstandingScore] = useState("0");
	const [missingGapsInput, setMissingGapsInput] = useState("");
	const [facts, setFacts] = useState<ContextFact[]>([createBlankFact()]);

	const [brandNarrative, setBrandNarrative] = useState("");
	const [brandSummary, setBrandSummary] = useState("");
	const [brandMissingGapsInput, setBrandMissingGapsInput] = useState("");
	const [visualGuardrailsInput, setVisualGuardrailsInput] = useState("");
	const [referenceResourceId, setReferenceResourceId] = useState<string>("");
	const [primaryColor, setPrimaryColor] = useState("");
	const [secondaryColor, setSecondaryColor] = useState("");
	const [accentColor, setAccentColor] = useState("");
	const [typography, setTypography] = useState("");
	const [visualStyle, setVisualStyle] = useState("");
	const [compositionCues, setCompositionCues] = useState("");
	const [prohibitedMotifs, setProhibitedMotifs] = useState("");

	const [defaultMode, setDefaultMode] = useState<"native" | "byok">("native");
	const [capabilityDefaults, setCapabilityDefaults] = useState<
		Record<string, AIModelSelection>
	>({});
	const [credentialDrafts, setCredentialDrafts] = useState<
		Record<string, CredentialDraft[]>
	>({});

	const imageResources = useMemo(
		() => resources.filter((resource) => resource.mediaKind === "image"),
		[resources],
	);
	const providerEntries = catalog?.providers ?? [];
	const providerMap = useMemo(
		() => new Map(providerEntries.map((entry) => [entry.provider, entry])),
		[providerEntries],
	);

	const loadPage = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [contextResponse, settingsResponse, catalogResponse, resourcesResponse] =
				await Promise.all([
					customerRequest<WorkspaceContextResponse>(
						`/workspaces/${activeWorkspaceId}/ai/context`,
					),
					customerRequest<WorkspaceAISettings>(
						`/workspaces/${activeWorkspaceId}/ai/settings`,
					),
					customerRequest<AIProviderCatalog>(
						`/workspaces/${activeWorkspaceId}/ai/catalog`,
					),
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
				]);

			setContext(contextResponse);
			setSettings(settingsResponse);
			setCatalog(catalogResponse);
			setResources(resourcesResponse.items);

			setBusinessNarrative(contextResponse.business.narrative);
			setBusinessSummary(contextResponse.business.summary);
			setUnderstandingScore(String(contextResponse.business.understandingScore));
			setMissingGapsInput(contextResponse.business.missingGaps.join("\n"));
			setFacts(
				contextResponse.business.facts.length > 0
					? contextResponse.business.facts
					: [createBlankFact()],
			);

			setBrandNarrative(contextResponse.brand.narrative);
			setBrandSummary(contextResponse.brand.summary);
			setBrandMissingGapsInput(contextResponse.brand.missingGaps.join("\n"));
			setVisualGuardrailsInput(contextResponse.brand.visualGuardrails.join("\n"));
			setReferenceResourceId(contextResponse.brand.referenceResourceId ?? "");
			setPrimaryColor(tokenValue(contextResponse.brand.designTokens, "primaryColor"));
			setSecondaryColor(
				tokenValue(contextResponse.brand.designTokens, "secondaryColor"),
			);
			setAccentColor(tokenValue(contextResponse.brand.designTokens, "accentColor"));
			setTypography(tokenValue(contextResponse.brand.designTokens, "typography"));
			setVisualStyle(tokenValue(contextResponse.brand.designTokens, "visualStyle"));
			setCompositionCues(
				tokenValue(contextResponse.brand.designTokens, "compositionCues"),
			);
			setProhibitedMotifs(
				tokenValue(contextResponse.brand.designTokens, "prohibitedMotifs"),
			);

			setDefaultMode(settingsResponse.defaultMode);
			setCapabilityDefaults(
				normalizeCapabilityDefaults(
					catalogResponse,
					settingsResponse.capabilityDefaults,
				),
			);
			setCredentialDrafts(
				groupCredentialDrafts(
					settingsResponse,
					catalogResponse.providers.map((entry) => entry.provider),
				),
			);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load workspace intelligence.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadPage();
	}, [loadPage]);

	async function saveBusinessContext() {
		if (!activeWorkspaceId) {
			return;
		}
		setSavingBusiness(true);
		setError(null);
		try {
			await customerRequest(
				`/workspaces/${activeWorkspaceId}/ai/context/business`,
				{
					method: "PATCH",
					body: {
						narrative: businessNarrative,
						summary: businessSummary,
						understandingScore: Number(understandingScore || 0),
						missingGaps: splitLines(missingGapsInput),
						facts: facts
							.map((fact) => ({
								...fact,
								key: fact.key.trim(),
								label: fact.label.trim(),
								value: fact.value.trim(),
								appliesTo: fact.appliesTo,
							}))
							.filter((fact) => fact.key && fact.label && fact.value),
					},
				},
			);
			toast.success("Business context updated.");
			await loadPage();
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to update business context.",
			);
		} finally {
			setSavingBusiness(false);
		}
	}

	async function saveBrandContext() {
		if (!activeWorkspaceId || !context) {
			return;
		}
		setSavingBrand(true);
		setError(null);
		try {
			let designTokens = { ...context.brand.designTokens };
			designTokens = setTokenValue(designTokens, "primaryColor", primaryColor);
			designTokens = setTokenValue(designTokens, "secondaryColor", secondaryColor);
			designTokens = setTokenValue(designTokens, "accentColor", accentColor);
			designTokens = setTokenValue(designTokens, "typography", typography);
			designTokens = setTokenValue(designTokens, "visualStyle", visualStyle);
			designTokens = setTokenValue(designTokens, "compositionCues", compositionCues);
			designTokens = setTokenValue(
				designTokens,
				"prohibitedMotifs",
				prohibitedMotifs,
			);

			await customerRequest(`/workspaces/${activeWorkspaceId}/ai/context/brand`, {
				method: "PATCH",
				body: {
					narrative: brandNarrative,
					summary: brandSummary,
					designTokens,
					visualGuardrails: splitLines(visualGuardrailsInput),
					missingGaps: splitLines(brandMissingGapsInput),
					referenceResourceId: referenceResourceId || null,
					clearReferenceImage: !referenceResourceId,
				},
			});
			toast.success("Brand system updated.");
			await loadPage();
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to update brand system.",
			);
		} finally {
			setSavingBrand(false);
		}
	}

	async function saveAISettings() {
		if (!activeWorkspaceId || !catalog) {
			return;
		}
		setSavingAI(true);
		setError(null);
		try {
			const credentials = providerEntries.flatMap((providerEntry) =>
				(credentialDrafts[providerEntry.provider] ?? [])
					.map((draft, index) => ({
						id: draft.id ?? "",
						provider: providerEntry.provider,
						position: index,
						status: draft.status || "active",
						apiKey: draft.apiKey.trim(),
						allowedModels: providerEntry.approvedModels,
					}))
					.filter((draft) => draft.id || draft.apiKey),
			);

			await customerRequest(`/workspaces/${activeWorkspaceId}/ai/settings`, {
				method: "PATCH",
				body: {
					defaultMode,
					capabilityDefaults,
					credentials,
				},
			});
			toast.success("AI access settings updated.");
			await loadPage();
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to update AI settings.",
			);
		} finally {
			setSavingAI(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace Intelligence"
				title="Intelligence"
				description="Give Heimdall the shortest possible set of facts that actually changes AI decisions: what the business does, what the brand should look like, and how the workspace can access AI."
				actions={
					onboardingMode ? (
						<>
							<Button variant="outline" className="rounded-full" asChild>
								<Link to="/dashboard">Skip for now</Link>
							</Button>
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								asChild
							>
								<Link to="/dashboard/posts/new">
									Try AI post draft
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</>
					) : undefined
				}
			/>

			{context?.readiness ? (
				<SurfaceCard className="p-5">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium">
								{context.readiness.complete ? (
									<CheckCircle2 className="size-4 text-emerald-600" />
								) : (
									<AlertTriangle className="size-4 text-amber-600" />
								)}
								Setup readiness
							</div>
							<div className="text-sm text-muted-foreground">
								{context.readiness.complete
									? "Business context and AI access are in place. Brand guidance can keep improving results, especially for image and reel workflows."
									: `Still missing: ${context.readiness.missing.join(", ")}.`}
							</div>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline" className="rounded-full">
								Business {context.readiness.hasBusinessContext ? "ready" : "missing"}
							</Badge>
							<Badge variant="outline" className="rounded-full">
								Brand {context.readiness.hasBrandContext ? "ready" : "optional"}
							</Badge>
							<Badge variant="outline" className="rounded-full">
								AI access {context.readiness.hasAiAccess ? "ready" : "missing"}
							</Badge>
						</div>
					</div>
				</SurfaceCard>
			) : null}

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<Tabs value={activeTab} onValueChange={setActiveTab}>
				<TabsList
					variant="default"
					className="!h-auto min-h-[4.5rem] w-full flex-wrap items-stretch justify-start gap-2 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/50 p-2.5"
				>
					<TabsTrigger value="business" className="rounded-[18px] px-4 py-3">
						<BrainCircuit className="size-4" />
						Business Context
					</TabsTrigger>
					<TabsTrigger value="brand" className="rounded-[18px] px-4 py-3">
						<Palette className="size-4" />
						Brand System
					</TabsTrigger>
					<TabsTrigger value="access" className="rounded-[18px] px-4 py-3">
						<KeyRound className="size-4" />
						AI Access
					</TabsTrigger>
				</TabsList>

				<TabsContent value="business" className="mt-5">
					<DashboardPanel
						title="Business context"
						description="Write the business in natural language, then tighten the extracted facts so they stay compact and decision-relevant."
						action={
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								disabled={loading || savingBusiness}
								onClick={() => void saveBusinessContext()}
							>
								{savingBusiness ? "Saving..." : "Save business context"}
							</Button>
						}
					>
						<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
							<div className="space-y-5">
								<SurfaceCard className="space-y-4 p-5">
									<div className="space-y-2">
										<Label htmlFor="business-narrative">Business description</Label>
										<Textarea
											id="business-narrative"
											value={businessNarrative}
											onChange={(event) => setBusinessNarrative(event.target.value)}
											className="min-h-44 rounded-[24px]"
											placeholder="Describe what the business does, who it serves, what outcomes it helps create, what makes it different, and any constraints AI should respect."
											disabled={loading}
										/>
									</div>
									<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
										<div className="space-y-2">
											<Label htmlFor="business-summary">What Heimdall understands</Label>
											<Textarea
												id="business-summary"
												value={businessSummary}
												onChange={(event) => setBusinessSummary(event.target.value)}
												className="min-h-24 rounded-[24px]"
												disabled={loading}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="understanding-score">Understanding score</Label>
											<Input
												id="understanding-score"
												type="number"
												min={0}
												max={100}
												value={understandingScore}
												onChange={(event) => setUnderstandingScore(event.target.value)}
												className="h-11 rounded-2xl"
												disabled={loading}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor="business-gaps">Missing gaps</Label>
										<Textarea
											id="business-gaps"
											value={missingGapsInput}
											onChange={(event) => setMissingGapsInput(event.target.value)}
											className="min-h-24 rounded-[24px]"
											placeholder="One gap per line"
											disabled={loading}
										/>
									</div>
								</SurfaceCard>

								<SurfaceCard className="space-y-4 p-5">
									<div className="flex items-center justify-between gap-3">
										<div>
											<div className="text-sm font-medium">High-impact facts</div>
											<div className="text-sm text-muted-foreground">
												Keep only facts that should materially change AI output.
											</div>
										</div>
										<Button
											type="button"
											variant="outline"
											className="rounded-full"
											onClick={() => setFacts((current) => [...current, createBlankFact()])}
										>
											<Plus className="size-4" />
											Add fact
										</Button>
									</div>
									<div className="space-y-4">
										{facts.map((fact, index) => (
											<SurfaceCard
												key={`${fact.key}-${index}`}
												tone="muted"
												className="space-y-4 p-4"
											>
												<div className="grid gap-4 md:grid-cols-3">
													<div className="space-y-2">
														<Label>Key</Label>
														<Input
															value={fact.key}
															onChange={(event) =>
																setFacts((current) =>
																	current.map((item, itemIndex) =>
																		itemIndex === index
																			? { ...item, key: event.target.value }
																			: item,
																	),
																)
															}
															className="h-10 rounded-2xl"
														/>
													</div>
													<div className="space-y-2">
														<Label>Label</Label>
														<Input
															value={fact.label}
															onChange={(event) =>
																setFacts((current) =>
																	current.map((item, itemIndex) =>
																		itemIndex === index
																			? { ...item, label: event.target.value }
																			: item,
																	),
																)
															}
															className="h-10 rounded-2xl"
														/>
													</div>
													<div className="space-y-2">
														<Label>Importance</Label>
														<Select
															value={fact.importance}
															onValueChange={(value) =>
																setFacts((current) =>
																	current.map((item, itemIndex) =>
																		itemIndex === index
																			? {
																					...item,
																					importance: value as
																						| "low"
																						| "medium"
																						| "high",
																			  }
																			: item,
																	),
																)
															}
														>
															<SelectTrigger className="h-10 rounded-2xl">
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="high">High</SelectItem>
																<SelectItem value="medium">Medium</SelectItem>
																<SelectItem value="low">Low</SelectItem>
															</SelectContent>
														</Select>
													</div>
												</div>
												<div className="space-y-2">
													<Label>Value</Label>
													<Textarea
														value={fact.value}
														onChange={(event) =>
															setFacts((current) =>
																current.map((item, itemIndex) =>
																	itemIndex === index
																		? { ...item, value: event.target.value }
																		: item,
																),
															)
														}
														className="min-h-24 rounded-[20px]"
													/>
												</div>
												<div className="space-y-2">
													<Label>Use this for</Label>
													<div className="flex flex-wrap gap-2">
														{useCaseOptions.map((option) => {
															const selected = fact.appliesTo.includes(option.value);
															return (
																<Button
																	key={option.value}
																	type="button"
																	variant="outline"
																	size="sm"
																	className="rounded-full"
																	onClick={() =>
																		setFacts((current) =>
																			current.map((item, itemIndex) =>
																				itemIndex === index
																					? {
																							...item,
																							appliesTo: selected
																								? item.appliesTo.filter(
																										(value) => value !== option.value,
																								  )
																								: [...item.appliesTo, option.value],
																					  }
																					: item,
																			),
																		)
																	}
																>
																	{selected ? "Included" : "Add"} {option.label}
																</Button>
															);
														})}
													</div>
												</div>
												<div className="flex justify-end">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														className="rounded-full text-destructive"
														onClick={() =>
															setFacts((current) =>
																current.length === 1
																	? [createBlankFact()]
																	: current.filter((_, itemIndex) => itemIndex !== index),
															)
														}
													>
														Remove fact
													</Button>
												</div>
											</SurfaceCard>
										))}
									</div>
								</SurfaceCard>
							</div>

							<SurfaceCard className="space-y-4 p-5">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Sparkles className="size-4 text-primary" />
									How this gets used
								</div>
								<div className="space-y-3 text-sm text-muted-foreground">
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
										Post generation gets the business summary, audience, offers,
										differentiators, guardrails, and optionally the linked campaign
										objective.
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
										Campaign planning gets goal and audience signals, but not extra
										fluff.
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
										The shorter and sharper these facts are, the more reliable the
										downstream prompts stay.
									</div>
								</div>
							</SurfaceCard>
						</div>
					</DashboardPanel>
				</TabsContent>

				<TabsContent value="brand" className="mt-5">
					<DashboardPanel
						title="Brand system"
						description="Capture visual identity in a form AI can use later for posts, images, reels, and campaign materials."
						action={
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								disabled={loading || savingBrand}
								onClick={() => void saveBrandContext()}
							>
								{savingBrand ? "Saving..." : "Save brand system"}
							</Button>
						}
					>
						<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
							<div className="space-y-5">
								<SurfaceCard className="space-y-4 p-5">
									<div className="space-y-2">
										<Label htmlFor="brand-narrative">Brand and design description</Label>
										<Textarea
											id="brand-narrative"
											value={brandNarrative}
											onChange={(event) => setBrandNarrative(event.target.value)}
											className="min-h-40 rounded-[24px]"
											placeholder="Describe how the brand should feel visually, what it should avoid, and what a strong visual system looks like."
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="brand-summary">Brand summary</Label>
										<Textarea
											id="brand-summary"
											value={brandSummary}
											onChange={(event) => setBrandSummary(event.target.value)}
											className="min-h-24 rounded-[24px]"
										/>
									</div>
									<div className="space-y-2">
										<Label>Reference image</Label>
										<div className="flex flex-wrap items-center gap-3">
											<ResourcePicker
												resources={imageResources}
												value={referenceResourceId ? [referenceResourceId] : []}
												onChange={(next) => setReferenceResourceId(next[0] ?? "")}
												triggerLabel="Choose reference image"
												emptyMessage="Upload an image to the library first."
											/>
											{referenceResourceId ? (
												<Button
													type="button"
													variant="outline"
													className="rounded-full"
													onClick={() => setReferenceResourceId("")}
												>
													Clear reference
												</Button>
											) : null}
										</div>
									</div>
								</SurfaceCard>

								<SurfaceCard className="space-y-4 p-5">
									<div>
										<div className="text-sm font-medium">Concrete tokens</div>
										<div className="text-sm text-muted-foreground">
											These are the fields future image and reel workflows will rely
											on most.
										</div>
									</div>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Primary color</Label>
											<Input
												value={primaryColor}
												onChange={(event) => setPrimaryColor(event.target.value)}
												className="h-10 rounded-2xl"
											/>
										</div>
										<div className="space-y-2">
											<Label>Secondary color</Label>
											<Input
												value={secondaryColor}
												onChange={(event) => setSecondaryColor(event.target.value)}
												className="h-10 rounded-2xl"
											/>
										</div>
										<div className="space-y-2">
											<Label>Accent color</Label>
											<Input
												value={accentColor}
												onChange={(event) => setAccentColor(event.target.value)}
												className="h-10 rounded-2xl"
											/>
										</div>
										<div className="space-y-2">
											<Label>Typography</Label>
											<Input
												value={typography}
												onChange={(event) => setTypography(event.target.value)}
												className="h-10 rounded-2xl"
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<Label>Visual style</Label>
											<Input
												value={visualStyle}
												onChange={(event) => setVisualStyle(event.target.value)}
												className="h-10 rounded-2xl"
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<Label>Composition cues</Label>
											<Textarea
												value={compositionCues}
												onChange={(event) => setCompositionCues(event.target.value)}
												className="min-h-24 rounded-[20px]"
											/>
										</div>
										<div className="space-y-2 md:col-span-2">
											<Label>Prohibited motifs</Label>
											<Textarea
												value={prohibitedMotifs}
												onChange={(event) => setProhibitedMotifs(event.target.value)}
												className="min-h-24 rounded-[20px]"
											/>
										</div>
									</div>
								</SurfaceCard>
							</div>

							<div className="space-y-5">
								<SurfaceCard className="space-y-4 p-5">
									<div className="space-y-2">
										<Label>Visual guardrails</Label>
										<Textarea
											value={visualGuardrailsInput}
											onChange={(event) => setVisualGuardrailsInput(event.target.value)}
											className="min-h-28 rounded-[24px]"
											placeholder="One guardrail per line"
										/>
									</div>
									<div className="space-y-2">
										<Label>Missing gaps</Label>
										<Textarea
											value={brandMissingGapsInput}
											onChange={(event) => setBrandMissingGapsInput(event.target.value)}
											className="min-h-24 rounded-[24px]"
											placeholder="One gap per line"
										/>
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
										Processing status: {context?.brand.processingStatus ?? "ready"}
									</div>
								</SurfaceCard>
							</div>
						</div>
					</DashboardPanel>
				</TabsContent>

				<TabsContent value="access" className="mt-5">
					<DashboardPanel
						title="AI access"
						description="Choose whether the workspace runs on Heimdall-managed AI or on its own provider keys. Models stay server-approved either way."
						action={
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								disabled={loading || savingAI}
								onClick={() => void saveAISettings()}
							>
								{savingAI ? "Saving..." : "Save AI access"}
							</Button>
						}
					>
						<div className="space-y-5">
							<SurfaceCard className="space-y-4 p-5">
								<div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
									<div className="space-y-2">
										<Label>Default mode</Label>
										<Select
											value={defaultMode}
											onValueChange={(value) =>
												setDefaultMode(value as "native" | "byok")
											}
										>
											<SelectTrigger className="h-11 rounded-2xl">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="native">Platform native</SelectItem>
												<SelectItem value="byok">Bring your own key</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
										Native mode uses Heimdall-managed keys and will later respect
										plan limits. BYOK mode keeps the workspace on its own approved
										provider keys.
									</div>
								</div>
							</SurfaceCard>

							<SurfaceCard className="space-y-4 p-5">
								<div>
									<div className="text-sm font-medium">Capability defaults</div>
									<div className="text-sm text-muted-foreground">
										Each workflow can prefer a different provider and model, but
										only from the approved catalog.
									</div>
								</div>
								<div className="space-y-4">
									{useCaseOptions.map((useCase) => {
										const selection = capabilityDefaults[useCase.value];
										const provider = providerMap.get(selection?.provider ?? "");
										return (
											<div
												key={useCase.value}
												className="grid gap-4 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]"
											>
												<div className="self-center text-sm font-medium">
													{useCase.label}
												</div>
												<div className="space-y-2">
													<Label>Provider</Label>
													<Select
														value={
															selection?.provider ??
															providerEntries[0]?.provider ??
															"openai"
														}
														onValueChange={(value) =>
															setCapabilityDefaults((current) => {
																const providerConfig = providerMap.get(value);
																return {
																	...current,
																	[useCase.value]: {
																		provider: value,
																		model:
																			providerConfig?.defaultModel ??
																			providerConfig?.approvedModels[0] ??
																			"",
																	},
																};
															})
														}
													>
														<SelectTrigger className="h-10 rounded-2xl">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{providerEntries.map((entry) => (
																<SelectItem key={entry.provider} value={entry.provider}>
																	{entry.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-2">
													<Label>Model</Label>
													<Select
														value={selection?.model ?? provider?.defaultModel ?? ""}
														onValueChange={(value) =>
															setCapabilityDefaults((current) => ({
																...current,
																[useCase.value]: {
																	provider:
																		selection?.provider ??
																		providerEntries[0]?.provider ??
																		"openai",
																	model: value,
																},
															}))
														}
													>
														<SelectTrigger className="h-10 rounded-2xl">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{(provider?.approvedModels ?? []).map((model) => (
																<SelectItem key={model} value={model}>
																	{model}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											</div>
										);
									})}
								</div>
							</SurfaceCard>

							<div className="grid gap-5 xl:grid-cols-2">
								{providerEntries.map((provider) => {
									const drafts = credentialDrafts[provider.provider] ?? [
										createBlankCredential(),
									];
									return (
										<SurfaceCard key={provider.provider} className="space-y-4 p-5">
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="text-sm font-medium">{provider.label}</div>
													<div className="text-sm text-muted-foreground">
														Approved models: {provider.approvedModels.join(", ")}
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													{provider.nativeAvailable ? (
														<Badge variant="outline" className="rounded-full">
															Native available
														</Badge>
													) : null}
													{provider.supportsByok ? (
														<Badge variant="outline" className="rounded-full">
															BYOK supported
														</Badge>
													) : null}
												</div>
											</div>
											<div className="space-y-4">
												{drafts.map((draft, index) => (
													<div
														key={`${provider.provider}-${draft.id ?? index}`}
														className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
													>
														<div className="mb-3 flex items-center justify-between gap-3">
															<div className="text-sm font-medium">
																{provider.supportsByok && settings?.fallbackPoolEnabled
																	? `Key ${index + 1}`
																	: "Workspace key"}
															</div>
															{draft.keyHint ? (
																<Badge variant="outline" className="rounded-full">
																	Saved: {draft.keyHint}
																</Badge>
															) : null}
														</div>
														<div className="space-y-2">
															<Label>API key</Label>
															<Input
																type="password"
																value={draft.apiKey}
																onChange={(event) =>
																	setCredentialDrafts((current) => ({
																		...current,
																		[provider.provider]: (
																			current[provider.provider] ?? []
																		).map((item, itemIndex) =>
																			itemIndex === index
																				? { ...item, apiKey: event.target.value }
																				: item,
																		),
																	}))
																}
																placeholder={
																	draft.keyHint
																		? "Leave blank to keep existing key"
																		: "Paste provider API key"
																}
																className="h-11 rounded-2xl"
															/>
														</div>
													</div>
												))}
											</div>
											{settings?.fallbackPoolEnabled ? (
												<div className="flex justify-between gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
													<div>
														Fallback key pools are enabled for this workspace by
														staff. Additional keys are tried when a provider hits
														retryable rate or credit failures.
													</div>
													<Button
														type="button"
														variant="outline"
														className="rounded-full"
														onClick={() =>
															setCredentialDrafts((current) => ({
																...current,
																[provider.provider]: [
																	...(current[provider.provider] ?? []),
																	createBlankCredential(
																		(current[provider.provider] ?? []).length,
																	),
																],
															}))
														}
													>
														<Plus className="size-4" />
														Add fallback key
													</Button>
												</div>
											) : null}
										</SurfaceCard>
									);
								})}
							</div>
						</div>
					</DashboardPanel>
				</TabsContent>
			</Tabs>
		</div>
	);
}
