import { ImagePlus, Layers3, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	LocalFileThumb,
	ResourceCompatibilityBadge,
	ResourceKindIcon,
	ResourceThumb,
	formatBytes,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import {
	ResourceSetIntentBadge,
	ResourceSetMembersPreview,
} from "@/components/resources/resource-set-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import type {
	ResourceRecord,
	ResourceSetSummary,
	ResourceUploadResponse,
} from "@/lib/api-types";
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

export function ResourcePicker({
	resources,
	resourceSets = [],
	resolveResourceSetIds,
	value,
	onChange,
	triggerLabel = "Select resources",
	emptyMessage = "Upload resources in the library first.",
	allowUpload = false,
	onResourcesCreated,
}: {
	resources: ResourceRecord[];
	resourceSets?: ResourceSetSummary[];
	resolveResourceSetIds?: (resourceSetId: string) => Promise<string[]>;
	value: string[];
	onChange: (resourceIds: string[]) => void;
	triggerLabel?: string;
	emptyMessage?: string;
	allowUpload?: boolean;
	onResourcesCreated?: (resources: ResourceRecord[]) => void;
}) {
	const { customerRequest } = useAuth();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [draftValue, setDraftValue] = useState<string[]>(value);
	const [loadingSetId, setLoadingSetId] = useState<string | null>(null);
	const [pickerView, setPickerView] = useState<"library" | "upload">("library");
	const [localResources, setLocalResources] = useState<ResourceRecord[]>(resources);
	const [queue, setQueue] = useState<UploadQueueItem[]>([]);
	const [optimizeImages, setOptimizeImages] = useState(true);
	const [uploading, setUploading] = useState(false);
	const [uploadNotice, setUploadNotice] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const queueRef = useRef<UploadQueueItem[]>([]);

	useEffect(() => {
		setLocalResources((current) => {
			const localOnly = current.filter(
				(resource) => !resources.some((item) => item.id === resource.id),
			);
			return [...resources, ...localOnly];
		});
	}, [resources]);

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

	const filteredResources = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			return localResources;
		}
		return localResources.filter((resource) =>
			[
				resource.displayName,
				resource.originalName,
				resource.mediaKind,
				resource.mimeType,
			]
				.join(" ")
				.toLowerCase()
				.includes(needle),
		);
	}, [localResources, query]);

	const filteredSets = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			return resourceSets;
		}
		return resourceSets.filter((set) =>
			[
				set.name,
				set.description,
				set.intentType,
				set.intentPlatform ?? "",
				set.intentSurface ?? "",
			]
				.join(" ")
				.toLowerCase()
				.includes(needle),
		);
	}, [query, resourceSets]);

	async function addAssetSetMembers(resourceSet: ResourceSetSummary) {
		const orderedIds = resolveResourceSetIds
			? await resolveResourceSetIds(resourceSet.id)
			: resourceSet.membersPreview.map((resource) => resource.id);
		setDraftValue((current) => {
			const next = [...current];
			for (const resourceId of orderedIds) {
				if (!next.includes(resourceId)) {
					next.push(resourceId);
				}
			}
			return next;
		});
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

	function enqueueFiles(files: FileList | File[]) {
		setUploadNotice(null);
		const nextItems = Array.from(files).map<UploadQueueItem>((file) => {
			let validationError: string | undefined;
			if (!isSupportedResourceFile(file)) {
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

	function updateQueueItem(
		id: string,
		updater: (item: UploadQueueItem) => UploadQueueItem,
	) {
		setQueue((current) =>
			current.map((item) => (item.id === id ? updater(item) : item)),
		);
	}

	async function uploadQueue() {
		const pendingItems = queue.filter((item) => item.status === "pending");
		if (pendingItems.length === 0) {
			return;
		}

		setUploading(true);
		setUploadNotice(null);
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
				setLocalResources((current) => [
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
				setUploadNotice(message);
			}
		}

		setUploading(false);
		if (uploadedResources.length > 0) {
			const uploadedIds = uploadedResources.map((resource) => resource.id);
			setDraftValue((current) => {
				const next = [...current];
				for (const resourceId of uploadedIds) {
					if (!next.includes(resourceId)) {
						next.push(resourceId);
					}
				}
				return next;
			});
			onResourcesCreated?.(uploadedResources);
			setPickerView("library");
			setUploadNotice(
				uploadedResources.length === 1
					? "Upload complete. The new asset is selected."
					: "Uploads complete. The new assets are selected.",
			);
		}
	}

	const uploadReadyCount = queue.filter((item) => item.status === "pending").length;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (nextOpen) {
					setDraftValue(value);
					setPickerView("library");
					setQuery("");
					setUploadNotice(null);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" className="rounded-full">
					<Layers3 className="size-4" />
					{triggerLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>Resource picker</DialogTitle>
					<DialogDescription>
						Attach reusable media from the workspace library.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant={pickerView === "library" ? "secondary" : "outline"}
								size="sm"
								className="rounded-full"
								onClick={() => setPickerView("library")}
							>
								<Layers3 className="size-4" />
								Library
							</Button>
							{allowUpload ? (
								<Button
									type="button"
									variant={pickerView === "upload" ? "secondary" : "outline"}
									size="sm"
									className="rounded-full"
									onClick={() => setPickerView("upload")}
								>
									<ImagePlus className="size-4" />
									Upload new
								</Button>
							) : null}
						</div>
						<div className="text-sm text-muted-foreground">
							{draftValue.length} selected
						</div>
					</div>

					{pickerView === "library" ? (
						<>
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									className="rounded-full pl-10"
									placeholder="Search resources"
								/>
							</div>
							{filteredSets.length === 0 && filteredResources.length === 0 ? (
								<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
									{emptyMessage}
								</div>
							) : (
								<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
									{filteredSets.length > 0 ? (
										<div className="space-y-3">
											<div className="text-sm font-medium">Asset sets</div>
											<div className="grid gap-3 md:grid-cols-2">
												{filteredSets.map((resourceSet) => (
													<div
														key={resourceSet.id}
														className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
													>
														<div className="flex items-start justify-between gap-3">
															<div className="min-w-0">
																<div className="truncate font-medium">
																	{resourceSet.name}
																</div>
																<div className="mt-1 text-xs text-muted-foreground">
																	{resourceSet.itemCount} ordered items
																</div>
															</div>
															<ResourceSetIntentBadge set={resourceSet} />
														</div>
														<div className="mt-3">
															<ResourceSetMembersPreview
																resources={resourceSet.membersPreview}
																max={3}
															/>
														</div>
														<div className="mt-3 flex justify-end">
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="rounded-full"
																disabled={loadingSetId === resourceSet.id}
																onClick={async () => {
																	setLoadingSetId(resourceSet.id);
																	try {
																		await addAssetSetMembers(resourceSet);
																	} finally {
																		setLoadingSetId(null);
																	}
																}}
															>
																{loadingSetId === resourceSet.id
																	? "Loading..."
																	: "Add set members"}
															</Button>
														</div>
													</div>
												))}
											</div>
										</div>
									) : null}
									{filteredResources.length > 0 ? (
										<div className="space-y-3">
											<div className="text-sm font-medium">Single resources</div>
											<div className="grid gap-3 md:grid-cols-2">
												{filteredResources.map((resource) => {
													const selected = draftValue.includes(resource.id);
													return (
														<button
															key={resource.id}
															type="button"
															onClick={() =>
																setDraftValue((current) =>
																	current.includes(resource.id)
																		? current.filter((item) => item !== resource.id)
																		: [...current, resource.id],
																)
															}
															className={cn(
																"overflow-hidden rounded-[24px] border text-left transition-colors",
																selected
																	? "border-primary bg-primary/5"
																	: "border-[var(--brand-border-soft)] bg-background/70 hover:bg-accent/40",
															)}
														>
															<div className="aspect-[16/10] overflow-hidden">
																<ResourceThumb resource={resource} />
															</div>
															<div className="space-y-3 p-4">
																<div className="flex items-start justify-between gap-3">
																	<div className="min-w-0">
																		<div
																			className="truncate font-medium"
																			title={resource.displayName}
																		>
																			{resource.displayName}
																		</div>
																		<div className="mt-1 text-xs text-muted-foreground">
																			{formatResourceMeta(resource)}
																		</div>
																	</div>
																	<ResourceCompatibilityBadge resource={resource} />
																</div>
																<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
																	<span className="inline-flex min-w-0 items-center gap-1.5 capitalize">
																		<ResourceKindIcon
																			mediaKind={resource.mediaKind}
																		/>
																		{resource.mediaKind}
																	</span>
																	<span>{resource.usageCount} uses</span>
																</div>
															</div>
														</button>
													);
												})}
											</div>
										</div>
									) : null}
								</div>
							)}
						</>
					) : (
						<div className="space-y-4">
							<input
								ref={fileInputRef}
								type="file"
								multiple
								className="hidden"
								accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"
								onChange={(event) => {
									if (event.target.files?.length) {
										enqueueFiles(event.target.files);
										event.target.value = "";
									}
								}}
							/>
							<button
								type="button"
								className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] bg-background/60 px-5 py-8 text-left transition-colors hover:bg-accent/30"
								onClick={() => fileInputRef.current?.click()}
							>
								<div className="flex items-start gap-4">
									<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/80">
										<Upload className="size-5 text-primary" />
									</div>
									<div className="space-y-1">
										<div className="font-medium">Upload from this picker</div>
										<div className="text-sm text-muted-foreground">
											Add a new image, video, or document without leaving this flow.
										</div>
										<div className="text-xs text-muted-foreground">
											Images and videos plus PDF, DOC, DOCX, PPT, and PPTX up to 512 MB.
										</div>
									</div>
								</div>
							</button>

							<div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3">
								<div className="text-sm text-muted-foreground">
									{queue.length === 0
										? "No files queued yet."
										: `${queue.length} file${queue.length === 1 ? "" : "s"} in queue`}
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant={optimizeImages ? "secondary" : "outline"}
										size="sm"
										className="rounded-full"
										onClick={() => setOptimizeImages((current) => !current)}
									>
										Optimize images {optimizeImages ? "on" : "off"}
									</Button>
									<Button
										type="button"
										className="rounded-full border-0 bg-gradient-brand text-white"
										disabled={uploading || uploadReadyCount === 0}
										onClick={() => void uploadQueue()}
									>
										{uploading ? "Uploading..." : "Upload and select"}
									</Button>
								</div>
							</div>

							{uploadNotice ? (
								<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-3 text-sm text-muted-foreground">
									{uploadNotice}
								</div>
							) : null}

							<div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
								{queue.length === 0 ? (
									<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
										Choose files to upload and attach them directly here.
									</div>
								) : (
									queue.map((item) => (
										<div
											key={item.id}
											className="flex flex-wrap items-center gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-3"
										>
											<div className="h-20 w-24 overflow-hidden rounded-[16px] bg-muted">
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
													<div className="mt-1 text-sm text-destructive">
														{item.error}
													</div>
												) : null}
											</div>
											<div className="ml-auto flex items-center gap-2">
												<Badge
													variant="outline"
													className={cn(
														"rounded-full capitalize",
														item.status === "done" &&
															"border-emerald-500/25 text-emerald-600 dark:text-emerald-300",
														item.status === "uploading" &&
															"border-primary/25 text-primary",
														item.status === "error" &&
															"border-red-500/25 text-red-600 dark:text-red-300",
													)}
												>
													{item.status}
												</Badge>
												<Button
													type="button"
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
						</div>
					)}

					<div className="flex items-center justify-between border-t border-border pt-4">
						<div className="text-sm text-muted-foreground">
							{draftValue.length} selected
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								className="rounded-full"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								onClick={() => {
									onChange(draftValue);
									setOpen(false);
								}}
							>
								Apply selection
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
