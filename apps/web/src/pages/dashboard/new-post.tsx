import {
	ArrowLeft,
	CalendarRange,
	LoaderCircle,
	Plus,
	Save,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { AdminFormPage, AdminFormSection } from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { ResourceChipList } from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
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
	PostDetail,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type DraftVariant = {
	id?: string;
	platform: string;
	surface: string;
	contentMode: "inherit" | "custom";
	contentKind: "text" | "article" | "thread";
	contentBody: string;
	contentTitle: string;
	threadText: string;
	assetMode: "inherit" | "replace";
	assetIds: string[];
	removedInheritedResourceIds: string[];
	approvalState: string;
	publicationState:
		| "unscheduled"
		| "scheduled"
		| "publishing"
		| "published"
		| "failed"
		| "cancelled";
	plannedAt: string;
	notes: string;
};

function extractContentFields(
	contentKind: "text" | "article" | "thread",
	contentPayload: Record<string, unknown>,
) {
	if (contentKind === "thread") {
		const items = Array.isArray(contentPayload.items)
			? contentPayload.items
					.map((item) =>
						typeof item === "object" &&
						item !== null &&
						"body" in item &&
						typeof item.body === "string"
							? item.body
							: "",
					)
					.filter(Boolean)
			: [];
		return {
			contentTitle:
				typeof contentPayload.title === "string" ? contentPayload.title : "",
			contentBody: "",
			threadText: items.join("\n"),
		};
	}
	return {
		contentTitle:
			typeof contentPayload.title === "string" ? contentPayload.title : "",
		contentBody:
			typeof contentPayload.body === "string" ? contentPayload.body : "",
		threadText: "",
	};
}

function buildContentPayload(
	contentKind: "text" | "article" | "thread",
	contentTitle: string,
	contentBody: string,
	threadText: string,
) {
	if (contentKind === "thread") {
		return {
			items: threadText
				.split("\n")
				.map((item) => item.trim())
				.filter(Boolean)
				.map((body) => ({ body })),
		};
	}
	if (contentKind === "article") {
		return {
			title: contentTitle,
			body: contentBody,
		};
	}
	return {
		body: contentBody,
	};
}

function toDateTimeLocal(value?: string) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "";
	}
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocal(value: string) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function uniquePlatforms(capabilities: ResourceCapabilityMatrix | null) {
	if (!capabilities) {
		return [];
	}
	return Array.from(
		new Set(capabilities.rules.map((rule) => rule.platform)),
	).sort();
}

function surfaceOptions(
	capabilities: ResourceCapabilityMatrix | null,
	platform: string,
) {
	if (!capabilities) {
		return [];
	}
	return capabilities.rules.filter((rule) => rule.platform === platform);
}

