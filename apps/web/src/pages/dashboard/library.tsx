import {
	FilePlus2,
	FolderKanban,
	FolderPlus,
	GripVertical,
	Layers3,
	PencilLine,
	RefreshCw,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

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
import {
	ResourceSetCover,
	ResourceSetIntentBadge,
	ResourceSetMembersPreview,
	formatAssetSetIntent,
} from "@/components/resources/resource-set-display";
import {
	getIntentSurfaceOptions,
	getResourceSetIntentOptions,
} from "@/components/resources/resource-set-intent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
	ApiListResponse,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
	ResourceUploadResponse,
} from "@/lib/api-types";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useAuth } from "@/lib/auth-context";
import {
	MAX_CLIENT_UPLOAD_BYTES,
	isSupportedResourceFile,
} from "@/lib/resource-upload";
import { cn } from "@/lib/utils";

type UploadQueueItem = {
	id: string;
	file: File;
	previewUrl: string;
	status: "pending" | "uploading" | "done" | "error";
	error?: string;
	uploadedResourceId?: string;
};

type LibraryMode = "resources" | "sets";

const LIBRARY_MODE_STORAGE_KEY = "dashboard-library-mode";

function isSupportedFile(file: File) {
	return isSupportedResourceFile(file);
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
				item.status === "done" &&
					"border-emerald-500/25 text-emerald-600 dark:text-emerald-300",
				item.status === "uploading" && "border-primary/25 text-primary",
				item.status === "error" &&
					"border-red-500/25 text-red-600 dark:text-red-300",
			)}
		>
			{item.status}
		</Badge>
	);
}

function buildBatchSetName(items: UploadQueueItem[]) {
	const namedItem = items.find((item) => item.file.name.trim().length > 0);
	if (!namedItem) {
		return "Upload batch";
	}
	const baseName = namedItem.file.name.replace(/\.[^.]+$/, "").trim();
	if (items.length === 1) {
		return baseName || "Upload batch";
	}
	return `${baseName || "Upload"} set`;
}

function reorderQueueItems(
	items: UploadQueueItem[],
	draggedItemId: string,
	targetItemId: string,
) {
	if (draggedItemId === targetItemId) {
		return items;
	}
	const fromIndex = items.findIndex((item) => item.id === draggedItemId);
	const toIndex = items.findIndex((item) => item.id === targetItemId);
	if (fromIndex === -1 || toIndex === -1) {
		return items;
	}
	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);
	nextItems.splice(toIndex, 0, item);
	return nextItems;
}

