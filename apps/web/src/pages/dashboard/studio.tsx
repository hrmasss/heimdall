import { FileText, ImagePlus, Sparkles, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader, DashboardPanel } from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ApiListResponse, AutomationDefinition, AutomationRun, RunArtifact } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function findArtifact(run: AutomationRun | null, type: string) {
	if (!run) {
		return null;
	}
	return (run.outputPayload.artifacts as RunArtifact[] | undefined)?.find(
		(artifact) => artifact.type === type,
	);
}

export function DashboardStudio() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [imagePrompt, setImagePrompt] = useState("");
	const [reelVideoResourceId, setReelVideoResourceId] = useState("");
	const [reelCaption, setReelCaption] = useState("");
	const [pdfTitle, setPdfTitle] = useState("");
	const [pdfPages, setPdfPages] = useState("");

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [automationResponse, runResponse] = await Promise.all([
				customerRequest<ApiListResponse<AutomationDefinition>>(
					`/workspaces/${activeWorkspaceId}/automations`,
				),
				customerRequest<ApiListResponse<AutomationRun>>(
					`/workspaces/${activeWorkspaceId}/runs`,
				),
			]);
			setAutomations(automationResponse.items);
			setLastRun(runResponse.items[0] ?? null);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Unable to load studio data.");
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const imageArtifact = useMemo(() => findArtifact(lastRun, "resource"), [lastRun]);
	const pdfArtifact = useMemo(() => findArtifact(lastRun, "document_resource"), [lastRun]);
	const reelArtifact = useMemo(() => findArtifact(lastRun, "resource_set"), [lastRun]);

	async function ensureAutomation(actionType: string, name: string) {
		if (!activeWorkspaceId) {
			throw new Error("No active workspace.");
		}
		const existing = automations.find((automation) => automation.actionType === actionType);
		if (existing) {
			return existing.id;
		}
		const created = await customerRequest<AutomationDefinition>(
			`/workspaces/${activeWorkspaceId}/automations`,
			{
				method: "POST",
				body: {
					name,
					description: `Studio automation for ${actionType}.`,
					status: "active",
					scope: "standalone",
					actionType,
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: {},
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: [],
					metadata: { source: "studio" },
				},
			},
		);
		setAutomations((current) => [created, ...current]);
		return created.id;
	}

	async function runStudioAction(actionType: string, name: string, input: Record<string, unknown>) {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			const automationId = await ensureAutomation(actionType, name);
			const run = await customerRequest<AutomationRun>(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`,
				{
					method: "POST",
					body: { input },
				},
			);
			setLastRun(run);
			setNotice("Studio generation complete.");
			await loadData();
		} catch (runError) {
			setError(runError instanceof Error ? runError.message : "Unable to run studio action.");
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Generation workspace"
				title="Studio"
				description="Generate image, reel, and PDF assets in a focused workspace, preview the result, and keep everything saved back into Assets for reuse."
				actions={
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/library">Open assets</Link>
					</Button>
				}
			/>

			{notice ? (
				<div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
					{notice}
				</div>
			) : null}
			{error ? (
				<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<div className="space-y-6">
					<DashboardPanel
						title="Image generation"
						description="Pollinations powers the first provider in the image registry, but the workflow stays provider-pluggable."
					>
						<SurfaceCard className="p-5">
							<Label htmlFor="image-prompt">Prompt</Label>
							<Textarea
								id="image-prompt"
								value={imagePrompt}
								onChange={(event) => setImagePrompt(event.target.value)}
								className="mt-3 min-h-28"
								placeholder="Minimalist product hero, editorial composition, bright daylight, warm neutrals..."
							/>
							<div className="mt-5 flex justify-end">
								<Button className="rounded-full" onClick={() => void runStudioAction("image_generate", "Studio image generation", { prompt: imagePrompt })}>
									<ImagePlus className="size-4" />
									Generate image
								</Button>
							</div>
						</SurfaceCard>
					</DashboardPanel>

					<DashboardPanel
						title="Reel beta"
						description="Start with a looped source video and a caption plan. This v1 beta stores a reusable reel blueprint in Assets."
					>
						<SurfaceCard className="p-5">
							<div className="grid gap-4">
								<div>
									<Label htmlFor="reel-video">Source video resource ID</Label>
									<Input
										id="reel-video"
										value={reelVideoResourceId}
										onChange={(event) => setReelVideoResourceId(event.target.value)}
										className="mt-2"
										placeholder="Paste a workspace video resource ID"
									/>
								</div>
								<div>
									<Label htmlFor="reel-caption">Caption</Label>
									<Textarea
										id="reel-caption"
										value={reelCaption}
										onChange={(event) => setReelCaption(event.target.value)}
										className="mt-2 min-h-24"
										placeholder="Animated captions, strong opening line, compact pacing."
									/>
								</div>
							</div>
							<div className="mt-5 flex justify-end">
								<Button className="rounded-full" onClick={() => void runStudioAction("reel_generate_beta", "Studio reel beta", { videoResourceId: reelVideoResourceId, caption: reelCaption })}>
									<Video className="size-4" />
									Create reel blueprint
								</Button>
							</div>
						</SurfaceCard>
					</DashboardPanel>

					<DashboardPanel
						title="LinkedIn PDF beta"
						description="Generate a reusable PDF asset for document posts, then route it into review or a broader workflow."
					>
						<SurfaceCard className="p-5">
							<div className="grid gap-4">
								<div>
									<Label htmlFor="pdf-title">Title</Label>
									<Input
										id="pdf-title"
										value={pdfTitle}
										onChange={(event) => setPdfTitle(event.target.value)}
										className="mt-2"
										placeholder="The 5 systems behind consistent content operations"
									/>
								</div>
								<div>
									<Label htmlFor="pdf-pages">Pages</Label>
									<Textarea
										id="pdf-pages"
										value={pdfPages}
										onChange={(event) => setPdfPages(event.target.value)}
										className="mt-2 min-h-28"
										placeholder="Write one paragraph per page. Separate pages with a blank line."
									/>
								</div>
							</div>
							<div className="mt-5 flex justify-end">
								<Button className="rounded-full" onClick={() => void runStudioAction("linkedin_pdf_generate_beta", "Studio LinkedIn PDF", { title: pdfTitle, pages: pdfPages.split(/\n\s*\n/).filter(Boolean) })}>
									<FileText className="size-4" />
									Generate PDF
								</Button>
							</div>
						</SurfaceCard>
					</DashboardPanel>
				</div>

				<DashboardPanel
					title="Latest output"
					description="Preview the most recent studio run and jump straight into Assets if you want to manage or reuse the result."
				>
					<div className="grid gap-4">
						<SurfaceCard className="p-5">
							<div className="flex items-center justify-between gap-3">
								<div className="text-sm font-medium">Current run</div>
								{lastRun ? (
									<Badge variant="outline" className="rounded-full capitalize">
										{lastRun.status}
									</Badge>
								) : null}
							</div>
							<div className="mt-3 text-sm text-muted-foreground">
								{lastRun ? `Last updated ${new Date(lastRun.updatedAt).toLocaleString()}` : loading ? "Loading..." : "No studio runs yet."}
							</div>
						</SurfaceCard>

						{imageArtifact ? (
							<SurfaceCard className="p-5">
								<div className="flex items-center gap-2 text-sm font-medium">
									<ImagePlus className="size-4 text-primary" />
									Image preview
								</div>
								{typeof imageArtifact.data?.previewUrl === "string" ? (
									<img
										src={imageArtifact.data.previewUrl}
										alt={imageArtifact.label}
										className="mt-4 w-full rounded-[24px] border object-cover"
									/>
								) : null}
								<div className="mt-4 text-sm text-muted-foreground">{imageArtifact.label}</div>
							</SurfaceCard>
						) : null}

						{reelArtifact ? (
							<SurfaceCard className="p-5">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Video className="size-4 text-primary" />
									Reel blueprint
								</div>
								<div className="mt-4 text-sm text-muted-foreground">
									{typeof reelArtifact.data?.caption === "string"
										? reelArtifact.data.caption
										: "Blueprint saved to Assets."}
								</div>
							</SurfaceCard>
						) : null}

						{pdfArtifact ? (
							<SurfaceCard className="p-5">
								<div className="flex items-center gap-2 text-sm font-medium">
									<FileText className="size-4 text-primary" />
									PDF output
								</div>
								<div className="mt-4 text-sm text-muted-foreground">{pdfArtifact.label}</div>
								{typeof pdfArtifact.data?.downloadUrl === "string" ? (
									<Button variant="outline" className="mt-4 rounded-full" asChild>
										<a href={pdfArtifact.data.downloadUrl} target="_blank" rel="noreferrer">
											<Sparkles className="size-4" />
											Open PDF
										</a>
									</Button>
								) : null}
							</SurfaceCard>
						) : null}
					</div>
				</DashboardPanel>
			</div>
		</div>
	);
}
