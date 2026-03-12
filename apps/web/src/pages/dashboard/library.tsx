import {
	FilePlus2,
	FolderKanban,
	PencilLine,
	RefreshCw,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import {
	LocalFileThumb,
	ResourceChipList,
	ResourceCompatibilityBadge,
	ResourceKindIcon,
	ResourceThumb,
	formatBytes,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
	previewUrl: string;
	status: "pending" | "uploading" | "done" | "error";
	error?: string;
	uploadedResourceId?: string;
};

function getFileExtension(name: string) {
	return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function isSupportedFile(file: File) {
	if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
		return true;
	}
	return documentExtensions.has(getFileExtension(file.name));
}

function getResourceHealth(resource: ResourceRecord) {
	const unsupportedCount = resource.compatibility.filter(
		(item) => item.status === "unsupported",
	).length;
	if (unsupportedCount > 0) {
		return "blocked";
	}
	const warningCount = resource.compatibility.filter(
		(item) => item.status === "warning",
	).length;
	return warningCount > 0 ? "warning" : "ready";
}

function QueueStatusBadge({ item }: { item: UploadQueueItem }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"rounded-full capitalize",
				item.status === "done" && "border-emerald-500/25 text-emerald-600",
				item.status === "uploading" && "border-primary/25 text-primary",
				item.status === "error" && "border-red-500/25 text-red-600",
			)}
		>
			{item.status}
		</Badge>
	);
}

