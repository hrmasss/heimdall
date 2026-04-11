import {
	ArrowRight,
	Bot,
	Clock3,
	Copy,
	LayoutTemplate,
	Play,
	Plus,
	Sparkles,
	Trash2,
	Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	AutomationCatalogResponse,
	AutomationDefinition,
	AutomationRun,
	WorkflowDefinition,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	formatAutomationWhen,
	summarizeRunArtifacts,
} from "@/lib/automation-builder";

type WorkflowRow = WorkflowDefinition & {
	runCount: number;
	lastRunAt?: string;
};

type PostAgentTarget = {
	label: string;
	platform: string;
	surface: string;
};

const postAgentTargets: PostAgentTarget[] = [
	{ label: "LinkedIn", platform: "linkedin", surface: "feed_post" },
	{ label: "X thread", platform: "x", surface: "thread" },
	{ label: "Instagram", platform: "instagram", surface: "feed_post" },
];

const defaultPostAgentDraft = {
	prompt: "",
	persona: "",
	useWebResearch: true,
	deepResearch: false,
	trendAware: true,
	includeHookOptions: true,
	includeTags: true,
	includeImageBrief: true,
	includeVideoBrief: false,
	country: "",
	timeRange: "week",
	sourceUrls: "",
	includeDomains: "",
	excludeDomains: "",
};

function StatPill({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Workflow;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3">
			<div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
				<Icon className="size-3.5" />
				{label}
			</div>
			<div className="mt-2 text-xl font-semibold">{value}</div>
		</div>
	);
}

