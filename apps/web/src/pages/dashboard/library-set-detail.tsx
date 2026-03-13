import { ArrowLeft, FolderKanban, PencilLine, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import {
	ResourceSetCover,
	ResourceSetIntentBadge,
	ResourceSetItemList,
	ResourceSetMembersPreview,
} from "@/components/resources/resource-set-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResourceSetDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatResourceDate(value: string) {
	return new Date(value).toLocaleString();
}

export function DashboardLibrarySetDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resourceSet, setResourceSet] = useState<ResourceSetDetail | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadResourceSet = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const response = await customerRequest<ResourceSetDetail>(
				`/resource-sets/${id}`,
			);
			setResourceSet(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this asset set.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest, id]);

	useEffect(() => {
		void loadResourceSet();
	}, [loadResourceSet]);

	async function deleteResourceSet() {
		if (!resourceSet) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await customerRequest(`/resource-sets/${resourceSet.id}`, {
				method: "DELETE",
			});
			navigate("/dashboard/library");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this asset set.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace resources"
				title={resourceSet?.name ?? "Asset set detail"}
				description="Inspect an ordered group of reusable resources, confirm intended use, and follow the same sequence into pickers and future post composition."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/library">
								<ArrowLeft className="size-4" />
								Back to library
							</Link>
						</Button>
						{resourceSet ? (
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={`/dashboard/library/sets/${resourceSet.id}/edit`}>
									<PencilLine className="size-4" />
									Edit asset set
								</Link>
							</Button>
						) : null}
						{resourceSet ? (
							<Button
								variant="outline"
								className="rounded-full text-red-600"
								onClick={() => void deleteResourceSet()}
								disabled={saving}
							>
								<Trash2 className="size-4" />
								Delete
							</Button>
						) : null}
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
				<div className="space-y-6">
					<SurfaceCard className="overflow-hidden p-0">
						<div className="aspect-[16/9] overflow-hidden bg-muted">
							{resourceSet ? <ResourceSetCover set={resourceSet} /> : null}
						</div>
						<div className="space-y-4 p-5">
							<div className="flex flex-wrap items-center gap-2">
								{resourceSet ? (
									<ResourceSetIntentBadge set={resourceSet} />
								) : null}
								<Badge variant="outline" className="rounded-full">
									{resourceSet?.itemCount ?? 0} items
								</Badge>
								{resourceSet ? (
									<Badge variant="outline" className="rounded-full capitalize">
										{resourceSet.sourceType.replaceAll("_", " ")}
									</Badge>
								) : null}
							</div>
							<div className="text-sm text-muted-foreground">
								{resourceSet?.description || "No description yet."}
							</div>
							{resourceSet ? (
								<ResourceSetMembersPreview
									resources={resourceSet.items.map((item) => item.resource)}
									max={6}
								/>
							) : null}
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5 md:p-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight">
								Ordered members
							</h2>
							<p className="text-sm text-muted-foreground">
								The sequence here is the same order exposed to pickers and
								future social-surface composition flows.
							</p>
						</div>
						<div className="mt-5">
							{loading || !resourceSet ? (
								<div className="text-sm text-muted-foreground">
									Loading members...
								</div>
							) : (
								<ResourceSetItemList
									items={resourceSet.items}
									onOpenResource={(resourceId) =>
										navigate(`/dashboard/library/${resourceId}`)
									}
								/>
							)}
						</div>
					</SurfaceCard>
				</div>

				<div className="space-y-6">
					<SurfaceCard className="p-5">
						<div className="flex items-center gap-2">
							<FolderKanban className="size-4 text-primary" />
							<div className="text-lg font-semibold">Set overview</div>
						</div>
						{loading || !resourceSet ? (
							<div className="mt-4 text-sm text-muted-foreground">
								Loading overview...
							</div>
						) : (
							<div className="mt-4 space-y-3">
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Intended use
									</div>
									<div className="mt-2 text-lg font-semibold">
										{resourceSet.intentType === "social_surface"
											? `${resourceSet.intentPlatform} · ${resourceSet.intentSurface}`
											: "Generic reusable set"}
									</div>
								</div>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Cover resource
									</div>
									<div className="mt-2 text-sm">
										{resourceSet.coverResource?.displayName ??
											resourceSet.items[0]?.resource.displayName ??
											"No cover yet"}
									</div>
								</div>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Updated
									</div>
									<div className="mt-2 text-sm">
										{formatResourceDate(resourceSet.updatedAt)}
									</div>
									<div className="mt-1 text-sm text-muted-foreground">
										Created {formatResourceDate(resourceSet.createdAt)}
									</div>
								</div>
							</div>
						)}
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
