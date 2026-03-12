import {
	ArrowLeft,
	FolderKanban,
	LoaderCircle,
	Plus,
	Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { AdminFormPage, AdminFormSection } from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import {
	ResourceSetCover,
	ResourceSetIntentBadge,
	ResourceSetItemList,
} from "@/components/resources/resource-set-display";
import {
	ResourceCompatibilityBadge,
	ResourceThumb,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
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
	const fromIndex = items.findIndex((item) => item.resourceId === draggedResourceId);
	const toIndex = items.findIndex((item) => item.resourceId === targetResourceId);
	if (fromIndex === -1 || toIndex === -1) {
		return items;
	}
	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);
	nextItems.splice(toIndex, 0, item);
	return nextItems;
}

export function DashboardLibrarySetFormPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const isEditMode = Boolean(id);
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resources, setResources] = useState<ResourceRecord[]>([]);
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
	const [draggingResourceId, setDraggingResourceId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadFormData() {
			setLoading(true);
			setError(null);
			try {
				const [resourceResponse, setResponse] = await Promise.all([
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					isEditMode && id
						? customerRequest<ResourceSetDetail>(`/resource-sets/${id}`)
						: Promise.resolve(null),
				]);
				if (cancelled) {
					return;
				}
				setResources(resourceResponse.items);
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
							: "Unable to load the asset set editor.",
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
	}, [resourceQuery, resources, selectedResourceIds]);

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
					body: {
						items: payload.items,
					},
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
					: "Unable to save the asset set.",
			);
		} finally {
			setSaving(false);
		}
	}

	const coverSetPreview =
		selectedItems.find((item) => item.resourceId === coverResourceId)?.resource ??
		selectedItems[0]?.resource;

	return (
		<AdminFormPage
			eyebrow="Workspace resources"
			title={isEditMode ? "Edit asset set" : "Create asset set"}
			description="Define a reusable ordered relationship between resources so grouped surfaces like carousels remain easy to find and reuse later."
			actions={
				<Button variant="outline" className="rounded-full" asChild>
					<Link to={isEditMode && id ? `/dashboard/library/sets/${id}` : "/dashboard/library"}>
						<ArrowLeft className="size-4" />
						Back
					</Link>
				</Button>
			}
			aside={
				<SurfaceCard className="p-5">
					<div className="overflow-hidden rounded-[24px] border border-[var(--brand-border-soft)] bg-muted">
						<div className="aspect-[16/10]">
							<ResourceSetCover
								set={{
									id: "draft",
									workspaceId: activeWorkspaceId ?? "",
									name: name || "Draft asset set",
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
					<div className="mt-4 space-y-3">
						<div>
							<div className="text-lg font-semibold">
								{name || "Draft asset set"}
							</div>
							<div className="mt-1 text-sm text-muted-foreground">
								{selectedItems.length} ordered items
							</div>
						</div>
						<ResourceSetIntentBadge
							set={{
								intentType,
								intentPlatform,
								intentSurface,
							}}
						/>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
							Cover preview defaults to the first ordered member unless you
							select a different member below.
						</div>
					</div>
				</SurfaceCard>
			}
		>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<AdminFormSection
					title="Set identity"
					description="Name the asset set, describe why these resources belong together, and declare the intended surface when relevant."
				>
					{loading ? (
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							<LoaderCircle className="size-4 animate-spin" />
							Loading asset set editor...
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="asset-set-name">Set name</Label>
								<Input
									id="asset-set-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									className="h-11 rounded-2xl"
									placeholder="Instagram launch carousel"
								/>
							</div>
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="asset-set-description">Description</Label>
								<Textarea
									id="asset-set-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									className="min-h-24 rounded-[24px]"
									placeholder="Used for the Q2 product narrative carousel."
								/>
							</div>
							<div className="grid gap-2 md:col-span-2">
								<Label>Intent type</Label>
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
										<Label htmlFor="asset-set-platform">Platform</Label>
										<Input
											id="asset-set-platform"
											value={intentPlatform}
											onChange={(event) => setIntentPlatform(event.target.value)}
											className="h-11 rounded-2xl"
											placeholder="instagram"
										/>
									</div>
									<div className="grid gap-2">
										<Label htmlFor="asset-set-surface">Surface</Label>
										<Input
											id="asset-set-surface"
											value={intentSurface}
											onChange={(event) => setIntentSurface(event.target.value)}
											className="h-11 rounded-2xl"
											placeholder="carousel"
										/>
									</div>
								</>
							) : null}
						</div>
					)}
				</AdminFormSection>

				<AdminFormSection
					title="Ordered members"
					description="Add reusable resources to the set, then drag or nudge them into the exact order you want exposed elsewhere."
				>
					{loading ? (
						<div className="text-sm text-muted-foreground">Loading resources...</div>
					) : (
						<div className="space-y-6">
							<ResourceSetItemList
								items={selectedItems}
								draggable
								draggingResourceId={draggingResourceId}
								onDragStart={(resourceId) => setDraggingResourceId(resourceId)}
								onDragOver={() => undefined}
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

							<div className="grid gap-3">
								<Label htmlFor="asset-set-cover">Cover resource</Label>
								<div className="flex flex-wrap gap-2">
									{selectedItems.length === 0 ? (
										<div className="text-sm text-muted-foreground">
											Add resources first to choose a cover.
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

							<div className="space-y-3">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="font-medium">Available resources</div>
										<div className="text-sm text-muted-foreground">
											Add any workspace resource. A single resource can belong
											to multiple sets.
										</div>
									</div>
									<Input
										value={resourceQuery}
										onChange={(event) => setResourceQuery(event.target.value)}
										className="h-11 w-full rounded-2xl md:w-72"
										placeholder="Search resources"
									/>
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{filteredResources.map((resource) => (
										<div
											key={resource.id}
											className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4"
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
													<div className="mt-2">
														<ResourceCompatibilityBadge resource={resource} />
													</div>
												</div>
											</div>
											<div className="mt-3 flex items-center justify-between">
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<Badge variant="outline" className="rounded-full capitalize">
														{resource.mediaKind}
													</Badge>
												</div>
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
													Add
												</Button>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
				</AdminFormSection>

				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}

				<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<FolderKanban className="size-4" />
						Ordered asset sets help pickers, details, and future composer flows
						surface related resources together.
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" className="rounded-full" asChild>
							<Link to={isEditMode && id ? `/dashboard/library/sets/${id}` : "/dashboard/library"}>
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
									Saving...
								</>
							) : (
								<>
									<Save className="size-4" />
									Save asset set
								</>
							)}
						</Button>
					</div>
				</SurfaceCard>
			</form>
		</AdminFormPage>
	);
}
