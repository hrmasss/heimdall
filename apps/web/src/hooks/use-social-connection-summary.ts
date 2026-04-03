import { useEffect, useMemo, useState } from "react";

import type { SocialConnectionsResponse } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	type SocialConnectionSummary,
	summarizeSocialConnections,
} from "@/lib/social-connections";

type UseSocialConnectionSummaryResult = {
	hydrated: boolean;
	loading: boolean;
	error: string | null;
	summary: SocialConnectionSummary;
};

export function useSocialConnectionSummary(): UseSocialConnectionSummaryResult {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [response, setResponse] = useState<SocialConnectionsResponse | null>(
		null,
	);
	const [loading, setLoading] = useState(Boolean(activeWorkspaceId));
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			setResponse(null);
			setLoading(false);
			setError(null);
			return;
		}

		let cancelled = false;

		async function loadSummary() {
			setLoading(true);
			setError(null);
			try {
				const next = await customerRequest<SocialConnectionsResponse>(
					"/social/connections",
				);
				if (!cancelled) {
					setResponse(next);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load platform connection health.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadSummary();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest]);

	const summary = useMemo(
		() => summarizeSocialConnections(response),
		[response],
	);

	const hydrated = !activeWorkspaceId || Boolean(response || error);

	return { hydrated, loading, error, summary };
}
