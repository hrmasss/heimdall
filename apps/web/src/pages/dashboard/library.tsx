import {
	Download,
	FilePlus2,
	FolderKanban,
	Grid2X2,
	Layers3,
	List,
	RefreshCw,
	Search,
	Trash2,
	TriangleAlert,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import {
	ResourceChipList,
	ResourceThumb,
	formatBytes,
	formatResourceMeta,
} from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type {
	ApiListResponse,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceUploadResponse,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const MAX_CLIENT_UPLOAD_BYTES = 1024 * 1024 * 512;
const documentExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);

type UploadQueueItem = {
	id: string;
	file: File;
	status: "pending" | "uploading" | "done" | "error";
	error?: string;
};

function isSupportedFile(file: File) {
	if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
		return true;
	}
	const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
	return documentExtensions.has(extension);
}

function statusBadge(resource: ResourceRecord) {
	const unsupportedCount = resource.compatibility.filter(
		(item) => item.status === "unsupported",
	).length;
	const warningCount = resource.compatibility.filter(
		(item) => item.status === "warning",
	).length;

	if (unsupportedCount > 0) {
		return (
			<Badge
				variant="outline"
				className="rounded-full border-red-500/25 text-red-600"
			>
				<TriangleAlert className="size-3.5" />
				{unsupportedCount} blockers
			</Badge>
		);
	}
	if (warningCount > 0) {
		return (
			<Badge
				variant="outline"
				className="rounded-full border-amber-500/25 text-amber-600"
			>
				<TriangleAlert className="size-3.5" />
				{warningCount} warnings
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="rounded-full border-emerald-500/25 text-emerald-600"
		>
			Ready
		</Badge>
	);
}

export function DashboardLibrary() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [mediaFilter, setMediaFilter] = useState("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [detail, setDetail] = useState<ResourceRecord | null>(null);
	const [queue, setQueue] = useState<UploadQueueItem[]>([]);
	const [optimizeImages, setOptimizeImages] = useState(true);
	const [uploading, setUploading] = useState(false);

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [resourceResponse, capabilityResponse] = await Promise.all([
				customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
				customerRequest<ResourceCapabilityMatrix>("/resources/capabilities"),
			]);
			setResources(resourceResponse.items);
			setCapabilities(capabilityResponse);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load the library.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const filteredResources = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return resources.filter((resource) => {
			if (mediaFilter !== "all" && resource.mediaKind !== mediaFilter) {
				return false;
			}
			if (!needle) {
				return true;
			}
			return [
				resource.displayName,
				resource.originalName,
				resource.mediaKind,
				resource.mimeType,
			]
				.join(" ")
				.toLowerCase()
				.includes(needle);
		});
	}, [mediaFilter, query, resources]);

	function enqueueFiles(files: FileList | File[]) {
		const nextItems = Array.from(files).map<UploadQueueItem>((file) => {
			let validationError: string | undefined;
			if (!isSupportedFile(file)) {
				validationError =
					"Unsupported file type for the shared resource library.";
			} else if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
				validationError = "File exceeds the current 512 MB upload limit.";
			}
			return {
				id: `${file.name}-${file.lastModified}-${file.size}`,
				file,
				status: validationError ? "error" : "pending",
				error: validationError,
			};
		});
		setQueue((current) => [...current, ...nextItems]);
	}

	async function uploadQueue() {
		if (queue.every((item) => item.status !== "pending")) {
			return;
		}
		setUploading(true);
		setError(null);
		for (const item of queue) {
			if (item.status !== "pending") {
				continue;
			}
			setQueue((current) =>
				current.map((entry) =>
					entry.id === item.id ? { ...entry, status: "uploading" } : entry,
				),
			);
			try {
				const formData = new FormData();
				formData.append("file", item.file);
				formData.append("sourceType", "upload");
				if (item.file.type.startsWith("image/")) {
					formData.append("optimize", String(optimizeImages));
				}
				const response = await customerRequest<ResourceUploadResponse>(
					"/resources",
					{
						method: "POST",
						body: formData,
					},
				);
				setResources((current) => [response.resource, ...current]);
				setQueue((current) =>
					current.map((entry) =>
						entry.id === item.id ? { ...entry, status: "done" } : entry,
					),
				);
			} catch (uploadError) {
				setQueue((current) =>
					current.map((entry) =>
						entry.id === item.id
							? {
									...entry,
									status: "error",
									error:
										uploadError instanceof Error
											? uploadError.message
											: "Upload failed.",
								}
							: entry,
					),
				);
			}
		}
		setUploading(false);
	}

	async function removeResource(resourceId: string) {
		try {
			await customerRequest(`/resources/${resourceId}`, { method: "DELETE" });
			setResources((current) =>
				current.filter((item) => item.id !== resourceId),
			);
			if (detail?.id === resourceId) {
				setDetail(null);
			}
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete the resource.",
			);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace resources"
				title="Library"
				description="Upload, inspect, and reuse workspace-scoped media with storage-aware optimization and surface compatibility checks."
				actions={
					<>
						<Button
							variant="outline"
							className="rounded-full"
							onClick={() => void loadData()}
						>
							<RefreshCw className="size-4" />
							Refresh
						</Button>
						<Button
							className="rounded-full bg-gradient-brand text-white border-0"
							onClick={() => fileInputRef.current?.click()}
						>
							<FilePlus2 className="size-4" />
							Add resources
						</Button>
					</>
				}
			/>

			<input
				ref={fileInputRef}
				type="file"
				multiple
				className="hidden"
				onChange={(event) => {
					if (event.target.files) {
						enqueueFiles(event.target.files);
						event.target.value = "";
					}
				}}
			/>

			<DashboardPanel
				title="Upload queue"
				description="Drop images, videos, and documents here. Image optimization is on by default to reduce storage usage."
				action={
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Switch
								checked={optimizeImages}
								onCheckedChange={(checked) =>
									setOptimizeImages(Boolean(checked))
								}
							/>
							Optimize images
						</div>
						<Button
							className="rounded-full bg-gradient-brand text-white border-0"
							disabled={
								uploading || queue.every((item) => item.status !== "pending")
							}
							onClick={() => void uploadQueue()}
						>
							<Upload className="size-4" />
							Upload queue
						</Button>
					</div>
				}
			>
				<div
					className="rounded-[28px] border border-dashed border-[var(--brand-border-soft)] bg-[linear-gradient(145deg,var(--brand-highlight),transparent)] px-6 py-10 text-center"
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						if (event.dataTransfer.files?.length) {
							enqueueFiles(event.dataTransfer.files);
						}
					}}
				>
					<div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-background/90 text-primary shadow-sm">
						<FolderKanban className="size-6" />
					</div>
					<div className="mt-4 text-lg font-medium">
						Drop files into the shared library
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Atomic resources only: images, videos, and documents. Carousels and
						reels are composed later from these reusable building blocks.
					</p>
				</div>
				<div className="mt-4 space-y-3">
					{queue.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No files queued yet.
						</div>
					) : (
						queue.map((item) => (
							<div
								key={item.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3"
							>
								<div>
									<div className="font-medium">{item.file.name}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{formatBytes(item.file.size)}
										{item.file.type.startsWith("image/")
											? ` · optimization ${optimizeImages ? "on" : "off"}`
											: ""}
									</div>
									{item.error ? (
										<div className="mt-1 text-sm text-red-600">
											{item.error}
										</div>
									) : null}
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className={cn(
											"rounded-full capitalize",
											item.status === "done" &&
												"border-emerald-500/25 text-emerald-600",
											item.status === "uploading" &&
												"border-primary/25 text-primary",
											item.status === "error" &&
												"border-red-500/25 text-red-600",
										)}
									>
										{item.status}
									</Badge>
									<Button
										variant="ghost"
										size="sm"
										className="rounded-full"
										onClick={() =>
											setQueue((current) =>
												current.filter((entry) => entry.id !== item.id),
											)
										}
									>
										Remove
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Browse resources"
				description={`Tracking ${capabilities?.rules.length ?? 0} platform-surface rules from the backend capability matrix.`}
				action={
					<div className="flex flex-wrap items-center gap-2">
						<div className="relative w-full sm:w-72">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="rounded-full pl-10"
								placeholder="Search library"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</div>
						<NativeSelect
							value={mediaFilter}
							onChange={(event) => setMediaFilter(event.target.value)}
							className="min-w-36"
						>
							<NativeSelectOption value="all">All media</NativeSelectOption>
							<NativeSelectOption value="image">Images</NativeSelectOption>
							<NativeSelectOption value="video">Videos</NativeSelectOption>
							<NativeSelectOption value="document">
								Documents
							</NativeSelectOption>
						</NativeSelect>
						<div className="flex rounded-full border border-[var(--brand-border-soft)] bg-background/70 p-1">
							<Button
								variant={viewMode === "grid" ? "default" : "ghost"}
								size="icon-sm"
								className="rounded-full"
								onClick={() => setViewMode("grid")}
							>
								<Grid2X2 className="size-4" />
							</Button>
							<Button
								variant={viewMode === "list" ? "default" : "ghost"}
								size="icon-sm"
								className="rounded-full"
								onClick={() => setViewMode("list")}
							>
								<List className="size-4" />
							</Button>
						</div>
					</div>
				}
			>
				{error ? (
					<div className="mb-4 rounded-[22px] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-600">
						{error}
					</div>
				) : null}
				{loading ? (
					<div className="text-sm text-muted-foreground">
						Loading resources...
					</div>
				) : filteredResources.length === 0 ? (
					<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
						No resources match the current view.
					</div>
				) : viewMode === "grid" ? (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{filteredResources.map((resource) => (
							<SurfaceCard key={resource.id} className="overflow-hidden">
								<button
									type="button"
									className="block w-full text-left"
									onClick={() => setDetail(resource)}
								>
									<div className="aspect-[16/10] overflow-hidden bg-muted">
										<ResourceThumb resource={resource} />
									</div>
									<div className="space-y-4 p-5">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<div className="truncate text-lg font-medium">
													{resource.displayName}
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													{formatResourceMeta(resource)}
												</div>
											</div>
											{statusBadge(resource)}
										</div>
										<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
											<Badge
												variant="outline"
												className="rounded-full capitalize"
											>
												{resource.mediaKind}
											</Badge>
											<Badge variant="outline" className="rounded-full">
												{resource.usageCount} uses
											</Badge>
											{resource.parentResourceId ? (
												<Badge variant="outline" className="rounded-full">
													Variant
												</Badge>
											) : null}
											{resource.childCount > 0 ? (
												<Badge variant="outline" className="rounded-full">
													{resource.childCount} variants
												</Badge>
											) : null}
										</div>
									</div>
								</button>
								<div className="flex items-center justify-between border-t border-[var(--brand-border-soft)] px-5 py-4">
									<a
										href={resource.downloadUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
									>
										<Download className="size-4" />
										Open
									</a>
									<Button
										variant="ghost"
										size="sm"
										className="rounded-full text-red-600"
										onClick={() => void removeResource(resource.id)}
									>
										<Trash2 className="size-4" />
										Delete
									</Button>
								</div>
							</SurfaceCard>
						))}
					</div>
				) : (
					<div className="space-y-3">
						{filteredResources.map((resource) => (
							<button
								key={resource.id}
								type="button"
								onClick={() => setDetail(resource)}
								className="flex w-full items-center gap-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-4 text-left transition-colors hover:bg-accent/30"
							>
								<div className="size-18 overflow-hidden rounded-[18px] bg-muted">
									<ResourceThumb resource={resource} />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-medium">{resource.displayName}</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{formatResourceMeta(resource)}
											</div>
										</div>
										{statusBadge(resource)}
									</div>
									<div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
										<span>{resource.mimeType}</span>
										<span>{resource.usageCount} uses</span>
										{resource.parentResourceId ? (
											<span>Derived variant</span>
										) : null}
										{resource.childCount > 0 ? (
											<span>{resource.childCount} downstream variants</span>
										) : null}
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									className="rounded-full text-red-600"
									onClick={(event) => {
										event.stopPropagation();
										void removeResource(resource.id);
									}}
								>
									<Trash2 className="size-4" />
									Delete
								</Button>
							</button>
						))}
					</div>
				)}
			</DashboardPanel>

			<SurfaceCard tone="muted" className="space-y-4 p-5">
				<div className="flex items-start gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Layers3 className="size-5" />
					</div>
					<div>
						<div className="font-medium">Current reuse state</div>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Reusable resources stay separate from posts. When future entity
							links swap or disappear, the backend can clean up orphaned blobs
							safely through the resource reference lifecycle.
						</p>
					</div>
				</div>
				<ResourceChipList resources={resources.slice(0, 3)} />
			</SurfaceCard>

			<Dialog
				open={Boolean(detail)}
				onOpenChange={(open) => !open && setDetail(null)}
			>
				<DialogContent className="max-w-4xl">
					{detail ? (
						<div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
							<div className="overflow-hidden rounded-[28px] border border-[var(--brand-border-soft)] bg-muted">
								<div className="aspect-[16/10]">
									<ResourceThumb resource={detail} />
								</div>
							</div>
							<div className="space-y-5">
								<DialogHeader className="space-y-2 text-left">
									<DialogTitle>{detail.displayName}</DialogTitle>
									<DialogDescription>
										Inspect metadata, lineage, and downstream platform
										compatibility before reusing this resource.
									</DialogDescription>
								</DialogHeader>
								<div className="grid gap-3 sm:grid-cols-2">
									<SurfaceCard tone="muted" className="p-4">
										<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
											Storage
										</div>
										<div className="mt-2 font-medium">
											{formatBytes(detail.sizeBytes)}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{detail.storageBackend} ·{" "}
											{detail.optimized ? "optimized" : "original"}
										</div>
									</SurfaceCard>
									<SurfaceCard tone="muted" className="p-4">
										<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
											Reuse
										</div>
										<div className="mt-2 font-medium">
											{detail.usageCount} references
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{detail.childCount} derived variants
										</div>
									</SurfaceCard>
								</div>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
									<div className="font-medium">Metadata</div>
									<div className="mt-3 grid gap-2 text-sm text-muted-foreground">
										<div>MIME type: {detail.mimeType}</div>
										<div>Original name: {detail.originalName}</div>
										<div>Checksum: {detail.checksumSha256.slice(0, 16)}...</div>
										{detail.widthPx && detail.heightPx ? (
											<div>
												Dimensions: {detail.widthPx} x {detail.heightPx}
											</div>
										) : null}
										{detail.pageCount ? (
											<div>Pages: {detail.pageCount}</div>
										) : null}
										<div>
											Lineage:{" "}
											{detail.parentResourceId
												? "Derived variant"
												: "Original root"}
										</div>
									</div>
								</div>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
									<div className="font-medium">Compatibility matrix</div>
									<div className="mt-3 grid gap-2">
										{detail.compatibility.slice(0, 8).map((item) => (
											<div
												key={`${item.platform}-${item.surface}`}
												className="rounded-[18px] border border-[var(--brand-border-soft)] px-3 py-2"
											>
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
															item.status === "warning" &&
																"border-amber-500/25 text-amber-600",
															item.status === "unsupported" &&
																"border-red-500/25 text-red-600",
														)}
													>
														{item.status}
													</Badge>
												</div>
												<div className="mt-1 text-xs text-muted-foreground">
													{item.reasons[0]}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
