import {
	ArrowLeft,
	Copy,
	Download,
	MoreHorizontal,
	PencilLine,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
	ResourceCompatibilityBadge,
	ResourceThumb,
	ResourceViewer,
	formatBytes,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { ResourceSetSummaryStrip } from "@/components/resources/resource-set-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ResourceCompatibility, ResourceDetail } from "@/lib/api-types";
import {
	buildStudioHref,
	getDefaultStudioTool,
	getStudioModeForResource,
	studioToolsByMode,
} from "@/lib/asset-studio";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function formatResourceDate(value: string) {
	return new Date(value).toLocaleString();
}

function getCompatibilitySummary(resource: ResourceDetail) {
	const unsupportedCount = resource.compatibility.filter(
		(item) => item.status === "unsupported",
	).length;
	const warningCount = resource.compatibility.filter(
		(item) => item.status === "warning",
	).length;
	if (unsupportedCount > 0) {
		return {
			title: "Needs fixes before broad publishing",
			detail: `${unsupportedCount} blocked surface${unsupportedCount === 1 ? "" : "s"}`,
		};
	}
	if (warningCount > 0) {
		return {
			title: "Mostly ready with a few cautions",
			detail: `${warningCount} warning surface${warningCount === 1 ? "" : "s"}`,
		};
	}
	return {
		title: "Ready for most publishing flows",
		detail: "No current compatibility blockers",
	};
}

function CompatibilityRow({ item }: { item: ResourceCompatibility }) {
	return (
		<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="text-sm font-medium capitalize">
					{item.platform.replace("_", " ")} · {item.surface.replaceAll("_", " ")}
				</div>
				<Badge
					variant="outline"
					className={cn(
						"rounded-full capitalize",
						item.status === "supported" &&
							"border-emerald-500/25 text-emerald-600 dark:text-emerald-300",
						item.status === "warning" &&
							"border-amber-500/25 text-amber-600 dark:text-amber-300",
						item.status === "unsupported" &&
							"border-red-500/25 text-red-600 dark:text-red-300",
					)}
				>
					{item.status}
				</Badge>
			</div>
			<div className="mt-2 text-sm text-muted-foreground">{item.reasons[0]}</div>
		</div>
	);
}

export function DashboardLibraryDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resource, setResource] = useState<ResourceDetail | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [compatibilityOpen, setCompatibilityOpen] = useState(false);
	const [technicalOpen, setTechnicalOpen] = useState(false);

	const loadResource = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setError(null);
		try {
			const response = await customerRequest<ResourceDetail>(`/resources/${id}`);
			setResource(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this asset.",
			);
		}
	}, [activeWorkspaceId, customerRequest, id]);

	useEffect(() => {
		void loadResource();
	}, [loadResource]);

	async function deleteResource() {
		if (!resource) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await customerRequest(`/resources/${resource.id}`, { method: "DELETE" });
			navigate("/dashboard/library");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this asset.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function copyValue(value: string, label: string) {
		if (!navigator.clipboard) {
			return;
		}
		await navigator.clipboard.writeText(value);
		setNotice(`${label} copied to clipboard.`);
		window.setTimeout(() => {
			setNotice((current) =>
				current === `${label} copied to clipboard.` ? null : current,
			);
		}, 1800);
	}

	const studioHref = resource
		? buildStudioHref({
				resourceId: resource.id,
				mode: getStudioModeForResource(resource),
				tool: getDefaultStudioTool(getStudioModeForResource(resource)),
				source: "detail",
			})
		: "/dashboard/studio";
	const transformTools = resource
		? studioToolsByMode[getStudioModeForResource(resource)]
		: [];
	const compatibilitySummary = useMemo(
		() => (resource ? getCompatibilitySummary(resource) : null),
		[resource],
	);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Media"
				title={resource?.displayName ?? "Asset detail"}
				description="Inspect the asset quickly, confirm it is usable, then move straight into a post or Studio without digging through storage detail."
				primaryAction={
					resource ? (
						<Button className="rounded-full border-0 bg-gradient-brand text-white" asChild>
							<Link to={`/dashboard/posts/new?resourceId=${resource.id}`}>
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
						{resource ? (
							<Button variant="outline" size="sm" className="rounded-full" asChild>
								<Link to={studioHref}>
									<Sparkles className="size-4" />
									Open in Studio
								</Link>
							</Button>
						) : null}
					</>
				}
				overflowActions={
					resource
						? [
								{
									label: "Rename",
									action: (
										<Link to={`/dashboard/library/${resource.id}/edit`}>
											Rename
										</Link>
									),
								},
						  ]
						: undefined
				}
			/>

			{resource && compatibilitySummary ? (
				<DashboardStatusStrip
					eyebrow="Publishing state"
					title={compatibilitySummary.title}
					description={compatibilitySummary.detail}
					action={<ResourceCompatibilityBadge resource={resource} />}
				/>
			) : null}

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}
			{notice ? (
				<SurfaceCard className="border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
					{notice}
				</SurfaceCard>
			) : null}

			<AssetWorkspaceShell
				railTitle="Related assets"
				railDescription="Variants and collections stay nearby, but the main asset remains the focus."
				railTriggerLabel="Open context"
				rail={
					<div className="space-y-5">
						<SurfaceCard className="space-y-4 p-5">
							<div className="space-y-1">
								<div className="text-base font-semibold">Variants</div>
								<div className="text-sm text-muted-foreground">
									Alternate crops and derivatives linked to this source.
								</div>
							</div>
							{resource?.variants.length ? (
								<div className="space-y-3">
									{resource.variants.map((variant) => (
										<Link
											key={variant.id}
											to={`/dashboard/library/${variant.id}`}
											className="flex items-center gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-3 transition-colors hover:bg-accent/20"
										>
											<div className="size-14 overflow-hidden rounded-[16px] bg-muted">
												<ResourceThumb resource={variant} variant="compact" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate font-medium">{variant.displayName}</div>
												<div className="mt-1 text-sm text-muted-foreground">
													{formatResourceMeta(variant)}
												</div>
											</div>
										</Link>
									))}
								</div>
							) : (
								<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
									No variants yet. Open this asset in Studio when you need the first derivative.
								</div>
							)}
						</SurfaceCard>

						<SurfaceCard className="space-y-4 p-5">
							<div className="space-y-1">
								<div className="text-base font-semibold">Collections</div>
								<div className="text-sm text-muted-foreground">
									Grouped bundles that already include this asset.
								</div>
							</div>
							{resource?.sets?.length ? (
								<div className="space-y-3">
									{resource.sets.map((set) => (
										<Link key={set.id} to={`/dashboard/library/sets/${set.id}`}>
											<ResourceSetSummaryStrip set={set} />
										</Link>
									))}
								</div>
							) : (
								<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
									This asset has not been grouped into a collection yet.
								</div>
							)}
						</SurfaceCard>
					</div>
				}
			>
				<DashboardPanel
					title="Preview"
					description="See the asset at useful size, then jump into the next action without leaving this page."
					action={
						resource ? (
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" size="sm" className="rounded-full" asChild>
									<a href={resource.downloadUrl} target="_blank" rel="noreferrer">
										<Download className="size-4" />
										Download
									</a>
								</Button>
								<Button variant="outline" size="sm" className="rounded-full" asChild>
									<Link to={`/dashboard/library/${resource.id}/edit`}>
										<PencilLine className="size-4" />
										Rename
									</Link>
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="icon-sm" className="rounded-full">
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-52 rounded-[20px] p-2">
										<DropdownMenuItem onClick={() => void copyValue(resource.id, "Asset ID")}>
											<Copy className="size-4" />
											Copy ID
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => void copyValue(resource.downloadUrl, "Signed URL")}
										>
											<Copy className="size-4" />
											Copy URL
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => void deleteResource()}
											disabled={saving}
										>
											<Trash2 className="size-4" />
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						) : null
					}
				>
					<div className="space-y-5">
						<div className="overflow-hidden rounded-[26px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
							{resource ? <ResourceViewer resource={resource} /> : null}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{resource ? <ResourceCompatibilityBadge resource={resource} /> : null}
							<Badge variant="outline" className="rounded-full capitalize">
								{resource?.mediaKind ?? "asset"}
							</Badge>
							{resource?.parentResourceId ? (
								<Badge variant="outline" className="rounded-full">
									Derivative
								</Badge>
							) : null}
							{resource ? (
								<Badge variant="outline" className="rounded-full">
									{formatResourceMeta(resource)}
								</Badge>
							) : null}
						</div>
					</div>
				</DashboardPanel>

				<DashboardStatStrip
					items={[
						{
							label: "Used in posts",
							value: resource?.usageCount ?? "—",
							detail: "How often this file is already reused.",
						},
						{
							label: "In collections",
							value: resource?.setCount ?? "—",
							detail: "Grouped bundles that include this asset.",
						},
						{
							label: "Variants",
							value: resource?.childCount ?? "—",
							detail: "Derived versions linked to this source.",
						},
						{
							label: "Added",
							value: resource ? new Date(resource.createdAt).toLocaleDateString() : "—",
							detail: "When this asset first entered the workspace.",
						},
					]}
				/>

				<DashboardPanel
					title="Transform in Studio"
					description="Start with a scoped editing job instead of reopening the asset and choosing tools again."
				>
					<div className="grid gap-3 lg:grid-cols-2">
						{resource
							? transformTools.map((tool) =>
									tool.status === "live" ? (
										<Link
											key={tool.value}
											to={buildStudioHref({
												resourceId: resource.id,
												mode: getStudioModeForResource(resource),
												tool: tool.value,
												source: "detail",
											})}
											className="block rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4 transition-colors hover:bg-accent/20"
										>
											<div className="flex items-center justify-between gap-3">
												<div className="font-medium">{tool.label}</div>
												<Sparkles className="size-4 text-primary" />
											</div>
											<div className="mt-2 text-sm text-muted-foreground">
												{tool.description}
											</div>
										</Link>
									) : (
										<div
											key={tool.value}
											className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] bg-background/55 p-4"
										>
											<div className="flex items-center justify-between gap-3">
												<div className="font-medium">{tool.label}</div>
												<Badge variant="outline" className="rounded-full">
													Soon
												</Badge>
											</div>
											<div className="mt-2 text-sm text-muted-foreground">
												{tool.description}
											</div>
										</div>
									),
							  )
							: null}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Compatibility"
					description="Keep publishing constraints available, but tucked behind a calmer default view."
					action={
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => setCompatibilityOpen((current) => !current)}
						>
							{compatibilityOpen ? "Hide details" : "Show details"}
						</Button>
					}
				>
					{resource ? (
						<Collapsible open={compatibilityOpen} onOpenChange={setCompatibilityOpen}>
							<div className="text-sm text-muted-foreground">
								{compatibilitySummary?.detail}
							</div>
							<CollapsibleContent className="mt-4">
								<div className="grid gap-3 md:grid-cols-2">
									{resource.compatibility.map((item) => (
										<CompatibilityRow
											key={`${item.platform}-${item.surface}`}
											item={item}
										/>
									))}
								</div>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<div className="text-sm text-muted-foreground">Loading compatibility…</div>
					)}
				</DashboardPanel>

				<DashboardPanel
					title="Technical details"
					description="Keep the raw ingest facts nearby without making them the first thing owners need to read."
					action={
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => setTechnicalOpen((current) => !current)}
						>
							{technicalOpen ? "Hide details" : "Show details"}
						</Button>
					}
				>
					{resource ? (
						<Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen}>
							<div className="text-sm text-muted-foreground">
								{formatBytes(resource.sizeBytes)} · {resource.mimeType} · uploaded{" "}
								{formatResourceDate(resource.createdAt)}
							</div>
							<CollapsibleContent className="mt-4">
								<div className="grid gap-4 md:grid-cols-2">
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm">
										<div>Original name: {resource.originalName}</div>
										<div className="mt-2 break-all">MIME type: {resource.mimeType}</div>
										<div className="mt-2">Extension: {resource.fileExtension}</div>
										<div className="mt-2 break-all">
											Checksum: {resource.checksumSha256}
										</div>
									</div>
									<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm">
										{resource.widthPx && resource.heightPx ? (
											<div>
												Dimensions: {resource.widthPx} x {resource.heightPx}
											</div>
										) : null}
										{resource.durationMs ? (
											<div className="mt-2">Duration: {resource.durationMs} ms</div>
										) : null}
										{resource.pageCount ? (
											<div className="mt-2">Pages: {resource.pageCount}</div>
										) : null}
										<div className="mt-2">Updated: {formatResourceDate(resource.updatedAt)}</div>
										<div className="mt-2 break-all">ID: {resource.id}</div>
									</div>
								</div>
							</CollapsibleContent>
						</Collapsible>
					) : (
						<div className="text-sm text-muted-foreground">Loading details…</div>
					)}
				</DashboardPanel>
			</AssetWorkspaceShell>
		</div>
	);
}
