import {
	ArrowRight,
	BrainCircuit,
	ChevronRight,
	LoaderCircle,
	Rocket,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceAISettings, WorkspaceSystemPrompts } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { useWorkspaceSetupReadiness } from "@/hooks/use-workspace-setup-readiness";

const blankPrompts: WorkspaceSystemPrompts = {
	base: "",
	studioImage: "",
	studioPdf: "",
	studioReel: "",
	automations: "",
};

function statusTone(complete: boolean, optional?: boolean) {
	if (complete) {
		return "border-emerald-500/20 bg-emerald-500/8 text-emerald-700";
	}
	if (optional) {
		return "border-sky-500/20 bg-sky-500/8 text-sky-700";
	}
	return "border-amber-500/20 bg-amber-500/8 text-amber-700";
}

export function DashboardSetupPage() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const { loading, error, readiness, context, reload } =
		useWorkspaceSetupReadiness();
	const [settings, setSettings] = useState<WorkspaceAISettings | null>(null);
	const [savingBasics, setSavingBasics] = useState(false);
	const [businessNarrative, setBusinessNarrative] = useState("");
	const [aiMode, setAiMode] = useState<"native" | "byok">("native");

	const loadSettings = useCallback(async () => {
		if (!activeWorkspaceId) {
			setSettings(null);
			return;
		}
		const response = await customerRequest<WorkspaceAISettings>(
			`/workspaces/${activeWorkspaceId}/ai/settings`,
		);
		setSettings(response);
		setAiMode(response.defaultMode);
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		setBusinessNarrative(context?.business.narrative ?? "");
	}, [context?.business.narrative]);

	async function saveBasics() {
		if (!activeWorkspaceId || !context || !settings) {
			return;
		}
		setSavingBasics(true);
		try {
			await Promise.all([
				customerRequest(`/workspaces/${activeWorkspaceId}/ai/context/business`, {
					method: "PATCH",
					body: {
						narrative: businessNarrative,
						summary: context.business.summary,
						understandingScore: context.business.understandingScore,
						missingGaps: context.business.missingGaps,
						facts: context.business.facts,
					},
				}),
				customerRequest(`/workspaces/${activeWorkspaceId}/ai/settings`, {
					method: "PATCH",
					body: {
						defaultMode: aiMode,
						capabilityDefaults: settings.capabilityDefaults,
						systemPrompts: settings.systemPrompts ?? blankPrompts,
						credentials: settings.credentials.map((credential) => ({
							id: credential.id,
							provider: credential.provider,
							position: credential.position,
							status: credential.status,
							apiKey: "",
							allowedModels: credential.allowedModels,
						})),
					},
				}),
			]);
			toast.success("Setup basics saved.");
			await Promise.all([reload(), loadSettings()]);
		} catch (saveError) {
			toast.error(
				saveError instanceof Error
					? saveError.message
					: "Unable to save setup basics.",
			);
		} finally {
			setSavingBasics(false);
		}
	}

	return (
		<div className="dashboard-page-stack space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace setup"
				title="Get Heimdall usable fast"
				description="Create the workspace, connect one destination, and add only the basics that materially improve output. Everything else can stay out of the way until later."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard">Skip for now</Link>
						</Button>
						<Button className="rounded-full border-0 bg-gradient-brand text-white" asChild>
							<Link to={readiness.publishingReady ? "/dashboard/posts/new" : "/dashboard/settings/platforms"}>
								{readiness.publishingReady ? "Create first post" : "Finish publishing setup"}
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</>
				}
			/>

			<SurfaceCard className="media-hero-surface overflow-hidden rounded-[32px] p-6 md:p-7">
				<div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							<Rocket className="size-3.5 text-primary" />
							Guided setup
						</div>
						<div className="space-y-3">
							<h2 className="text-2xl font-semibold tracking-tight">
								{readiness.publishingReady
									? "Your first publish path is almost there."
									: "Build one working publish path before worrying about the rest."}
							</h2>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
								{readiness.summary}
							</p>
						</div>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Recommended steps complete
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{readiness.completedStepCount}/{readiness.requiredStepCount}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Only workspace creation is mandatory. The rest is guided, not blocking.
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Publishing layer
							</div>
							<div className="mt-3 text-lg font-semibold tracking-tight">
								{readiness.publishingReady ? "Ready" : "Needs setup"}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								{readiness.targetReady
									? "A healthy selected destination is in place."
									: "Connect one provider and choose one destination target."}
							</div>
						</SurfaceCard>
					</div>
				</div>
			</SurfaceCard>

			<DashboardPanel
				title="Setup checklist"
				description="Move through the main path once, then handle advanced setup only if the workspace really needs it."
			>
				<div className="grid gap-4 xl:grid-cols-2">
					{readiness.steps.map((step, index) => (
						<SurfaceCard key={step.id} className="dashboard-card space-y-4">
							<div className="flex items-start justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2 text-sm font-medium">
										<span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
											{index + 1}
										</span>
										{step.title}
									</div>
									<div className="text-sm text-muted-foreground">
										{step.description}
									</div>
								</div>
								<Badge
									variant="outline"
									className={`rounded-full ${statusTone(step.complete, step.optional)}`}
								>
									{step.complete ? "Complete" : step.optional ? "Optional" : "Next"}
								</Badge>
							</div>
							{step.ctaHref ? (
								<Button
									variant={step.complete ? "outline" : "default"}
									className={step.complete ? "rounded-full" : "rounded-full border-0 bg-gradient-brand text-white"}
									asChild
								>
									<Link to={step.ctaHref}>
										{step.ctaLabel}
										<ChevronRight className="size-4" />
									</Link>
								</Button>
							) : null}
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Intelligence basics"
				description="Only add the inputs that materially improve drafts and guidance. Brand systems and prompt policy can wait until later."
				action={
					<Button
						className="rounded-full border-0 bg-gradient-brand text-white"
						disabled={loading || savingBasics || !settings || !context}
						onClick={() => void saveBasics()}
					>
						{savingBasics ? (
							<>
								<LoaderCircle className="size-4 animate-spin" />
								Saving basics...
							</>
						) : (
							"Save basics"
						)}
					</Button>
				}
			>
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
					<SurfaceCard className="dashboard-card space-y-4">
						<div className="space-y-2">
							<Label htmlFor="setup-business-description">
								Business description
							</Label>
							<Textarea
								id="setup-business-description"
								value={businessNarrative}
								onChange={(event) => setBusinessNarrative(event.target.value)}
								className="dashboard-textarea-xl rounded-[24px]"
								placeholder="Describe what the business does, who it helps, and what makes it valuable."
								disabled={loading}
							/>
						</div>

						<div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
							<div className="space-y-2">
								<Label>AI access mode</Label>
								<Select
									value={aiMode}
									onValueChange={(value) =>
										setAiMode(value as "native" | "byok")
									}
								>
									<SelectTrigger className="dashboard-input-height rounded-2xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="native">Use Heimdall-managed AI</SelectItem>
										<SelectItem value="byok">Use my own keys later</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
								{aiMode === "native"
									? "Recommended for the fastest setup. Heimdall can start generating with approved workspace defaults."
									: "BYOK is fine, but the workspace will still need provider keys in advanced intelligence settings before AI access becomes ready."}
							</div>
						</div>
					</SurfaceCard>

					<div className="space-y-4">
						<SurfaceCard className="dashboard-card space-y-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								<BrainCircuit className="size-4 text-primary" />
								Current readiness
							</div>
							<div className="space-y-3">
								<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3 text-sm">
									<span>Business context</span>
									<span className={context?.readiness.hasBusinessContext ? "text-emerald-700" : "text-amber-700"}>
										{context?.readiness.hasBusinessContext ? "Ready" : "Missing"}
									</span>
								</div>
								<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3 text-sm">
									<span>AI access</span>
									<span className={context?.readiness.hasAiAccess ? "text-emerald-700" : "text-amber-700"}>
										{context?.readiness.hasAiAccess ? "Ready" : "Needs setup"}
									</span>
								</div>
								<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3 text-sm">
									<span>Brand guidance</span>
									<span className={context?.readiness.hasBrandContext ? "text-emerald-700" : "text-sky-700"}>
										{context?.readiness.hasBrandContext ? "Ready" : "Optional"}
									</span>
								</div>
							</div>
						</SurfaceCard>

						<SurfaceCard className="dashboard-card space-y-3">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Sparkles className="size-4 text-primary" />
								When to go deeper
							</div>
							<div className="text-sm text-muted-foreground">
								Open the full intelligence page when you want brand guidance,
								prompt policy, or provider-specific key management.
							</div>
							<Button variant="outline" className="rounded-full" asChild>
								<Link to="/dashboard/settings/intelligence">
									Open advanced intelligence
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</SurfaceCard>
					</div>
				</div>
			</DashboardPanel>

			{error ? (
				<SurfaceCard className="dashboard-card-sm border border-destructive/20 bg-destructive/10 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}
		</div>
	);
}