export function DashboardLibrary() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const queueRef = useRef<UploadQueueItem[]>([]);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [queue, setQueue] = useState<UploadQueueItem[]>([]);
	const [optimizeImages, setOptimizeImages] = useState(true);
	const [uploading, setUploading] = useState(false);

	const releasePreview = useCallback((previewUrl: string) => {
		URL.revokeObjectURL(previewUrl);
	}, []);

	useEffect(() => {
		queueRef.current = queue;
	}, [queue]);

	useEffect(() => {
		return () => {
			for (const item of queueRef.current) {
				releasePreview(item.previewUrl);
			}
		};
	}, [releasePreview]);

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
					: "Unable to load the resource library.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	function updateQueueItem(
		id: string,
		updater: (item: UploadQueueItem) => UploadQueueItem,
	) {
		setQueue((current) =>
			current.map((item) => (item.id === id ? updater(item) : item)),
		);
	}

	function removeQueueItem(itemId: string) {
		setQueue((current) => {
			const target = current.find((item) => item.id === itemId);
			if (target) {
				releasePreview(target.previewUrl);
			}
			return current.filter((item) => item.id !== itemId);
		});
	}

	function clearCompletedQueue() {
		setQueue((current) => {
			for (const item of current) {
				if (item.status !== "uploading") {
					releasePreview(item.previewUrl);
				}
			}
			return current.filter((item) => item.status === "uploading");
		});
	}

	function enqueueFiles(files: FileList | File[]) {
		setNotice(null);
		const nextItems = Array.from(files).map<UploadQueueItem>((file) => {
			let validationError: string | undefined;
			if (!isSupportedFile(file)) {
				validationError =
					"Unsupported file type for the shared resource library.";
			} else if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
				validationError = "File exceeds the current 512 MB upload limit.";
			}
			return {
				id:
					typeof crypto !== "undefined" && "randomUUID" in crypto
						? crypto.randomUUID()
						: `${file.name}-${file.lastModified}-${file.size}`,
				file,
				previewUrl: URL.createObjectURL(file),
				status: validationError ? "error" : "pending",
				error: validationError,
			};
		});
		setQueue((current) => [...nextItems, ...current]);
	}

	async function uploadQueue() {
		const pendingItems = queue.filter((item) => item.status === "pending");
		if (pendingItems.length === 0) {
			return;
		}

		setUploading(true);
		setError(null);
		setNotice(null);
		for (const item of pendingItems) {
			updateQueueItem(item.id, (entry) => ({
				...entry,
				status: "uploading",
				error: undefined,
			}));

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
				setResources((current) => [
					response.resource,
					...current.filter((resource) => resource.id !== response.resource.id),
				]);
				updateQueueItem(item.id, (entry) => ({
					...entry,
					status: "done",
					uploadedResourceId: response.resource.id,
				}));
			} catch (uploadError) {
				const message =
					uploadError instanceof Error ? uploadError.message : "Upload failed.";
				updateQueueItem(item.id, (entry) => ({
					...entry,
					status: "error",
					error: message,
				}));
				setError(message);
			}
		}
		setUploading(false);
		setNotice("Upload queue processed.");
	}

	const removeResource = useCallback(
		async (resourceId: string) => {
			setError(null);
			setNotice(null);
			try {
				await customerRequest(`/resources/${resourceId}`, { method: "DELETE" });
				setResources((current) =>
					current.filter((resource) => resource.id !== resourceId),
				);
				setNotice("Resource deleted.");
			} catch (deleteError) {
				setError(
					deleteError instanceof Error
						? deleteError.message
						: "Unable to delete the resource.",
				);
			}
		},
		[customerRequest],
	);

	const columns: DataTableColumn<ResourceRecord>[] = useMemo(
		() => [
			{
				id: "resource",
				label: "Resource",
				width: 320,
				accessor: (resource) => (
					<div className="flex items-center gap-3">
						<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
							<ResourceThumb resource={resource} variant="compact" />
						</div>
						<div className="min-w-0">
							<div className="truncate font-medium">{resource.displayName}</div>
							<div className="truncate text-sm text-muted-foreground">
								{resource.originalName}
							</div>
						</div>
					</div>
				),
				getSortValue: (resource) => resource.displayName,
			},
			{
				id: "format",
				label: "Format",
				width: 220,
				accessor: (resource) => (
					<div className="space-y-1">
						<div className="inline-flex items-center gap-2 capitalize">
							<ResourceKindIcon mediaKind={resource.mediaKind} />
							{resource.mediaKind}
						</div>
						<div className="text-sm text-muted-foreground">
							{formatResourceMeta(resource)}
						</div>
					</div>
				),
				getSortValue: (resource) => resource.mediaKind,
			},
			{
				id: "compatibility",
				label: "Compatibility",
				width: 180,
				accessor: (resource) => (
					<ResourceCompatibilityBadge resource={resource} />
				),
				getSortValue: (resource) => getResourceHealth(resource),
			},
			{
				id: "reuse",
				label: "Reuse",
				width: 220,
				accessor: (resource) => (
					<div className="space-y-1 text-sm">
						<div>{resource.usageCount} references</div>
						<div className="text-muted-foreground">
							{resource.parentResourceId
								? "Derived variant"
								: `${resource.childCount} child variants`}
						</div>
					</div>
				),
				getSortValue: (resource) => resource.usageCount,
			},
			{
				id: "updated",
				label: "Updated",
				width: 170,
				accessor: (resource) =>
					new Date(resource.updatedAt).toLocaleDateString(),
				getSortValue: (resource) => new Date(resource.updatedAt).getTime(),
			},
			{
				id: "actions",
				label: "Manage",
				width: 280,
				className: "text-right",
				headerClassName: "text-right",
				accessor: (resource) => (
					<div className="flex items-center justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={(event) => {
								event.stopPropagation();
								navigate(`/dashboard/library/${resource.id}`);
							}}
						>
							Open
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={(event) => {
								event.stopPropagation();
								navigate(`/dashboard/library/${resource.id}/edit`);
							}}
						>
							<PencilLine className="size-4" />
							Edit
						</Button>
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
					</div>
				),
			},
		],
		[navigate, removeResource],
	);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Workspace resources"
				title="Library"
				description="Upload, preview, inspect, and reuse workspace-scoped media from a dedicated shared library before composing platform-specific posts."
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
							className="rounded-full border-0 bg-gradient-brand text-white"
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
				description="Preview files before they enter the workspace library. Image optimization stays enabled by default to reduce storage usage."
				action={
					<div className="flex flex-wrap items-center gap-3">
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
							variant="outline"
							className="rounded-full"
							onClick={clearCompletedQueue}
							disabled={queue.length === 0}
						>
							Clear queue
						</Button>
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
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
						Images, videos, and documents become reusable workspace resources.
						Composed surfaces like carousels and reels are assembled later.
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
								className="flex flex-wrap items-center gap-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-4"
							>
								<div className="h-24 w-28 overflow-hidden rounded-[18px] bg-muted">
									<LocalFileThumb
										file={item.file}
										previewUrl={item.previewUrl}
									/>
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium">{item.file.name}</div>
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
									{item.status === "done" && item.uploadedResourceId ? (
										<button
											type="button"
											className="mt-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
											onClick={() =>
												navigate(
													`/dashboard/library/${item.uploadedResourceId}`,
												)
											}
										>
											Open resource detail
										</button>
									) : null}
								</div>
								<div className="ml-auto flex items-center gap-2">
									<QueueStatusBadge item={item} />
									{item.status === "error" ? (
										<Button
											variant="outline"
											size="sm"
											className="rounded-full"
											onClick={() =>
												updateQueueItem(item.id, (entry) => ({
													...entry,
													status: "pending",
													error: undefined,
												}))
											}
										>
											Retry
										</Button>
									) : null}
									<Button
										variant="ghost"
										size="sm"
										className="rounded-full"
										onClick={() => removeQueueItem(item.id)}
									>
										Remove
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</DashboardPanel>

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

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Workspace asset library"
					description={`Tracking ${capabilities?.rules.length ?? 0} backend-owned platform surface rules. Grid view is the default because previews matter here.`}
					rows={resources}
					columns={columns}
					getRowId={(resource) => resource.id}
					getSearchText={(resource) =>
						[
							resource.displayName,
							resource.originalName,
							resource.mediaKind,
							resource.mimeType,
							getResourceHealth(resource),
						].join(" ")
					}
					filters={[
						{
							id: "media",
							label: "Media",
							options: [
								{ label: "Images", value: "image" },
								{ label: "Videos", value: "video" },
								{ label: "Documents", value: "document" },
							],
							getValue: (resource) => resource.mediaKind,
						},
						{
							id: "health",
							label: "Readiness",
							options: [
								{ label: "Ready", value: "ready" },
								{ label: "Warnings", value: "warning" },
								{ label: "Blocked", value: "blocked" },
							],
							getValue: (resource) => getResourceHealth(resource),
						},
					]}
					loading={loading}
					error={null}
					initialView="grid"
					pageSizeOptions={[6, 12, 24]}
					searchPlaceholder="Search resources, filenames, media types, or MIME types..."
					emptyState={{
						title: "No resources found",
						description:
							"Upload your first image, video, or document to start building the shared workspace media library.",
						actionLabel: "Add resources",
						onAction: () => fileInputRef.current?.click(),
					}}
					onRowClick={(resource) =>
						navigate(`/dashboard/library/${resource.id}`)
					}
					renderGridCard={(resource) => (
						<>
							<div className="aspect-[16/10] overflow-hidden bg-muted">
								<ResourceThumb resource={resource} variant="minimal" />
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
									<ResourceCompatibilityBadge resource={resource} />
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="rounded-full capitalize">
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
								<div className="flex flex-wrap gap-2 border-t border-[var(--brand-border-soft)] pt-4">
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										onClick={(event) => {
											event.stopPropagation();
											navigate(`/dashboard/library/${resource.id}`);
										}}
									>
										Open
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										onClick={(event) => {
											event.stopPropagation();
											navigate(`/dashboard/library/${resource.id}/edit`);
										}}
									>
										<PencilLine className="size-4" />
										Edit
									</Button>
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
								</div>
							</div>
						</>
					)}
					gridClassName="xl:grid-cols-3"
					gridCardClassName="overflow-hidden p-0"
				/>
			</SurfaceCard>

			<SurfaceCard tone="muted" className="space-y-4 p-5">
				<div className="flex items-start gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<FolderKanban className="size-5" />
					</div>
					<div>
						<div className="font-medium">Shared resource reuse</div>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							This library stays separate from post entities so the same media
							can be attached to multiple destination-specific posts and future
							edited variants.
						</p>
					</div>
				</div>
				<ResourceChipList resources={resources.slice(0, 4)} />
			</SurfaceCard>
		</div>
	);
}
