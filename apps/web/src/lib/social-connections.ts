import type {
	SocialConnectionRecord,
	SocialConnectionsResponse,
	SocialTargetRecord,
} from "@/lib/api-types";

const healthyStatuses = new Set(["healthy", "active", "connected", "ready"]);

export type SocialProviderSummary = {
	provider: string;
	connectionCount: number;
	healthyConnectionCount: number;
	selectedTargetCount: number;
	healthySelectedTargetCount: number;
};

export type SocialConnectionSummary = {
	connectionCount: number;
	healthyConnectionCount: number;
	selectedTargetCount: number;
	healthySelectedTargetCount: number;
	providerCount: number;
	connectedProviders: string[];
	hasHealthyConnection: boolean;
	hasSelectedTarget: boolean;
	hasHealthySelectedTarget: boolean;
	providers: SocialProviderSummary[];
};

export function isHealthyStatus(status?: string) {
	return healthyStatuses.has((status ?? "").toLowerCase());
}

export function formatSocialStatusLabel(status: string) {
	return status
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function socialStatusBadgeClass(status: string) {
	switch (status) {
		case "healthy":
		case "active":
		case "connected":
		case "ready":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
		case "degraded":
		case "pending":
			return "border-amber-500/20 bg-amber-500/10 text-amber-600";
		case "reauth_required":
		case "revoked":
		case "failed":
			return "border-red-500/20 bg-red-500/10 text-red-600";
		default:
			return "border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground";
	}
}

export function groupConnectionsByProvider(
	connections: SocialConnectionRecord[],
) {
	return connections.reduce<Record<string, SocialConnectionRecord[]>>(
		(accumulator, connection) => {
			accumulator[connection.provider] ??= [];
			accumulator[connection.provider].push(connection);
			return accumulator;
		},
		{},
	);
}

function summarizeTargets(
	targets: SocialTargetRecord[],
	connectionHealthById: Map<string, boolean>,
) {
	let selectedTargetCount = 0;
	let healthySelectedTargetCount = 0;

	for (const target of targets) {
		if (!target.isSelected) {
			continue;
		}
		selectedTargetCount += 1;
		if (
			isHealthyStatus(target.status) &&
			connectionHealthById.get(target.connectionId)
		) {
			healthySelectedTargetCount += 1;
		}
	}

	return { selectedTargetCount, healthySelectedTargetCount };
}

export function summarizeSocialConnections(
	response?: Pick<SocialConnectionsResponse, "connections" | "targets"> | null,
): SocialConnectionSummary {
	const connections = response?.connections ?? [];
	const targets = response?.targets ?? [];
	const connectionHealthById = new Map(
		connections.map((connection) => [
			connection.id,
			isHealthyStatus(connection.healthStatus),
		]),
	);
	const providerMap = new Map<string, SocialProviderSummary>();

	for (const connection of connections) {
		const current = providerMap.get(connection.provider) ?? {
			provider: connection.provider,
			connectionCount: 0,
			healthyConnectionCount: 0,
			selectedTargetCount: 0,
			healthySelectedTargetCount: 0,
		};
		current.connectionCount += 1;
		if (isHealthyStatus(connection.healthStatus)) {
			current.healthyConnectionCount += 1;
		}
		providerMap.set(connection.provider, current);
	}

	for (const target of targets) {
		const current = providerMap.get(target.provider) ?? {
			provider: target.provider,
			connectionCount: 0,
			healthyConnectionCount: 0,
			selectedTargetCount: 0,
			healthySelectedTargetCount: 0,
		};
		if (target.isSelected) {
			current.selectedTargetCount += 1;
			if (
				isHealthyStatus(target.status) &&
				connectionHealthById.get(target.connectionId)
			) {
				current.healthySelectedTargetCount += 1;
			}
		}
		providerMap.set(target.provider, current);
	}

	const providerSummaries = Array.from(providerMap.values()).sort(
		(left, right) => left.provider.localeCompare(right.provider),
	);
	const targetSummary = summarizeTargets(targets, connectionHealthById);
	const healthyConnectionCount = connections.filter((connection) =>
		isHealthyStatus(connection.healthStatus),
	).length;
	const connectedProviders = providerSummaries
		.filter((provider) => provider.connectionCount > 0)
		.map((provider) => provider.provider);

	return {
		connectionCount: connections.length,
		healthyConnectionCount,
		selectedTargetCount: targetSummary.selectedTargetCount,
		healthySelectedTargetCount: targetSummary.healthySelectedTargetCount,
		providerCount: connectedProviders.length,
		connectedProviders,
		hasHealthyConnection: healthyConnectionCount > 0,
		hasSelectedTarget: targetSummary.selectedTargetCount > 0,
		hasHealthySelectedTarget: targetSummary.healthySelectedTargetCount > 0,
		providers: providerSummaries,
	};
}
