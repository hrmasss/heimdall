import {
	ArrowLeft,
	ArrowRight,
	Bot,
	CopyPlus,
	Play,
	Plus,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	AutomationActionContract,
	AutomationCatalogResponse,
	AutomationDefinition,
	AutomationRun,
	AutomationTemplate,
	WorkspaceAISettings,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	formatAutomationWhen,
	summarizeRunArtifacts,
	systemPromptPreview,
} from "@/lib/automation-builder";

export function DashboardAutomationCatalogDetailPage() {
	const navigate = useNavigate();
	const { actionType = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();

	const [catalog, setCatalog] = useState<AutomationCatalogResponse | null>(
		null,
	);
	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [runs, setRuns] = useState<AutomationRun[]>([]);
	const [aiSettings, setAiSettings] = useState<WorkspaceAISettings | null>(
		null,
	);
	const [runtimePrompt, setRuntimePrompt] = useState("");
	const [newInstanceName, setNewInstanceName] = useState("");
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
				runResponse,
				settingsResponse,
			] = await Promise.all([
				customerRequest<AutomationCatalogResponse>(
					`/workspaces/${activeWorkspaceId}/automation-catalog`,
				),
				customerRequest<ApiListResponse<AutomationDefinition>>(
					`/workspaces/${activeWorkspaceId}/automations`,
				),
				customerRequest<ApiListResponse<AutomationRun>>(
					`/workspaces/${activeWorkspaceId}/runs`,
				),
				customerRequest<WorkspaceAISettings>(
					`/workspaces/${activeWorkspaceId}/ai/settings`,
				),
			]);
			setCatalog(catalogResponse);
			setAutomations(automationResponse.items);
			setRuns(runResponse.items);
			setAiSettings(settingsResponse);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load automation details.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const action = useMemo<AutomationActionContract | null>(
		() =>
			catalog?.actions.find((item) => item.actionType === actionType) ?? null,
		[actionType, catalog],
	);
	const matchingAutomations = useMemo(
		() =>
			automations.filter((automation) => automation.actionType === actionType),
		[actionType, automations],
	);
	const recentRuns = useMemo(
		() =>
			runs.filter((run) =>
				matchingAutomations.some(
					(automation) => automation.id === run.automationId,
				),
			),
		[matchingAutomations, runs],
	);
	const relatedTemplates = useMemo<AutomationTemplate[]>(
		() =>
			(catalog?.templates ?? []).filter((template) =>
				template.steps.some((step) => step.actionType === actionType),
			),
		[actionType, catalog],
	);

	async function createInstance() {
		if (!activeWorkspaceId || !action) {
			return null;
		}
		const created = await customerRequest<AutomationDefinition>(
			`/workspaces/${activeWorkspaceId}/automations`,
			{
				method: "POST",
				body: {
					name: newInstanceName.trim() || `${action.label} instance`,
					description: `Standalone automation for ${action.label}.`,
					status: "active",
					scope: "standalone",
					actionType: action.actionType,
					triggerType: "manual",
					inputSchema: {},
					defaultConfig: {},
					outputSchema: {},
					reviewPolicy: {},
					capabilityHints: action.requiredCapabilities,
					metadata: {
						source: "automation_detail",
					},
				},
			},
		);
		setNewInstanceName("");
		toast.success("Standalone instance created.");
		await loadData();
		return created;
	}

	async function runStandalone(automationId?: string) {
		if (!activeWorkspaceId || !action) {
			return;
		}
		try {
			const resolvedId = automationId ?? (await createInstance())?.id;
			if (!resolvedId) {
				return;
			}
			const run = await customerRequest<AutomationRun>(
				`/workspaces/${activeWorkspaceId}/automations/${resolvedId}/runs`,
				{
					method: "POST",
					body: {
						input: {
							prompt: runtimePrompt,
							promptScope: "automations",
						},
					},
				},
			);
			toast.success("Standalone run started.");
			await loadData();
			navigate(`/dashboard/automations/runs/${run.id}`);
		} catch (runError) {
			toast.error(
				runError instanceof Error
					? runError.message
					: "Unable to start the standalone run.",
			);
		}
	}

	async function deleteInstance(automationId: string) {
		if (!activeWorkspaceId) {
			return;
		}
		if (!window.confirm("Delete this standalone automation instance?")) {
			return;
		}
		try {
			await customerRequest(
				`/workspaces/${activeWorkspaceId}/automations/${automationId}`,
				{
					method: "DELETE",
				},
			);
			toast.success("Standalone automation deleted.");
			await loadData();
		} catch (deleteError) {
			toast.error(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete the automation instance.",
			);
		}
	}

	if (!loading && !action) {
		return (
			<SurfaceCard className="p-6 text-sm text-muted-foreground">
				This automation action could not be found.
			</SurfaceCard>
		);
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Action detail"
				title={action?.label ?? "Automation"}
				description={
					action?.description ??
					"Inspect the action contract, review prompt policy, and run this capability as a standalone automation."
				}
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/automations">
								<ArrowLeft className="size-4" />
								Back to Automations
							</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								to={`/dashboard/automations/workflows/new?action=${actionType}`}
							>
								<CopyPlus className="size-4" />
								Create workflow from this
							</Link>
						</Button>
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
							onClick={() => void runStandalone()}
							disabled={!action?.supportsStandalone}
						>
							<Play className="size-4" />
							Run now
						</Button>
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-6">
					<DashboardPanel
						title="Contract overview"
						description="These capabilities are taken from the backend runtime contract, so the detail page always matches what the execution engine expects."
					>
						<div className="grid gap-4 md:grid-cols-2">
							<SurfaceCard className="space-y-4 p-5">
								<div className="text-sm font-medium">Accepted inputs</div>
								<div className="flex flex-wrap gap-2">
									{action?.acceptedInputs.map((input) => (
										<Badge
											key={input}
											variant="outline"
											className="rounded-full"
										>
											{input}
										</Badge>
									))}
								</div>
							</SurfaceCard>
							<SurfaceCard className="space-y-4 p-5">
								<div className="text-sm font-medium">Produced outputs</div>
								<div className="flex flex-wrap gap-2">
									{action?.producedOutputs.map((output) => (
										<Badge
											key={output}
											variant="outline"
											className="rounded-full"
										>
											{output}
										</Badge>
									))}
								</div>
							</SurfaceCard>
						</div>
					</DashboardPanel>

					<DashboardPanel
						title="Standalone run"
						description="Use a focused brief for this action. If you have no saved instance yet, the page will create one automatically on first run."
					>
						<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
							<SurfaceCard className="space-y-4 p-5">
								<div className="space-y-2">
									<div className="text-sm font-medium">Runtime brief</div>
									<Textarea
										value={runtimePrompt}
										onChange={(event) => setRuntimePrompt(event.target.value)}
										className="min-h-36 rounded-[24px]"
										placeholder="Objective, audience, creative direction, references, or reviewer expectations..."
									/>
								</div>
								<div className="space-y-2">
									<div className="text-sm font-medium">
										Create a named instance
									</div>
									<Input
										value={newInstanceName}
										onChange={(event) => setNewInstanceName(event.target.value)}
										className="h-11 rounded-2xl"
										placeholder={`${action?.label ?? "Action"} instance`}
									/>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										className="rounded-full border-0 bg-gradient-brand text-white"
										onClick={() => void runStandalone()}
										disabled={!action?.supportsStandalone}
									>
										<Play className="size-4" />
										Run standalone
									</Button>
									<Button
										variant="outline"
										className="rounded-full"
										onClick={() => void createInstance()}
									>
										<Plus className="size-4" />
										Create instance only
									</Button>
								</div>
							</SurfaceCard>
							<SurfaceCard className="space-y-4 p-5">
								<div className="text-sm font-medium">
									Prompt context preview
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/65 p-4 text-sm text-muted-foreground whitespace-pre-wrap">
									{aiSettings
										? systemPromptPreview(
												aiSettings.systemPrompts,
												"automations",
											)
										: "Loading workspace prompt policy..."}
								</div>
								<Button variant="outline" className="rounded-full" asChild>
									<Link to="/dashboard/settings/intelligence">
										Open prompt settings
										<ArrowRight className="size-4" />
									</Link>
								</Button>
							</SurfaceCard>
						</div>
					</DashboardPanel>

					<DashboardPanel
						title="Saved standalone instances"
						description="Reusable automation wrappers for this action type. Run one directly, or remove wrappers you no longer need."
					>
						<div className="grid gap-4 lg:grid-cols-2">
							{matchingAutomations.length > 0 ? (
								matchingAutomations.map((automation) => (
									<SurfaceCard key={automation.id} className="p-5">
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium">{automation.name}</div>
												<div className="mt-2 text-sm text-muted-foreground">
													{automation.description || action?.description}
												</div>
											</div>
											<Badge
												variant="outline"
												className="rounded-full capitalize"
											>
												{automation.status}
											</Badge>
										</div>
										<div className="mt-5 flex flex-wrap gap-2">
											<Button
												variant="outline"
												className="rounded-full"
												onClick={() => void runStandalone(automation.id)}
											>
												<Play className="size-4" />
												Run
											</Button>
											<Button
												variant="outline"
												className="rounded-full text-destructive"
												onClick={() => void deleteInstance(automation.id)}
											>
												<Trash2 className="size-4" />
												Delete
											</Button>
										</div>
									</SurfaceCard>
								))
							) : (
								<SurfaceCard className="p-5 text-sm text-muted-foreground">
									No standalone instances saved for this action yet.
								</SurfaceCard>
							)}
						</div>
					</DashboardPanel>
				</div>

				<div className="space-y-6">
					<DashboardPanel
						title="Recent runs"
						description="Latest standalone runs for this action."
					>
						<div className="grid gap-4">
							{recentRuns.length > 0 ? (
								recentRuns.slice(0, 5).map((run) => (
									<SurfaceCard key={run.id} className="p-5">
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium">
													{summarizeRunArtifacts(run)}
												</div>
												<div className="mt-2 text-sm text-muted-foreground">
													{formatAutomationWhen(run.updatedAt)}
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
											<Button
												variant="outline"
												className="rounded-full"
												asChild
											>
												<Link to={`/dashboard/automations/runs/${run.id}`}>
													View run
												</Link>
											</Button>
										</div>
									</SurfaceCard>
								))
							) : (
								<SurfaceCard className="p-5 text-sm text-muted-foreground">
									No runs for this action yet.
								</SurfaceCard>
							)}
						</div>
					</DashboardPanel>

					<DashboardPanel
						title="Starter flows"
						description="Templates that already include this action, so you can move from standalone testing into larger sequences."
					>
						<div className="grid gap-4">
							{relatedTemplates.length > 0 ? (
								relatedTemplates.map((template) => (
									<SurfaceCard key={template.id} className="p-5">
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium">{template.name}</div>
												<div className="mt-2 text-sm text-muted-foreground">
													{template.description}
												</div>
											</div>
											<Bot className="size-4 text-muted-foreground" />
										</div>
										<div className="mt-4 flex flex-wrap gap-2">
											{template.steps.map((step) => (
												<Badge
													key={`${template.id}-${step.position}`}
													variant="outline"
													className="rounded-full"
												>
													{step.name}
												</Badge>
											))}
										</div>
										<div className="mt-5">
											<Button
												variant="outline"
												className="rounded-full"
												asChild
											>
												<Link
													to={`/dashboard/automations/workflows/new?template=${template.id}`}
												>
													Use template
												</Link>
											</Button>
										</div>
									</SurfaceCard>
								))
							) : (
								<SurfaceCard className="p-5 text-sm text-muted-foreground">
									No starter templates include this action yet.
								</SurfaceCard>
							)}
						</div>
					</DashboardPanel>
				</div>
			</div>
		</div>
	);
}
