import {
	ArrowLeft,
	ArrowRight,
	GripHorizontal,
	Play,
	Plus,
	Save,
	Settings2,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
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
	AutomationActionContract,
	AutomationCatalogResponse,
	WorkflowDefinition,
	WorkflowStep,
	WorkspaceAISettings,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	buildWorkflowFromTemplate,
	canInsertActionAt,
	createStepFromAction,
	formatAutomationWhen,
	normalizeWorkflowPositions,
	systemPromptPreview,
} from "@/lib/automation-builder";

type WorkflowDraft = {
	name: string;
	description: string;
	status: string;
	triggerType: string;
	metadata: Record<string, unknown>;
	steps: WorkflowStep[];
};

function createBlankDraft(): WorkflowDraft {
	return {
		name: "",
		description: "",
		status: "active",
		triggerType: "manual",
		metadata: {
			editor: {
				mode: "sequential_canvas",
				viewport: { x: 0, y: 0, zoom: 1 },
			},
		},
		steps: [],
	};
}

function draftFromWorkflow(workflow: WorkflowDefinition): WorkflowDraft {
	return {
		name: workflow.name,
		description: workflow.description,
		status: workflow.status,
		triggerType: workflow.triggerType,
		metadata: workflow.metadata ?? {},
		steps: normalizeWorkflowPositions(workflow.steps),
	};
}

function Slot({
	active,
	compatible,
	onDropAction,
}: {
	active: boolean;
	compatible: boolean;
	onDropAction: () => void;
}) {
	return (
		<div
			onDragOver={(event) => {
				if (compatible) {
					event.preventDefault();
				}
			}}
			onDrop={(event) => {
				event.preventDefault();
				if (compatible) {
					onDropAction();
				}
			}}
			className={`flex min-w-[108px] items-center justify-center rounded-[22px] border border-dashed px-3 py-5 text-center text-xs transition-colors ${
				active && compatible
					? "border-primary bg-primary/8 text-foreground"
					: compatible
						? "border-[var(--brand-border-soft)] bg-background/55 text-muted-foreground"
						: "border-[var(--brand-border-soft)]/50 bg-background/35 text-muted-foreground/60"
			}`}
		>
			{compatible ? "Drop node here" : "Incompatible slot"}
		</div>
	);
}

export function DashboardAutomationWorkflowEditorPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const workflowId = id ?? null;
	const templateId = searchParams.get("template");
	const actionType = searchParams.get("action");
	const showTemplatePicker = searchParams.get("templatePicker") === "1";
	const { activeWorkspaceId, customerRequest } = useAuth();

	const [catalog, setCatalog] = useState<AutomationCatalogResponse | null>(
		null,
	);
	const [aiSettings, setAiSettings] = useState<WorkspaceAISettings | null>(
		null,
	);
	const [draft, setDraft] = useState<WorkflowDraft>(createBlankDraft());
	const [selectedStepIndex, setSelectedStepIndex] = useState(0);
	const [draggedActionType, setDraggedActionType] = useState<string | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

	const actionMap = useMemo(
		() =>
			new Map(
				(catalog?.actions ?? []).map((action) => [action.actionType, action]),
			),
		[catalog],
	);
	const selectedStep = draft.steps[selectedStepIndex] ?? null;

	const loadPage = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [catalogResponse, settingsResponse, workflowResponse] =
				await Promise.all([
					customerRequest<AutomationCatalogResponse>(
						`/workspaces/${activeWorkspaceId}/automation-catalog`,
					),
					customerRequest<WorkspaceAISettings>(
						`/workspaces/${activeWorkspaceId}/ai/settings`,
					),
					workflowId
						? customerRequest<WorkflowDefinition>(
								`/workspaces/${activeWorkspaceId}/workflows/${workflowId}`,
							)
						: Promise.resolve(null),
				]);
			setCatalog(catalogResponse);
			setAiSettings(settingsResponse);

			let nextDraft = createBlankDraft();
			if (workflowResponse) {
				nextDraft = draftFromWorkflow(workflowResponse);
				setLastSavedAt(workflowResponse.updatedAt);
			} else if (templateId) {
				const template = catalogResponse.templates.find(
					(item) => item.id === templateId,
				);
				if (template) {
					const seeded = buildWorkflowFromTemplate(template);
					nextDraft = {
						name: seeded.name,
						description: seeded.description,
						status: seeded.status,
						triggerType: seeded.triggerType,
						metadata: seeded.metadata ?? {},
						steps: normalizeWorkflowPositions(seeded.steps),
					};
				}
			} else if (actionType) {
				const action = catalogResponse.actions.find(
					(item) => item.actionType === actionType,
				);
				if (action) {
					nextDraft = {
						...createBlankDraft(),
						name: `${action.label} workflow`,
						description: `Workflow seeded from ${action.label}.`,
						steps: [createStepFromAction(action, 0)],
					};
				}
			}

			setDraft(nextDraft);
			setSelectedStepIndex(nextDraft.steps.length > 0 ? 0 : -1);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load workflow editor.",
			);
		} finally {
			setLoading(false);
		}
	}, [actionType, activeWorkspaceId, customerRequest, templateId, workflowId]);

	useEffect(() => {
		void loadPage();
	}, [loadPage]);

	function updateSelectedStep(updater: (step: WorkflowStep) => WorkflowStep) {
		setDraft((current) => ({
			...current,
			steps: normalizeWorkflowPositions(
				current.steps.map((step, index) =>
					index === selectedStepIndex ? updater(step) : step,
				),
			),
		}));
	}

	function insertAction(action: AutomationActionContract, insertIndex: number) {
		setDraft((current) => {
			const nextSteps = [...current.steps];
			nextSteps.splice(
				insertIndex,
				0,
				createStepFromAction(action, insertIndex),
			);
			return {
				...current,
				steps: normalizeWorkflowPositions(nextSteps),
			};
		});
		setSelectedStepIndex(insertIndex);
	}

	function removeSelectedStep() {
		setDraft((current) => {
			const nextSteps = current.steps.filter(
				(_, index) => index !== selectedStepIndex,
			);
			return {
				...current,
				steps: normalizeWorkflowPositions(nextSteps),
			};
		});
		setSelectedStepIndex((current) => Math.max(0, current - 1));
	}

	function moveSelected(offset: -1 | 1) {
		setDraft((current) => {
			const nextSteps = [...current.steps];
			const targetIndex = selectedStepIndex + offset;
			if (targetIndex < 0 || targetIndex >= nextSteps.length) {
				return current;
			}
			const [step] = nextSteps.splice(selectedStepIndex, 1);
			nextSteps.splice(targetIndex, 0, step);
			return {
				...current,
				steps: normalizeWorkflowPositions(nextSteps),
			};
		});
		setSelectedStepIndex((current) => current + offset);
	}

	async function saveWorkflow() {
		if (!activeWorkspaceId) {
			return;
		}
		if (!draft.name.trim()) {
			toast.error("Workflow name is required.");
			return;
		}
		if (draft.steps.length === 0) {
			toast.error("Add at least one node before saving.");
			return;
		}
		setSaving(true);
		try {
			const body = {
				status: draft.status,
				scope: "workflow",
				name: draft.name.trim(),
				description: draft.description.trim(),
				triggerType: draft.triggerType,
				inputSchema: {},
				outputSchema: {},
				reviewPolicy: {},
				capabilityHints: [],
				metadata: {
					...draft.metadata,
					editor: {
						mode: "sequential_canvas",
						viewport: { x: 0, y: 0, zoom: 1 },
					},
				},
				steps: normalizeWorkflowPositions(draft.steps),
			};

			const saved = workflowId
				? await customerRequest<WorkflowDefinition>(
						`/workspaces/${activeWorkspaceId}/workflows/${workflowId}`,
						{
							method: "PATCH",
							body,
						},
					)
				: await customerRequest<WorkflowDefinition>(
						`/workspaces/${activeWorkspaceId}/workflows`,
						{
							method: "POST",
							body,
						},
					);

			toast.success(workflowId ? "Workflow updated." : "Workflow created.");
			setDraft(draftFromWorkflow(saved));
			setLastSavedAt(saved.updatedAt);
			if (!workflowId) {
				navigate(`/dashboard/automations/workflows/${saved.id}`, {
					replace: true,
				});
			}
		} catch (saveError) {
			toast.error(
				saveError instanceof Error
					? saveError.message
					: "Unable to save workflow.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function runWorkflow() {
		if (!activeWorkspaceId || !workflowId) {
			return;
		}
		setRunning(true);
		try {
			const run = await customerRequest<{ id: string }>(
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
			navigate(`/dashboard/automations/runs/${run.id}`);
		} catch (runError) {
			toast.error(
				runError instanceof Error
					? runError.message
					: "Unable to run workflow.",
			);
		} finally {
			setRunning(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workflow editor"
				title={workflowId ? "Workflow detail" : "New workflow"}
				description="Build a left-to-right automation sequence with compatible nodes, adjust each node in the inspector, and keep the runtime aligned with the current sequential engine."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/automations">
								<ArrowLeft className="size-4" />
								Back to Automations
							</Link>
						</Button>
						{workflowId ? (
							<Button
								variant="outline"
								className="rounded-full"
								onClick={() => void runWorkflow()}
								disabled={running}
							>
								<Play className="size-4" />
								{running ? "Starting..." : "Run workflow"}
							</Button>
						) : null}
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
							onClick={() => void saveWorkflow()}
							disabled={saving || loading}
						>
							<Save className="size-4" />
							{saving ? "Saving..." : "Save workflow"}
						</Button>
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="space-y-6">
					<DashboardPanel
						title="Workflow shell"
						description="Name the flow, keep the trigger manual, and use the template gallery when you want a faster starting point."
					>
						<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px]">
							<div className="space-y-2">
								<Label htmlFor="workflow-name">Workflow name</Label>
								<Input
									id="workflow-name"
									value={draft.name}
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									className="h-11 rounded-2xl"
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="workflow-description">Description</Label>
								<Input
									id="workflow-description"
									value={draft.description}
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											description: event.target.value,
										}))
									}
									className="h-11 rounded-2xl"
								/>
							</div>
							<div className="space-y-2">
								<Label>Status</Label>
								<Select
									value={draft.status}
									onValueChange={(value) =>
										setDraft((current) => ({ ...current, status: value }))
									}
								>
									<SelectTrigger className="h-11 rounded-2xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="active">Active</SelectItem>
										<SelectItem value="draft">Draft</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="mt-4 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3 text-sm text-muted-foreground">
							{lastSavedAt
								? `Last saved ${formatAutomationWhen(lastSavedAt)}`
								: "This workflow has not been saved yet."}
						</div>
					</DashboardPanel>

					{showTemplatePicker && catalog?.templates?.length ? (
						<DashboardPanel
							title="Starter templates"
							description="Import a starter flow, then adjust names, prompts, and node settings in the canvas."
							action={
								<Button
									variant="outline"
									className="rounded-full"
									onClick={() => {
										searchParams.delete("templatePicker");
										setSearchParams(searchParams, { replace: true });
									}}
								>
									Close gallery
								</Button>
							}
						>
							<div className="grid gap-4 lg:grid-cols-2">
								{catalog.templates.map((template) => (
									<SurfaceCard key={template.id} className="p-5">
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium">{template.name}</div>
												<div className="mt-2 text-sm text-muted-foreground">
													{template.description}
												</div>
											</div>
											{template.beta ? (
												<Badge variant="outline" className="rounded-full">
													Beta
												</Badge>
											) : null}
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
												onClick={() => {
													const seeded = buildWorkflowFromTemplate(template);
													setDraft({
														name: seeded.name,
														description: seeded.description,
														status: seeded.status,
														triggerType: seeded.triggerType,
														metadata: seeded.metadata ?? {},
														steps: normalizeWorkflowPositions(seeded.steps),
													});
													setSelectedStepIndex(0);
													searchParams.delete("templatePicker");
													searchParams.set("template", template.id);
													setSearchParams(searchParams, { replace: true });
												}}
											>
												Use template
											</Button>
										</div>
									</SurfaceCard>
								))}
							</div>
						</DashboardPanel>
					) : null}

					<DashboardPanel
						title="Sequential canvas"
						description="Drag compatible action cards into the slots below. The editor keeps the flow sequential so it matches the current workflow validator and runtime."
					>
						<div className="space-y-5">
							<div className="overflow-x-auto">
								<div className="flex min-w-max items-center gap-4 pb-2">
									{Array.from({ length: draft.steps.length + 1 }).map(
										(_, insertIndex) => {
											const previousStepId =
												draft.steps[insertIndex - 1]?.id ?? "start";
											const nextStepId = draft.steps[insertIndex]?.id ?? "end";
											const compatibleActions = (catalog?.actions ?? []).filter(
												(action) =>
													canInsertActionAt(
														actionMap,
														draft.steps,
														insertIndex,
														action,
													),
											);
											const compatible = compatibleActions.length > 0;
											return (
												<div
													key={`slot-${previousStepId}-${nextStepId}`}
													className="flex items-center gap-4"
												>
													<Slot
														active={draggedActionType !== null}
														compatible={
															draggedActionType
																? compatibleActions.some(
																		(action) =>
																			action.actionType === draggedActionType,
																	)
																: compatible
														}
														onDropAction={() => {
															if (!draggedActionType) {
																return;
															}
															const action = actionMap.get(draggedActionType);
															if (action) {
																insertAction(action, insertIndex);
															}
															setDraggedActionType(null);
														}}
													/>
													{draft.steps[insertIndex] ? (
														<>
															<button
																type="button"
																onClick={() =>
																	setSelectedStepIndex(insertIndex)
																}
																className={`w-[260px] rounded-[26px] border p-5 transition-colors ${
																	selectedStepIndex === insertIndex
																		? "border-primary bg-primary/8"
																		: "border-[var(--brand-border-soft)] bg-background/72"
																}`}
															>
																<div className="flex items-start justify-between gap-3">
																	<div>
																		<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
																			Node {insertIndex + 1}
																		</div>
																		<div className="mt-2 text-base font-medium">
																			{draft.steps[insertIndex].name}
																		</div>
																	</div>
																	<GripHorizontal className="size-4 text-muted-foreground" />
																</div>
																<div className="mt-4 flex flex-wrap gap-2">
																	<Badge
																		variant="outline"
																		className="rounded-full"
																	>
																		{draft.steps[insertIndex].actionType}
																	</Badge>
																	<Badge
																		variant="outline"
																		className="rounded-full"
																	>
																		{draft.steps[insertIndex].stepKind}
																	</Badge>
																</div>
																<div className="mt-4 text-xs text-muted-foreground">
																	{draft.steps[insertIndex]
																		.consumesArtifactType || "none"}{" "}
																	→{" "}
																	{draft.steps[insertIndex]
																		.producesArtifactType || "none"}
																</div>
															</button>
															{insertIndex < draft.steps.length - 1 ? (
																<div className="h-px w-16 bg-[var(--brand-border-soft)]" />
															) : null}
														</>
													) : null}
												</div>
											);
										},
									)}
								</div>
							</div>

							<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
								<div className="grid gap-3 md:grid-cols-2">
									{catalog?.actions.map((action) => {
										const canAppend = canInsertActionAt(
											actionMap,
											draft.steps,
											draft.steps.length,
											action,
										);
										return (
											<div
												key={action.actionType}
												draggable
												onDragStart={() =>
													setDraggedActionType(action.actionType)
												}
												onDragEnd={() => setDraggedActionType(null)}
												className={`rounded-[24px] border p-4 ${
													canAppend
														? "border-[var(--brand-border-soft)] bg-background/70"
														: "border-[var(--brand-border-soft)]/50 bg-background/45 opacity-65"
												}`}
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<div className="font-medium">{action.label}</div>
														<div className="mt-1 text-sm text-muted-foreground">
															{action.description}
														</div>
													</div>
													<Badge variant="outline" className="rounded-full">
														{action.defaultStepKind}
													</Badge>
												</div>
												<div className="mt-4 flex flex-wrap gap-2">
													<Badge variant="outline" className="rounded-full">
														In: {action.defaultConsumesType}
													</Badge>
													<Badge variant="outline" className="rounded-full">
														Out: {action.defaultProducesType}
													</Badge>
												</div>
												<div className="mt-4 flex items-center justify-between gap-3">
													<div className="text-xs text-muted-foreground">
														Drag into a compatible slot
													</div>
													<Button
														variant="outline"
														size="sm"
														className="rounded-full"
														disabled={!canAppend}
														onClick={() =>
															insertAction(action, draft.steps.length)
														}
													>
														<Plus className="size-4" />
														Add
													</Button>
												</div>
											</div>
										);
									})}
								</div>

								<SurfaceCard className="space-y-4 p-5">
									<div className="flex items-center justify-between gap-3">
										<div>
											<div className="text-sm font-medium">Prompt policy</div>
											<div className="text-xs text-muted-foreground">
												Base + automation override
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
												Open prompts
											</Link>
										</Button>
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/65 p-4 text-sm text-muted-foreground whitespace-pre-wrap">
										{aiSettings
											? systemPromptPreview(
													aiSettings.systemPrompts,
													"automations",
												)
											: "Loading workspace prompt policy..."}
									</div>
								</SurfaceCard>
							</div>
						</div>
					</DashboardPanel>
				</div>

				<DashboardPanel
					title="Node inspector"
					description="Select a node on the canvas to adjust behavior, reviewer type, and mode-specific settings."
				>
					{selectedStep ? (
						<div className="space-y-5">
							<SurfaceCard className="space-y-4 p-5">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-sm font-medium">
											{selectedStep.actionType}
										</div>
										<div className="mt-1 text-xs text-muted-foreground">
											Node {selectedStep.position}
										</div>
									</div>
									<Badge variant="outline" className="rounded-full">
										{selectedStep.stepKind}
									</Badge>
								</div>
								<div className="space-y-2">
									<Label>Node name</Label>
									<Input
										value={selectedStep.name}
										onChange={(event) =>
											updateSelectedStep((step) => ({
												...step,
												name: event.target.value,
											}))
										}
										className="h-11 rounded-2xl"
									/>
								</div>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className="space-y-2">
										<Label>Consumes</Label>
										<Input
											value={selectedStep.consumesArtifactType}
											readOnly
											className="h-11 rounded-2xl"
										/>
									</div>
									<div className="space-y-2">
										<Label>Produces</Label>
										<Input
											value={selectedStep.producesArtifactType}
											readOnly
											className="h-11 rounded-2xl"
										/>
									</div>
								</div>
								{selectedStep.stepKind === "review" ? (
									<div className="space-y-2">
										<Label>Reviewer type</Label>
										<Select
											value={selectedStep.reviewerType || "human"}
											onValueChange={(value) =>
												updateSelectedStep((step) => ({
													...step,
													reviewerType: value,
												}))
											}
										>
											<SelectTrigger className="h-11 rounded-2xl">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="human">Human</SelectItem>
												<SelectItem value="ai">AI</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : null}
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										disabled={selectedStepIndex <= 0}
										onClick={() => moveSelected(-1)}
									>
										<ArrowLeft className="size-4" />
										Move left
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										disabled={selectedStepIndex >= draft.steps.length - 1}
										onClick={() => moveSelected(1)}
									>
										Move right
										<ArrowRight className="size-4" />
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full text-destructive"
										onClick={removeSelectedStep}
									>
										<Trash2 className="size-4" />
										Remove
									</Button>
								</div>
							</SurfaceCard>

							<SurfaceCard className="space-y-4 p-5">
								<div className="text-sm font-medium">Mode-specific config</div>
								{selectedStep.actionType === "campaign_plan" ||
								selectedStep.actionType === "post_generate" ? (
									<div className="space-y-2">
										<Label>Prompt</Label>
										<Textarea
											value={String(selectedStep.config.prompt ?? "")}
											onChange={(event) =>
												updateSelectedStep((step) => ({
													...step,
													config: {
														...step.config,
														prompt: event.target.value,
													},
												}))
											}
											className="min-h-28 rounded-[24px]"
										/>
									</div>
								) : null}
								{selectedStep.actionType === "image_generate" ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label>Prompt</Label>
											<Textarea
												value={String(selectedStep.config.prompt ?? "")}
												onChange={(event) =>
													updateSelectedStep((step) => ({
														...step,
														config: {
															...step.config,
															prompt: event.target.value,
														},
													}))
												}
												className="min-h-28 rounded-[24px]"
											/>
										</div>
										<div className="grid gap-3 sm:grid-cols-2">
											<div className="space-y-2">
												<Label>Width</Label>
												<Input
													type="number"
													value={String(selectedStep.config.width ?? 1280)}
													onChange={(event) =>
														updateSelectedStep((step) => ({
															...step,
															config: {
																...step.config,
																width: Number(event.target.value || 1280),
															},
														}))
													}
													className="h-11 rounded-2xl"
												/>
											</div>
											<div className="space-y-2">
												<Label>Height</Label>
												<Input
													type="number"
													value={String(selectedStep.config.height ?? 1280)}
													onChange={(event) =>
														updateSelectedStep((step) => ({
															...step,
															config: {
																...step.config,
																height: Number(event.target.value || 1280),
															},
														}))
													}
													className="h-11 rounded-2xl"
												/>
											</div>
										</div>
									</div>
								) : null}
								{selectedStep.actionType === "reel_generate_beta" ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label>Reel title</Label>
											<Input
												value={String(selectedStep.config.title ?? "")}
												onChange={(event) =>
													updateSelectedStep((step) => ({
														...step,
														config: {
															...step.config,
															title: event.target.value,
														},
													}))
												}
												className="h-11 rounded-2xl"
											/>
										</div>
										<div className="space-y-2">
											<Label>Style</Label>
											<Input
												value={String(selectedStep.config.style ?? "kinetic")}
												onChange={(event) =>
													updateSelectedStep((step) => ({
														...step,
														config: {
															...step.config,
															style: event.target.value,
														},
													}))
												}
												className="h-11 rounded-2xl"
											/>
										</div>
									</div>
								) : null}
								{selectedStep.actionType === "linkedin_pdf_generate_beta" ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label>Document title</Label>
											<Input
												value={String(selectedStep.config.title ?? "")}
												onChange={(event) =>
													updateSelectedStep((step) => ({
														...step,
														config: {
															...step.config,
															title: event.target.value,
														},
													}))
												}
												className="h-11 rounded-2xl"
											/>
										</div>
										<div className="space-y-2">
											<Label>Subtitle</Label>
											<Input
												value={String(selectedStep.config.subtitle ?? "")}
												onChange={(event) =>
													updateSelectedStep((step) => ({
														...step,
														config: {
															...step.config,
															subtitle: event.target.value,
														},
													}))
												}
												className="h-11 rounded-2xl"
											/>
										</div>
									</div>
								) : null}
								{selectedStep.actionType === "review" ? (
									<div className="space-y-2">
										<Label>Reviewer note</Label>
										<Textarea
											value={String(selectedStep.config.comment ?? "")}
											onChange={(event) =>
												updateSelectedStep((step) => ({
													...step,
													config: {
														...step.config,
														comment: event.target.value,
													},
												}))
											}
											className="min-h-24 rounded-[24px]"
										/>
									</div>
								) : null}
								{selectedStep.actionType === "publish_or_schedule" ? (
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
										Publish nodes reuse the existing publish runtime. Add them
										only after a variations step.
									</div>
								) : null}
							</SurfaceCard>
						</div>
					) : (
						<SurfaceCard className="p-5 text-sm text-muted-foreground">
							Select a node on the canvas to configure it, or drag in a starter
							action from the library.
						</SurfaceCard>
					)}
				</DashboardPanel>
			</div>
		</div>
	);
}
