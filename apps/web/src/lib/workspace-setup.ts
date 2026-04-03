import type {
	SocialConnectionRecord,
	SocialProviderAvailability,
	SocialTargetRecord,
	WorkspaceContextResponse,
	WorkspaceSummary,
} from "@/lib/api-types";
import {
	formatSocialStatusLabel,
	groupConnectionsByProvider,
	isHealthyStatus,
	type SocialConnectionSummary,
} from "@/lib/social-connections";

export type SetupStepState = {
	id: "workspace" | "platform" | "target" | "intelligence" | "finish";
	title: string;
	description: string;
	complete: boolean;
	optional?: boolean;
	ctaHref?: string;
	ctaLabel?: string;
};

export type SetupReadiness = {
	workspaceReady: boolean;
	platformConnected: boolean;
	targetReady: boolean;
	businessReady: boolean;
	aiAccessReady: boolean;
	intelligenceReady: boolean;
	brandReady: boolean;
	publishingReady: boolean;
	complete: boolean;
	completedStepCount: number;
	requiredStepCount: number;
	summary: string;
	steps: SetupStepState[];
};

export type PlatformSetupState = {
	provider: string;
	label: string;
	state: "ready" | "needs_attention" | "not_connected";
	summary: string;
	actionLabel: "Connect" | "Reconnect" | "Choose destination" | "Revalidate";
	connectionCount: number;
	healthyConnectionCount: number;
	selectedTargetCount: number;
	healthySelectedTargetCount: number;
	healthyTargets: SocialTargetRecord[];
	selectedTargets: SocialTargetRecord[];
	connections: SocialConnectionRecord[];
};

export function createEmptySetupReadiness(): SetupReadiness {
	const steps: SetupStepState[] = [
		{
			id: "workspace",
			title: "Workspace confirmed",
			description: "Create the workspace so Heimdall can start saving setup state.",
			complete: false,
		},
		{
			id: "platform",
			title: "Connect first platform",
			description: "Link at least one provider so Heimdall can publish on behalf of the workspace.",
			complete: false,
			ctaHref: "/dashboard/settings/platforms",
			ctaLabel: "Open platform setup",
		},
		{
			id: "target",
			title: "Choose first destination",
			description: "Pick the page, profile, or organization Heimdall should publish to.",
			complete: false,
			ctaHref: "/dashboard/settings/platforms",
			ctaLabel: "Choose destination",
		},
		{
			id: "intelligence",
			title: "Add intelligence basics",
			description: "Business context and AI access improve output quality, but stay optional.",
			complete: false,
			optional: true,
			ctaHref: "/dashboard/settings/intelligence",
			ctaLabel: "Open intelligence",
		},
		{
			id: "finish",
			title: "Create first post",
			description: "Open the unified composer and publish from the new setup flow.",
			complete: false,
			ctaHref: "/dashboard/posts/new",
			ctaLabel: "Create post",
		},
	];

	return {
		workspaceReady: false,
		platformConnected: false,
		targetReady: false,
		businessReady: false,
		aiAccessReady: false,
		intelligenceReady: false,
		brandReady: false,
		publishingReady: false,
		complete: false,
		completedStepCount: 0,
		requiredStepCount: 4,
		summary: "Create a workspace, connect one destination, and add the basics when you are ready.",
		steps,
	};
}

