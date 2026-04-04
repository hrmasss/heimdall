import {
	FileText,
	ImagePlus,
	Play,
	Settings2,
	Video,
	WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	AssetCommandBar,
	AssetWorkspaceShell,
} from "@/components/app/asset-workspace";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import {
	ResourceThumb,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	refreshResourceDownloadUrl,
	useDurableUrl,
} from "@/hooks/use-resource-preview-url";
import type {
	ApiListResponse,
	AutomationDefinition,
	AutomationRun,
	ResourceRecord,
	RunArtifact,
	WorkspaceAISettings,
} from "@/lib/api-types";
import {
	getDefaultStudioTool,
	getStudioModeForResource,
	getStudioToolDefinition,
	studioModeMeta,
	studioToolsByMode,
	type StudioMode,
} from "@/lib/asset-studio";
import { useAuth } from "@/lib/auth-context";
import {
	formatAutomationWhen,
	summarizeRunArtifacts,
	systemPromptPreview,
} from "@/lib/automation-builder";

const imageAspectRatios: Record<string, { width: number; height: number }> = {
	"1:1": { width: 1280, height: 1280 },
	"4:5": { width: 1080, height: 1350 },
	"16:9": { width: 1600, height: 900 },
};

function findArtifact(run: AutomationRun | null, type: string) {
	if (!run) {
		return null;
	}
	return (run.outputPayload.artifacts as RunArtifact[] | undefined)?.find(
		(artifact) => artifact.type === type,
	);
}

function isStudioMode(value: string | null): value is StudioMode {
	return value === "image" || value === "pdf" || value === "reel";
}

function toolIcon(mode: StudioMode) {
	if (mode === "image") {
		return ImagePlus;
	}
	if (mode === "pdf") {
		return FileText;
	}
	return Video;
}

function toolPromptPlaceholder(mode: StudioMode, tool: string) {
	if (mode === "image" && tool === "resize") {
		return "Reframe this into a 4:5 launch graphic with a stronger focal crop and clean negative space.";
	}
	if (mode === "image" && tool === "fill") {
		return "Extend the scene naturally for a wider canvas while preserving the subject and lighting.";
	}
	if (mode === "pdf") {
		return "Turn this topic into a compact editorial PDF with one clear idea per page.";
	}
	if (tool === "caption") {
		return "Tighten pacing, add strong opening captions, and keep the hook visible in the first seconds.";
	}
	return "Shape this into a tighter social-ready cut with a stronger hook and cleaner pacing.";
}

