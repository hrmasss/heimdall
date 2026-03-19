import type {
	AutomationActionContract,
	AutomationRun,
	AutomationTemplate,
	WorkflowDefinition,
	WorkflowStep,
	WorkspaceSystemPrompts,
} from "@/lib/api-types";

const artifactNone = "none";
const artifactAny = "any";

export function formatAutomationWhen(value?: string) {
	if (!value) {
		return "Not started";
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function summarizeRunArtifacts(run: AutomationRun) {
	const artifacts = ((run.outputPayload.artifacts as unknown[]) ??
		[]) as Array<{
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

export function buildWorkflowFromTemplate(template: AutomationTemplate) {
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

export function createStepFromAction(
	action: AutomationActionContract,
	index: number,
): WorkflowStep {
	return {
		position: index + 1,
		name: action.label,
		stepKind: action.defaultStepKind,
		actionType: action.actionType,
		consumesArtifactType: action.defaultConsumesType,
		producesArtifactType: action.defaultProducesType,
		reviewerType: action.defaultReviewerType ?? "",
		requiredCapabilities: [...action.requiredCapabilities],
		config: {},
		metadata: {
			canvasPosition: {
				x: 120 + index * 280,
				y: 120,
			},
		},
	};
}

export function normalizeWorkflowPositions(steps: WorkflowStep[]) {
	return steps.map((step, index) => ({
		...step,
		position: index + 1,
		metadata: {
			...step.metadata,
			canvasPosition:
				step.metadata?.canvasPosition ??
				({
					x: 120 + index * 280,
					y: 120,
				} as Record<string, number>),
		},
	}));
}

export function artifactCompatible(
	consumesType: string,
	currentOutput: string,
	accepted: string[],
) {
	const acceptedInputs = accepted.length > 0 ? accepted : [consumesType];
	if (acceptedInputs.includes(artifactAny) || consumesType === artifactAny) {
		return true;
	}
	const output = currentOutput || artifactNone;
	const consumes = consumesType || output;
	if (output === artifactNone) {
		return acceptedInputs.includes(artifactNone);
	}
	if (consumes === output) {
		return acceptedInputs.includes(consumes);
	}
	return acceptedInputs.includes(output);
}

export function canInsertActionAt(
	actions: Map<string, AutomationActionContract>,
	steps: WorkflowStep[],
	insertIndex: number,
	action: AutomationActionContract,
) {
	const previousOutput =
		insertIndex === 0
			? artifactNone
			: steps[insertIndex - 1]?.producesArtifactType || artifactNone;
	if (
		!artifactCompatible(
			action.defaultConsumesType,
			previousOutput,
			action.acceptedInputs,
		)
	) {
		return false;
	}
	const nextStep = steps[insertIndex];
	if (!nextStep) {
		return true;
	}
	const nextAction = actions.get(nextStep.actionType);
	return artifactCompatible(
		nextStep.consumesArtifactType ||
			nextAction?.defaultConsumesType ||
			artifactNone,
		action.defaultProducesType,
		nextAction?.acceptedInputs ?? [],
	);
}

export function systemPromptPreview(
	prompts: WorkspaceSystemPrompts,
	scope: keyof WorkspaceSystemPrompts,
) {
	const parts = [prompts.base, prompts[scope]].filter(
		(value) => value.trim().length > 0,
	);
	if (parts.length === 0) {
		return "No workspace prompt policy set.";
	}
	return parts.join("\n\n");
}

export function filterRunsForWorkflow(
	workflow: WorkflowDefinition,
	runs: AutomationRun[],
) {
	return runs.filter((run) => run.workflowId === workflow.id);
}