export function DashboardNewPost() {
	const navigate = useNavigate();
	const { id } = useParams();
	const isEditMode = Boolean(id);
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [resourceSets, setResourceSets] = useState<ResourceSetSummary[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [contentKind, setContentKind] = useState<"text" | "article" | "thread">(
		"text",
	);
	const [contentBody, setContentBody] = useState("");
	const [contentTitle, setContentTitle] = useState("");
	const [threadText, setThreadText] = useState("");
	const [originPlatform, setOriginPlatform] = useState("");
	const [originSurface, setOriginSurface] = useState("");
	const [notes, setNotes] = useState("");
	const [rootAssetIds, setRootAssetIds] = useState<string[]>([]);
	const [variants, setVariants] = useState<DraftVariant[]>([]);
	const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

	const platformOptions = useMemo(
		() => uniquePlatforms(capabilities),
		[capabilities],
	);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			try {
				const [
					resourceResponse,
					setResponse,
					capabilityResponse,
					postResponse,
				] = await Promise.all([
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					customerRequest<ApiListResponse<ResourceSetSummary>>(
						"/resource-sets",
					),
					customerRequest<ResourceCapabilityMatrix>("/resources/capabilities"),
					isEditMode && id
						? customerRequest<PostDetail>(`/posts/${id}`)
						: Promise.resolve(null),
				]);
				if (cancelled) {
					return;
				}
				setResources(resourceResponse.items);
				setResourceSets(setResponse.items);
				setCapabilities(capabilityResponse);
				if (postResponse) {
					setTitle(postResponse.title);
					setContentKind(postResponse.contentKind);
					const fields = extractContentFields(
						postResponse.contentKind,
						postResponse.contentPayload,
					);
					setContentTitle(fields.contentTitle);
					setContentBody(fields.contentBody);
					setThreadText(fields.threadText);
					setOriginPlatform(postResponse.originPlatform ?? "");
					setOriginSurface(postResponse.originSurface ?? "");
					setNotes(postResponse.notes ?? "");
					setRootAssetIds(postResponse.assets.map((asset) => asset.id));
					setVariants(
						postResponse.variants.map((variant) => {
							const resolvedContentKind =
								variant.contentKind ?? postResponse.contentKind;
							const variantFields = extractContentFields(
								resolvedContentKind,
								(variant.contentPayload ?? {}) as Record<string, unknown>,
							);
							return {
								id: variant.id,
								platform: variant.platform,
								surface: variant.surface,
								contentMode: variant.contentMode,
								contentKind: resolvedContentKind,
								contentBody: variantFields.contentBody,
								contentTitle: variantFields.contentTitle,
								threadText: variantFields.threadText,
								assetMode: variant.assetMode,
								assetIds: variant.assets.map((asset) => asset.id),
								removedInheritedResourceIds:
									variant.removedInheritedResourceIds ?? [],
								approvalState: variant.approvalState,
								publicationState:
									variant.latestPublication?.publicationState ?? "unscheduled",
								plannedAt: toDateTimeLocal(
									variant.latestPublication?.plannedAt,
								),
								notes: variant.notes ?? "",
							};
						}),
					);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load the post editor.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest, id, isEditMode]);

	const selectedRootResources = useMemo(
		() =>
			rootAssetIds
				.map((resourceId) =>
					resources.find((resource) => resource.id === resourceId),
				)
				.filter((resource): resource is ResourceRecord => Boolean(resource)),
		[rootAssetIds, resources],
	);

	async function resolveResourceSetIds(resourceSetId: string) {
		const response = await customerRequest<ResourceSetDetail>(
			`/resource-sets/${resourceSetId}`,
		);
		return response.items.map((item) => item.resourceId);
	}

	function addVariant() {
		const platform = platformOptions[0] ?? "linkedin";
		const surface =
			surfaceOptions(capabilities, platform)[0]?.surface ?? "image_post";
		setVariants((current) => [
			...current,
			{
				platform,
				surface,
				contentMode: "inherit",
				contentKind: "text",
				contentBody: "",
				contentTitle: "",
				threadText: "",
				assetMode: "inherit",
				assetIds: [],
				removedInheritedResourceIds: [],
				approvalState: "draft",
				publicationState: "unscheduled",
				plannedAt: "",
				notes: "",
			},
		]);
	}

	function removeVariant(index: number) {
		setVariants((current) => {
			const next = [...current];
			const [removed] = next.splice(index, 1);
			const removedId = removed?.id;
			if (removedId) {
				setDeletedVariantIds((ids) => [...ids, removedId]);
			}
			return next;
		});
	}

	function updateVariant(index: number, patch: Partial<DraftVariant>) {
		setVariants((current) =>
			current.map((variant, variantIndex) =>
				variantIndex === index ? { ...variant, ...patch } : variant,
			),
		);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			const postPayload = {
				title,
				contentKind,
				contentPayload: buildContentPayload(
					contentKind,
					contentTitle,
					contentBody,
					threadText,
				),
				originPlatform,
				originSurface,
				notes,
			};

			const post =
				isEditMode && id
					? await customerRequest<PostDetail>(`/posts/${id}`, {
							method: "PATCH",
							body: postPayload,
						})
					: await customerRequest<PostDetail>("/posts", {
							method: "POST",
							body: postPayload,
						});

			await customerRequest<PostDetail>(`/posts/${post.id}/assets`, {
				method: "PUT",
				body: {
					resourceIds: rootAssetIds,
				},
			});

			for (const variant of variants) {
				const variantPayload = {
					platform: variant.platform,
					surface: variant.surface,
					contentMode: variant.contentMode,
					contentKind: variant.contentKind,
					contentPayload:
						variant.contentMode === "custom"
							? buildContentPayload(
									variant.contentKind,
									variant.contentTitle,
									variant.contentBody,
									variant.threadText,
								)
							: {},
					assetMode: variant.assetMode,
					notes: variant.notes,
				};

				const savedVariant = variant.id
					? await customerRequest(`/posts/variants/${variant.id}`, {
							method: "PATCH",
							body: variantPayload,
						})
					: await customerRequest(`/posts/${post.id}/variants`, {
							method: "POST",
							body: variantPayload,
						});

				const variantId =
					typeof savedVariant === "object" &&
					savedVariant !== null &&
					"id" in savedVariant &&
					typeof savedVariant.id === "string"
						? savedVariant.id
						: variant.id;

				if (!variantId) {
					continue;
				}

				await customerRequest(`/posts/variants/${variantId}/assets`, {
					method: "PUT",
					body: {
						resourceIds: variant.assetIds,
						assetMode: variant.assetMode,
						removedInheritedResourceIds: variant.removedInheritedResourceIds,
					},
				});

				await customerRequest(`/posts/variants/${variantId}/publication`, {
					method: "PUT",
					body: {
						publicationState: variant.publicationState,
						plannedAt: fromDateTimeLocal(variant.plannedAt),
						source: "manual",
					},
				});
			}

			for (const deletedVariantId of deletedVariantIds) {
				await customerRequest(`/posts/variants/${deletedVariantId}`, {
					method: "DELETE",
				});
			}

			navigate(`/dashboard/posts/${post.id}`);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to save the post.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminFormPage
			eyebrow="Compose"
			title={isEditMode ? "Edit post" : "Create post"}
			description="Build the generic post first, then branch into platform-specific variants with their own asset and publication plans."
			actions={
				<Button variant="outline" className="rounded-full" asChild>
					<Link
						to={
							isEditMode && id ? `/dashboard/posts/${id}` : "/dashboard/posts"
						}
					>
						<ArrowLeft className="size-4" />
						Back
					</Link>
				</Button>
			}
			aside={
				<SurfaceCard className="space-y-4 p-5">
					<div>
						<div className="text-lg font-semibold">
							{title || "Untitled post"}
						</div>
						<div className="mt-1 text-sm text-muted-foreground">
							{variants.length} platform variant
							{variants.length === 1 ? "" : "s"}
						</div>
					</div>
					<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
						Generic assets: {rootAssetIds.length}
					</div>
					<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
						Variants inherit root content and assets by default. Switch a
						variant to custom only when a platform needs a specialized version.
					</div>
				</SurfaceCard>
			}
		>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<AdminFormSection
					title="Generic post"
					description="This is the canonical source. Platform variants can inherit it or override it."
				>
					{loading ? (
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							<LoaderCircle className="size-4 animate-spin" />
							Loading post editor...
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="post-title">Post title</Label>
								<Input
									id="post-title"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									className="h-11 rounded-2xl"
									placeholder="Founder memo campaign"
								/>
							</div>
							<div className="grid gap-2">
								<Label>Content kind</Label>
								<Select
									value={contentKind}
									onValueChange={(value) =>
										setContentKind(value as "text" | "article" | "thread")
									}
								>
									<SelectTrigger className="h-11 rounded-2xl px-4">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="text">Text</SelectItem>
										<SelectItem value="article">Article</SelectItem>
										<SelectItem value="thread">Thread</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label>Origin platform</Label>
								<Select
									value={originPlatform || "generic"}
									onValueChange={(value) => {
										if (value === "generic") {
											setOriginPlatform("");
											setOriginSurface("");
											return;
										}
										setOriginPlatform(value);
									}}
								>
									<SelectTrigger className="h-11 rounded-2xl px-4">
										<SelectValue placeholder="Generic source" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="generic">Generic source</SelectItem>
										{platformOptions.map((platform) => (
											<SelectItem key={platform} value={platform}>
												{platform}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label>Origin surface</Label>
								<Select
									value={originSurface || "generic"}
									onValueChange={(value) =>
										setOriginSurface(value === "generic" ? "" : value)
									}
									disabled={!originPlatform}
								>
									<SelectTrigger className="h-11 rounded-2xl px-4">
										<SelectValue
											placeholder={
												originPlatform
													? "Select originating surface"
													: "Select a platform first"
											}
										/>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="generic">Not specified</SelectItem>
										{surfaceOptions(capabilities, originPlatform).map(
											(option) => (
												<SelectItem
													key={`${option.platform}-${option.surface}`}
													value={option.surface}
												>
													{option.label}
												</SelectItem>
											),
										)}
									</SelectContent>
								</Select>
							</div>
							{contentKind === "article" ? (
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="content-title">Article headline</Label>
									<Input
										id="content-title"
										value={contentTitle}
										onChange={(event) => setContentTitle(event.target.value)}
										className="h-11 rounded-2xl"
										placeholder="Headline used inside the article payload"
									/>
								</div>
							) : null}
							{contentKind === "thread" ? (
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="thread-text">Thread items</Label>
									<Textarea
										id="thread-text"
										value={threadText}
										onChange={(event) => setThreadText(event.target.value)}
										className="min-h-40 rounded-[24px]"
										placeholder="One line per thread item"
									/>
								</div>
							) : (
								<div className="grid gap-2 md:col-span-2">
									<Label htmlFor="content-body">Body</Label>
									<Textarea
										id="content-body"
										value={contentBody}
										onChange={(event) => setContentBody(event.target.value)}
										className="min-h-40 rounded-[24px]"
										placeholder="Draft the canonical copy here"
									/>
								</div>
							)}
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="post-notes">Internal notes</Label>
								<Textarea
									id="post-notes"
									value={notes}
									onChange={(event) => setNotes(event.target.value)}
									className="min-h-24 rounded-[24px]"
									placeholder="Editorial context, approval notes, or internal reminders"
								/>
							</div>
						</div>
					)}
				</AdminFormSection>

				<AdminFormSection
					title="Generic assets"
					description="Attach shared assets once here, then let variants inherit them or override them."
				>
					<div className="space-y-4">
						<ResourcePicker
							resources={resources}
							resourceSets={resourceSets}
							resolveResourceSetIds={resolveResourceSetIds}
							value={rootAssetIds}
							onChange={setRootAssetIds}
							triggerLabel="Attach shared assets"
						/>
						<ResourceChipList
							resources={selectedRootResources}
							onRemove={(resourceId: string) =>
								setRootAssetIds((current) =>
									current.filter((item) => item !== resourceId),
								)
							}
						/>
					</div>
				</AdminFormSection>

				<AdminFormSection
					title="Platform variants"
					description="Each variant targets one concrete platform and surface. It can inherit or customize content and assets."
				>
					<div className="space-y-4">
						<div className="flex justify-end">
							<Button
								type="button"
								variant="outline"
								className="rounded-full"
								onClick={addVariant}
							>
								<Plus className="size-4" />
								Add variant
							</Button>
						</div>
						{variants.length === 0 ? (
							<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
								No platform variants yet. Add one for each publish target you
								want to schedule or track separately.
							</div>
						) : null}
						{variants.map((variant, index) => {
							const variantResources = variant.assetIds
								.map((resourceId) =>
									resources.find((resource) => resource.id === resourceId),
								)
								.filter((resource): resource is ResourceRecord =>
									Boolean(resource),
								);
							const platformSurfaceOptions = surfaceOptions(
								capabilities,
								variant.platform,
							);

							return (
								<SurfaceCard
									key={`${variant.id ?? "draft"}-${index}`}
									className="space-y-4 p-5"
								>
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-semibold">
												{variant.platform} · {variant.surface}
											</div>
											<div className="mt-1 text-sm text-muted-foreground">
												Approval: {variant.approvalState} · Publish state:{" "}
												{variant.publicationState}
											</div>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="rounded-full text-red-600"
											onClick={() => removeVariant(index)}
										>
											<Trash2 className="size-4" />
											Remove
										</Button>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="grid gap-2">
											<Label>Platform</Label>
											<Select
												value={variant.platform}
												onValueChange={(value) => {
													const nextSurface =
														surfaceOptions(capabilities, value)[0]?.surface ??
														"";
													updateVariant(index, {
														platform: value,
														surface: nextSurface,
													});
												}}
											>
												<SelectTrigger className="h-11 rounded-2xl px-4">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{platformOptions.map((platform) => (
														<SelectItem key={platform} value={platform}>
															{platform}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Surface</Label>
											<Select
												value={variant.surface}
												onValueChange={(value) =>
													updateVariant(index, { surface: value })
												}
											>
												<SelectTrigger className="h-11 rounded-2xl px-4">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{platformSurfaceOptions.map((option) => (
														<SelectItem
															key={option.surface}
															value={option.surface}
														>
															{option.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Content mode</Label>
											<Select
												value={variant.contentMode}
												onValueChange={(value) =>
													updateVariant(index, {
														contentMode: value as "inherit" | "custom",
													})
												}
											>
												<SelectTrigger className="h-11 rounded-2xl px-4">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="inherit">
														Inherit generic post
													</SelectItem>
													<SelectItem value="custom">Custom variant</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label>Asset mode</Label>
											<Select
												value={variant.assetMode}
												onValueChange={(value) =>
													updateVariant(index, {
														assetMode: value as "inherit" | "replace",
													})
												}
											>
												<SelectTrigger className="h-11 rounded-2xl px-4">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="inherit">
														Inherit generic assets
													</SelectItem>
													<SelectItem value="replace">
														Replace assets
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>

									{variant.contentMode === "custom" ? (
										<div className="grid gap-4 md:grid-cols-2">
											<div className="grid gap-2">
												<Label>Custom content kind</Label>
												<Select
													value={variant.contentKind}
													onValueChange={(value) =>
														updateVariant(index, {
															contentKind: value as
																| "text"
																| "article"
																| "thread",
														})
													}
												>
													<SelectTrigger className="h-11 rounded-2xl px-4">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="text">Text</SelectItem>
														<SelectItem value="article">Article</SelectItem>
														<SelectItem value="thread">Thread</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="grid gap-2">
												<Label htmlFor={`variant-notes-${index}`}>
													Variant notes
												</Label>
												<Input
													id={`variant-notes-${index}`}
													value={variant.notes}
													onChange={(event) =>
														updateVariant(index, { notes: event.target.value })
													}
													className="h-11 rounded-2xl"
													placeholder="Why this variant differs"
												/>
											</div>
											{variant.contentKind === "article" ? (
												<div className="grid gap-2 md:col-span-2">
													<Label>Custom article headline</Label>
													<Input
														value={variant.contentTitle}
														onChange={(event) =>
															updateVariant(index, {
																contentTitle: event.target.value,
															})
														}
														className="h-11 rounded-2xl"
													/>
												</div>
											) : null}
											{variant.contentKind === "thread" ? (
												<div className="grid gap-2 md:col-span-2">
													<Label>Custom thread items</Label>
													<Textarea
														value={variant.threadText}
														onChange={(event) =>
															updateVariant(index, {
																threadText: event.target.value,
															})
														}
														className="min-h-32 rounded-[24px]"
														placeholder="One line per thread item"
													/>
												</div>
											) : (
												<div className="grid gap-2 md:col-span-2">
													<Label>Custom body</Label>
													<Textarea
														value={variant.contentBody}
														onChange={(event) =>
															updateVariant(index, {
																contentBody: event.target.value,
															})
														}
														className="min-h-32 rounded-[24px]"
													/>
												</div>
											)}
										</div>
									) : null}

									<div className="space-y-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div>
												<div className="font-medium">Variant assets</div>
												<div className="text-sm text-muted-foreground">
													Attach variant-only assets or replace inherited ones.
												</div>
											</div>
											<ResourcePicker
												resources={resources}
												resourceSets={resourceSets}
												resolveResourceSetIds={resolveResourceSetIds}
												value={variant.assetIds}
												onChange={(value) =>
													updateVariant(index, { assetIds: value })
												}
												triggerLabel="Select variant assets"
											/>
										</div>
										<ResourceChipList
											resources={variantResources}
											onRemove={(resourceId: string) =>
												updateVariant(index, {
													assetIds: variant.assetIds.filter(
														(item) => item !== resourceId,
													),
												})
											}
										/>
										{variant.assetMode === "inherit" &&
										selectedRootResources.length > 0 ? (
											<div className="space-y-2">
												<div className="text-sm font-medium">
													Skip inherited assets
												</div>
												<div className="flex flex-wrap gap-2">
													{selectedRootResources.map((resource) => {
														const removed =
															variant.removedInheritedResourceIds.includes(
																resource.id,
															);
														return (
															<Button
																key={resource.id}
																type="button"
																variant={removed ? "secondary" : "outline"}
																size="sm"
																className="rounded-full"
																onClick={() =>
																	updateVariant(index, {
																		removedInheritedResourceIds: removed
																			? variant.removedInheritedResourceIds.filter(
																					(item) => item !== resource.id,
																				)
																			: [
																					...variant.removedInheritedResourceIds,
																					resource.id,
																				],
																	})
																}
															>
																{resource.displayName}
															</Button>
														);
													})}
												</div>
											</div>
										) : null}
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="grid gap-2">
											<Label>Publication state</Label>
											<Select
												value={variant.publicationState}
												onValueChange={(value) =>
													updateVariant(index, {
														publicationState:
															value as DraftVariant["publicationState"],
													})
												}
											>
												<SelectTrigger className="h-11 rounded-2xl px-4">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="unscheduled">
														Unscheduled
													</SelectItem>
													<SelectItem value="scheduled">Scheduled</SelectItem>
													<SelectItem value="publishing">Publishing</SelectItem>
													<SelectItem value="published">Published</SelectItem>
													<SelectItem value="failed">Failed</SelectItem>
													<SelectItem value="cancelled">Cancelled</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="grid gap-2">
											<Label htmlFor={`planned-at-${index}`}>
												Planned publish time
											</Label>
											<div className="relative">
												<CalendarRange className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
												<Input
													id={`planned-at-${index}`}
													type="datetime-local"
													value={variant.plannedAt}
													onChange={(event) =>
														updateVariant(index, {
															plannedAt: event.target.value,
														})
													}
													className="h-11 rounded-2xl pl-10"
												/>
											</div>
										</div>
									</div>
								</SurfaceCard>
							);
						})}
					</div>
				</AdminFormSection>

				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}

				<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="text-sm text-muted-foreground">
						Saving updates the generic post first, then syncs root assets,
						variants, variant assets, and publication plans.
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								to={
									isEditMode && id
										? `/dashboard/posts/${id}`
										: "/dashboard/posts"
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
									Saving...
								</>
							) : (
								<>
									<Save className="size-4" />
									Save post
								</>
							)}
						</Button>
					</div>
				</SurfaceCard>
			</form>
		</AdminFormPage>
	);
}
