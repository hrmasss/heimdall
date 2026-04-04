import {
	ArrowLeft,
	FolderKanban,
	GripVertical,
	LoaderCircle,
	Plus,
	Save,
	Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import {
	ResourceSetCover,
	ResourceSetIntentBadge,
	ResourceSetItemList,
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
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceSetDetail,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type DraftSetItem = {
	resourceId: string;
	resource: ResourceRecord;
	role: string;
};

function moveDraftItem(
	items: DraftSetItem[],
	resourceId: string,
	direction: "up" | "down",
) {
	const index = items.findIndex((item) => item.resourceId === resourceId);
	if (index === -1) {
		return items;
	}
	const targetIndex = direction === "up" ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= items.length) {
		return items;
	}
	const nextItems = [...items];
	const [item] = nextItems.splice(index, 1);
	nextItems.splice(targetIndex, 0, item);
	return nextItems;
}

function reorderDraftItems(
	items: DraftSetItem[],
	draggedResourceId: string,
	targetResourceId: string,
) {
	if (draggedResourceId === targetResourceId) {
		return items;
	}
	const fromIndex = items.findIndex(
		(item) => item.resourceId === draggedResourceId,
	);
	const toIndex = items.findIndex((item) => item.resourceId === targetResourceId);
	if (fromIndex === -1 || toIndex === -1) {
		return items;
	}
	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);
	nextItems.splice(toIndex, 0, item);
	return nextItems;
}

function getResourceHealth(resource: ResourceRecord) {
	if (resource.compatibility.some((item) => item.status === "unsupported")) {
		return "blocked";
	}
	if (resource.compatibility.some((item) => item.status === "warning")) {
		return "warning";
	}
	return "ready";
}

export function DashboardLibrarySetFormPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const isEditMode = Boolean(id);
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [intentType, setIntentType] = useState<"generic" | "social_surface">(
		"generic",
	);
	const [intentPlatform, setIntentPlatform] = useState("instagram");
	const [intentSurface, setIntentSurface] = useState("carousel");
	const [selectedItems, setSelectedItems] = useState<DraftSetItem[]>([]);
	const [coverResourceId, setCoverResourceId] = useState<string | null>(null);
	const [resourceQuery, setResourceQuery] = useState("");
	const [resourceKindFilter, setResourceKindFilter] = useState<
		"all" | "image" | "video" | "document"
	>("all");
	const [resourceReadinessFilter, setResourceReadinessFilter] = useState<
		"all" | "ready" | "warning" | "blocked"
	>("all");
	const [draggingResourceId, setDraggingResourceId] = useState<string | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const intentPlatformOptions = useMemo(
		() => getResourceSetIntentOptions(capabilities),
		[capabilities],
	);
	const intentSurfaceOptions = useMemo(
		() => getIntentSurfaceOptions(intentPlatformOptions, intentPlatform),
		[intentPlatform, intentPlatformOptions],
	);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadFormData() {
			setLoading(true);
			setError(null);
			try {
				const [resourceResponse, capabilityResponse, setResponse] =
					await Promise.all([
						customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
						customerRequest<ResourceCapabilityMatrix>("/resources/capabilities"),
						isEditMode && id
							? customerRequest<ResourceSetDetail>(`/resource-sets/${id}`)
							: Promise.resolve(null),
					]);
				if (cancelled) {
					return;
				}
				setResources(resourceResponse.items);
				setCapabilities(capabilityResponse);
				if (setResponse) {
					setName(setResponse.name);
					setDescription(setResponse.description);
					setIntentType(setResponse.intentType);
					setIntentPlatform(setResponse.intentPlatform ?? "instagram");
					setIntentSurface(setResponse.intentSurface ?? "carousel");
					setCoverResourceId(setResponse.coverResourceId ?? null);
					setSelectedItems(
						setResponse.items.map((item) => ({
							resourceId: item.resourceId,
							resource: item.resource,
							role: item.role,
						})),
					);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load this collection editor.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadFormData();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest, id, isEditMode]);

	useEffect(() => {
		if (
			intentPlatformOptions.length > 0 &&
			!intentPlatformOptions.some((option) => option.value === intentPlatform)
		) {
			setIntentPlatform(intentPlatformOptions[0].value);
		}
	}, [intentPlatform, intentPlatformOptions]);

	useEffect(() => {
		if (
			intentSurfaceOptions.length > 0 &&
			!intentSurfaceOptions.some((option) => option.value === intentSurface)
		) {
			setIntentSurface(intentSurfaceOptions[0].value);
		}
	}, [intentSurface, intentSurfaceOptions]);

	useEffect(() => {
		if (!coverResourceId && selectedItems.length > 0) {
			setCoverResourceId(selectedItems[0].resourceId);
			return;
		}
		if (
			coverResourceId &&
			!selectedItems.some((item) => item.resourceId === coverResourceId)
		) {
			setCoverResourceId(selectedItems[0]?.resourceId ?? null);
		}
	}, [coverResourceId, selectedItems]);

	const selectedResourceIds = useMemo(
		() => new Set(selectedItems.map((item) => item.resourceId)),
		[selectedItems],
	);

	const filteredResources = useMemo(() => {
		const needle = resourceQuery.trim().toLowerCase();
		return resources.filter((resource) => {
			if (selectedResourceIds.has(resource.id)) {
				return false;
			}
			if (
				resourceKindFilter !== "all" &&
				resource.mediaKind !== resourceKindFilter
			) {
				return false;
			}
			if (
				resourceReadinessFilter !== "all" &&
				getResourceHealth(resource) !== resourceReadinessFilter
			) {
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
	}, [
		resourceKindFilter,
		resourceQuery,
		resourceReadinessFilter,
		resources,
		selectedResourceIds,
	]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			const payload = {
				name,
				description,
				intentType,
				intentPlatform: intentType === "social_surface" ? intentPlatform : "",
				intentSurface: intentType === "social_surface" ? intentSurface : "",
				coverResourceId,
				clearCover: !coverResourceId,
				items: selectedItems.map((item) => ({
					resourceId: item.resourceId,
					role: item.role,
				})),
			};

			if (isEditMode && id) {
				await customerRequest<ResourceSetDetail>(`/resource-sets/${id}`, {
					method: "PATCH",
					body: payload,
				});
				await customerRequest<ResourceSetDetail>(`/resource-sets/${id}/items`, {
					method: "PUT",
					body: { items: payload.items },
				});
				navigate(`/dashboard/library/sets/${id}`);
				return;
			}

			const created = await customerRequest<ResourceSetDetail>("/resource-sets", {
				method: "POST",
				body: {
					...payload,
					sourceType: "manual",
				},
			});
			navigate(`/dashboard/library/sets/${created.id}`);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to save this collection.",
			);
		} finally {
			setSaving(false);
		}
	}

	const coverSetPreview =
		selectedItems.find((item) => item.resourceId === coverResourceId)?.resource ??
		selectedItems[0]?.resource;

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Collections"
				title={isEditMode ? "Update collection" : "Create collection"}
				description="Group assets only when it helps reuse. Single assets stay primary, and this collection just preserves order and intent when you need a bundle."
				primaryAction={
					<Button
						type="submit"
						form="collection-form"
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
								<Save className="size-4" />
								Save collection
							</>
						)}
					</Button>
				}
				secondaryActions={
					<Button variant="outline" size="sm" className="rounded-full" asChild>
						<Link
							to={
								isEditMode && id
									? `/dashboard/library/sets/${id}`
									: "/dashboard/library"
							}
						>
							<ArrowLeft className="size-4" />
							Back
						</Link>
					</Button>
				}
			/>

			<DashboardStatusStrip
				eyebrow="Ordered reuse"
				title="Make grouped assets useful without slowing down browse time"
				description="Collections are for carousels, sequences, and bundled reuse. Keep them specific, lightweight, and easy to hand off to a post."
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<AssetWorkspaceShell
				railTitle="Collection preview"
				railDescription="Cover and intent stay visible without interrupting the main editing flow."
				railTriggerLabel="Open preview"
				rail={
					<SurfaceCard className="space-y-4 p-5">
						<div className="overflow-hidden rounded-[24px] border border-[var(--brand-border-soft)] bg-muted">
							<div className="aspect-[16/10]">
								<ResourceSetCover
									set={{
										id: "draft",
										workspaceId: activeWorkspaceId ?? "",
										name: name || "Draft collection",
										description,
										intentType,
										intentPlatform,
										intentSurface,
										coverResourceId: coverResourceId ?? undefined,
										coverPreviewUrl: coverSetPreview?.previewUrl,
										sourceType: "manual",
										itemCount: selectedItems.length,
										membersPreview: selectedItems.map((item) => item.resource),
										createdAt: "",
										updatedAt: "",
									}}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<div className="text-lg font-semibold">
								{name || "Draft collection"}
							</div>
							<div className="text-sm text-muted-foreground">
								{selectedItems.length} ordered item
								{selectedItems.length === 1 ? "" : "s"}
							</div>
							<ResourceSetIntentBadge
								set={{ intentType, intentPlatform, intentSurface }}
							/>
						</div>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
							The cover defaults to the first ordered member. Pick a different one below when the lead visual should be more obvious.
						</div>
					</SurfaceCard>
				}
			>
				<form id="collection-form" className="space-y-5" onSubmit={handleSubmit}>
					<DashboardPanel
						title="Collection basics"
						description="Name it clearly, say why the assets belong together, and set reuse intent only when it actually helps."
					>
						{loading ? (
							<div className="flex items-center gap-3 text-sm text-muted-foreground">
								<LoaderCircle className="size-4 animate-spin" />
								Loading collection editor...
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="asset-set-name">Collection name</Label>
									<Input
										id="asset-set-name"
										value={name}
										onChange={(event) => setName(event.target.value)}
										className="dashboard-input-height rounded-2xl"
										placeholder="Product launch carousel"
									/>
								</div>
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="asset-set-description">Short note</Label>
									<Textarea
										id="asset-set-description"
										value={description}
										onChange={(event) => setDescription(event.target.value)}
										className="min-h-24 rounded-[24px]"
										placeholder="Use this bundle for the April feature launch sequence."
									/>
								</div>
								<div className="grid gap-2 md:col-span-2">
									<Label>Intent</Label>
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant={intentType === "generic" ? "secondary" : "outline"}
											className="rounded-full"
											onClick={() => setIntentType("generic")}
										>
											Generic
										</Button>
										<Button
											type="button"
											variant={
												intentType === "social_surface" ? "secondary" : "outline"
											}
											className="rounded-full"
											onClick={() => setIntentType("social_surface")}
										>
											Social surface
										</Button>
									</div>
								</div>
								{intentType === "social_surface" ? (
									<>
										<div className="grid gap-2">
											<Label>Platform</Label>
											<Select value={intentPlatform} onValueChange={setIntentPlatform}>
												<SelectTrigger className="dashboard-input-height rounded-2xl px-4">
													<SelectValue placeholder="Choose platform" />
												</SelectTrigger>
												<SelectContent position="popper" align="start">
													{intentPlatformOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Surface</Label>
											<Select value={intentSurface} onValueChange={setIntentSurface}>
												<SelectTrigger className="dashboard-input-height rounded-2xl px-4">
													<SelectValue placeholder="Choose surface" />
												</SelectTrigger>
												<SelectContent position="popper" align="start">
													{intentSurfaceOptions.map((option) => (
														<SelectItem key={option.value} value={option.value}>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</>
								) : null}
							</div>
						)}
					</DashboardPanel>

					<DashboardPanel
						title="Ordered members"
						description="Add the assets you need, then arrange them exactly how this collection should appear elsewhere."
					>
						{loading ? (
							<div className="text-sm text-muted-foreground">Loading assets...</div>
						) : (
							<div className="space-y-5">
								<div className="flex items-center gap-2 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm text-muted-foreground">
									<GripVertical className="size-4" />
									Drag items to set the saved order. That same order is reused in pickers and post flows.
								</div>
								<ResourceSetItemList
									items={selectedItems}
									draggable
									draggingResourceId={draggingResourceId}
									onDragStart={(resourceId) => setDraggingResourceId(resourceId)}
									onDragOver={() => undefined}
									onDragEnd={() => setDraggingResourceId(null)}
									onDrop={(targetResourceId) => {
										if (!draggingResourceId) {
											return;
										}
										setSelectedItems((current) =>
											reorderDraftItems(current, draggingResourceId, targetResourceId),
										);
										setDraggingResourceId(null);
									}}
									onOpenResource={(resourceId) =>
										navigate(`/dashboard/library/${resourceId}`)
									}
									onMoveUp={(resourceId) =>
										setSelectedItems((current) =>
											moveDraftItem(current, resourceId, "up"),
										)
									}
									onMoveDown={(resourceId) =>
										setSelectedItems((current) =>
											moveDraftItem(current, resourceId, "down"),
										)
									}
									onRemove={(resourceId) =>
										setSelectedItems((current) =>
											current.filter((item) => item.resourceId !== resourceId),
										)
									}
								/>

								<div className="grid gap-2">
									<Label>Cover asset</Label>
									<div className="flex flex-wrap gap-2">
										{selectedItems.length === 0 ? (
											<div className="text-sm text-muted-foreground">
												Add assets first to choose a cover.
											</div>
										) : (
											selectedItems.map((item) => (
												<Button
													key={item.resourceId}
													type="button"
													variant={
														coverResourceId === item.resourceId
															? "secondary"
															: "outline"
													}
													className="rounded-full"
													onClick={() => setCoverResourceId(item.resourceId)}
												>
													{item.resource.displayName}
												</Button>
											))
										)}
									</div>
								</div>
							</div>
						)}
					</DashboardPanel>

					<DashboardPanel
						title="Add more assets"
						description="Search once, scan fast, and only bring in the assets that belong in this bundle."
					>
						{loading ? (
							<div className="text-sm text-muted-foreground">Loading assets...</div>
						) : (
							<div className="space-y-4">
								<div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
									<div className="relative">
										<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											value={resourceQuery}
											onChange={(event) => setResourceQuery(event.target.value)}
											className="dashboard-input-height rounded-2xl pl-10"
											placeholder="Search assets by name, type, or file"
										/>
									</div>
									<Select
										value={resourceKindFilter}
										onValueChange={(value) =>
											setResourceKindFilter(
												value as "all" | "image" | "video" | "document",
											)
										}
									>
										<SelectTrigger className="dashboard-input-height rounded-2xl px-4">
											<SelectValue placeholder="All media kinds" />
										</SelectTrigger>
										<SelectContent position="popper" align="start">
											<SelectItem value="all">All media kinds</SelectItem>
											<SelectItem value="image">Images</SelectItem>
											<SelectItem value="video">Videos</SelectItem>
											<SelectItem value="document">Documents</SelectItem>
										</SelectContent>
									</Select>
									<Select
										value={resourceReadinessFilter}
										onValueChange={(value) =>
											setResourceReadinessFilter(
												value as "all" | "ready" | "warning" | "blocked",
											)
										}
									>
										<SelectTrigger className="dashboard-input-height rounded-2xl px-4">
											<SelectValue placeholder="All readiness states" />
										</SelectTrigger>
										<SelectContent position="popper" align="start">
											<SelectItem value="all">All readiness states</SelectItem>
											<SelectItem value="ready">Ready</SelectItem>
											<SelectItem value="warning">Warnings</SelectItem>
											<SelectItem value="blocked">Blocked</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="text-sm text-muted-foreground">
									{filteredResources.length} asset
									{filteredResources.length === 1 ? "" : "s"} available
								</div>

								{filteredResources.length > 0 ? (
									<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
										{filteredResources.map((resource) => (
											<SurfaceCard
												key={resource.id}
												tone="muted"
												className="space-y-4 p-4"
											>
												<div className="flex gap-3">
													<div className="size-16 overflow-hidden rounded-[18px] bg-muted">
														<ResourceThumb resource={resource} variant="compact" />
													</div>
													<div className="min-w-0 flex-1">
														<div className="truncate font-medium">
															{resource.displayName}
														</div>
														<div className="mt-1 text-sm text-muted-foreground">
															{formatResourceMeta(resource)}
														</div>
													</div>
												</div>
												<div className="flex flex-wrap gap-2">
													<Badge variant="outline" className="rounded-full capitalize">
														{resource.mediaKind}
													</Badge>
													<ResourceCompatibilityBadge resource={resource} />
												</div>
												<div className="flex justify-end">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="rounded-full"
														onClick={() =>
															setSelectedItems((current) => [
																...current,
																{ resourceId: resource.id, resource, role: "" },
															])
														}
													>
														<Plus className="size-4" />
														Add asset
													</Button>
												</div>
											</SurfaceCard>
										))}
									</div>
								) : (
									<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-sm text-muted-foreground">
										No assets match the current search and filters.
									</div>
								)}
							</div>
						)}
					</DashboardPanel>

					<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<FolderKanban className="size-4" />
							Keep collections narrow and purposeful so grouped reuse stays quick to scan.
						</div>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" className="rounded-full" asChild>
								<Link
									to={
										isEditMode && id
											? `/dashboard/library/sets/${id}`
											: "/dashboard/library"
									}
								>
									Cancel
								</Link>
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
										<Save className="size-4" />
										Save collection
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