export function deriveSetupReadiness(input: {
	workspace?: WorkspaceSummary | null;
	context?: WorkspaceContextResponse | null;
	summary?: SocialConnectionSummary | null;
}): SetupReadiness {
	const workspaceReady = Boolean(input.workspace?.id);
	const platformConnected = Boolean(input.summary?.hasHealthyConnection);
	const targetReady = Boolean(input.summary?.hasHealthySelectedTarget);
	const businessReady = Boolean(input.context?.readiness.hasBusinessContext);
	const aiAccessReady = Boolean(input.context?.readiness.hasAiAccess);
	const intelligenceReady = businessReady && aiAccessReady;
	const brandReady = Boolean(input.context?.readiness.hasBrandContext);
	const publishingReady = workspaceReady && targetReady;

	const steps: SetupStepState[] = [
		{
			id: "workspace",
			title: "Workspace confirmed",
			description: "The workspace exists and can now hold setup state, content, and connections.",
			complete: workspaceReady,
		},
		{
			id: "platform",
			title: "Connect first platform",
			description: platformConnected
				? "At least one provider is healthy."
				: "Connect one provider so Heimdall can publish for this workspace.",
			complete: platformConnected,
			ctaHref: "/dashboard/settings/platforms",
			ctaLabel: platformConnected ? "Manage platforms" : "Connect platform",
		},
		{
			id: "target",
			title: "Choose first destination",
			description: targetReady
				? "A healthy destination is selected and publish-ready."
				: "Choose where Heimdall should publish by default.",
			complete: targetReady,
			ctaHref: "/dashboard/settings/platforms",
			ctaLabel: targetReady ? "Manage destinations" : "Choose destination",
		},
		{
			id: "intelligence",
			title: "Add intelligence basics",
			description: intelligenceReady
				? "Business context and AI access are ready."
				: "Add business context and AI access when you want better drafts and guidance.",
			complete: intelligenceReady,
			optional: true,
			ctaHref: "/dashboard/settings/intelligence",
			ctaLabel: intelligenceReady ? "Manage intelligence" : "Add basics",
		},
		{
			id: "finish",
			title: "Create first post",
			description: publishingReady
				? "The composer is ready for a live publish flow."
				: "Finish the publishing setup so the composer can post on your behalf.",
			complete: publishingReady,
			ctaHref: "/dashboard/posts/new",
			ctaLabel: publishingReady ? "Create post" : "Finish setup",
		},
	];

	const completedStepCount = steps.filter(
		(step) => step.complete && !step.optional,
	).length;
	const requiredStepCount = steps.filter((step) => !step.optional).length;
	const complete = publishingReady && intelligenceReady;

	let summary = "Create the workspace, connect one destination, and you can start publishing.";
	if (publishingReady && intelligenceReady) {
		summary = "Publishing and intelligence basics are ready. You can move straight into content creation.";
	} else if (publishingReady) {
		summary =
			"Publishing is ready. Intelligence basics are still optional, but adding them will improve drafts and automation later.";
	} else if (platformConnected) {
		summary =
			"The provider is connected. Choose one destination target to finish the publishing path.";
	}

	return {
		workspaceReady,
		platformConnected,
		targetReady,
		businessReady,
		aiAccessReady,
		intelligenceReady,
		brandReady,
		publishingReady,
		complete,
		completedStepCount,
		requiredStepCount,
		summary,
		steps,
	};
}

export function derivePlatformSetupStates(input: {
	providers: SocialProviderAvailability[];
	connections: SocialConnectionRecord[];
}): PlatformSetupState[] {
	const groupedConnections = groupConnectionsByProvider(input.connections);

	return input.providers.map((provider) => {
		const providerConnections = groupedConnections[provider.provider] ?? [];
		const healthyConnections = providerConnections.filter((connection) =>
			isHealthyStatus(connection.healthStatus),
		);
		const healthyTargets = providerConnections.flatMap((connection) =>
			connection.targets.filter((target) => isHealthyStatus(target.status)),
		);
		const selectedTargets = providerConnections.flatMap((connection) =>
			connection.targets.filter((target) => target.isSelected),
		);
		const healthySelectedTargets = selectedTargets.filter((target) =>
			isHealthyStatus(target.status),
		);

		let state: PlatformSetupState["state"] = "not_connected";
		let summary =
			"Connect this provider to choose where Heimdall should publish.";
		let actionLabel: PlatformSetupState["actionLabel"] = "Connect";

		if (healthySelectedTargets.length > 0) {
			state = "ready";
			actionLabel = healthyTargets.length > 1 ? "Choose destination" : "Revalidate";
			summary =
				healthySelectedTargets.length === 1
					? `${healthySelectedTargets[0].displayName} is selected and ready.`
					: `${healthySelectedTargets.length} destinations are selected and ready.`;
		} else if (providerConnections.length > 0) {
			state = "needs_attention";
			if (healthyConnections.length === 0) {
				actionLabel = "Reconnect";
				summary = "Reconnect this provider so Heimdall can discover publishable destinations again.";
			} else if (healthyTargets.length > 0) {
				actionLabel = "Choose destination";
				summary = "Choose where Heimdall should publish for this provider.";
			} else {
				actionLabel = "Revalidate";
				summary = "Revalidate this provider to refresh connection health and destination discovery.";
			}
		}

		if (
			state === "not_connected" &&
			provider.managedStatus &&
			provider.managedStatus !== "not_connected"
		) {
			summary =
				provider.managedStatusText ??
				`${formatSocialStatusLabel(provider.managedStatus)}. Connect again to keep this provider publish-ready.`;
		}

		return {
			provider: provider.provider,
			label: provider.label,
			state,
			summary,
			actionLabel,
			connectionCount: providerConnections.length,
			healthyConnectionCount: healthyConnections.length,
			selectedTargetCount: selectedTargets.length,
			healthySelectedTargetCount: healthySelectedTargets.length,
			healthyTargets,
			selectedTargets,
			connections: providerConnections,
		};
	});
}
