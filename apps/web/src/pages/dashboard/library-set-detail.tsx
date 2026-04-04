import {
	ArrowLeft,
	FolderKanban,
	MoreHorizontal,
	PencilLine,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { AssetWorkspaceShell } from "@/components/app/asset-workspace";
import {
	DashboardPageHeader,
	DashboardPanel,
	DashboardStatStrip,
	DashboardStatusStrip,
} from "@/components/app/dashboard";
import {
	ResourceSetCover,
	ResourceSetIntentBadge,
	ResourceSetItemList,
	ResourceSetMembersPreview,
} from "@/components/resources/resource-set-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ResourceSetDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatResourceDate(value: string) {
	return new Date(value).toLocaleString();
}

export function DashboardLibrarySetDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resourceSet, setResourceSet] = useState<ResourceSetDetail | null>(null);
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
			const response = await customerRequest<ResourceSetDetail>(`/resource-sets/${id}`);
			setResourceSet(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this collection.",
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
					: "Unable to delete this collection.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Collections"
				title={resourceSet?.name ?? "Collection detail"}
				description="Collections keep grouped assets reusable for carousels, sequences, and bundled publishing jobs without overshadowing single-asset work."
				primaryAction={
					resourceSet ? (
						<Button className="rounded-full border-0 bg-gradient-brand text-white" asChild>
							<Link to={`/dashboard/posts/new?resourceSetId=${resourceSet.id}`}>
								Use in post
							</Link>
						</Button>
					) : null
				}
				secondaryActions={
					<>
						<Button variant="outline" size="sm" className="rounded-full" asChild>
							<Link to="/dashboard/library">
								<ArrowLeft className="size-4" />
								Back to media
							</Link>
						</Button>
						{resourceSet ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" className="rounded-full">
										<MoreHorizontal className="size-4" />
										More
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-52 rounded-[20px] p-2">
									<DropdownMenuItem asChild>
										<Link to={`/dashboard/library/sets/${resourceSet.id}/edit`}>
											<PencilLine className="size-4" />
											Rename
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onClick={() => void deleteResourceSet()}
										disabled={saving}
									>
										<Trash2 className="size-4" />
										Delete
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</>
				}
			/>

			<DashboardStatusStrip
				eyebrow="Grouped reuse"
				title={
					resourceSet
						? `${resourceSet.itemCount} ordered asset${resourceSet.itemCount === 1 ? "" : "s"}`
						: "Loading collection"
				}
				description="Use collections when order matters. Otherwise, stay in the single-asset path to keep the workflow fast."
				action={
					resourceSet ? <ResourceSetIntentBadge set={resourceSet} /> : undefined
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<AssetWorkspaceShell
				railTitle="Collection context"
				railDescription="Quick overview stays nearby while the ordered member list remains central."
				railTriggerLabel="Open context"
				rail={
					<SurfaceCard className="space-y-4 p-5">
						<div className="flex items-center gap-2">
							<FolderKanban className="size-4 text-primary" />
							<div className="text-base font-semibold">Overview</div>
						</div>
						{loading || !resourceSet ? (
							<div className="text-sm text-muted-foreground">Loading overview…</div>
						) : (
							<div className="space-y-3">
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm">
									<div className="font-medium">Intent</div>
									<div className="mt-1 text-muted-foreground">
										{resourceSet.intentType === "social_surface"
											? `${resourceSet.intentPlatform} · ${resourceSet.intentSurface}`
											: "Generic grouped reuse"}
									</div>
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm">
									<div className="font-medium">Updated</div>
									<div className="mt-1 text-muted-foreground">
										{formatResourceDate(resourceSet.updatedAt)}
									</div>
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm">
									<div className="font-medium">Source</div>
									<div className="mt-1 text-muted-foreground capitalize">
										{resourceSet.sourceType.replaceAll("_", " ")}
									</div>
								</div>
							</div>
						)}
					</SurfaceCard>
				}
			>
				<DashboardPanel
					title="Collection preview"
					description="Review the lead visual and member summary before using this collection in a post."
				>
					<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
						<div className="overflow-hidden rounded-[26px] border border-[var(--brand-border-soft)] bg-muted">
							<div className="aspect-[16/9]">
								{resourceSet ? <ResourceSetCover set={resourceSet} /> : null}
							</div>
						</div>
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								{resourceSet ? <ResourceSetIntentBadge set={resourceSet} /> : null}
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
					</div>
				</DashboardPanel>

				<DashboardStatStrip
					items={[
						{
							label: "Members",
							value: resourceSet?.itemCount ?? "—",
							detail: "Saved in the same order reused elsewhere.",
						},
						{
							label: "Intent",
							value: resourceSet
								? resourceSet.intentType === "social_surface"
									? `${resourceSet.intentPlatform} · ${resourceSet.intentSurface}`
									: "Generic"
								: "—",
							detail: "How this grouped media is meant to be reused.",
						},
						{
							label: "Updated",
							value: resourceSet
								? new Date(resourceSet.updatedAt).toLocaleDateString()
								: "—",
							detail: "Most recent collection change.",
						},
						{
							label: "Created",
							value: resourceSet
								? new Date(resourceSet.createdAt).toLocaleDateString()
								: "—",
							detail: "When this collection was first added.",
						},
					]}
				/>

				<DashboardPanel
					title="Ordered members"
					description="This is the same sequence reused by pickers and post flows."
				>
					{loading || !resourceSet ? (
						<div className="text-sm text-muted-foreground">Loading members…</div>
					) : (
						<ResourceSetItemList
							items={resourceSet.items}
							onOpenResource={(resourceId) =>
								navigate(`/dashboard/library/${resourceId}`)
							}
						/>
					)}
				</DashboardPanel>
			</AssetWorkspaceShell>
		</div>
	);
}
