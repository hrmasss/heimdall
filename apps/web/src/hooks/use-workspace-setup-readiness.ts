import { useCallback, useEffect, useMemo, useState } from "react";

import type {
	SocialConnectionsResponse,
	WorkspaceContextResponse,
	WorkspaceSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { summarizeSocialConnections } from "@/lib/social-connections";
import {
	createEmptySetupReadiness,
	deriveSetupReadiness,
	type SetupReadiness,
} from "@/lib/workspace-setup";

type WorkspaceSetupReadinessResult = {
	hydrated: boolean;
	loading: boolean;
	error: string | null;
	workspace: WorkspaceSummary | null;
	context: WorkspaceContextResponse | null;
	social: SocialConnectionsResponse | null;
	readiness: SetupReadiness;
	reload: () => Promise<void>;
};

export function useWorkspaceSetupReadiness(): WorkspaceSetupReadinessResult {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
	const [context, setContext] = useState<WorkspaceContextResponse | null>(null);
	const [social, setSocial] = useState<SocialConnectionsResponse | null>(null);
	const [loading, setLoading] = useState(Boolean(activeWorkspaceId));
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		if (!activeWorkspaceId) {
			setWorkspace(null);
			setContext(null);
			setSocial(null);
			setLoading(false);
			setError(null);
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const [workspaceResponse, contextResponse, socialResponse] =
				await Promise.all([
					customerRequest<WorkspaceSummary>(`/workspaces/${activeWorkspaceId}`),
					customerRequest<WorkspaceContextResponse>(
						`/workspaces/${activeWorkspaceId}/ai/context`,
					),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
				]);
			setWorkspace(workspaceResponse);
			setContext(contextResponse);
			setSocial(socialResponse);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load workspace setup status.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const readiness = useMemo(() => {
		if (!activeWorkspaceId) {
			return createEmptySetupReadiness();
		}
		if (!workspace && !context && !social) {
			return createEmptySetupReadiness();
		}
		return deriveSetupReadiness({
			workspace,
			context,
			summary: summarizeSocialConnections(social),
		});
	}, [activeWorkspaceId, context, social, workspace]);

	const hydrated = !activeWorkspaceId || Boolean(workspace || context || social || error);

	return {
		hydrated,
		loading,
		error,
		workspace,
		context,
		social,
		readiness,
		reload,
	};
}
