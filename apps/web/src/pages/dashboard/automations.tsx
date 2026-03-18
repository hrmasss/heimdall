import { Bot, CheckCircle2, Clock3, Play, Plus, Sparkles, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader, DashboardPanel } from "@/components/app/dashboard";
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
	AutomationCatalogResponse,
	AutomationDefinition,
	AutomationRun,
	AutomationTemplate,
	WorkflowDefinition,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatWhen(value?: string) {
	if (!value) {
		return "Not started";
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function summarizeArtifacts(run: AutomationRun) {
	const artifacts =
		((run.outputPayload.artifacts as unknown[]) ?? []) as Array<{
			label?: string;
			type?: string;
		}>;
	if (artifacts.length === 0) {
		return "No artifacts yet";
	}
	return artifacts
		.slice(0, 3)
		.map((artifact) => artifact.label ?? artifact.type ?? "Artifact")
		.join(" • ");
}

function buildWorkflowFromTemplate(template: AutomationTemplate) {
	return {
		name: template.name,
		description: template.description,
		status: "active",
		scope: "workflow",
		triggerType: "manual",
		inputSchema: {},
		outputSchema: {},
		reviewPolicy: {},
		capabilityHints: [],
		metadata: {
			templateId: template.id,
			category: template.category,
			entryPoint: template.entryPoint,
		},
		steps: template.steps.map((step, index) => ({
			position: index + 1,
			name: step.name,
			stepKind: step.stepKind || "",
			actionType: step.actionType,
			consumesArtifactType: step.consumesArtifactType || "",
			producesArtifactType: step.producesArtifactType || "",
			reviewerType: step.reviewerType || "",
			requiredCapabilities: step.requiredCapabilities ?? [],
			config: step.config ?? {},
			metadata: step.metadata ?? {},
		})),
	};
}

export function DashboardAutomations() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [catalog, setCatalog] = useState<AutomationCatalogResponse | null>(null);
	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
	const [runs, setRuns] = useState<AutomationRun[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [runtimePrompt, setRuntimePrompt] = useState("");
	const [newAutomationName, setNewAutomationName] = useState("");
	const [newAutomationAction, setNewAutomationAction] = useState("post_generate");

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [catalogResponse, automationResponse, workflowResponse, runResponse] =
				await Promise.all([
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
			setError(loadError instanceof Error ? loadError.message : "Unable to load automations.");
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const pendingRuns = useMemo(
		() => runs.filter((run) => run.status === "waiting_review"),
		[runs],
	);

	async function handleCreateAutomation() {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			await customerRequest(`/workspaces/${activeWorkspaceId}/automations`, {
				method: "POST",
				body: {
					name: newAutomationName.trim() || `${newAutomationAction} automation`,
					description: "Created from the automation hub.",
					status: "active",
					scope: "standalone",
					actionType: newAutomationAction,
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: {},
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: [],
					metadata: { source: "automation_hub" },
				},
			});
			setNotice("Standalone automation created.");
			setNewAutomationName("");
			await loadData();
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Unable to create automation.",
			);
		}
	}

	async function handleCreateTemplateWorkflow(template: AutomationTemplate) {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			await customerRequest(`/workspaces/${activeWorkspaceId}/workflows`, {
				method: "POST",
				body: buildWorkflowFromTemplate(template),
			});
			setNotice(`Saved "${template.name}" to your workflows.`);
			await loadData();
		} catch (createError) {
			setError(
				createError instanceof Error
					? createError.message
					: "Unable to save the workflow template.",
			);
		}
	}

	async function handleRunAutomation(automationId: string) {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			await customerRequest(`/workspaces/${activeWorkspaceId}/automations/${automationId}/runs`, {
				method: "POST",
				body: { input: { prompt: runtimePrompt } },
			});
			setNotice("Automation run started.");
			await loadData();
		} catch (runError) {
			setError(runError instanceof Error ? runError.message : "Unable to run automation.");
		}
	}

	async function handleRunWorkflow(workflowId: string) {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			await customerRequest(`/workspaces/${activeWorkspaceId}/workflows/${workflowId}/runs`, {
				method: "POST",
				body: { input: { prompt: runtimePrompt } },
			});
			setNotice("Workflow run started.");
			await loadData();
		} catch (runError) {
			setError(runError instanceof Error ? runError.message : "Unable to run workflow.");
		}
	}

	async function handleReview(runId: string, decision: "approved" | "changes_requested") {
		if (!activeWorkspaceId) {
			return;
		}
		setNotice(null);
		setError(null);
		try {
			await customerRequest(`/workspaces/${activeWorkspaceId}/runs/${runId}/reviews`, {
				method: "POST",
				body: {
					decision,
					comment:
						decision === "approved"
							? "Approved from the automation hub."
							: "Changes requested from the automation hub.",
					findings: [],
				},
			});
			setNotice(
				decision === "approved"
					? "Review approved and run resumed."
					: "Review sent back for changes.",
			);
			await loadData();
		} catch (reviewError) {
			setError(
				reviewError instanceof Error
					? reviewError.message
					: "Unable to submit the review.",
			);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Automation runtime"
				title="Automations"
				description="Manage standalone automations, sequential workflows, pending reviews, and run history from one place. Suggested entry points on campaigns, posts, and assets route back here or into Studio when the action is asset-first."
				actions={
					<Button className="rounded-full bg-gradient-brand text-white border-0" asChild>
						<Link to="/dashboard/studio">
							<Sparkles className="size-4" />
							Open studio
						</Link>
					</Button>
				}
			/>

			<DashboardPanel
				title="Run context"
				description="Use a shared prompt while testing workflows or standalone actions. Individual steps can still contribute their own defaults."
			>
				<div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
					<SurfaceCard className="p-5">
						<Label htmlFor="runtime-prompt">Runtime prompt</Label>
						<Textarea
							id="runtime-prompt"
							value={runtimePrompt}
							onChange={(event) => setRuntimePrompt(event.target.value)}
							className="mt-3 min-h-32"
							placeholder="Describe the campaign goal, post angle, image direction, or asset brief you want the run to use."
						/>
					</SurfaceCard>
					<SurfaceCard className="p-5">
						<div className="text-sm font-medium">Workspace status</div>
						<div className="mt-4 grid gap-3 text-sm text-muted-foreground">
							<div className="flex items-center gap-2">
								<Workflow className="size-4 text-primary" />
								<span>{workflows.length} saved workflows</span>
							</div>
							<div className="flex items-center gap-2">
								<Bot className="size-4 text-primary" />
								<span>{automations.length} standalone automations</span>
							</div>
							<div className="flex items-center gap-2">
								<Clock3 className="size-4 text-primary" />
								<span>{pendingRuns.length} pending reviews</span>
							</div>
						</div>
					</SurfaceCard>
				</div>
				{notice ? (
					<div className="mt-4 rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
						{notice}
					</div>
				) : null}
				{error ? (
					<div className="mt-4 rounded-[20px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				) : null}
			</DashboardPanel>

			<DashboardPanel
				title="Workflow templates"
				description="Templates provide the v1 builder shortcut. Save the flow you want, then run and review it from the same hub."
			>
				<div className="grid gap-4 lg:grid-cols-2">
					{catalog?.templates.map((template) => (
						<SurfaceCard key={template.id} className="p-5">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-lg font-medium">{template.name}</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{template.description}
									</p>
								</div>
								{template.beta ? (
									<Badge variant="outline" className="rounded-full">
										Beta
									</Badge>
								) : null}
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								{template.steps.map((step) => (
									<Badge key={`${template.id}-${step.position}-${step.actionType}`} variant="outline" className="rounded-full">
										{step.name}
									</Badge>
								))}
							</div>
							<div className="mt-5 flex items-center justify-between gap-3">
								<div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
									{template.category}
								</div>
								<Button variant="outline" className="rounded-full" onClick={() => void handleCreateTemplateWorkflow(template)}>
									<Plus className="size-4" />
									Save workflow
								</Button>
							</div>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Standalone automations"
				description="Create a reusable single-step automation for focused generation tasks like post drafts, images, or PDFs."
			>
				<div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
					<SurfaceCard className="p-5">
						<div className="grid gap-4">
							<div>
								<Label htmlFor="automation-name">Automation name</Label>
								<Input
									id="automation-name"
									value={newAutomationName}
									onChange={(event) => setNewAutomationName(event.target.value)}
									className="mt-2"
									placeholder="Image spark, LinkedIn PDF, Campaign planner..."
								/>
							</div>
							<div>
								<Label htmlFor="automation-action">Action</Label>
								<Select value={newAutomationAction} onValueChange={setNewAutomationAction}>
									<SelectTrigger id="automation-action" className="mt-2">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{catalog?.actions
											.filter((action) => action.supportsStandalone)
											.map((action) => (
												<SelectItem key={action.actionType} value={action.actionType}>
													{action.label}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
							<Button className="rounded-full" onClick={() => void handleCreateAutomation()}>
								<Plus className="size-4" />
								Create standalone automation
							</Button>
						</div>
					</SurfaceCard>
					<div className="grid gap-4">
						{automations.map((automation) => (
							<SurfaceCard key={automation.id} className="p-5">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-base font-medium">{automation.name}</div>
										<div className="mt-2 text-sm text-muted-foreground">
											{automation.description || automation.actionType}
										</div>
									</div>
									<Badge variant="outline" className="rounded-full capitalize">
										{automation.status}
									</Badge>
								</div>
								<div className="mt-4 flex flex-wrap gap-2">
									<Badge variant="outline" className="rounded-full">
										{automation.actionType}
									</Badge>
									{automation.capabilityHints.map((hint) => (
										<Badge key={hint} variant="outline" className="rounded-full">
											{hint}
										</Badge>
									))}
								</div>
								<div className="mt-5 flex justify-end">
									<Button variant="outline" className="rounded-full" onClick={() => void handleRunAutomation(automation.id)}>
										<Play className="size-4" />
										Run
									</Button>
								</div>
							</SurfaceCard>
						))}
						{!loading && automations.length === 0 ? (
							<SurfaceCard className="p-5 text-sm text-muted-foreground">
								No standalone automations yet.
							</SurfaceCard>
						) : null}
					</div>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Saved workflows"
				description="Sequential-only v1 flows. Save them once, run them many times, and let review steps hold the line before publishing."
			>
				<div className="grid gap-4 lg:grid-cols-2">
					{workflows.map((workflow) => (
						<SurfaceCard key={workflow.id} className="p-5">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-lg font-medium">{workflow.name}</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{workflow.description || "Saved workflow"}
									</p>
								</div>
								<Badge variant="outline" className="rounded-full capitalize">
									{workflow.status}
								</Badge>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								{workflow.steps.map((step) => (
									<Badge key={`${workflow.id}-${step.position}`} variant="outline" className="rounded-full">
										{step.name}
									</Badge>
								))}
							</div>
							<div className="mt-5 flex justify-end">
								<Button className="rounded-full" onClick={() => void handleRunWorkflow(workflow.id)}>
									<Play className="size-4" />
									Run workflow
								</Button>
							</div>
						</SurfaceCard>
					))}
					{!loading && workflows.length === 0 ? (
						<SurfaceCard className="p-5 text-sm text-muted-foreground">
							Save a template above to create your first workflow.
						</SurfaceCard>
					) : null}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Pending reviews"
				description="Human review steps pause the workflow here. Approve to continue or request changes to stop the run."
			>
				<div className="grid gap-4">
					{pendingRuns.map((run) => (
						<SurfaceCard key={run.id} className="p-5">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-base font-medium">{summarizeArtifacts(run)}</div>
									<div className="mt-2 text-sm text-muted-foreground">
										Queued on {formatWhen(run.updatedAt)}
									</div>
								</div>
								<Badge variant="outline" className="rounded-full">
									{run.reviewerType}
								</Badge>
							</div>
							<div className="mt-5 flex flex-wrap gap-3">
								<Button className="rounded-full" onClick={() => void handleReview(run.id, "approved")}>
									<CheckCircle2 className="size-4" />
									Approve
								</Button>
								<Button variant="outline" className="rounded-full" onClick={() => void handleReview(run.id, "changes_requested")}>
									Request changes
								</Button>
							</div>
						</SurfaceCard>
					))}
					{!loading && pendingRuns.length === 0 ? (
						<SurfaceCard className="p-5 text-sm text-muted-foreground">
							No runs are waiting for review.
						</SurfaceCard>
					) : null}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Run history"
				description="Track execution state, inspect artifacts, and spot where workflows are slowing down or failing."
			>
				<div className="grid gap-4">
					{runs.map((run) => (
						<SurfaceCard key={run.id} className="p-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<div className="text-base font-medium">{summarizeArtifacts(run)}</div>
									<div className="mt-2 text-sm text-muted-foreground">
										Created {formatWhen(run.createdAt)}
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="rounded-full capitalize">
										{run.sourceType}
									</Badge>
									<Badge variant="outline" className="rounded-full capitalize">
										{run.status}
									</Badge>
								</div>
							</div>
							<div className="mt-4 grid gap-3 text-sm text-muted-foreground lg:grid-cols-3">
								<div>Current step: {run.currentStepPosition ?? "Done"}</div>
								<div>Reviewer: {run.reviewerType || "none"}</div>
								<div>Completed: {formatWhen(run.completedAt)}</div>
							</div>
							{run.lastError ? (
								<div className="mt-4 rounded-[18px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
									{run.lastError}
								</div>
							) : null}
						</SurfaceCard>
					))}
					{!loading && runs.length === 0 ? (
						<SurfaceCard className="p-5 text-sm text-muted-foreground">
							No automation runs yet.
						</SurfaceCard>
					) : null}
				</div>
			</DashboardPanel>
		</div>
	);
}
