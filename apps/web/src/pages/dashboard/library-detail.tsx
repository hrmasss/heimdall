import {
	ArrowLeft,
	ArrowUpRight,
	Copy,
	Info,
	PencilLine,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import {
	ResourceCompatibilityBadge,
	ResourceThumb,
	formatBytes,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResourceCompatibility, ResourceDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function formatResourceDate(value: string) {
	return new Date(value).toLocaleString();
}

function CompatibilityRow({
	item,
}: {
	item: ResourceCompatibility;
}) {
	return (
		<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="text-sm font-medium capitalize">
					{item.platform.replace("_", " ")} ·{" "}
					{item.surface.replaceAll("_", " ")}
				</div>
				<Badge
					variant="outline"
					className={cn(
						"rounded-full capitalize",
						item.status === "supported" &&
							"border-emerald-500/25 text-emerald-600",
						item.status === "warning" && "border-amber-500/25 text-amber-600",
						item.status === "unsupported" && "border-red-500/25 text-red-600",
					)}
				>
					{item.status}
				</Badge>
			</div>
			<div className="mt-2 text-sm text-muted-foreground">
				{item.reasons[0]}
			</div>
		</div>
	);
}

export function DashboardLibraryDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resource, setResource] = useState<ResourceDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const loadResource = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		setNotice(null);
		try {
			const response = await customerRequest<ResourceDetail>(
				`/resources/${id}`,
			);
			setResource(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this resource.",
			);
		} finally {
			setLoading(false);
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
		setNotice(null);
		try {
			await customerRequest(`/resources/${resource.id}`, { method: "DELETE" });
			navigate("/dashboard/library");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this resource.",
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

	const overviewStats = useMemo(() => {
		if (!resource) {
			return [];
		}
		return [
			{
				label: "Media type",
				value: resource.mediaKind,
				detail: resource.mimeType,
			},
			{
				label: "Storage",
				value: formatBytes(resource.sizeBytes),
				detail: `${resource.storageBackend} · ${resource.optimized ? "optimized" : "standard"}`,
			},
			{
				label: "Reuse",
				value: `${resource.usageCount} uses`,
				detail: `${resource.childCount} variants`,
			},
		];
	}, [resource]);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace resources"
				title={resource?.displayName ?? "Resource detail"}
				description={
					resource
						? "Inspect the reusable asset, verify downstream compatibility, and manage the shared workspace media entry from a dedicated page."
						: "Inspect resource metadata and reuse state."
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
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={`/dashboard/library/${resource.id}/edit`}>
									<PencilLine className="size-4" />
									Edit resource
								</Link>
							</Button>
						) : null}
						{resource ? (
							<Button variant="outline" className="rounded-full" asChild>
								<a href={resource.downloadUrl} target="_blank" rel="noreferrer">
									<ArrowUpRight className="size-4" />
									Open original
								</a>
							</Button>
						) : null}
						{resource ? (
							<Button
								variant="outline"
								className="rounded-full text-red-600"
								onClick={() => void deleteResource()}
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
			{notice ? (
				<SurfaceCard className="border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
					{notice}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
				<div className="space-y-6">
					<SurfaceCard className="overflow-hidden p-0">
						<div className="aspect-[16/10] bg-muted">
							{resource ? <ResourceThumb resource={resource} /> : null}
						</div>
						<div className="border-t border-[var(--brand-border-soft)] p-5">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										{resource ? (
											<ResourceCompatibilityBadge resource={resource} />
										) : null}
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{resource?.mediaKind ?? "resource"}
										</Badge>
										{resource?.parentResourceId ? (
											<Badge variant="outline" className="rounded-full">
												Variant
											</Badge>
										) : null}
									</div>
									<div className="text-sm text-muted-foreground">
										{resource ? formatResourceMeta(resource) : null}
									</div>
								</div>
								{resource ? (
									<div className="flex flex-wrap gap-2">
										<Button
											variant="ghost"
											size="sm"
											className="rounded-full"
											onClick={() => void copyValue(resource.id, "Resource ID")}
										>
											<Copy className="size-4" />
											Copy ID
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="rounded-full"
											onClick={() =>
												void copyValue(resource.downloadUrl, "Signed URL")
											}
										>
											<Copy className="size-4" />
											Copy URL
										</Button>
									</div>
								) : null}
							</div>
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5 md:p-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight">Metadata</h2>
							<p className="text-sm text-muted-foreground">
								Immutable file attributes and storage information recorded
								during ingestion.
							</p>
						</div>
						{loading || !resource ? (
							<div className="mt-5 text-sm text-muted-foreground">
								Loading metadata...
							</div>
						) : (
							<div className="mt-5 grid gap-4 md:grid-cols-2">
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										File identity
									</div>
									<div className="mt-3 space-y-2 text-sm">
										<div>Original name: {resource.originalName}</div>
										<div>MIME type: {resource.mimeType}</div>
										<div>Extension: {resource.fileExtension}</div>
										<div>
											Checksum: {resource.checksumSha256.slice(0, 18)}...
										</div>
									</div>
								</div>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Media facts
									</div>
									<div className="mt-3 space-y-2 text-sm">
										{resource.widthPx && resource.heightPx ? (
											<div>
												Dimensions: {resource.widthPx} x {resource.heightPx}
											</div>
										) : null}
										{resource.durationMs ? (
											<div>
												Duration: {Math.round(resource.durationMs / 1000)}s
											</div>
										) : null}
										{resource.pageCount ? (
											<div>Pages: {resource.pageCount}</div>
										) : null}
										<div>
											Uploaded: {formatResourceDate(resource.createdAt)}
										</div>
										<div>Updated: {formatResourceDate(resource.updatedAt)}</div>
									</div>
								</div>
							</div>
						)}
					</SurfaceCard>

					<SurfaceCard className="p-5 md:p-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight">
								Compatibility matrix
							</h2>
							<p className="text-sm text-muted-foreground">
								Server-side platform surface checks derived from the capability
								registry.
							</p>
						</div>
						{loading || !resource ? (
							<div className="mt-5 text-sm text-muted-foreground">
								Loading compatibility rules...
							</div>
						) : (
							<div className="mt-5 grid gap-3 md:grid-cols-2">
								{resource.compatibility.map((item) => (
									<CompatibilityRow
										key={`${item.platform}-${item.surface}`}
										item={item}
									/>
								))}
							</div>
						)}
					</SurfaceCard>
				</div>

				<div className="space-y-6">
					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div>
								<div className="text-lg font-semibold">Overview</div>
								<div className="mt-1 text-sm text-muted-foreground">
									Reuse and lineage signals for this shared library entry.
								</div>
							</div>
							{loading || !resource ? (
								<div className="text-sm text-muted-foreground">
									Loading overview...
								</div>
							) : (
								<div className="space-y-3">
									{overviewStats.map((stat, index) => (
										<div
											key={`${stat.label}-${index}`}
											className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
										>
											<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
												{stat.label}
											</div>
											<div className="mt-2 text-xl font-semibold capitalize">
												{stat.value}
											</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{stat.detail}
											</div>
										</div>
									))}
									<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
										<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
											Lineage
										</div>
										<div className="mt-2 text-sm font-medium">
											{resource.parentResourceId
												? "Derived variant"
												: "Original library root"}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{resource.parentResourceId
												? `Parent resource: ${resource.parentResourceId}`
												: "This file can serve as the parent for future crop, aspect-ratio, or branded variants."}
										</div>
									</div>
								</div>
							)}
						</div>
					</SurfaceCard>

					<SurfaceCard className="p-5">
						<div className="space-y-4">
							<div className="flex items-center gap-2">
								<Info className="size-4 text-primary" />
								<div className="text-lg font-semibold">Derived variants</div>
							</div>
							<div className="text-sm text-muted-foreground">
								Future crop, expansion, and branding outputs live as independent
								child resources.
							</div>
							{loading || !resource ? (
								<div className="text-sm text-muted-foreground">
									Loading variants...
								</div>
							) : resource.variants.length ? (
								<div className="space-y-3">
									{resource.variants.map((variant) => (
										<button
											key={variant.id}
											type="button"
											onClick={() =>
												navigate(`/dashboard/library/${variant.id}`)
											}
											className="flex w-full items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-3 text-left transition-colors hover:bg-accent/20"
										>
											<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
												<ResourceThumb resource={variant} />
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate font-medium">
													{variant.displayName}
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													{formatResourceMeta(variant)}
												</div>
											</div>
										</button>
									))}
								</div>
							) : (
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
									No child variants exist yet.
								</div>
							)}
						</div>
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
