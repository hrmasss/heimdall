import {
	ArrowLeft,
	FolderKanban,
	LoaderCircle,
	PencilLine,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { AssetWorkspaceShell } from "@/components/app/asset-workspace";
import {
	DashboardPageHeader,
	DashboardPanel,
	DashboardStatusStrip,
} from "@/components/app/dashboard";
import {
	ResourceCompatibilityBadge,
	ResourceThumb,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export function DashboardLibraryFormPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resource, setResource] = useState<ResourceDetail | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadResource() {
			setLoading(true);
			setError(null);
			try {
				const response = await customerRequest<ResourceDetail>(`/resources/${id}`);
				if (cancelled) {
					return;
				}
				setResource(response);
				setDisplayName(response.displayName);
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load this asset.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadResource();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest, id]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await customerRequest<ResourceDetail>(`/resources/${id}`, {
				method: "PATCH",
				body: { displayName },
			});
			navigate(`/dashboard/library/${id}`);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to save this asset.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Media"
				title={loading ? "Update asset" : `Update ${resource?.displayName ?? "asset"}`}
				description="Keep the asset name readable in pickers and post flows without changing the source file underneath."
				primaryAction={
					<Button
						type="submit"
						form="asset-edit-form"
						disabled={loading || saving}
						className="rounded-full border-0 bg-gradient-brand text-white"
					>
						{saving ? (
							<>
								<LoaderCircle className="size-4 animate-spin" />
								Saving
							</>
						) : (
							<>
								<PencilLine className="size-4" />
								Save asset
							</>
						)}
					</Button>
				}
				secondaryActions={
					<>
						<Button variant="outline" size="sm" className="rounded-full" asChild>
							<Link to={`/dashboard/library/${id}`}>
								<ArrowLeft className="size-4" />
								Back to asset
							</Link>
						</Button>
						{resource ? (
							<Button variant="outline" size="sm" className="rounded-full" asChild>
								<Link to={`/dashboard/posts/new?resourceId=${resource.id}`}>
									<Sparkles className="size-4" />
									Use in post
								</Link>
							</Button>
						) : null}
					</>
				}
			/>

			<DashboardStatusStrip
				eyebrow="Naming pass"
				title="Rename it once, keep it obvious everywhere"
				description="This only updates the display label shown in the library, pickers, and future creation flows. The uploaded binary and technical ingest data stay fixed."
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<AssetWorkspaceShell
				railTitle="Asset preview"
				railDescription="Quick context stays nearby while the rename form remains the main task."
				railTriggerLabel="Open preview"
				rail={
					<SurfaceCard className="space-y-4 p-5">
						<div className="overflow-hidden rounded-[24px] border border-[var(--brand-border-soft)] bg-muted">
							<div className="aspect-[4/3]">
								{resource ? (
									<ResourceThumb resource={resource} variant="minimal" />
								) : null}
							</div>
						</div>
						<div className="space-y-2">
							<div className="text-lg font-semibold">
								{resource?.displayName ?? "Asset preview"}
							</div>
							<div className="text-sm text-muted-foreground">
								{resource ? formatResourceMeta(resource) : "Loading summary..."}
							</div>
							{resource ? <ResourceCompatibilityBadge resource={resource} /> : null}
						</div>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
							Use variants in Studio for crops, framing changes, or format-specific treatments. The original upload remains untouched here.
						</div>
					</SurfaceCard>
				}
			>
				<form id="asset-edit-form" className="space-y-5" onSubmit={handleSubmit}>
					<DashboardPanel
						title="Asset label"
						description="Choose the name you want owners to see when they search, browse, and reuse this file."
					>
						{loading ? (
							<div className="flex items-center gap-3 text-sm text-muted-foreground">
								<LoaderCircle className="size-4 animate-spin" />
								Loading asset...
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="resource-display-name">Display name</Label>
									<Input
										id="resource-display-name"
										name="displayName"
										value={displayName}
										onChange={(event) => setDisplayName(event.target.value)}
										className="dashboard-input-height rounded-2xl"
										placeholder="Spring launch hero image"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="resource-original-name">Original file</Label>
									<Input
										id="resource-original-name"
										value={resource?.originalName ?? ""}
										className="dashboard-input-height rounded-2xl"
										readOnly
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="resource-source-type">Source</Label>
									<Input
										id="resource-source-type"
										value={resource?.sourceType ?? ""}
										className="dashboard-input-height rounded-2xl"
										readOnly
									/>
								</div>
							</div>
						)}
					</DashboardPanel>

					<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<FolderKanban className="size-4" />
							Keep names short and specific so this asset is easy to find in the next 30-second search.
						</div>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={`/dashboard/library/${id}`}>Cancel</Link>
							</Button>
							<Button
								type="submit"
								disabled={loading || saving}
								className="rounded-full border-0 bg-gradient-brand text-white"
							>
								{saving ? (
									<>
										<LoaderCircle className="size-4 animate-spin" />
										Saving
									</>
								) : (
									<>
										<PencilLine className="size-4" />
										Save asset
									</>
								)}
							</Button>
						</div>
					</SurfaceCard>
				</form>
			</AssetWorkspaceShell>
		</div>
	);
}
