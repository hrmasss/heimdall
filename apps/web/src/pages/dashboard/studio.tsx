import { FileText, ImagePlus, Play, Settings2, Video } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	AutomationDefinition,
	AutomationRun,
	ResourceRecord,
	RunArtifact,
	WorkspaceAISettings,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	formatAutomationWhen,
	summarizeRunArtifacts,
	systemPromptPreview,
} from "@/lib/automation-builder";

type StudioMode = "image" | "pdf" | "reel";

const studioModes: Array<{
	value: StudioMode;
	label: string;
	icon: typeof ImagePlus;
	actionType: string;
	promptScope: string;
}> = [
	{
		value: "image",
		label: "Image",
		icon: ImagePlus,
		actionType: "image_generate",
		promptScope: "studio_image",
	},
	{
		value: "pdf",
		label: "PDF",
		icon: FileText,
		actionType: "linkedin_pdf_generate_beta",
		promptScope: "studio_pdf",
	},
	{
		value: "reel",
		label: "Reel",
		icon: Video,
		actionType: "reel_generate_beta",
		promptScope: "studio_reel",
	},
];

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

export function DashboardStudio() {
	const [searchParams, setSearchParams] = useSearchParams();
	const mode = (searchParams.get("mode") as StudioMode) || "image";
	const currentMode =
		studioModes.find((item) => item.value === mode) ?? studioModes[0];
	const { activeWorkspaceId, customerRequest } = useAuth();

	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [runs, setRuns] = useState<AutomationRun[]>([]);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [aiSettings, setAiSettings] = useState<WorkspaceAISettings | null>(
		null,
	);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

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
			setSelectedRunId(
				(current) => current ?? runResponse.items[0]?.id ?? null,
			);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load studio.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const automationMap = useMemo(
		() => new Map(automations.map((automation) => [automation.id, automation])),
		[automations],
	);
	const studioRuns = useMemo(
		() =>
			runs.filter((run) => {
				if (!run.automationId) {
					return false;
				}
				const automation = automationMap.get(run.automationId);
				return automation?.metadata?.source === "studio";
			}),
		[automationMap, runs],
	);
	const filteredRuns = useMemo(
		() =>
			studioRuns.filter((run) => {
				if (!run.automationId) {
					return false;
				}
				return (
					automationMap.get(run.automationId)?.actionType ===
					currentMode.actionType
				);
			}),
		[automationMap, currentMode.actionType, studioRuns],
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

	async function ensureAutomation() {
		if (!activeWorkspaceId) {
			throw new Error("No active workspace.");
		}
		const existing = automations.find(
			(automation) =>
				automation.actionType === currentMode.actionType &&
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
					name: `Studio ${currentMode.label}`,
					description: `Studio automation for ${currentMode.label.toLowerCase()} generation.`,
					status: "active",
					scope: "standalone",
					actionType: currentMode.actionType,
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: {},
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: [],
					metadata: {
						source: "studio",
						studioMode: currentMode.value,
					},
				},
			},
		);
		setAutomations((current) => [created, ...current]);
		return created.id;
	}

	async function runStudioMode() {
		if (!activeWorkspaceId) {
			return;
		}
		setSubmitting(true);
		try {
			const automationId = await ensureAutomation();
			let input: Record<string, unknown>;
			if (currentMode.value === "image") {
				const dimensions =
					imageAspectRatios[imageAspectRatio] ?? imageAspectRatios["1:1"];
				input = {
					prompt: imagePrompt,
					promptScope: currentMode.promptScope,
					seed: imageSeed,
					referenceResourceIds: imageReferenceIds,
					width: dimensions.width,
					height: dimensions.height,
					model: imageModel,
				};
			} else if (currentMode.value === "pdf") {
				input = {
					title: pdfTitle,
					subtitle: pdfSubtitle,
					promptScope: currentMode.promptScope,
					pages: pdfPages.split(/\n\s*\n/).filter(Boolean),
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
					promptScope: currentMode.promptScope,
				};
			}
			const run = await customerRequest<AutomationRun>(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`,
				{
					method: "POST",
					body: { input },
				},
			);
			toast.success(`${currentMode.label} run started.`);
			await loadData();
			setSelectedRunId(run.id);
		} catch (runError) {
			toast.error(
				runError instanceof Error
					? runError.message
					: "Unable to run studio mode.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Studio control room"
				title="Studio"
				description="Switch modes without leaving the workspace, keep controls in one inspector, and reuse the same runtime and review system that powers automations."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/automations">Open automations</Link>
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

			<div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="space-y-6">
					<DashboardPanel
						title={`${currentMode.label} canvas`}
						description="Preview the selected run output in the main stage, then move between recent studio runs in the strip below."
					>
						<SurfaceCard className="overflow-hidden p-0">
							<div className="min-h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(206,163,98,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.8))] p-6">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium">Active preview</div>
										<div className="mt-1 text-xs text-muted-foreground">
											{selectedRun
												? `${summarizeRunArtifacts(selectedRun)} • ${formatAutomationWhen(selectedRun.updatedAt)}`
												: loading
													? "Loading studio output..."
													: "Run this mode to populate the preview stage."}
										</div>
									</div>
									{selectedRun ? (
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{selectedRun.status}
										</Badge>
									) : null}
								</div>

								{currentMode.value === "image" && imageArtifact ? (
									<div className="mt-6">
										{typeof imageArtifact.data?.previewUrl === "string" ? (
											<img
												src={imageArtifact.data.previewUrl}
												alt={imageArtifact.label}
												className="w-full rounded-[28px] border object-cover shadow-[0_28px_80px_-40px_rgba(32,20,10,0.45)]"
											/>
										) : null}
									</div>
								) : null}

								{currentMode.value === "pdf" && pdfArtifact ? (
									<div className="mt-6 rounded-[28px] border border-[var(--brand-border-soft)] bg-background/80 p-6">
										<div className="text-lg font-medium">
											{pdfArtifact.label}
										</div>
										<div className="mt-3 text-sm text-muted-foreground">
											Document asset ready for review or reuse.
										</div>
										{typeof pdfArtifact.data?.downloadUrl === "string" ? (
											<Button
												variant="outline"
												className="mt-5 rounded-full"
												asChild
											>
												<a
													href={pdfArtifact.data.downloadUrl}
													target="_blank"
													rel="noreferrer"
												>
													<FileText className="size-4" />
													Open PDF
												</a>
											</Button>
										) : null}
									</div>
								) : null}

								{currentMode.value === "reel" && reelArtifact ? (
									<div className="mt-6 rounded-[28px] border border-[var(--brand-border-soft)] bg-background/80 p-6">
										<div className="text-lg font-medium">
											{reelArtifact.label}
										</div>
										<div className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
											{typeof reelArtifact.data?.caption === "string"
												? reelArtifact.data.caption
												: JSON.stringify(reelArtifact.data ?? {}, null, 2)}
										</div>
									</div>
								) : null}

								{!selectedRun ? (
									<div className="mt-10 rounded-[28px] border border-dashed border-[var(--brand-border-soft)] bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground">
										{currentMode.label} outputs will appear here after the first
										run.
									</div>
								) : null}
							</div>
						</SurfaceCard>

						<div className="grid gap-4 md:grid-cols-3">
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
									<div className="font-medium">
										{summarizeRunArtifacts(run)}
									</div>
									<div className="mt-2 text-xs text-muted-foreground">
										{formatAutomationWhen(run.updatedAt)}
									</div>
									<div className="mt-3">
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{run.status}
										</Badge>
									</div>
								</button>
							))}
						</div>
					</DashboardPanel>
				</div>

				<div className="xl:sticky xl:top-24 xl:self-start">
					<DashboardPanel
						title="Inspector"
						description="Controls stay mode-aware, while prompt policy and execution all route through the shared automation runtime."
						className="h-fit xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto"
					>
						<div className="space-y-5">
							<SurfaceCard className="space-y-4 p-5">
								<div className="space-y-2">
									<div className="text-sm font-medium">Studio mode</div>
									<div className="text-xs text-muted-foreground">
										Switch modes from the inspector instead of leaving the
										canvas.
									</div>
								</div>
								<div className="grid grid-cols-3 gap-2">
									{studioModes.map((item) => (
										<Button
											key={item.value}
											variant={
												item.value === currentMode.value ? "default" : "outline"
											}
											size="sm"
											className="h-10 rounded-full px-3 text-sm"
											onClick={() => {
												searchParams.set("mode", item.value);
												setSearchParams(searchParams, { replace: true });
											}}
										>
											<item.icon className="size-4" />
											{item.label}
										</Button>
									))}
								</div>
							</SurfaceCard>

							<SurfaceCard className="space-y-4 p-5">
								{currentMode.value === "image" ? (
									<>
										<div className="space-y-2">
											<Label>Prompt</Label>
											<Textarea
												value={imagePrompt}
												onChange={(event) => setImagePrompt(event.target.value)}
												className="min-h-28 rounded-[24px]"
												placeholder="Editorial product scene, strong focal point, warm material palette..."
											/>
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-2">
												<Label>Aspect ratio</Label>
												<Select
													value={imageAspectRatio}
													onValueChange={setImageAspectRatio}
												>
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
												<Label>Model</Label>
												<Input
													value={imageModel}
													onChange={(event) =>
														setImageModel(event.target.value)
													}
													className="h-11 rounded-2xl"
												/>
											</div>
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
										<div className="space-y-2">
											<Label>Reference assets</Label>
											<ResourcePicker
												resources={imageResources}
												value={imageReferenceIds}
												onChange={setImageReferenceIds}
												triggerLabel="Choose references"
												emptyMessage="Upload image assets in the library first."
											/>
										</div>
									</>
								) : null}

								{currentMode.value === "pdf" ? (
									<>
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
												placeholder="Write one paragraph per page. Separate pages with a blank line."
											/>
										</div>
									</>
								) : null}

								{currentMode.value === "reel" ? (
									<>
										<div className="space-y-2">
											<Label>Source video</Label>
											<ResourcePicker
												resources={videoResources}
												value={reelVideoIds}
												onChange={(next) => setReelVideoIds(next.slice(0, 1))}
												triggerLabel="Choose video"
												emptyMessage="Upload a video asset in the library first."
											/>
										</div>
										<div className="space-y-2">
											<Label>Caption</Label>
											<Textarea
												value={reelCaption}
												onChange={(event) => setReelCaption(event.target.value)}
												className="min-h-28 rounded-[24px]"
												placeholder="Animated captions, strong opening line, tight pacing..."
											/>
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-2">
												<Label>Style</Label>
												<Input
													value={reelStyle}
													onChange={(event) => setReelStyle(event.target.value)}
													className="h-11 rounded-2xl"
												/>
											</div>
											<div className="space-y-2">
												<Label>Effects</Label>
												<Input
													value={reelEffects}
													onChange={(event) =>
														setReelEffects(event.target.value)
													}
													className="h-11 rounded-2xl"
													placeholder="zoom, cut, captions"
												/>
											</div>
										</div>
									</>
								) : null}

								<Button
									className="w-full rounded-full border-0 bg-gradient-brand text-white"
									onClick={() => void runStudioMode()}
									disabled={submitting}
								>
									<Play className="size-4" />
									{submitting ? "Running..." : `Run ${currentMode.label}`}
								</Button>
							</SurfaceCard>

							<SurfaceCard className="space-y-4 p-5">
								<div className="text-sm font-medium">Current mode activity</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
									{selectedRun
										? `${summarizeRunArtifacts(selectedRun)} • ${formatAutomationWhen(selectedRun.updatedAt)}`
										: "No runs for this mode yet."}
								</div>
								{selectedRun ? (
									<Button
										variant="outline"
										className="w-full rounded-full"
										asChild
									>
										<Link to={`/dashboard/automations/runs/${selectedRun.id}`}>
											View run detail
										</Link>
									</Button>
								) : null}
							</SurfaceCard>

							<SurfaceCard className="space-y-3 p-5">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium">Prompt policy</div>
										<div className="text-xs text-muted-foreground">
											Base + {currentMode.label.toLowerCase()} override
										</div>
									</div>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										asChild
									>
										<Link to="/dashboard/settings/intelligence">
											<Settings2 className="size-4" />
											Edit
										</Link>
									</Button>
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
									{aiSettings
										? systemPromptPreview(
												aiSettings.systemPrompts,
												currentMode.value === "image"
													? "studioImage"
													: currentMode.value === "pdf"
														? "studioPdf"
														: "studioReel",
											)
										: "Loading prompt policy..."}
								</div>
							</SurfaceCard>
						</div>
					</DashboardPanel>
				</div>
			</div>
		</div>
	);
}
