import { useCallback, useEffect, useRef, useState } from "react";

import type { ResourceRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type DurableUrlOptions = {
	initialUrl?: string | null;
	refresh?: (() => Promise<string>) | null;
};

export function useDurableUrl(options: DurableUrlOptions) {
	const { initialUrl, refresh } = options;
	const [url, setUrl] = useState(initialUrl ?? "");
	const [broken, setBroken] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const refreshAttemptedRef = useRef(false);
	const objectUrlRef = useRef<string | null>(null);

	useEffect(() => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}
		setUrl(initialUrl ?? "");
		setBroken(false);
		setRefreshing(false);
		refreshAttemptedRef.current = false;
	}, [initialUrl]);

	useEffect(() => {
		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};
	}, []);

	const handleError = useCallback(async () => {
		if (!refresh || refreshAttemptedRef.current) {
			setBroken(true);
			return;
		}

		refreshAttemptedRef.current = true;
		setRefreshing(true);
		try {
			const nextUrl = await refresh();
			if (nextUrl) {
				if (objectUrlRef.current && objectUrlRef.current !== nextUrl) {
					URL.revokeObjectURL(objectUrlRef.current);
				}
				if (nextUrl.startsWith("blob:")) {
					objectUrlRef.current = nextUrl;
				} else {
					objectUrlRef.current = null;
				}
				setUrl(nextUrl);
				setBroken(false);
				return;
			}
			setBroken(true);
		} catch {
			setBroken(true);
		} finally {
			setRefreshing(false);
		}
	}, [refresh]);

	return {
		url,
		broken,
		refreshing,
		handleError,
	};
}

export async function refreshResourceDownloadUrl(input: {
	resourceId: string;
	accessToken?: string | null;
	workspaceId?: string | null;
}) {
	const headers = new Headers();
	if (input.accessToken) {
		headers.set("Authorization", `Bearer ${input.accessToken}`);
	}
	if (input.workspaceId) {
		headers.set("X-Workspace-ID", input.workspaceId);
	}

	const response = await fetch(`/api/v1/resources/${input.resourceId}/download`, {
		headers,
		credentials: "include",
	});
	if (response.ok) {
		const blob = await response.blob();
		return URL.createObjectURL(blob);
	}
	throw new Error(`Unable to refresh preview URL (${response.status}).`);
}

export function useResourcePreviewUrl(
	resource?: Pick<ResourceRecord, "id" | "previewUrl"> | null,
) {
	const { customerSession, activeWorkspaceId } = useAuth();

	const refresh = useCallback(async () => {
		if (!resource?.id) {
			throw new Error("No resource id available.");
		}
		return refreshResourceDownloadUrl({
			resourceId: resource.id,
			accessToken: customerSession?.accessToken ?? null,
			workspaceId: activeWorkspaceId,
		});
	}, [activeWorkspaceId, customerSession?.accessToken, resource?.id]);

	return useDurableUrl({
		initialUrl: resource?.previewUrl,
		refresh: resource?.id ? refresh : null,
	});
}
