import {
	ArrowRight,
	Check,
	ChevronDown,
	LoaderCircle,
	Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
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
import type { AutomationDefinition, AutomationRun } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type PostAgentGuideSurface = "composer" | "automations";

type PostAgentTarget = {
	label: string;
	platform: string;
	surface: string;
};

type PostAgentDirection =
	| "practical"
	| "opinionated"
	| "educational"
	| "launch";
type PostAgentResearchLevel = "quick" | "deep";

type PostAgentDraft = {
	idea: string;
	direction: PostAgentDirection;
	personalTouch: string;
	researchLevel: PostAgentResearchLevel;
	includeImageBrief: boolean;
	includeVideoBrief: boolean;
	sourceUrls: string;
	excludeDomains: string;
	country: string;
	timeRange: "day" | "week" | "month" | "year";
};

const postAgentTargets: PostAgentTarget[] = [
	{ label: "LinkedIn", platform: "linkedin", surface: "feed_post" },
	{ label: "X thread", platform: "x", surface: "thread" },
	{ label: "Instagram", platform: "instagram", surface: "feed_post" },
];

const directionOptions: Array<{
	value: PostAgentDirection;
	label: string;
	detail: string;
}> = [
	{
		value: "practical",
		label: "Practical",
		detail: "Clear point, useful takeaway, no fluff.",
	},
	{
		value: "opinionated",
		label: "Opinionated",
		detail: "Sharper stance with a confident point of view.",
	},
	{
		value: "educational",
		label: "Educational",
		detail: "Teach the idea with examples and context.",
	},
	{
		value: "launch",
		label: "Launch/update",
		detail: "Frame it as news, progress, or a timely update.",
	},
];

const defaultPostAgentDraft: PostAgentDraft = {
	idea: "",
	direction: "practical",
	personalTouch: "",
	researchLevel: "quick",
	includeImageBrief: true,
	includeVideoBrief: false,
	sourceUrls: "",
	excludeDomains: "",
	country: "",
	timeRange: "week",
};

function parseCSV(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function buildPostAgentPrompt(draft: PostAgentDraft) {
	const direction = directionOptions.find(
		(option) => option.value === draft.direction,
	);
	return [
		draft.idea.trim(),
		direction
			? `Direction: ${direction.label}. ${direction.detail}`
			: undefined,
		draft.personalTouch.trim()
			? `Personal touch: ${draft.personalTouch.trim()}`
			: undefined,
	]
		.filter(Boolean)
		.join("\n\n");
}

function postDraftPostId(run: AutomationRun) {
	const artifacts = [
		...(((run.outputPayload.artifacts as unknown[]) ?? []) as Array<{
			type?: string;
			postId?: string;
		}>),
		...run.steps.flatMap((step) => step.artifactPayload),
	];
	return (
		artifacts.find((artifact) => artifact.type === "post_draft")?.postId ?? ""
	);
}

function friendlyRunError(run?: AutomationRun, caught?: unknown) {
	const raw =
		run?.lastError ??
		(caught instanceof Error ? caught.message : "The draft did not finish.");
	const lower = raw.toLowerCase();
	if (lower.includes("quota") || lower.includes("resource_exhausted")) {
		return "The AI provider is out of usable generation quota right now. Your idea is still here, so you can try again after the provider is fixed.";
	}
	if (lower.includes("api key") || lower.includes("permission")) {
		return "The AI provider needs a setup fix before it can draft this. Your idea is still here.";
	}
	if (lower.includes("tavily")) {
		return "Research setup needs attention before the agent can use web sources. Your idea is still here.";
	}
	return "The agent could not finish this draft. Your idea is still here, and the run details have the technical reason.";
}

function postAgentDefaultConfig() {
	return {
		persist: true,
		provider: "gemini",
		mode: "native",
		useWebResearch: true,
		trendAware: true,
		deepResearch: false,
		includeHookOptions: true,
		includeTags: true,
		includeImageBrief: true,
		includeVideoBrief: false,
		personaMode: "workspace",
	};
}

function runInputFromDraft(
	draft: PostAgentDraft,
	selectedTargetItems: PostAgentTarget[],
) {
	return {
		prompt: buildPostAgentPrompt(draft),
		promptScope: "automations",
		persist: true,
		provider: "gemini",
		mode: "native",
		useWebResearch: true,
		deepResearch: draft.researchLevel === "deep",
		trendAware: true,
		includeHookOptions: true,
		includeTags: true,
		includeImageBrief: draft.includeImageBrief,
		includeVideoBrief: draft.includeVideoBrief,
		personaMode: draft.personalTouch.trim() ? "custom" : "workspace",
		persona: draft.personalTouch.trim(),
		targets: selectedTargetItems.map(({ platform, surface }) => ({
			platform,
			surface,
		})),
		sourceUrls: parseCSV(draft.sourceUrls),
		country: draft.country.trim().toLowerCase(),
		timeRange: draft.timeRange,
		includeDomains: [],
		excludeDomains: parseCSV(draft.excludeDomains),
	};
}

export function PostAgentGuide({
	automations,
	onRunCreated,
	surface = "composer",
	className,
}: {
	automations: AutomationDefinition[];
	onRunCreated?: () => Promise<void>;
	surface?: PostAgentGuideSurface;
	className?: string;
}) {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<PostAgentDraft>(defaultPostAgentDraft);
	const [selectedTargets, setSelectedTargets] = useState(
		() => new Set(postAgentTargets.map((target) => target.label)),
	);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState("");
	const [failedRunId, setFailedRunId] = useState("");

	const selectedTargetItems = useMemo(
		() =>
			postAgentTargets.filter((target) => selectedTargets.has(target.label)),
		[selectedTargets],
	);

	function updateDraft<Key extends keyof PostAgentDraft>(
		key: Key,
		value: PostAgentDraft[Key],
	) {
		setDraft((current) => ({ ...current, [key]: value }));
	}

	function toggleTarget(label: string) {
		setSelectedTargets((current) => {
			const next = new Set(current);
			if (next.has(label)) {
				next.delete(label);
			} else {
				next.add(label);
			}
			return next.size > 0 ? next : current;
		});
	}

	async function ensurePostAgentAutomation() {
		const existing = automations.find(
			(automation) =>
				automation.actionType === "post_generate" &&
				automation.metadata?.source === "post_agent",
		);
		if (existing) {
			return existing.id;
		}
		const created = await customerRequest<AutomationDefinition>(
			`/workspaces/${activeWorkspaceId}/automations`,
			{
				method: "POST",
				body: {
					status: "active",
					scope: "standalone",
					name: "Post Agent",
					description:
						"Researches a topic, drafts a post, and prepares creative handoff briefs.",
					actionType: "post_generate",
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: postAgentDefaultConfig(),
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: ["text_generation", "research"],
					metadata: {
						source: "post_agent",
						managed: true,
					},
				},
			},
		);
		await onRunCreated?.();
		return created.id;
	}

	async function runPostAgent() {
		if (!activeWorkspaceId || running) {
			return;
		}
		if (!draft.idea.trim()) {
			setError("Start with the idea you want the post to carry.");
			return;
		}
		setRunning(true);
		setError("");
		setFailedRunId("");
		try {
			const automationId = await ensurePostAgentAutomation();
			const run = await customerRequest<AutomationRun>(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`,
				{
					method: "POST",
					body: {
						input: runInputFromDraft(draft, selectedTargetItems),
					},
				},
			);
			await onRunCreated?.();
			const nextPostId = postDraftPostId(run);
			if (run.status === "completed" && nextPostId) {
				toast.success("Post Agent saved a draft for review.");
				navigate(`/dashboard/posts/${nextPostId}/edit`);
				return;
			}
			setFailedRunId(run.id);
			setError(friendlyRunError(run));
		} catch (runError) {
			setError(friendlyRunError(undefined, runError));
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className={cn("flex flex-col items-start gap-3", className)}>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className={cn(
					"inline-flex max-w-full items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/84 px-4 py-3 text-left transition hover:border-[var(--brand-border-strong)] hover:bg-background",
					surface === "automations" && "bg-background/72",
				)}
				aria-expanded={open}
			>
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-[0_18px_40px_-26px_var(--brand-glow-strong)]">
						<Sparkles className="size-4" />
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<div className="font-semibold">Post Agent</div>
							<Badge variant="outline" className="rounded-full">
								Automation
							</Badge>
						</div>
						<div className="mt-0.5 text-sm text-muted-foreground">
							Turn an idea into a researched draft.
						</div>
					</div>
				</div>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 text-muted-foreground transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>

			{open ? (
				<SurfaceCard className="space-y-5 border-[var(--brand-border-soft)] bg-background/84 p-4 md:p-5">
					<div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor={`post-agent-idea-${surface}`}>
									What should this post say?
								</Label>
								<Textarea
									id={`post-agent-idea-${surface}`}
									value={draft.idea}
									onChange={(event) => updateDraft("idea", event.target.value)}
									className="dashboard-textarea-large"
									placeholder="Example: Small teams should use agentic automation for research, but the final point of view still has to feel human."
								/>
							</div>

							<div className="space-y-2">
								<div className="text-sm font-medium">Choose the direction</div>
								<div className="grid gap-2 sm:grid-cols-2">
									{directionOptions.map((option) => (
										<ChoiceButton
											key={option.value}
											active={draft.direction === option.value}
											label={option.label}
											detail={option.detail}
											onClick={() => updateDraft("direction", option.value)}
										/>
									))}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor={`post-agent-touch-${surface}`}>
									Add your voice, if you want
								</Label>
								<Textarea
									id={`post-agent-touch-${surface}`}
									value={draft.personalTouch}
									onChange={(event) =>
										updateDraft("personalTouch", event.target.value)
									}
									className="dashboard-textarea-medium"
									placeholder="Example: direct founder voice, skeptical of hype, practical for busy operators."
								/>
							</div>
						</div>

						<div className="space-y-4">
							<GuideBlock title="Where should it fit?">
								<div className="flex flex-wrap gap-2">
									{postAgentTargets.map((target) => {
										const selected = selectedTargets.has(target.label);
										return (
											<Button
												key={target.label}
												type="button"
												variant={selected ? "default" : "outline"}
												className="rounded-full"
												onClick={() => toggleTarget(target.label)}
											>
												{selected ? <Check className="size-3.5" /> : null}
												{target.label}
											</Button>
										);
									})}
								</div>
							</GuideBlock>

							<GuideBlock title="How much research?">
								<div className="grid gap-2">
									<ChoiceButton
										active={draft.researchLevel === "quick"}
										label="Quick scan"
										detail="Use recent context without slowing the flow down."
										onClick={() => updateDraft("researchLevel", "quick")}
									/>
									<ChoiceButton
										active={draft.researchLevel === "deep"}
										label="Deep research"
										detail="Spend more effort on evidence, trend signals, and counterpoints."
										onClick={() => updateDraft("researchLevel", "deep")}
									/>
								</div>
							</GuideBlock>

							<GuideBlock title="Creative handoff">
								<div className="grid gap-2">
									<ChoiceButton
										active={draft.includeImageBrief}
										label="Suggest an image idea"
										detail="Prepare a prompt for later image generation."
										onClick={() =>
											updateDraft("includeImageBrief", !draft.includeImageBrief)
										}
									/>
									<ChoiceButton
										active={draft.includeVideoBrief}
										label="Think through a short video"
										detail="Add a future-ready video direction."
										onClick={() =>
											updateDraft("includeVideoBrief", !draft.includeVideoBrief)
										}
									/>
								</div>
							</GuideBlock>
						</div>
					</div>

					<details className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
						<summary className="cursor-pointer list-none text-sm font-medium">
							Fine-tune sources and market
						</summary>
						<div className="mt-4 grid gap-4 lg:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`post-agent-sources-${surface}`}>
									Sources to use
								</Label>
								<Input
									id={`post-agent-sources-${surface}`}
									value={draft.sourceUrls}
									onChange={(event) =>
										updateDraft("sourceUrls", event.target.value)
									}
									className="h-11 rounded-2xl"
									placeholder="https://example.com/report, https://..."
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`post-agent-avoid-${surface}`}>
									Avoid sites
								</Label>
								<Input
									id={`post-agent-avoid-${surface}`}
									value={draft.excludeDomains}
									onChange={(event) =>
										updateDraft("excludeDomains", event.target.value)
									}
									className="h-11 rounded-2xl"
									placeholder="low-quality-site.com, competitor.com"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`post-agent-country-${surface}`}>
									Country or market
								</Label>
								<Input
									id={`post-agent-country-${surface}`}
									value={draft.country}
									onChange={(event) =>
										updateDraft("country", event.target.value)
									}
									className="h-11 rounded-2xl"
									placeholder="United States"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`post-agent-time-${surface}`}>
									Recent timeframe
								</Label>
								<Select
									value={draft.timeRange}
									onValueChange={(value) =>
										updateDraft(
											"timeRange",
											value as PostAgentDraft["timeRange"],
										)
									}
								>
									<SelectTrigger
										id={`post-agent-time-${surface}`}
										className="h-11 rounded-2xl"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="day">Today</SelectItem>
										<SelectItem value="week">This week</SelectItem>
										<SelectItem value="month">This month</SelectItem>
										<SelectItem value="year">This year</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</details>

					{error ? (
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							<div>{error}</div>
							{failedRunId ? (
								<Button variant="outline" className="rounded-full" asChild>
									<Link to={`/dashboard/automations/runs/${failedRunId}`}>
										View details
									</Link>
								</Button>
							) : null}
						</div>
					) : null}

					<div className="flex flex-col gap-3 border-t border-[var(--brand-border-soft)] pt-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-sm text-muted-foreground">
							The agent will save a draft, then bring you back to the composer.
						</div>
						<Button
							type="button"
							className="rounded-full"
							onClick={() => void runPostAgent()}
							disabled={running}
						>
							{running ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<Sparkles className="size-4" />
							)}
							{running ? "Drafting..." : "Create my draft"}
							{running ? null : <ArrowRight className="size-4" />}
						</Button>
					</div>
				</SurfaceCard>
			) : null}
		</div>
	);
}

function GuideBlock({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
			<div className="text-sm font-medium">{title}</div>
			{children}
		</div>
	);
}

function ChoiceButton({
	active,
	label,
	detail,
	onClick,
}: {
	active: boolean;
	label: string;
	detail: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex min-h-20 w-full items-start gap-3 rounded-[18px] border px-3.5 py-3 text-left transition",
				active
					? "border-[var(--brand-border-strong)] bg-primary/10 text-foreground"
					: "border-[var(--brand-border-soft)] bg-background/72 hover:border-[var(--brand-border-strong)] hover:bg-background",
			)}
		>
			<span
				className={cn(
					"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
					active
						? "border-primary bg-primary text-primary-foreground"
						: "border-[var(--brand-border-soft)]",
				)}
			>
				{active ? <Check className="size-3" /> : null}
			</span>
			<span className="min-w-0">
				<span className="block text-sm font-medium">{label}</span>
				<span className="mt-1 block text-xs leading-5 text-muted-foreground">
					{detail}
				</span>
			</span>
		</button>
	);
}
