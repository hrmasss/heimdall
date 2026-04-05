import { useVirtualizer } from "@tanstack/react-virtual";
import {
	ChevronDown,
	FilePlus2,
	FolderKanban,
	ImagePlus,
	MoreHorizontal,
	PencilLine,
	RefreshCw,
	Search,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import {
	AssetCommandBar,
	AssetWorkspaceShell,
} from "@/components/app/asset-workspace";
import {
	DashboardPageHeader,
	DashboardPanel,
	DashboardStatStrip,
	DashboardStatusStrip,
} from "@/components/app/dashboard";
import {
	LocalFileThumb,
	ResourceCompatibilityBadge,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
	ApiListResponse,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
	ResourceUploadResponse,
} from "@/lib/api-types";
import {
	buildStudioHref,
	getDefaultStudioTool,
	getStudioModeForResource,
} from "@/lib/asset-studio";
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

type LibraryView = "assets" | "collections";
type AssetFilter = "all" | ResourceRecord["mediaKind"];

function isSupportedFile(file: File) {
	return isSupportedResourceFile(file);
}

function getResourceHealth(resource: ResourceRecord) {
	if (resource.processingError) {
		return "blocked";
	}
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

function buildCollectionName(items: UploadQueueItem[]) {
	const base = items[0]?.file.name.replace(/\.[^.]+$/, "").trim();
	if (!base) {
		return "New collection";
	}
	return items.length > 1 ? `${base} collection` : base;
}

function UploadQueueBadge({ item }: { item: UploadQueueItem }) {
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

function QuietHealthBadge({ resource }: { resource: ResourceRecord }) {
	const health = getResourceHealth(resource);
	if (health === "ready") {
		return null;
	}
	return <ResourceCompatibilityBadge resource={resource} />;
}

function useResponsiveColumns() {
	const [columns, setColumns] = useState(1);

	useEffect(() => {
		function updateColumns() {
			// Matches Tailwind breakpoints: md:2 cols, 2xl:3 cols
			if (window.innerWidth >= 1536) {
				setColumns(3);
			} else if (window.innerWidth >= 768) {
				setColumns(2);
			} else {
				setColumns(1);
			}
		}
		updateColumns();
		window.addEventListener("resize", updateColumns);
		return () => window.removeEventListener("resize", updateColumns);
	}, []);

	return columns;
}

// Estimated card heights for virtualization
const ASSET_CARD_HEIGHT = 340; // Approximate height of AssetCard
const COLLECTION_CARD_HEIGHT = 380; // Approximate height of CollectionCard
const ROW_GAP = 16; // gap-4 = 1rem = 16px

function VirtualizedAssetGrid({
	resources,
	onDelete,
}: {
	resources: ResourceRecord[];
	onDelete: (resourceId: string) => Promise<void>;
}) {
	const parentRef = useRef<HTMLDivElement>(null);
	const columns = useResponsiveColumns();
	const rowCount = Math.ceil(resources.length / columns);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ASSET_CARD_HEIGHT + ROW_GAP,
		overscan: 3,
	});

	const virtualRows = virtualizer.getVirtualItems();
	const totalHeight = virtualizer.getTotalSize();

	// Clamp container height: min 1 row, max 70vh
	const containerStyle: React.CSSProperties = {
		height: Math.min(totalHeight, window.innerHeight * 0.7),
		minHeight: Math.min(totalHeight, ASSET_CARD_HEIGHT + ROW_GAP),
		overflow: "auto",
	};

	return (
		<div ref={parentRef} style={containerStyle}>
			<div
				style={{
					height: `${totalHeight}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualRows.map((virtualRow) => {
					const rowStartIndex = virtualRow.index * columns;
					const rowItems = resources.slice(
						rowStartIndex,
						rowStartIndex + columns,
					);

					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<div
								className={cn(
									"grid gap-4",
									columns === 1 && "grid-cols-1",
									columns === 2 && "grid-cols-2",
									columns === 3 && "grid-cols-3",
								)}
							>
								{rowItems.map((resource) => (
									<AssetCard
										key={resource.id}
										resource={resource}
										onDelete={onDelete}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function VirtualizedCollectionGrid({
	collections,
	onDelete,
}: {
	collections: ResourceSetSummary[];
	onDelete: (resourceSetId: string) => Promise<void>;
}) {
	const parentRef = useRef<HTMLDivElement>(null);
	const columns = useResponsiveColumns();
	const rowCount = Math.ceil(collections.length / columns);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => COLLECTION_CARD_HEIGHT + ROW_GAP,
		overscan: 3,
	});

	const virtualRows = virtualizer.getVirtualItems();
	const totalHeight = virtualizer.getTotalSize();

	// Clamp container height: min 1 row, max 70vh
	const containerStyle: React.CSSProperties = {
		height: Math.min(totalHeight, window.innerHeight * 0.7),
		minHeight: Math.min(totalHeight, COLLECTION_CARD_HEIGHT + ROW_GAP),
		overflow: "auto",
	};

	return (
		<div ref={parentRef} style={containerStyle}>
			<div
				style={{
					height: `${totalHeight}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualRows.map((virtualRow) => {
					const rowStartIndex = virtualRow.index * columns;
					const rowItems = collections.slice(
						rowStartIndex,
						rowStartIndex + columns,
					);

					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							ref={virtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<div
								className={cn(
									"grid gap-4",
									columns === 1 && "grid-cols-1",
									columns === 2 && "grid-cols-2",
									columns === 3 && "grid-cols-3",
								)}
							>
								{rowItems.map((resourceSet) => (
									<CollectionCard
										key={resourceSet.id}
										resourceSet={resourceSet}
										onDelete={onDelete}
									/>
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function AssetCard({
	resource,
	onDelete,
}: {
	resource: ResourceRecord;
	onDelete: (resourceId: string) => Promise<void>;
}) {
	const navigate = useNavigate();
	const studioHref = buildStudioHref({
		resourceId: resource.id,
		mode: getStudioModeForResource(resource),
		tool: getDefaultStudioTool(getStudioModeForResource(resource)),
		source: "library",
	});

	return (
		<SurfaceCard className="group overflow-hidden p-0">
			<button
				type="button"
				onClick={() => navigate(`/dashboard/library/${resource.id}`)}
				className="block w-full text-left"
			>
				<div className="aspect-[4/3] overflow-hidden bg-muted">
					<ResourceThumb resource={resource} variant="minimal" />
				</div>
				<div className="space-y-3 p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="truncate text-base font-semibold" title={resource.displayName}>
								{resource.displayName}
							</div>
							<div className="mt-1 truncate text-sm text-muted-foreground">
								{formatResourceMeta(resource)}
							</div>
						</div>
						<QuietHealthBadge resource={resource} />
					</div>
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<Badge variant="outline" className="rounded-full capitalize">
							{resource.mediaKind}
						</Badge>
						<span>{resource.usageCount} reuse{resource.usageCount === 1 ? "" : "s"}</span>
					</div>
				</div>
			</button>
			<div className="flex items-center justify-between border-t border-[var(--brand-border-soft)] px-4 py-3">
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" className="rounded-full" asChild>
						<Link to={`/dashboard/posts/new?resourceId=${resource.id}`}>
							<FilePlus2 className="size-4" />
							Use in post
						</Link>
					</Button>
					<Button variant="ghost" size="sm" className="rounded-full" asChild>
						<Link to={studioHref}>
							<Sparkles className="size-4" />
							Studio
						</Link>
					</Button>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" className="rounded-full">
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52 rounded-[20px] p-2">
						<DropdownMenuItem asChild>
							<Link to={`/dashboard/library/${resource.id}`}>Open detail</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to={`/dashboard/library/${resource.id}/edit`}>
								<PencilLine className="size-4" />
								Rename
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								void onDelete(resource.id);
							}}
						>
							<Trash2 className="size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</SurfaceCard>
	);
}

function CollectionCard({
	resourceSet,
	onDelete,
}: {
	resourceSet: ResourceSetSummary;
	onDelete: (resourceSetId: string) => Promise<void>;
}) {
	return (
		<SurfaceCard className="overflow-hidden p-0">
			<Link to={`/dashboard/library/sets/${resourceSet.id}`} className="block">
				<div className="aspect-[16/10] overflow-hidden bg-muted">
					<ResourceSetCover set={resourceSet} />
				</div>
				<div className="space-y-3 p-4">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="truncate text-base font-semibold">{resourceSet.name}</div>
							<div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
								{resourceSet.description ||
									"Reusable ordered media for a sequence, bundle, or carousel."}
							</div>
						</div>
						<ResourceSetIntentBadge set={resourceSet} />
					</div>
					<ResourceSetMembersPreview resources={resourceSet.membersPreview} max={3} />
				</div>
			</Link>
			<div className="flex items-center justify-between border-t border-[var(--brand-border-soft)] px-4 py-3">
				<Button variant="outline" size="sm" className="rounded-full" asChild>
					<Link to={`/dashboard/posts/new?resourceSetId=${resourceSet.id}`}>
						<FilePlus2 className="size-4" />
						Use in post
					</Link>
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon-sm" className="rounded-full">
							<MoreHorizontal className="size-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-52 rounded-[20px] p-2">
						<DropdownMenuItem asChild>
							<Link to={`/dashboard/library/sets/${resourceSet.id}`}>Open detail</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to={`/dashboard/library/sets/${resourceSet.id}/edit`}>
								<PencilLine className="size-4" />
								Rename
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() => {
								void onDelete(resourceSet.id);
							}}
						>
							<Trash2 className="size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</SurfaceCard>
	);
}

export function DashboardLibrary() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const queueRef = useRef<UploadQueueItem[]>([]);

	const [view, setView] = useState<LibraryView>("assets");
	const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
	const [query, setQuery] = useState("");
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [resourceSets, setResourceSets] = useState<ResourceSetSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [queue, setQueue] = useState<UploadQueueItem[]>([]);
	const [uploadTrayOpen, setUploadTrayOpen] = useState(false);
	const [optimizeImages, setOptimizeImages] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [createCollectionFromBatch, setCreateCollectionFromBatch] =
		useState(false);
	const [collectionName, setCollectionName] = useState("");

	useEffect(() => {
		queueRef.current = queue;
	}, [queue]);

	useEffect(() => {
		return () => {
			for (const item of queueRef.current) {
				URL.revokeObjectURL(item.previewUrl);
			}
		};
	}, []);

	useEffect(() => {
		if (queue.length > 0) {
			setUploadTrayOpen(true);
		}
		if (queue.length >= 2) {
			setCreateCollectionFromBatch(true);
			setCollectionName((current) =>
				current.trim().length > 0 ? current : buildCollectionName(queue),
			);
		}
		if (queue.length < 2) {
			setCreateCollectionFromBatch(false);
		}
	}, [queue]);

	const loadData = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const [resourceResponse, setResponse] = await Promise.all([
				customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
				customerRequest<ApiListResponse<ResourceSetSummary>>("/resource-sets"),
			]);
			setResources(resourceResponse.items);
			setResourceSets(setResponse.items);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load the media library.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	function enqueueFiles(files: FileList | File[]) {
		setNotice(null);
		const nextItems = Array.from(files).map<UploadQueueItem>((file) => {
			let validationError: string | undefined;
			if (!isSupportedFile(file)) {
				validationError = "Unsupported file type for the shared asset library.";
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
				URL.revokeObjectURL(target.previewUrl);
			}
			return current.filter((item) => item.id !== itemId);
		});
	}

	function clearQueue() {
		setQueue((current) => {
			for (const item of current) {
				URL.revokeObjectURL(item.previewUrl);
			}
			return [];
		});
		setUploadTrayOpen(false);
	}

	async function maybeCreateCollection(uploadedResources: ResourceRecord[]) {
		if (!createCollectionFromBatch || uploadedResources.length < 2) {
			return null;
		}

		try {
			const createdSet = await customerRequest<ResourceSetDetail>(
				"/resource-sets",
				{
					method: "POST",
					body: {
						name: collectionName.trim() || buildCollectionName(queue),
						description:
							"Created from a multi-file upload in the workspace library.",
						intentType: "generic",
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
		} catch (createError) {
			setNotice(
				createError instanceof Error
					? createError.message
					: "Assets uploaded, but collection creation failed.",
			);
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
		let failedCount = 0;

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
				failedCount += 1;
				updateQueueItem(item.id, (entry) => ({
					...entry,
					status: "error",
					error:
						uploadError instanceof Error
							? uploadError.message
							: "Upload failed.",
				}));
			}
		}

		const createdCollection = await maybeCreateCollection(uploadedResources);
		setUploading(false);

		if (failedCount === 0) {
			clearQueue();
			setNotice(
				createdCollection
					? `Assets added and "${createdCollection.name}" is ready as a collection.`
					: uploadedResources.length === 1
						? "Asset added to the library."
						: `${uploadedResources.length} assets added to the library.`,
			);
			return;
		}

		setQueue((current) => {
			for (const item of current) {
				if (item.status === "done") {
					URL.revokeObjectURL(item.previewUrl);
				}
			}
			return current.filter((item) => item.status !== "done");
		});
		setNotice(
			uploadedResources.length > 0
				? `${uploadedResources.length} uploaded, ${failedCount} still need attention.`
				: "Upload queue needs attention.",
		);
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
				setNotice("Asset deleted.");
			} catch (deleteError) {
				setError(
					deleteError instanceof Error
						? deleteError.message
						: "Unable to delete the asset.",
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
					current.filter((set) => set.id !== resourceSetId),
				);
				setNotice("Collection deleted.");
			} catch (deleteError) {
				setError(
					deleteError instanceof Error
						? deleteError.message
						: "Unable to delete the collection.",
				);
			}
		},
		[customerRequest],
	);

	const filteredResources = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return resources
			.filter((resource) =>
				assetFilter === "all" ? true : resource.mediaKind === assetFilter,
			)
			.filter((resource) =>
				needle
					? [
							resource.displayName,
							resource.originalName,
							resource.mediaKind,
							resource.mimeType,
						]
							.join(" ")
							.toLowerCase()
							.includes(needle)
					: true,
			)
			.sort(
				(left, right) =>
					new Date(right.updatedAt).getTime() -
					new Date(left.updatedAt).getTime(),
			);
	}, [assetFilter, query, resources]);

	const filteredCollections = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return resourceSets
			.filter((set) =>
				needle
					? [
							set.name,
							set.description,
							set.intentPlatform ?? "",
							set.intentSurface ?? "",
						]
							.join(" ")
							.toLowerCase()
							.includes(needle)
					: true,
			)
			.sort(
				(left, right) =>
					new Date(right.updatedAt).getTime() -
					new Date(left.updatedAt).getTime(),
			);
	}, [query, resourceSets]);

	const readyAssets = useMemo(
		() =>
			resources.filter((resource) => getResourceHealth(resource) === "ready")
				.length,
		[resources],
	);
	const warningAssets = useMemo(
		() =>
			resources.filter((resource) => getResourceHealth(resource) === "warning")
				.length,
		[resources],
	);
	const recentCollections = useMemo(() => resourceSets.slice(0, 3), [resourceSets]);
	const uploadReadyCount = queue.filter((item) => item.status === "pending").length;

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Asset-first workflow"
				title="Media"
				description="Find an asset fast, inspect it quickly, and move straight into a post or Studio. Collections stay nearby for grouped reuse when order matters."
				secondaryActions={
					<Button
						variant="outline"
						size="sm"
						className="rounded-full"
						onClick={() => void loadData()}
					>
						<RefreshCw className="size-4" />
						Refresh
					</Button>
				}
				primaryAction={
					<Button
						size="sm"
						className="rounded-full border-0 bg-gradient-brand text-white"
						onClick={() => fileInputRef.current?.click()}
					>
						<Upload className="size-4" />
						Upload asset
					</Button>
				}
			/>

			<DashboardStatusStrip
				eyebrow="Daily use"
				title="Search once, reuse fast"
				description="This library is tuned for quick owner workflows: upload when needed, keep assets tidy enough to find, and only dip into collections when a grouped sequence helps."
				action={
					view === "collections" ? (
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							onClick={() => navigate("/dashboard/library/sets/new")}
						>
							<FolderKanban className="size-4" />
							New collection
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="rounded-full"
							asChild
						>
							<Link to="/dashboard/studio">
								<Sparkles className="size-4" />
								Open Studio
							</Link>
						</Button>
					)
				}
			/>

			<input
				ref={fileInputRef}
				type="file"
				multiple
				className="hidden"
				onChange={(event) => {
					if (event.target.files?.length) {
						enqueueFiles(event.target.files);
						event.target.value = "";
					}
				}}
			/>

			<DashboardStatStrip
				items={[
					{
						label: "Assets",
						value: resources.length,
						detail: "Images, videos, and docs ready to reuse.",
						icon: ImagePlus,
					},
					{
						label: "Ready now",
						value: readyAssets,
						detail: warningAssets
							? `${warningAssets} need a quick review.`
							: "No current publishing cautions.",
						icon: Sparkles,
						tone: "success",
					},
					{
						label: "Collections",
						value: resourceSets.length,
						detail: "Grouped sequences kept secondary to assets.",
						icon: FolderKanban,
					},
				]}
			/>

			<AssetWorkspaceShell
				commandBar={
					<AssetCommandBar>
						<div className="flex flex-col gap-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex flex-wrap items-center gap-2">
									<Button
										variant={view === "assets" ? "secondary" : "outline"}
										size="sm"
										className="rounded-full"
										onClick={() => setView("assets")}
									>
										<ImagePlus className="size-4" />
										Assets
									</Button>
									<Button
										variant={view === "collections" ? "secondary" : "outline"}
										size="sm"
										className="rounded-full"
										onClick={() => setView("collections")}
									>
										<FolderKanban className="size-4" />
										Collections
									</Button>
									<Button
										variant="outline"
										size="sm"
										className="rounded-full"
										onClick={() => setUploadTrayOpen((current) => !current)}
									>
										<Upload className="size-4" />
										{queue.length > 0 ? `Upload tray (${queue.length})` : "Upload tray"}
										<ChevronDown
											className={cn(
												"size-4 transition-transform",
												uploadTrayOpen && "rotate-180",
											)}
										/>
									</Button>
								</div>

								<div className="text-xs text-muted-foreground">
									{view === "assets"
										? "Single assets lead the page."
										: "Collections stay available for grouped reuse."}
								</div>
							</div>

							<div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
								<div className="relative">
									<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={query}
										onChange={(event) => setQuery(event.target.value)}
										className="dashboard-input-height rounded-full pl-10"
										placeholder={
											view === "assets"
												? "Search assets, filenames, and formats"
												: "Search collections, bundles, and grouped sequences"
										}
									/>
								</div>
								{view === "assets" ? (
									<div className="flex flex-wrap gap-2">
										{(["all", "image", "video", "document"] as const).map(
											(filterValue) => (
												<Button
													key={filterValue}
													variant={
														assetFilter === filterValue ? "secondary" : "outline"
													}
													size="sm"
													className="rounded-full capitalize"
													onClick={() => setAssetFilter(filterValue)}
												>
													{filterValue === "all" ? "All media" : filterValue}
												</Button>
											),
										)}
									</div>
								) : null}
							</div>
						</div>
					</AssetCommandBar>
				}
			>
				{uploadTrayOpen || queue.length > 0 ? (
					<DashboardPanel
						title="Upload tray"
						description="Drop files, review them quickly, and add them to the shared library without turning uploads into a separate workspace."
						action={
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant={optimizeImages ? "secondary" : "outline"}
									size="sm"
									className="rounded-full"
									onClick={() => setOptimizeImages((current) => !current)}
								>
									Optimize images {optimizeImages ? "on" : "off"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="rounded-full"
									onClick={clearQueue}
									disabled={queue.length === 0}
								>
									Clear
								</Button>
								<Button
									size="sm"
									className="rounded-full border-0 bg-gradient-brand text-white"
									disabled={uploading || uploadReadyCount === 0}
									onClick={() => void uploadQueue()}
								>
									{uploading ? "Uploading..." : "Add to library"}
								</Button>
							</div>
						}
					>
						<div
							className="dashboard-card-sm rounded-[24px] border border-dashed border-[var(--brand-border-soft)] bg-background/55"
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => {
								event.preventDefault();
								if (event.dataTransfer.files?.length) {
									enqueueFiles(event.dataTransfer.files);
								}
							}}
						>
							<button
								type="button"
								className="flex w-full items-start gap-4 text-left"
								onClick={() => fileInputRef.current?.click()}
							>
								<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/80">
									<Upload className="size-5 text-primary" />
								</div>
								<div className="space-y-1">
									<div className="font-medium">
										Drop files or choose from your device
									</div>
									<div className="text-sm text-muted-foreground">
										Images, video, and documents become reusable assets for posts, collections, and Studio.
									</div>
								</div>
							</button>
						</div>
						{queue.length >= 2 ? (
							<div className="mt-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="font-medium">Also make a collection</div>
										<div className="text-sm text-muted-foreground">
											Useful for carousels, bundles, or ordered sequences.
										</div>
									</div>
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Switch
											checked={createCollectionFromBatch}
											onCheckedChange={(checked) =>
												setCreateCollectionFromBatch(Boolean(checked))
											}
										/>
										Create collection
									</div>
								</div>
								{createCollectionFromBatch ? (
									<Input
										value={collectionName}
										onChange={(event) => setCollectionName(event.target.value)}
										className="mt-4 dashboard-input-height rounded-2xl"
										placeholder="Q2 launch carousel"
									/>
								) : null}
							</div>
						) : null}

						<div className="mt-4 space-y-3">
							{queue.length === 0 ? (
								<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
									No files queued yet.
								</div>
							) : (
								queue.map((item) => (
									<div
										key={item.id}
										className="flex flex-wrap items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-3"
									>
										<div className="h-20 w-24 overflow-hidden rounded-[18px] bg-muted">
											<LocalFileThumb
												file={item.file}
												previewUrl={item.previewUrl}
												variant="compact"
											/>
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium" title={item.file.name}>
												{item.file.name}
											</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{formatBytes(item.file.size)}
												{item.file.type.startsWith("image/")
													? ` · optimization ${optimizeImages ? "on" : "off"}`
													: ""}
											</div>
											{item.error ? (
												<div className="mt-1 text-sm text-destructive">{item.error}</div>
											) : null}
										</div>
										<div className="ml-auto flex items-center gap-2">
											<UploadQueueBadge item={item} />
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

				<DashboardPanel
					title={view === "assets" ? "Assets ready to use" : "Collections ready to reuse"}
					description={
						view === "assets"
							? "Single assets stay primary so owners can scan, open, and act without detouring through extra workspace chrome."
							: "Collections stay available for carousels, grouped bundles, and ordered visual sequences."
					}
				>
					{loading ? (
						<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-10 text-sm text-muted-foreground">
							Loading the library...
						</div>
					) : view === "assets" ? (
						filteredResources.length > 0 ? (
							<VirtualizedAssetGrid
								resources={filteredResources}
								onDelete={removeResource}
							/>
						) : (
							<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-12 text-center">
								<div className="text-lg font-semibold">No assets match yet</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Upload your first reusable asset or broaden the filters.
								</div>
								<Button
									className="mt-4 rounded-full border-0 bg-gradient-brand text-white"
									onClick={() => fileInputRef.current?.click()}
								>
									Upload asset
								</Button>
							</div>
						)
					) : filteredCollections.length > 0 ? (
						<VirtualizedCollectionGrid
							collections={filteredCollections}
							onDelete={removeResourceSet}
						/>
					) : (
						<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-12 text-center">
							<div className="text-lg font-semibold">No collections yet</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Group related uploads into a reusable ordered bundle when you need carousels or campaign sequences.
							</div>
							<Button
								variant="outline"
								className="mt-4 rounded-full"
								onClick={() => navigate("/dashboard/library/sets/new")}
							>
								Create collection
							</Button>
						</div>
					)}
				</DashboardPanel>

				{view === "assets" ? (
					<DashboardPanel
						title="Collections nearby"
						description="Grouped media stays available when you need it, but does not take over the main browse flow."
						action={
							<Button
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() => setView("collections")}
							>
								View all collections
							</Button>
						}
					>
						{recentCollections.length > 0 ? (
							<div className="grid gap-3 lg:grid-cols-3">
								{recentCollections.map((resourceSet) => (
									<Link
										key={resourceSet.id}
										to={`/dashboard/library/sets/${resourceSet.id}`}
										className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4 transition-colors hover:bg-accent/20"
									>
										<div className="flex items-center gap-3">
											<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
												<ResourceSetCover set={resourceSet} compact />
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate font-medium">
													{resourceSet.name}
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													{resourceSet.itemCount} items · {formatAssetSetIntent(resourceSet)}
												</div>
											</div>
										</div>
									</Link>
								))}
							</div>
						) : (
							<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-sm text-muted-foreground">
								Collections will appear here once you group related uploads.
							</div>
						)}
					</DashboardPanel>
				) : null}
			</AssetWorkspaceShell>
		</div>
	);
}