export function DashboardLibrary() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const queueRef = useRef<UploadQueueItem[]>([]);
	const [libraryMode, setLibraryMode] = useLocalStorageState<LibraryMode>(
		LIBRARY_MODE_STORAGE_KEY,
		"resources",
	);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [resourceSets, setResourceSets] = useState<ResourceSetSummary[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [queue, setQueue] = useState<UploadQueueItem[]>([]);
	const [optimizeImages, setOptimizeImages] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [createSetFromBatch, setCreateSetFromBatch] = useState(false);
	const [batchSetName, setBatchSetName] = useState("");
	const [batchIntentPlatform, setBatchIntentPlatform] = useState("instagram");
	const [batchIntentSurface, setBatchIntentSurface] = useState("carousel");
	const [draggingQueueItemId, setDraggingQueueItemId] = useState<string | null>(
		null,
	);

	const batchPlatformOptions = useMemo(
		() => getResourceSetIntentOptions(capabilities),
		[capabilities],
	);
	const batchSurfaceOptions = useMemo(
		() => getIntentSurfaceOptions(batchPlatformOptions, batchIntentPlatform),
		[batchIntentPlatform, batchPlatformOptions],
	);

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

	useEffect(() => {
		if (queue.length >= 2) {
			setCreateSetFromBatch(true);
			if (!batchSetName.trim()) {
				setBatchSetName(buildBatchSetName(queue));
			}
			return;
		}
		setCreateSetFromBatch(false);
	}, [batchSetName, queue]);

	useEffect(() => {
		if (batchPlatformOptions.length === 0) {
			return;
		}
		if (
			!batchPlatformOptions.some(
				(option) => option.value === batchIntentPlatform,
			)
		) {
			setBatchIntentPlatform(batchPlatformOptions[0].value);
		}
	}, [batchIntentPlatform, batchPlatformOptions]);

	useEffect(() => {
		if (batchSurfaceOptions.length === 0) {
			return;
		}
		if (
			!batchSurfaceOptions.some((option) => option.value === batchIntentSurface)
		) {
			setBatchIntentSurface(batchSurfaceOptions[0].value);
		}
	}, [batchIntentSurface, batchSurfaceOptions]);

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [resourceResponse, capabilityResponse, setResponse] =
				await Promise.all([
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					customerRequest<ResourceCapabilityMatrix>("/resources/capabilities"),
					customerRequest<ApiListResponse<ResourceSetSummary>>(
						"/resource-sets",
					),
				]);
			setResources(resourceResponse.items);
			setCapabilities(capabilityResponse);
			setResourceSets(setResponse.items);
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

	function reorderQueue(draggedItemId: string, targetItemId: string) {
		setQueue((current) =>
			reorderQueueItems(current, draggedItemId, targetItemId),
		);
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

	async function maybeCreateBatchSet(uploadedResources: ResourceRecord[]) {
		if (!createSetFromBatch || uploadedResources.length < 2) {
			return null;
		}

		try {
			const createdSet = await customerRequest<ResourceSetDetail>(
				"/resource-sets",
				{
					method: "POST",
					body: {
						name: batchSetName.trim() || buildBatchSetName(queue),
						description:
							"Created from a multi-file upload batch in the workspace library.",
						intentType: "social_surface",
						intentPlatform: batchIntentPlatform,
						intentSurface: batchIntentSurface,
						sourceType: "upload_batch",
						items: uploadedResources.map((resource) => ({
							resourceId: resource.id,
						})),
					},
				},
			);
			setResourceSets((current) => [
				createdSet,
				...current.filter((item) => item.id !== createdSet.id),
			]);
			return createdSet;
		} catch (setError) {
			const message =
				setError instanceof Error
					? setError.message
					: "Resources uploaded, but asset-set creation failed.";
			setNotice(message);
			return null;
		}
	}

	async function uploadQueue() {
		const pendingItems = queue.filter((item) => item.status === "pending");
		if (pendingItems.length === 0) {
			return;
		}

		setUploading(true);
		setError(null);
		setNotice(null);
		const uploadedResources: ResourceRecord[] = [];
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
				uploadedResources.push(response.resource);
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

		const createdSet = await maybeCreateBatchSet(uploadedResources);
		setUploading(false);
		if (createdSet) {
			setNotice(
				`Upload queue processed and "${createdSet.name}" was created as an ordered asset set.`,
			);
		} else {
			setNotice("Upload queue processed.");
		}
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
				setResourceSets((current) =>
					current.map((set) => ({
						...set,
						itemCount: Math.max(
							0,
							set.membersPreview.some((member) => member.id === resourceId)
								? set.itemCount - 1
								: set.itemCount,
						),
						membersPreview: set.membersPreview.filter(
							(member) => member.id !== resourceId,
						),
						coverPreviewUrl:
							set.coverResourceId === resourceId
								? set.membersPreview.find((member) => member.id !== resourceId)
										?.previewUrl
								: set.coverPreviewUrl,
						coverResourceId:
							set.coverResourceId === resourceId
								? set.membersPreview.find((member) => member.id !== resourceId)
										?.id
								: set.coverResourceId,
					})),
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

	const removeResourceSet = useCallback(
		async (resourceSetId: string) => {
			setError(null);
			setNotice(null);
			try {
				await customerRequest(`/resource-sets/${resourceSetId}`, {
					method: "DELETE",
				});
				setResourceSets((current) =>
					current.filter((item) => item.id !== resourceSetId),
				);
				setNotice("Asset set deleted.");
			} catch (deleteError) {
				setError(
					deleteError instanceof Error
						? deleteError.message
						: "Unable to delete the asset set.",
				);
			}
		},
		[customerRequest],
	);

	const resourceColumns: DataTableColumn<ResourceRecord>[] = useMemo(
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
							{resource.setCount} sets ·{" "}
							{resource.parentResourceId
								? "derived variant"
								: `${resource.childCount} child variants`}
						</div>
					</div>
				),
				getSortValue: (resource) => resource.usageCount + resource.setCount,
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

	const resourceSetColumns: DataTableColumn<ResourceSetSummary>[] = useMemo(
		() => [
			{
				id: "set",
				label: "Asset set",
				width: 360,
				accessor: (set) => (
					<div className="flex items-center gap-3">
						<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
							<ResourceSetCover set={set} compact className="rounded-[18px]" />
						</div>
						<div className="min-w-0">
							<div className="truncate font-medium">{set.name}</div>
							<div className="truncate text-sm text-muted-foreground">
								{set.description || formatAssetSetIntent(set)}
							</div>
						</div>
					</div>
				),
				getSortValue: (set) => set.name,
			},
			{
				id: "intent",
				label: "Intended use",
				width: 220,
				accessor: (set) => (
					<div className="space-y-2">
						<ResourceSetIntentBadge set={set} />
						<div className="text-sm text-muted-foreground capitalize">
							{set.sourceType.replaceAll("_", " ")}
						</div>
					</div>
				),
				getSortValue: (set) => formatAssetSetIntent(set),
			},
			{
				id: "members",
				label: "Members",
				width: 260,
				accessor: (set) => (
					<div className="space-y-2">
						<div className="text-sm">{set.itemCount} ordered items</div>
						<ResourceSetMembersPreview resources={set.membersPreview} max={3} />
					</div>
				),
				getSortValue: (set) => set.itemCount,
			},
			{
				id: "updated",
				label: "Updated",
				width: 170,
				accessor: (set) => new Date(set.updatedAt).toLocaleDateString(),
				getSortValue: (set) => new Date(set.updatedAt).getTime(),
			},
			{
				id: "actions",
				label: "Manage",
				width: 260,
				className: "text-right",
				headerClassName: "text-right",
				accessor: (set) => (
					<div className="flex items-center justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={(event) => {
								event.stopPropagation();
								navigate(`/dashboard/library/sets/${set.id}`);
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
								navigate(`/dashboard/library/sets/${set.id}/edit`);
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
								void removeResourceSet(set.id);
							}}
						>
							<Trash2 className="size-4" />
							Delete
						</Button>
					</div>
				),
			},
		],
		[navigate, removeResourceSet],
	);

	return (
		<div className="dashboard-page-stack">
			<DashboardPageHeader
				eyebrow="Workspace assets"
				title="Assets"
				description="Upload, preview, inspect, and reuse workspace-scoped media. Ordered asset sets keep related resources together for surfaces like carousels and story sequences."
				actions={
					<>
						<Button variant="outline" size="sm" className="rounded-full" asChild>
							<Link to="/dashboard/studio">
								<Sparkles className="size-4" />
								Open studio
							</Link>
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => void loadData()}
						>
							<RefreshCw className="size-4" />
							Refresh
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => navigate("/dashboard/library/sets/new")}
						>
							<FolderPlus className="size-4" />
							New asset set
						</Button>
						<Button
							size="sm"
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
				description="Preview files before they enter the workspace library. Multi-file uploads can create an ordered asset set automatically."
				action={
					<div className="flex flex-wrap items-center gap-2.5">
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
							size="sm"
							className="rounded-full"
							onClick={clearCompletedQueue}
							disabled={queue.length === 0}
						>
							Clear queue
						</Button>
						<Button
							size="sm"
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
					className="dashboard-card border border-dashed border-[var(--brand-border-soft)] bg-[linear-gradient(145deg,var(--brand-highlight),transparent)] text-center"
					onDragOver={(event) => event.preventDefault()}
					onDrop={(event) => {
						event.preventDefault();
						if (event.dataTransfer.files?.length) {
							enqueueFiles(event.dataTransfer.files);
						}
					}}
				>
					<div className="mx-auto flex size-12 items-center justify-center rounded-[var(--density-dashboard-card-radius-sm)] bg-background/90 text-primary shadow-sm">
						<FolderKanban className="size-5" />
					</div>
					<div className="mt-3 text-base font-medium sm:text-lg">
						Drop files into the shared library
					</div>
					<p className="mt-2 text-sm text-muted-foreground">
						Images, videos, and documents become reusable workspace resources.
						If you upload multiple files together, their drag order becomes the
						initial asset-set order.
					</p>
				</div>
				{queue.length >= 2 ? (
					<div className="dashboard-card-sm mt-3 border border-[var(--brand-border-soft)] bg-background/70">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="font-medium">
									Create asset set from this batch
								</div>
								<div className="text-sm text-muted-foreground">
									Group related resources now so carousels, story sequences, and
									ordered picks stay intact later.
								</div>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Switch
									checked={createSetFromBatch}
									onCheckedChange={(checked) =>
										setCreateSetFromBatch(Boolean(checked))
									}
								/>
								Auto-create ordered set
							</div>
						</div>
						{createSetFromBatch ? (
							<div className="mt-4 grid gap-3 md:grid-cols-3">
								<div className="grid gap-2">
									<Label htmlFor="batch-set-name">Set name</Label>
									<Input
										id="batch-set-name"
										value={batchSetName}
										onChange={(event) => setBatchSetName(event.target.value)}
										className="dashboard-input-height rounded-2xl"
										placeholder="Instagram carousel set"
									/>
								</div>
								<div className="grid gap-2">
									<Label>Platform intent</Label>
									<Select
										value={batchIntentPlatform}
										onValueChange={setBatchIntentPlatform}
									>
										<SelectTrigger className="dashboard-input-height w-full rounded-2xl px-4">
											<SelectValue placeholder="Choose a platform" />
										</SelectTrigger>
										<SelectContent position="popper" align="start">
											{batchPlatformOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label>Surface intent</Label>
									<Select
										value={batchIntentSurface}
										onValueChange={setBatchIntentSurface}
									>
										<SelectTrigger className="dashboard-input-height w-full rounded-2xl px-4">
											<SelectValue placeholder="Choose a surface" />
										</SelectTrigger>
										<SelectContent position="popper" align="start">
											{batchSurfaceOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						) : null}
					</div>
				) : null}

				<div className="mt-4 space-y-3">
					{queue.length === 0 ? (
						<div className="text-sm text-muted-foreground">
							No files queued yet.
						</div>
					) : (
						queue.map((item) => (
							<div
								key={item.id}
								draggable={queue.length > 1}
								onDragStart={() => setDraggingQueueItemId(item.id)}
								onDragEnd={() => setDraggingQueueItemId(null)}
								onDragOver={(event) => {
									if (queue.length <= 1 || !draggingQueueItemId) {
										return;
									}
									event.preventDefault();
								}}
								onDrop={(event) => {
									if (!draggingQueueItemId) {
										return;
									}
									event.preventDefault();
									reorderQueue(draggingQueueItemId, item.id);
									setDraggingQueueItemId(null);
								}}
								className={cn(
									"dashboard-card-sm flex flex-wrap items-center gap-3 border border-[var(--brand-border-soft)] bg-background/75",
									draggingQueueItemId === item.id && "opacity-60",
								)}
							>
								<div className="flex items-center gap-2 text-sm text-muted-foreground">
									<div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background">
										<GripVertical className="size-4" />
									</div>
									<span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background px-2 font-medium">
										{queue.findIndex((queueItem) => queueItem.id === item.id) +
											1}
									</span>
								</div>
								<div className="h-20 w-24 overflow-hidden rounded-[16px] bg-muted">
									<LocalFileThumb
										file={item.file}
										previewUrl={item.previewUrl}
										variant="compact"
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
				{queue.length > 1 ? (
					<div className="mt-3 text-sm text-muted-foreground">
						Drag queued files to set their upload and initial asset-set order.
					</div>
				) : null}
			</DashboardPanel>

			{error ? (
				<SurfaceCard className="dashboard-card-sm border border-destructive/20 bg-destructive/10 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}
			{notice ? (
				<SurfaceCard className="dashboard-card-sm border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300">
					{notice}
				</SurfaceCard>
			) : null}

			<SurfaceCard className="dashboard-card-sm">
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant={libraryMode === "resources" ? "secondary" : "outline"}
						size="sm"
						className="rounded-full"
						onClick={() => setLibraryMode("resources")}
					>
						<Layers3 className="size-4" />
						Resources
					</Button>
					<Button
						variant={libraryMode === "sets" ? "secondary" : "outline"}
						size="sm"
						className="rounded-full"
						onClick={() => setLibraryMode("sets")}
					>
						<FolderKanban className="size-4" />
						Asset sets
					</Button>
				</div>
			</SurfaceCard>

			<SurfaceCard className="dashboard-card">
				{libraryMode === "resources" ? (
					<DataTable
						title="Workspace resources"
						description={`Tracking ${capabilities?.rules.length ?? 0} backend-owned platform surface rules. Grid view stays the default because previews matter here.`}
						storageKey="dashboard-library-resources-table"
						rows={resources}
						columns={resourceColumns}
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
								<div className="space-y-3 p-4">
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
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{resource.mediaKind}
										</Badge>
										<Badge variant="outline" className="rounded-full">
											{resource.usageCount} uses
										</Badge>
										<Badge variant="outline" className="rounded-full">
											{resource.setCount} sets
										</Badge>
										{resource.parentResourceId ? (
											<Badge variant="outline" className="rounded-full">
												Variant
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
				) : (
					<DataTable
						title="Asset sets"
						description="Reusable ordered groups for sequences like Instagram carousels, story frames, or coordinated document bundles."
						storageKey="dashboard-library-sets-table"
						rows={resourceSets}
						columns={resourceSetColumns}
						getRowId={(set) => set.id}
						getSearchText={(set) =>
							[
								set.name,
								set.description,
								set.intentType,
								set.intentPlatform ?? "",
								set.intentSurface ?? "",
							].join(" ")
						}
						filters={[
							{
								id: "intent",
								label: "Intent",
								options: [
									{ label: "Generic", value: "generic" },
									{ label: "Social surface", value: "social_surface" },
								],
								getValue: (set) => set.intentType,
							},
						]}
						loading={loading}
						error={null}
						initialView="grid"
						pageSizeOptions={[6, 12, 24]}
						searchPlaceholder="Search asset sets, descriptions, platforms, or surfaces..."
						emptyState={{
							title: "No asset sets yet",
							description:
								"Create a set manually or upload multiple related files together to preserve order and reuse them as a group.",
							actionLabel: "New asset set",
							onAction: () => navigate("/dashboard/library/sets/new"),
						}}
						onRowClick={(set) => navigate(`/dashboard/library/sets/${set.id}`)}
						renderGridCard={(set) => (
							<>
								<div className="aspect-[16/10] overflow-hidden bg-muted">
									<ResourceSetCover set={set} />
								</div>
								<div className="space-y-3 p-4">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="truncate text-lg font-medium">
												{set.name}
											</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{set.description || formatAssetSetIntent(set)}
											</div>
										</div>
										<ResourceSetIntentBadge set={set} />
									</div>
									<ResourceSetMembersPreview
										resources={set.membersPreview}
										max={4}
									/>
									<div className="flex flex-wrap gap-2">
										<Badge variant="outline" className="rounded-full">
											{set.itemCount} ordered items
										</Badge>
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{set.sourceType.replaceAll("_", " ")}
										</Badge>
									</div>
									<div className="flex flex-wrap gap-2 border-t border-[var(--brand-border-soft)] pt-4">
										<Button
											variant="outline"
											size="sm"
											className="rounded-full"
											onClick={(event) => {
												event.stopPropagation();
												navigate(`/dashboard/library/sets/${set.id}`);
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
												navigate(`/dashboard/library/sets/${set.id}/edit`);
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
												void removeResourceSet(set.id);
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
				)}
			</SurfaceCard>

			<SurfaceCard tone="muted" className="space-y-4 p-5">
				<div className="flex items-start gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<FolderKanban className="size-5" />
					</div>
					<div>
						<div className="font-medium">Resource reuse and grouping</div>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Resources stay separate from post entities so the same media can
							be attached to multiple destination-specific posts. Asset sets add
							ordered, reusable relationships on top when files belong together.
						</p>
					</div>
				</div>
				{libraryMode === "resources" ? (
					<ResourceChipList resources={resources.slice(0, 4)} />
				) : (
					<ResourceSetMembersPreview
						resources={resourceSets
							.flatMap((set) => set.membersPreview)
							.slice(0, 4)}
					/>
				)}
			</SurfaceCard>
		</div>
	);
}