function parseCSV(value: string) {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function PostAgentLauncher({
	automations,
	onRunCreated,
}: {
	automations: AutomationDefinition[];
	onRunCreated: () => Promise<void>;
}) {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [draft, setDraft] = useState(defaultPostAgentDraft);
	const [selectedTargets, setSelectedTargets] = useState(
		() => new Set(postAgentTargets.map((target) => target.label)),
	);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [running, setRunning] = useState(false);

	const selectedTargetItems = useMemo(
		() =>
			postAgentTargets.filter((target) => selectedTargets.has(target.label)),
		[selectedTargets],
	);

	function updateDraft<Key extends keyof typeof defaultPostAgentDraft>(
		key: Key,
		value: (typeof defaultPostAgentDraft)[Key],
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
					defaultConfig: {
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
					},
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
		await onRunCreated();
		return created.id;
	}

	async function runPostAgent() {
		if (!activeWorkspaceId || running) {
			return;
		}
		const prompt = draft.prompt.trim();
		if (!prompt) {
			toast.error("Add a topic or request first.");
			return;
		}
		setRunning(true);
		try {
			const automationId = await ensurePostAgentAutomation();
			const run = await customerRequest<{ id: string }>(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`,
				{
					method: "POST",
					body: {
						input: {
							prompt,
							promptScope: "automations",
							provider: "gemini",
							mode: "native",
							useWebResearch: draft.useWebResearch,
							deepResearch: draft.deepResearch,
							trendAware: draft.trendAware,
							includeHookOptions: draft.includeHookOptions,
							includeTags: draft.includeTags,
							includeImageBrief: draft.includeImageBrief,
							includeVideoBrief: draft.includeVideoBrief,
							personaMode: draft.persona.trim() ? "custom" : "workspace",
							persona: draft.persona.trim(),
							targets: selectedTargetItems.map(({ platform, surface }) => ({
								platform,
								surface,
							})),
							sourceUrls: parseCSV(draft.sourceUrls),
							country: draft.country.trim().toLowerCase(),
							timeRange: draft.timeRange,
							includeDomains: parseCSV(draft.includeDomains),
							excludeDomains: parseCSV(draft.excludeDomains),
						},
					},
				},
			);
			toast.success("Post Agent started.");
			await onRunCreated();
			navigate(`/dashboard/automations/runs/${run.id}`);
		} catch (runError) {
			toast.error(
				runError instanceof Error
					? runError.message
					: "Unable to start Post Agent.",
			);
		} finally {
			setRunning(false);
		}
	}

	return (
		<DashboardPanel
			title="Post Agent"
			description="Start with a topic. The agent researches, takes a position, drafts the post, and prepares the creative handoff."
		>
			<SurfaceCard className="overflow-hidden border border-[var(--brand-border-soft)] bg-background/75 p-5">
				<div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="post-agent-prompt">Topic or request</Label>
							<Textarea
								id="post-agent-prompt"
								value={draft.prompt}
								onChange={(event) => updateDraft("prompt", event.target.value)}
								placeholder="Example: Write a strong LinkedIn post about why AI content workflows need a human point of view."
								className="min-h-32 rounded-[24px]"
							/>
						</div>
						<div className="space-y-2">
							<Label>Destinations</Label>
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
											{target.label}
										</Button>
									);
								})}
							</div>
						</div>
					</div>
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
							<PostAgentSwitch
								label="Web research"
								checked={draft.useWebResearch}
								onCheckedChange={(checked) =>
									updateDraft("useWebResearch", checked)
								}
							/>
							<PostAgentSwitch
								label="Use trends"
								checked={draft.trendAware}
								onCheckedChange={(checked) =>
									updateDraft("trendAware", checked)
								}
							/>
							<PostAgentSwitch
								label="Deep research"
								checked={draft.deepResearch}
								onCheckedChange={(checked) =>
									updateDraft("deepResearch", checked)
								}
							/>
							<PostAgentSwitch
								label="Hook ideas"
								checked={draft.includeHookOptions}
								onCheckedChange={(checked) =>
									updateDraft("includeHookOptions", checked)
								}
							/>
							<PostAgentSwitch
								label="Effective tags"
								checked={draft.includeTags}
								onCheckedChange={(checked) =>
									updateDraft("includeTags", checked)
								}
							/>
							<PostAgentSwitch
								label="Image idea"
								checked={draft.includeImageBrief}
								onCheckedChange={(checked) =>
									updateDraft("includeImageBrief", checked)
								}
							/>
							<PostAgentSwitch
								label="Video idea"
								checked={draft.includeVideoBrief}
								onCheckedChange={(checked) =>
									updateDraft("includeVideoBrief", checked)
								}
							/>
						</div>
						<Button
							className="w-full rounded-full border-0 bg-gradient-brand text-white"
							onClick={() => void runPostAgent()}
							disabled={running}
						>
							<Sparkles className="size-4" />
							{running ? "Starting..." : "Generate post"}
						</Button>
					</div>
				</div>

				<div className="mt-5 border-t border-[var(--brand-border-soft)] pt-4">
					<Button
						type="button"
						variant="ghost"
						className="rounded-full"
						onClick={() => setAdvancedOpen((current) => !current)}
					>
						{advancedOpen ? "Hide" : "Show"} advanced options
					</Button>
					{advancedOpen ? (
						<div className="mt-4 grid gap-4 lg:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="post-agent-persona">Personal touch</Label>
								<Textarea
									id="post-agent-persona"
									value={draft.persona}
									onChange={(event) =>
										updateDraft("persona", event.target.value)
									}
									placeholder="Example: direct, founder-led, practical, a little skeptical of hype."
									className="min-h-24 rounded-[22px]"
								/>
							</div>
							<div className="space-y-3">
								<div className="space-y-2">
									<Label htmlFor="post-agent-country">Target country</Label>
									<Input
										id="post-agent-country"
										value={draft.country}
										onChange={(event) =>
											updateDraft("country", event.target.value)
										}
										placeholder="united states"
										className="h-11 rounded-2xl"
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="post-agent-time-range">Time range</Label>
									<select
										id="post-agent-time-range"
										value={draft.timeRange}
										onChange={(event) =>
											updateDraft("timeRange", event.target.value)
										}
										className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm"
									>
										<option value="day">Day</option>
										<option value="week">Week</option>
										<option value="month">Month</option>
										<option value="year">Year</option>
									</select>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="post-agent-sources">Source URLs</Label>
								<Input
									id="post-agent-sources"
									value={draft.sourceUrls}
									onChange={(event) =>
										updateDraft("sourceUrls", event.target.value)
									}
									placeholder="https://example.com/report, https://..."
									className="h-11 rounded-2xl"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="post-agent-include-domains">
									Include domains
								</Label>
								<Input
									id="post-agent-include-domains"
									value={draft.includeDomains}
									onChange={(event) =>
										updateDraft("includeDomains", event.target.value)
									}
									placeholder="example.com, another.com"
									className="h-11 rounded-2xl"
								/>
							</div>
							<div className="space-y-2 lg:col-span-2">
								<Label htmlFor="post-agent-exclude-domains">
									Exclude domains
								</Label>
								<Input
									id="post-agent-exclude-domains"
									value={draft.excludeDomains}
									onChange={(event) =>
										updateDraft("excludeDomains", event.target.value)
									}
									placeholder="low-quality-site.com, competitor.com"
									className="h-11 rounded-2xl"
								/>
							</div>
						</div>
					) : null}
				</div>
			</SurfaceCard>
		</DashboardPanel>
	);
}

function PostAgentSwitch({
	label,
	checked,
	onCheckedChange,
}: {
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--brand-border-soft)] bg-background/60 px-3 py-2">
			<span className="text-sm font-medium">{label}</span>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

export function DashboardAutomations() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [catalog, setCatalog] = useState<AutomationCatalogResponse | null>(
		null,
	);
	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
	const [runs, setRuns] = useState<AutomationRun[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [
				catalogResponse,
				automationResponse,
				workflowResponse,
				runResponse,
			] = await Promise.all([
				customerRequest<AutomationCatalogResponse>(
					`/workspaces/${activeWorkspaceId}/automation-catalog`,
				),
				customerRequest<ApiListResponse<AutomationDefinition>>(
					`/workspaces/${activeWorkspaceId}/automations`,
				),
				customerRequest<ApiListResponse<WorkflowDefinition>>(
					`/workspaces/${activeWorkspaceId}/workflows`,
				),
				customerRequest<ApiListResponse<AutomationRun>>(
					`/workspaces/${activeWorkspaceId}/runs`,
				),
			]);
			setCatalog(catalogResponse);
			setAutomations(automationResponse.items);
			setWorkflows(workflowResponse.items);
			setRuns(runResponse.items);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load automations.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const workflowsWithRunMeta = useMemo<WorkflowRow[]>(() => {
		return workflows.map((workflow) => {
			const workflowRuns = runs.filter((run) => run.workflowId === workflow.id);
			return {
				...workflow,
				runCount: workflowRuns.length,
				lastRunAt: workflowRuns[0]?.updatedAt,
			};
		});
	}, [runs, workflows]);

	const pendingRuns = useMemo(
		() => runs.filter((run) => run.status === "waiting_review").slice(0, 4),
		[runs],
	);
	const recentRuns = useMemo(() => runs.slice(0, 6), [runs]);
	const standaloneCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const automation of automations) {
			counts.set(
				automation.actionType,
				(counts.get(automation.actionType) ?? 0) + 1,
			);
		}
		return counts;
	}, [automations]);

	const workflowColumns: Array<DataTableColumn<WorkflowRow>> = useMemo(
		() => [
			{
				id: "name",
				label: "Workflow",
				accessor: (row) => (
					<div className="space-y-1">
						<div className="font-medium">{row.name}</div>
						<div className="text-xs text-muted-foreground">
							{row.description || "Sequential automation workflow"}
						</div>
					</div>
				),
				getSortValue: (row) => row.name.toLowerCase(),
			},
			{
				id: "status",
				label: "Status",
				accessor: (row) => (
					<Badge variant="outline" className="rounded-full capitalize">
						{row.status}
					</Badge>
				),
				getSortValue: (row) => row.status,
			},
			{
				id: "steps",
				label: "Steps",
				accessor: (row) => `${row.steps.length} nodes`,
				getSortValue: (row) => row.steps.length,
			},
			{
				id: "runs",
				label: "Runs",
				accessor: (row) => `${row.runCount} total`,
				getSortValue: (row) => row.runCount,
			},
			{
				id: "updated",
				label: "Updated",
				accessor: (row) => formatAutomationWhen(row.updatedAt),
				getSortValue: (row) => new Date(row.updatedAt).getTime(),
			},
		],
		[],
	);

	async function runWorkflow(workflowId: string) {
		if (!activeWorkspaceId) {
			return;
		}
		try {
			await customerRequest(
				`/workspaces/${activeWorkspaceId}/workflows/${workflowId}/runs`,
				{
					method: "POST",
					body: {
						input: {
							promptScope: "automations",
						},
					},
				},
			);
			toast.success("Workflow run started.");
			await loadData();
		} catch (runError) {
			toast.error(
				runError instanceof Error
					? runError.message
					: "Unable to run workflow.",
			);
		}
	}

	async function duplicateWorkflow(workflowId: string, name: string) {
		if (!activeWorkspaceId) {
			return;
		}
		try {
			const created = await customerRequest<WorkflowDefinition>(
				`/workspaces/${activeWorkspaceId}/workflows/${workflowId}/duplicate`,
				{
					method: "POST",
					body: {
						name: `${name} Copy`,
					},
				},
			);
			toast.success("Workflow duplicated.");
			await loadData();
			navigate(`/dashboard/automations/workflows/${created.id}`);
		} catch (duplicateError) {
			toast.error(
				duplicateError instanceof Error
					? duplicateError.message
					: "Unable to duplicate workflow.",
			);
		}
	}

	async function deleteWorkflow(workflowId: string) {
		if (!activeWorkspaceId) {
			return;
		}
		if (!window.confirm("Delete this workflow? Existing runs will be kept.")) {
			return;
		}
		try {
			await customerRequest(
				`/workspaces/${activeWorkspaceId}/workflows/${workflowId}`,
				{
					method: "DELETE",
				},
			);
			toast.success("Workflow deleted.");
			await loadData();
		} catch (deleteError) {
			toast.error(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete workflow.",
			);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Automation control room"
				title="Automations"
				description="Discover available automation actions, open focused detail pages to run them, and manage your saved workflow library from a cleaner command surface."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/studio?mode=image">
								<Sparkles className="size-4" />
								Open studio
							</Link>
						</Button>
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
							asChild
						>
							<Link to="/dashboard/automations/workflows/new">
								<Plus className="size-4" />
								New workflow
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

			<div className="grid gap-3 md:grid-cols-3">
				<StatPill
					icon={Workflow}
					label="Saved workflows"
					value={String(workflows.length)}
				/>
				<StatPill
					icon={Bot}
					label="Standalone actions"
					value={String(automations.length)}
				/>
				<StatPill
					icon={Clock3}
					label="Pending reviews"
					value={String(pendingRuns.length)}
				/>
			</div>

			<PostAgentLauncher automations={automations} onRunCreated={loadData} />

			<DashboardPanel
				title="Available automations"
				description="Action cards are sourced from the runtime contract, so this stays aligned with what the backend actually supports."
			>
				<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
					{catalog?.actions.map((action) => (
						<Link
							key={action.actionType}
							to={`/dashboard/automations/catalog/${action.actionType}`}
							className="group"
						>
							<SurfaceCard className="h-full overflow-hidden p-5 transition-transform duration-200 group-hover:-translate-y-1">
								<div className="flex items-start justify-between gap-3">
									<div className="space-y-2">
										<div className="text-lg font-medium">{action.label}</div>
										<div className="text-sm leading-6 text-muted-foreground">
											{action.description}
										</div>
									</div>
									<div className="flex flex-wrap gap-2 justify-end">
										{action.beta ? (
											<Badge variant="outline" className="rounded-full">
												Beta
											</Badge>
										) : null}
										{!action.supportsStandalone ? (
											<Badge variant="outline" className="rounded-full">
												Workflow only
											</Badge>
										) : null}
									</div>
								</div>
								<div className="mt-5 flex flex-wrap gap-2">
									{action.acceptedInputs.map((input) => (
										<Badge
											key={`${action.actionType}-${input}`}
											variant="outline"
											className="rounded-full"
										>
											In: {input}
										</Badge>
									))}
									{action.producedOutputs.map((output) => (
										<Badge
											key={`${action.actionType}-${output}`}
											variant="outline"
											className="rounded-full"
										>
											Out: {output}
										</Badge>
									))}
								</div>
								<div className="mt-6 flex items-center justify-between gap-3">
									<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
										{standaloneCounts.get(action.actionType) ?? 0} saved
										instances
									</div>
									<Button variant="outline" className="rounded-full">
										Open details
										<ArrowRight className="size-4" />
									</Button>
								</div>
							</SurfaceCard>
						</Link>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Saved workflows"
				description="Your workspace workflows live here by default in grid view, with quick actions for run, duplicate, and clean-up."
			>
				<DataTable
					title="Workflow library"
					description="Open a workflow to edit its node canvas, inspector settings, and saved metadata."
					rows={workflowsWithRunMeta}
					columns={workflowColumns}
					getRowId={(row) => row.id}
					getSearchText={(row) =>
						[
							row.name,
							row.description,
							row.status,
							row.steps.map((step) => step.name).join(" "),
						]
							.join(" ")
							.toLowerCase()
					}
					filters={[
						{
							id: "status",
							label: "Status",
							options: [
								{ label: "Active", value: "active" },
								{ label: "Draft", value: "draft" },
							],
							getValue: (row) => row.status,
						},
					]}
					globalActions={[
						{
							label: "New workflow",
							icon: Plus,
							onClick: () => navigate("/dashboard/automations/workflows/new"),
						},
						{
							label: "Open Studio",
							icon: Sparkles,
							variant: "outline",
							onClick: () => navigate("/dashboard/studio?mode=image"),
						},
						{
							label: "Import template",
							icon: LayoutTemplate,
							variant: "outline",
							onClick: () =>
								navigate(
									"/dashboard/automations/workflows/new?templatePicker=1",
								),
						},
					]}
					rowActions={[
						{
							label: "Open",
							icon: Workflow,
							onClick: (row) =>
								navigate(`/dashboard/automations/workflows/${row.id}`),
						},
						{
							label: "Run",
							icon: Play,
							onClick: (row) => void runWorkflow(row.id),
						},
						{
							label: "Duplicate",
							icon: Copy,
							onClick: (row) => void duplicateWorkflow(row.id, row.name),
						},
						{
							label: "Delete",
							icon: Trash2,
							destructive: true,
							onClick: (row) => void deleteWorkflow(row.id),
						},
					]}
					emptyState={{
						title: "No workflows yet",
						description:
							"Create one from scratch or import a template to start building connected automation runs.",
						actionLabel: "New workflow",
						onAction: () => navigate("/dashboard/automations/workflows/new"),
					}}
					loading={loading}
					error={error}
					initialView="grid"
					storageKey="automation-workflows"
					searchPlaceholder="Search workflows, steps, descriptions..."
					onRowClick={(row) =>
						navigate(`/dashboard/automations/workflows/${row.id}`)
					}
					renderGridCard={(row) => (
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="font-medium">{row.name}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{row.description || "Sequential automation workflow"}
									</div>
								</div>
								<Badge variant="outline" className="rounded-full capitalize">
									{row.status}
								</Badge>
							</div>
							<div className="flex flex-wrap gap-2">
								{row.steps.slice(0, 4).map((step) => (
									<Badge
										key={`${row.id}-${step.position}`}
										variant="outline"
										className="rounded-full"
									>
										{step.name}
									</Badge>
								))}
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/60 p-3">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Activity
									</div>
									<div className="mt-2 text-sm">{row.runCount} runs</div>
								</div>
								<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/60 p-3">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Last run
									</div>
									<div className="mt-2 text-sm">
										{formatAutomationWhen(row.lastRunAt)}
									</div>
								</div>
							</div>
						</div>
					)}
				/>
			</DashboardPanel>

			<div className="grid gap-6 xl:grid-cols-2">
				<DashboardPanel
					title="Pending reviews"
					description="These runs are waiting on a human decision before the sequence can continue."
				>
					<div className="grid gap-4">
						{pendingRuns.length > 0 ? (
							pendingRuns.map((run) => (
								<SurfaceCard key={run.id} className="p-5">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-medium">
												{summarizeRunArtifacts(run)}
											</div>
											<div className="mt-2 text-sm text-muted-foreground">
												Updated {formatAutomationWhen(run.updatedAt)}
											</div>
										</div>
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{run.reviewerType}
										</Badge>
									</div>
									<div className="mt-5">
										<Button variant="outline" className="rounded-full" asChild>
											<Link to={`/dashboard/automations/runs/${run.id}`}>
												Open review
											</Link>
										</Button>
									</div>
								</SurfaceCard>
							))
						) : (
							<SurfaceCard className="p-5 text-sm text-muted-foreground">
								No runs are waiting for review.
							</SurfaceCard>
						)}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Recent runs"
					description="Track recent workflow and standalone execution without crowding the main workspace table."
				>
					<div className="grid gap-4">
						{recentRuns.length > 0 ? (
							recentRuns.map((run) => (
								<SurfaceCard key={run.id} className="p-5">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-medium">
												{summarizeRunArtifacts(run)}
											</div>
											<div className="mt-2 text-sm text-muted-foreground">
												{run.sourceType} • {formatAutomationWhen(run.updatedAt)}
											</div>
										</div>
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{run.status}
										</Badge>
									</div>
									<div className="mt-5">
										<Button variant="outline" className="rounded-full" asChild>
											<Link to={`/dashboard/automations/runs/${run.id}`}>
												View run
											</Link>
										</Button>
									</div>
								</SurfaceCard>
							))
						) : (
							<SurfaceCard className="p-5 text-sm text-muted-foreground">
								No automation runs yet.
							</SurfaceCard>
						)}
					</div>
				</DashboardPanel>
			</div>
		</div>
	);
}