export function DashboardStudio() {
	const [searchParams, setSearchParams] = useSearchParams();
	const { activeWorkspaceId, customerRequest, customerSession } = useAuth();

	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [runs, setRuns] = useState<AutomationRun[]>([]);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [aiSettings, setAiSettings] = useState<WorkspaceAISettings | null>(null);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);

	const [imagePrompt, setImagePrompt] = useState("");
	const [imageAspectRatio, setImageAspectRatio] = useState("1:1");
	const [imageSeed, setImageSeed] = useState("");
	const [imageModel, setImageModel] = useState("flux");
	const [imageReferenceIds, setImageReferenceIds] = useState<string[]>([]);

	const [pdfTitle, setPdfTitle] = useState("");
	const [pdfSubtitle, setPdfSubtitle] = useState("");
	const [pdfPages, setPdfPages] = useState("");

	const [reelVideoIds, setReelVideoIds] = useState<string[]>([]);
	const [reelCaption, setReelCaption] = useState("");
	const [reelStyle, setReelStyle] = useState("kinetic");
	const [reelEffects, setReelEffects] = useState("");

	const selectedResourceId = searchParams.get("resourceId");
	const requestedMode = searchParams.get("mode");
	const source = searchParams.get("source") ?? "library";
	const selectedResource = useMemo(
		() =>
			selectedResourceId
				? resources.find((resource) => resource.id === selectedResourceId) ?? null
				: null,
		[resources, selectedResourceId],
	);
	const mode = isStudioMode(requestedMode)
		? requestedMode
		: getStudioModeForResource(selectedResource);
	const activeTool = getStudioToolDefinition(mode, searchParams.get("tool"));
	const currentModeMeta = studioModeMeta[mode];
	const ModeIcon = toolIcon(mode);

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [
				automationResponse,
				runResponse,
				resourceResponse,
				settingsResponse,
			] = await Promise.all([
				customerRequest<ApiListResponse<AutomationDefinition>>(
					`/workspaces/${activeWorkspaceId}/automations`,
				),
				customerRequest<ApiListResponse<AutomationRun>>(
					`/workspaces/${activeWorkspaceId}/runs`,
				),
				customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
				customerRequest<WorkspaceAISettings>(
					`/workspaces/${activeWorkspaceId}/ai/settings`,
				),
			]);
			setAutomations(automationResponse.items);
			setRuns(runResponse.items);
			setResources(resourceResponse.items);
			setAiSettings(settingsResponse);
			setSelectedRunId((current) => current ?? runResponse.items[0]?.id ?? null);
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : "Unable to load studio.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	useEffect(() => {
		const nextParams = new URLSearchParams(searchParams);
		let changed = false;
		if (!isStudioMode(searchParams.get("mode"))) {
			nextParams.set("mode", mode);
			changed = true;
		}
		if (!searchParams.get("tool")) {
			nextParams.set("tool", getDefaultStudioTool(mode));
			changed = true;
		}
		if (!searchParams.get("source")) {
			nextParams.set("source", source);
			changed = true;
		}
		if (changed) {
			setSearchParams(nextParams, { replace: true });
		}
	}, [mode, searchParams, setSearchParams, source]);

	useEffect(() => {
		if (!selectedResource) {
			return;
		}
		if (mode === "image") {
			setImageReferenceIds((current) =>
				current.includes(selectedResource.id)
					? current
					: [selectedResource.id, ...current],
			);
			return;
		}
		if (mode === "reel") {
			setReelVideoIds((current) =>
				current[0] === selectedResource.id ? current : [selectedResource.id],
			);
			return;
		}
		setPdfTitle((current) =>
			current.trim().length > 0 ? current : selectedResource.displayName,
		);
	}, [mode, selectedResource]);

	const automationMap = useMemo(
		() => new Map(automations.map((automation) => [automation.id, automation])),
		[automations],
	);
	const filteredRuns = useMemo(
		() =>
			runs.filter((run) => {
				if (!run.automationId) {
					return false;
				}
				const automation = automationMap.get(run.automationId);
				return (
					automation?.metadata?.source === "studio" &&
					automation.actionType === currentModeMeta.actionType
				);
			}),
		[automationMap, currentModeMeta.actionType, runs],
	);
	const selectedRun = useMemo(
		() =>
			filteredRuns.find((run) => run.id === selectedRunId) ??
			filteredRuns[0] ??
			null,
		[filteredRuns, selectedRunId],
	);

	const imageResources = useMemo(
		() => resources.filter((resource) => resource.mediaKind === "image"),
		[resources],
	);
	const videoResources = useMemo(
		() => resources.filter((resource) => resource.mediaKind === "video"),
		[resources],
	);

	const imageArtifact = useMemo(
		() => findArtifact(selectedRun, "resource"),
		[selectedRun],
	);
	const pdfArtifact = useMemo(
		() => findArtifact(selectedRun, "document_resource"),
		[selectedRun],
	);
	const reelArtifact = useMemo(
		() => findArtifact(selectedRun, "resource_set"),
		[selectedRun],
	);
	const imageArtifactResourceId = imageArtifact?.resourceId ?? null;
	const studioPreview = useDurableUrl({
		initialUrl:
			typeof imageArtifact?.data?.previewUrl === "string"
				? imageArtifact.data.previewUrl
				: null,
		refresh: imageArtifactResourceId
			? () =>
					refreshResourceDownloadUrl({
						resourceId: imageArtifactResourceId,
						accessToken: customerSession?.accessToken ?? null,
						workspaceId: activeWorkspaceId,
					})
			: null,
	});

	async function ensureAutomation() {
		if (!activeWorkspaceId) {
			throw new Error("No active workspace.");
		}
		const existing = automations.find(
			(automation) =>
				automation.actionType === currentModeMeta.actionType &&
				automation.metadata?.source === "studio",
		);
		if (existing) {
			return existing.id;
		}
		const created = await customerRequest<AutomationDefinition>(
			`/workspaces/${activeWorkspaceId}/automations`,
			{
				method: "POST",
				body: {
					name: `Studio ${currentModeMeta.label}`,
					description: currentModeMeta.description,
					status: "active",
					scope: "standalone",
					actionType: currentModeMeta.actionType,
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: {},
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: [],
					metadata: {
						source: "studio",
						studioMode: mode,
						tool: activeTool.value,
					},
				},
			},
		);
		setAutomations((current) => [created, ...current]);
		return created.id;
	}

	function addUploadedResources(created: ResourceRecord[]) {
		setResources((current) => [
			...created,
			...current.filter(
				(resource) => !created.some((item) => item.id === resource.id),
			),
		]);
	}

	async function runStudioMode() {
		if (!activeWorkspaceId) {
			return;
		}
		setSubmitting(true);
		try {
			const automationId = await ensureAutomation();
			let input: Record<string, unknown>;
			if (mode === "image") {
				const dimensions =
					imageAspectRatios[imageAspectRatio] ?? imageAspectRatios["1:1"];
				input = {
					prompt: imagePrompt,
					promptScope: currentModeMeta.promptScope,
					seed: imageSeed,
					referenceResourceIds: imageReferenceIds,
					width: dimensions.width,
					height: dimensions.height,
					model: imageModel,
					tool: activeTool.value,
					sourceResourceId: selectedResource?.id ?? null,
				};
			} else if (mode === "pdf") {
				input = {
					title: pdfTitle,
					subtitle: pdfSubtitle,
					promptScope: currentModeMeta.promptScope,
					pages: pdfPages.split(/\n\s*\n/).filter(Boolean),
					tool: activeTool.value,
					sourceResourceId: selectedResource?.id ?? null,
				};
			} else {
				input = {
					videoResourceId: reelVideoIds[0] ?? "",
					caption: reelCaption,
					style: reelStyle,
					effects: reelEffects
						.split(",")
						.map((item) => item.trim())
						.filter(Boolean),
					promptScope: currentModeMeta.promptScope,
					tool: activeTool.value,
				};
			}
			const run = await customerRequest<AutomationRun>(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`,
				{
					method: "POST",
					body: { input },
				},
			);
			toast.success(`${currentModeMeta.label} run started.`);
			await loadData();
			setSelectedRunId(run.id);
		} catch (runError) {
			toast.error(
				runError instanceof Error ? runError.message : "Unable to run Studio.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	function updateStudioSearchParams(next: Partial<Record<string, string | null>>) {
		const nextParams = new URLSearchParams(searchParams);
		for (const [key, value] of Object.entries(next)) {
			if (!value) {
				nextParams.delete(key);
			} else {
				nextParams.set(key, value);
			}
		}
		setSearchParams(nextParams, { replace: true });
	}

	const inspector = (
		<DashboardPanel
			title="Tool settings"
			description="Keep the essentials close, and open deeper controls only when the current task needs them."
			className="h-fit"
		>
			<div className="space-y-5">
				<SurfaceCard className="studio-inspector-section space-y-4 p-5">
					<div className="space-y-2">
						<div className="text-sm font-medium">Task family</div>
						<div className="text-xs text-muted-foreground">
							Choose the kind of output you are preparing.
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{(Object.keys(studioModeMeta) as StudioMode[]).map((modeValue) => {
							const Icon = toolIcon(modeValue);
							return (
								<Button
									key={modeValue}
									variant={modeValue === mode ? "default" : "outline"}
									size="sm"
									className="h-10 rounded-full px-3 text-sm"
									onClick={() =>
										updateStudioSearchParams({
											mode: modeValue,
											tool: getDefaultStudioTool(modeValue),
										})
									}
								>
									<Icon className="size-4" />
									{studioModeMeta[modeValue].label}
								</Button>
							);
						})}
					</div>
					<div className="grid gap-2">
						{studioToolsByMode[mode].map((tool) => (
							<Button
								key={tool.value}
								variant={tool.value === activeTool.value ? "secondary" : "outline"}
								className="h-auto justify-start rounded-[20px] px-4 py-3 text-left whitespace-normal"
								disabled={tool.status === "soon"}
								onClick={() => updateStudioSearchParams({ tool: tool.value })}
							>
								<div className="min-w-0 flex-1">
									<div className="font-medium">{tool.label}</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{tool.description}
									</div>
								</div>
								{tool.status === "soon" ? (
									<Badge variant="outline" className="rounded-full">
										Soon
									</Badge>
								) : (
									<WandSparkles className="size-4 shrink-0 text-primary" />
								)}
							</Button>
						))}
					</div>
				</SurfaceCard>

				<SurfaceCard className="studio-inspector-section space-y-4 p-5">
					<div>
						<div className="text-sm font-medium">Essentials</div>
						<div className="mt-1 text-xs text-muted-foreground">
							Source, direction, and the few settings most users need first.
						</div>
					</div>

					{selectedResource ? (
						<div className="flex items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-3">
							<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
								<ResourceThumb resource={selectedResource} variant="compact" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium">{selectedResource.displayName}</div>
								<div className="mt-1 text-sm text-muted-foreground">
									{formatResourceMeta(selectedResource)}
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
							Open Studio from the library, or pick a source asset here.
						</div>
					)}

					{mode === "image" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Prompt</Label>
								<Textarea
									value={imagePrompt}
									onChange={(event) => setImagePrompt(event.target.value)}
									className="min-h-28 rounded-[24px]"
									placeholder={toolPromptPlaceholder(mode, activeTool.value)}
								/>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Aspect ratio</Label>
									<Select value={imageAspectRatio} onValueChange={setImageAspectRatio}>
										<SelectTrigger className="h-11 rounded-2xl">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Object.keys(imageAspectRatios).map((ratio) => (
												<SelectItem key={ratio} value={ratio}>
													{ratio}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>References</Label>
									<ResourcePicker
										resources={imageResources}
										value={imageReferenceIds}
										onChange={setImageReferenceIds}
										triggerLabel="Choose references"
										emptyMessage="Upload image assets in the library first."
										allowUpload
										onResourcesCreated={addUploadedResources}
									/>
								</div>
							</div>
						</div>
					) : null}

					{mode === "pdf" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Title</Label>
								<Input
									value={pdfTitle}
									onChange={(event) => setPdfTitle(event.target.value)}
									className="h-11 rounded-2xl"
									placeholder="The 5 systems behind consistent content operations"
								/>
							</div>
							<div className="space-y-2">
								<Label>Subtitle</Label>
								<Input
									value={pdfSubtitle}
									onChange={(event) => setPdfSubtitle(event.target.value)}
									className="h-11 rounded-2xl"
									placeholder="Optional supporting subtitle"
								/>
							</div>
							<div className="space-y-2">
								<Label>Pages</Label>
								<Textarea
									value={pdfPages}
									onChange={(event) => setPdfPages(event.target.value)}
									className="min-h-40 rounded-[24px]"
									placeholder={toolPromptPlaceholder(mode, activeTool.value)}
								/>
							</div>
						</div>
					) : null}

					{mode === "reel" ? (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Source video</Label>
								<ResourcePicker
									resources={videoResources}
									value={reelVideoIds}
									onChange={(next) => setReelVideoIds(next.slice(0, 1))}
									triggerLabel="Choose video"
									emptyMessage="Upload a video asset in the library first."
									allowUpload
									onResourcesCreated={addUploadedResources}
								/>
							</div>
							<div className="space-y-2">
								<Label>Caption / direction</Label>
								<Textarea
									value={reelCaption}
									onChange={(event) => setReelCaption(event.target.value)}
									className="min-h-28 rounded-[24px]"
									placeholder={toolPromptPlaceholder(mode, activeTool.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Style</Label>
								<Input
									value={reelStyle}
									onChange={(event) => setReelStyle(event.target.value)}
									className="h-11 rounded-2xl"
								/>
							</div>
						</div>
					) : null}

					<Button
						className="w-full rounded-full border-0 bg-gradient-brand text-white"
						onClick={() => void runStudioMode()}
						disabled={submitting}
					>
						<Play className="size-4" />
						{submitting ? "Running..." : `Run ${activeTool.label}`}
					</Button>
				</SurfaceCard>

				<SurfaceCard className="studio-inspector-section p-5">
					<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-sm font-medium">Advanced</div>
								<div className="mt-1 text-xs text-muted-foreground">
									Model controls, prompt policy, and deeper run context stay nearby.
								</div>
							</div>
							<CollapsibleTrigger asChild>
								<Button variant="outline" size="sm" className="rounded-full">
									{advancedOpen ? "Hide" : "Show"}
								</Button>
							</CollapsibleTrigger>
						</div>
						<CollapsibleContent className="mt-4 space-y-4">
							{mode === "image" ? (
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-2">
										<Label>Model</Label>
										<Input
											value={imageModel}
											onChange={(event) => setImageModel(event.target.value)}
											className="h-11 rounded-2xl"
										/>
									</div>
									<div className="space-y-2">
										<Label>Seed</Label>
										<Input
											value={imageSeed}
											onChange={(event) => setImageSeed(event.target.value)}
											className="h-11 rounded-2xl"
											placeholder="Optional deterministic seed"
										/>
									</div>
								</div>
							) : null}

							{mode === "reel" ? (
								<div className="space-y-2">
									<Label>Effects</Label>
									<Input
										value={reelEffects}
										onChange={(event) => setReelEffects(event.target.value)}
										className="h-11 rounded-2xl"
										placeholder="zoom, cut, captions"
									/>
								</div>
							) : null}

							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
								<div className="mb-2 flex items-center justify-between gap-3">
									<div className="font-medium text-foreground">Prompt policy</div>
									<Button variant="outline" size="sm" className="rounded-full" asChild>
										<Link to="/dashboard/settings/intelligence">
											<Settings2 className="size-4" />
											Edit
										</Link>
									</Button>
								</div>
								{aiSettings
									? systemPromptPreview(
											aiSettings.systemPrompts,
											mode === "image"
												? "studioImage"
												: mode === "pdf"
													? "studioPdf"
													: "studioReel",
									  )
									: "Loading prompt policy..."}
							</div>

							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
								{selectedRun
									? `${summarizeRunArtifacts(selectedRun)} • ${formatAutomationWhen(selectedRun.updatedAt)}`
									: "No runs for this task family yet."}
							</div>
						</CollapsibleContent>
					</Collapsible>
				</SurfaceCard>
			</div>
		</DashboardPanel>
	);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Contextual editor"
				title="Studio"
				description="Work from a selected asset and a clear task, not a generic control room."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/library">Back to library</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/intelligence">
								<Settings2 className="size-4" />
								Prompt settings
							</Link>
						</Button>
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}
			<AssetWorkspaceShell
				commandBar={
					<AssetCommandBar className="studio-context-strip">
						<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
							<div className="min-w-0 space-y-2">
								<div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--brand-accent)]">
									<ModeIcon className="size-3.5" />
									{currentModeMeta.label}
								</div>
								<div>
									<div className="text-lg font-semibold">{activeTool.label}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{activeTool.description}
									</div>
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<div className="studio-context-chip rounded-full px-3 py-2 text-xs">
									<span className="text-muted-foreground">Source:</span>{" "}
									<span className="font-medium text-foreground">
										{selectedResource ? selectedResource.displayName : "Choose a source"}
									</span>
								</div>
								<div className="studio-context-chip rounded-full px-3 py-2 text-xs">
									<span className="text-muted-foreground">Output:</span>{" "}
									<span className="font-medium text-foreground">
										{currentModeMeta.outputLabel}
									</span>
								</div>
								<div className="studio-context-chip rounded-full px-3 py-2 text-xs">
									<span className="text-muted-foreground">Runs:</span>{" "}
									<span className="font-medium text-foreground">{filteredRuns.length}</span>
								</div>
							</div>
						</div>
					</AssetCommandBar>
				}
				rail={inspector}
				railTitle="Studio settings"
				railDescription="Task family, essentials, and advanced controls stay nearby without squeezing the canvas."
				railTriggerLabel="Open Studio settings"
			>
				<div className="space-y-6">
					<DashboardPanel
						title={`${currentModeMeta.label} canvas`}
						description="Preview the active output first, then scan recent runs without the history taking over the page."
					>
						<SurfaceCard className="overflow-hidden p-0">
							<div className="media-hero-surface min-h-[420px] p-6">
								<div className="flex items-center justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-medium">Active output</div>
										<div className="mt-1 break-words text-xs text-muted-foreground">
											{selectedRun
												? `${summarizeRunArtifacts(selectedRun)} • ${formatAutomationWhen(selectedRun.updatedAt)}`
												: loading
													? "Loading studio output..."
													: "Run this task to populate the canvas."}
										</div>
									</div>
									{selectedRun ? (
										<Badge variant="outline" className="rounded-full capitalize">
											{selectedRun.status}
										</Badge>
									) : null}
								</div>

								{mode === "image" && imageArtifact ? (
									<div className="mt-6">
										{studioPreview.broken ? (
											<div className="media-preview-canvas flex min-h-[280px] items-center justify-center rounded-[28px] border border-[var(--brand-border-soft)] px-6 py-10 text-center">
												<div className="max-w-sm space-y-3">
													<div className="text-base font-medium">Preview unavailable</div>
													<div className="text-sm text-muted-foreground">
														{studioPreview.refreshing
															? "Refreshing the generated image preview..."
															: "This preview expired or could not be loaded."}
													</div>
												</div>
											</div>
										) : typeof imageArtifact.data?.previewUrl === "string" ? (
											<img
												src={studioPreview.url || imageArtifact.data.previewUrl}
												alt={imageArtifact.label}
												onError={() => {
													void studioPreview.handleError();
												}}
												className="w-full rounded-[28px] border object-cover shadow-[0_28px_80px_-40px_rgba(32,20,10,0.45)]"
											/>
										) : null}
									</div>
								) : null}

								{mode === "pdf" && pdfArtifact ? (
									<div className="mt-6 rounded-[28px] border border-[var(--brand-border-soft)] bg-background/80 p-6">
										<div className="text-lg font-medium">{pdfArtifact.label}</div>
										<div className="mt-3 text-sm text-muted-foreground">
											Document output ready for review or reuse.
										</div>
										{typeof pdfArtifact.data?.downloadUrl === "string" ? (
											<Button variant="outline" className="mt-5 rounded-full" asChild>
												<a href={pdfArtifact.data.downloadUrl} target="_blank" rel="noreferrer">
													<FileText className="size-4" />
													Open PDF
												</a>
											</Button>
										) : null}
									</div>
								) : null}

								{mode === "reel" && reelArtifact ? (
									<div className="mt-6 rounded-[28px] border border-[var(--brand-border-soft)] bg-background/80 p-6">
										<div className="text-lg font-medium">{reelArtifact.label}</div>
										<div className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
											{typeof reelArtifact.data?.caption === "string"
												? reelArtifact.data.caption
												: JSON.stringify(reelArtifact.data ?? {}, null, 2)}
										</div>
									</div>
								) : null}

								{!selectedRun ? (
									<div className="mt-10 rounded-[28px] border border-dashed border-[var(--brand-border-soft)] bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground">
										{currentModeMeta.outputLabel} will appear here after the first run.
									</div>
								) : null}
							</div>
						</SurfaceCard>
					</DashboardPanel>
					<DashboardPanel
						title="Recent runs"
						description="History stays close for reuse and inspection, but no longer takes over the page."
					>
						{filteredRuns.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								{filteredRuns.slice(0, 6).map((run) => (
									<button
										key={run.id}
										type="button"
										onClick={() => setSelectedRunId(run.id)}
										className={`rounded-[24px] border p-4 text-left transition-colors ${
											run.id === selectedRun?.id
												? "border-primary bg-primary/8"
												: "border-[var(--brand-border-soft)] bg-background/70"
										}`}
									>
										<div className="font-medium">{summarizeRunArtifacts(run)}</div>
										<div className="mt-2 text-xs text-muted-foreground">
											{formatAutomationWhen(run.updatedAt)}
										</div>
										<div className="mt-3 flex items-center justify-between gap-3">
											<Badge variant="outline" className="rounded-full capitalize">
												{run.status}
											</Badge>
											<Link
												to={`/dashboard/automations/runs/${run.id}`}
												className="text-xs font-medium text-primary"
												onClick={(event) => event.stopPropagation()}
											>
												View detail
											</Link>
										</div>
									</button>
								))}
							</div>
						) : (
							<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-sm text-muted-foreground">
								No runs for this task family yet.
							</div>
						)}
					</DashboardPanel>
				</div>
			</AssetWorkspaceShell>
		</div>
	);
}
