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

import { SurfaceCard, StatChip } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
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
	CollapsibleTrigger,
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
			label: "Needs fixes before broad publishing",
			detail: `${unsupportedCount} blocked surface${unsupportedCount === 1 ? "" : "s"}`,
		};
	}
	if (warningCount > 0) {
		return {
			label: "Mostly ready with a few cautions",
			detail: `${warningCount} warning surface${warningCount === 1 ? "" : "s"}`,
		};
	}
	return {
		label: "Ready for most publishing flows",
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
		} finally {
			// Resource nullability now drives the loading surface.
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
				eyebrow="Reusable assets"
				title={resource?.displayName ?? "Asset detail"}
				description={
					resource
						? "Preview the asset, understand how it is reused, and launch the next action without digging through storage detail first."
						: "Preview this asset and keep it ready for posts, collections, and Studio."
				}
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/library">
								<ArrowLeft className="size-4" />
								Back to library
							</Link>
						</Button>
						{resource ? (
							<Button className="rounded-full border-0 bg-gradient-brand text-white" asChild>
								<Link to={`/dashboard/posts/new?resourceId=${resource.id}`}>
									Use in post
								</Link>
							</Button>
						) : null}
						{resource ? (
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={studioHref}>
									<Sparkles className="size-4" />
									Open in Studio
								</Link>
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
			{notice ? (
				<SurfaceCard className="border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
					{notice}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
				<div className="space-y-6">
					<SurfaceCard className="overflow-hidden p-0">
						<div className="p-5">{resource ? <ResourceViewer resource={resource} /> : null}</div>
						<div className="border-t border-[var(--brand-border-soft)] p-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="space-y-2">
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
									</div>
									<div className="text-sm text-muted-foreground">
										{resource ? formatResourceMeta(resource) : "Loading..."}
									</div>
								</div>
								{resource ? (
									<div className="flex flex-wrap items-center gap-2">
										<Button variant="outline" size="sm" className="rounded-full" asChild>
											<a href={resource.downloadUrl} target="_blank" rel="noreferrer">
												<Download className="size-4" />
												Download original
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
												<Button variant="ghost" size="icon-sm" className="rounded-full">
													<MoreHorizontal className="size-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end" className="w-52 rounded-[20px] p-2">
												<DropdownMenuItem onClick={() => void copyValue(resource.id, "Asset ID")}>
													<Copy className="size-4" />
													Copy ID
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														void copyValue(resource.downloadUrl, "Signed URL")
													}
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
								) : null}
							</div>
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5 md:p-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight">
								Publishing compatibility
							</h2>
							<p className="text-sm text-muted-foreground">
								Available when you need it, but no longer the first thing on the page.
							</p>
						</div>
						{resource ? (
							<div className="mt-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="font-medium">{compatibilitySummary?.label}</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{compatibilitySummary?.detail}
										</div>
									</div>
									<Collapsible
										open={compatibilityOpen}
										onOpenChange={setCompatibilityOpen}
									>
										<CollapsibleTrigger asChild>
											<Button variant="outline" size="sm" className="rounded-full">
												{compatibilityOpen ? "Hide details" : "Show details"}
											</Button>
										</CollapsibleTrigger>
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
								</div>
							</div>
						) : (
							<div className="mt-4 text-sm text-muted-foreground">
								Loading compatibility...
							</div>
						)}
					</SurfaceCard>

					<SurfaceCard className="p-5 md:p-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight">Technical details</h2>
							<p className="text-sm text-muted-foreground">
								Storage and ingestion facts stay available without crowding the main path.
							</p>
						</div>
						{resource ? (
							<div className="mt-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
								<Collapsible open={technicalOpen} onOpenChange={setTechnicalOpen}>
									<div className="flex items-center justify-between gap-3">
										<div className="text-sm text-muted-foreground">
											{formatBytes(resource.sizeBytes)} · {resource.mimeType} · uploaded{" "}
											{formatResourceDate(resource.createdAt)}
										</div>
										<CollapsibleTrigger asChild>
											<Button variant="outline" size="sm" className="rounded-full">
												{technicalOpen ? "Hide details" : "Show details"}
											</Button>
										</CollapsibleTrigger>
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
													<div className="mt-2">
														Duration: {Math.round(resource.durationMs / 1000)}s
													</div>
												) : null}
												{resource.pageCount ? (
													<div className="mt-2">Pages: {resource.pageCount}</div>
												) : null}
												<div className="mt-2">Storage backend: {resource.storageBackend}</div>
												<div className="mt-2">
													Last updated: {formatResourceDate(resource.updatedAt)}
												</div>
											</div>
										</div>
									</CollapsibleContent>
								</Collapsible>
							</div>
						) : null}
					</SurfaceCard>
				</div>

				<div className="space-y-6 xl:sticky xl:top-[var(--density-dashboard-sticky-top)] xl:self-start">
					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div>
								<div className="text-lg font-semibold">Reuse</div>
								<div className="mt-1 text-sm text-muted-foreground">
									How this asset is already working inside the workspace.
								</div>
							</div>
							{resource ? (
								<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
									<StatChip label="Used in posts" value={String(resource.usageCount)} />
									<StatChip label="In collections" value={String(resource.setCount)} />
									<StatChip label="Variants" value={String(resource.childCount)} />
								</div>
							) : (
								<div className="text-sm text-muted-foreground">Loading reuse…</div>
							)}
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div>
								<div className="text-lg font-semibold">Transform</div>
								<div className="mt-1 text-sm text-muted-foreground">
									Launch the next prep task without starting from a blank studio.
								</div>
							</div>
							<div className="space-y-3">
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
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div className="text-lg font-semibold">Derivatives</div>
							<div className="text-sm text-muted-foreground">
								Child variants stay linked here so alternate crops and outputs remain easy to reuse.
							</div>
							{resource?.variants.length ? (
								<div className="space-y-3">
									{resource.variants.map((variant) => (
										<Link
											key={variant.id}
											to={`/dashboard/library/${variant.id}`}
											className="flex items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-3 transition-colors hover:bg-accent/20"
										>
											<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
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
								<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
									No derivatives yet. Use Studio to create the first reusable variant.
								</div>
							)}
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div className="text-lg font-semibold">Collections</div>
							<div className="text-sm text-muted-foreground">
								Ordered bundles that already include this asset.
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
								<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
									This asset is not part of a collection yet.
								</div>
							)}
						</div>
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
