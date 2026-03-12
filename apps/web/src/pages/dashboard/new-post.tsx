import {
	AlertTriangle,
	ArrowLeft,
	Clock3,
	Globe2,
	LoaderCircle,
	Plus,
	Save,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
	AdminFormField,
	AdminFormGrid,
	AdminFormPage,
	AdminFormSection,
	AdminFormSubsection,
	adminInputClassName,
	adminSelectTriggerClassName,
	adminTextareaClassName,
} from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { ResourceChipList } from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
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
	PostDetail,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { normalizePostDetail } from "@/lib/post-models";

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

const longTextareaClassName = `${adminTextareaClassName} min-h-40`;
const mediumTextareaClassName = `${adminTextareaClassName} min-h-28`;

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

function VariantStateBadge({
	label,
	value,
	tone = "muted",
}: {
	label: string;
	value: string;
	tone?: "muted" | "success" | "warning";
}) {
	const className =
		tone === "success"
			? "border-emerald-500/20 text-emerald-700"
			: tone === "warning"
				? "border-amber-500/20 text-amber-700"
				: "border-[var(--brand-border-soft)] text-muted-foreground";

	return (
		<Badge variant="outline" className={`rounded-full ${className}`}>
			{label}: {value}
		</Badge>
	);
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
	const [dataWarning, setDataWarning] = useState<string | null>(null);

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
					const normalized = normalizePostDetail(postResponse);
					const safePost = normalized.value;
					setDataWarning(
						normalized.coerced
							? "Some existing post data was incomplete and has been safely normalized for editing."
							: null,
					);
					setTitle(safePost.title);
					setContentKind(safePost.contentKind);
					const fields = extractContentFields(
						safePost.contentKind,
						safePost.contentPayload,
					);
					setContentTitle(fields.contentTitle);
					setContentBody(fields.contentBody);
					setThreadText(fields.threadText);
					setOriginPlatform(safePost.originPlatform ?? "");
					setOriginSurface(safePost.originSurface ?? "");
					setNotes(safePost.notes ?? "");
					setRootAssetIds(safePost.assets.map((asset) => asset.id));
					setVariants(
						safePost.variants.map((variant) => {
							const resolvedContentKind =
								variant.contentKind ?? safePost.contentKind;
							const variantFields = extractContentFields(
								resolvedContentKind,
								variant.contentPayload ?? {},
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
									variant.removedInheritedResourceIds,
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
				} else {
					setDataWarning(null);
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

	const summaryItems = [
		{
			label: "Generic assets",
			value: String(rootAssetIds.length),
		},
		{
			label: "Variants",
			value: String(variants.length),
		},
		{
			label: "Save flow",
			value: isEditMode ? "Update existing post" : "Create new post",
		},
	];

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
			description="Build the canonical post first, then shape platform-specific variants only where the channel needs a different delivery."
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
				<SurfaceCard className="space-y-5 p-5">
					<div className="space-y-1">
						<div className="text-lg font-semibold">
							{title || "Untitled post"}
						</div>
						<div className="text-sm text-muted-foreground">
							{isEditMode
								? "Editing the canonical post and its delivery variants."
								: "Start with the canonical source, then add platform-specific delivery only where needed."}
						</div>
					</div>
					<div className="space-y-3">
						{summaryItems.map((item) => (
							<div
								key={item.label}
								className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
							>
								<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
									{item.label}
								</div>
								<div className="mt-2 text-sm font-medium">{item.value}</div>
							</div>
						))}
					</div>
					<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
						The save action updates the post first, then synchronizes assets,
						variants, and publication plans in sequence.
					</div>
				</SurfaceCard>
			}
		>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<AdminFormSection
					title="Basics"
					description="Capture the root post metadata and editorial context first."
				>
					{loading ? (
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							<LoaderCircle className="size-4 animate-spin" />
							Loading post editor...
						</div>
					) : (
						<AdminFormGrid>
							<AdminFormField className="md:col-span-2">
								<Label htmlFor="post-title">Post title</Label>
								<Input
									id="post-title"
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									className={adminInputClassName}
									placeholder="Founder memo campaign"
								/>
							</AdminFormField>
							<AdminFormField>
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
									<SelectTrigger className={adminSelectTriggerClassName}>
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
							</AdminFormField>
							<AdminFormField>
								<Label>Origin surface</Label>
								<Select
									value={originSurface || "generic"}
									onValueChange={(value) =>
										setOriginSurface(value === "generic" ? "" : value)
									}
									disabled={!originPlatform}
								>
									<SelectTrigger className={adminSelectTriggerClassName}>
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
							</AdminFormField>
							<AdminFormField className="md:col-span-2">
								<Label htmlFor="post-notes">Internal notes</Label>
								<Textarea
									id="post-notes"
									value={notes}
									onChange={(event) => setNotes(event.target.value)}
									className={mediumTextareaClassName}
									placeholder="Editorial context, approval notes, or internal reminders"
								/>
							</AdminFormField>
						</AdminFormGrid>
					)}
				</AdminFormSection>

				<AdminFormSection
					title="Content"
					description="Draft the canonical source once. Variants inherit this by default."
				>
					{loading ? (
						<div className="text-sm text-muted-foreground">
							Loading content fields...
						</div>
					) : (
						<AdminFormGrid>
							<AdminFormField>
								<Label>Content kind</Label>
								<Select
									value={contentKind}
									onValueChange={(value) =>
										setContentKind(value as "text" | "article" | "thread")
									}
								>
									<SelectTrigger className={adminSelectTriggerClassName}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="text">Text</SelectItem>
										<SelectItem value="article">Article</SelectItem>
										<SelectItem value="thread">Thread</SelectItem>
									</SelectContent>
								</Select>
							</AdminFormField>
							<div className="hidden md:block" />
							{contentKind === "article" ? (
								<AdminFormField className="md:col-span-2">
									<Label htmlFor="content-title">Article headline</Label>
									<Input
										id="content-title"
										value={contentTitle}
										onChange={(event) => setContentTitle(event.target.value)}
										className={adminInputClassName}
										placeholder="Headline used inside the article payload"
									/>
								</AdminFormField>
							) : null}
							{contentKind === "thread" ? (
								<AdminFormField className="md:col-span-2">
									<Label htmlFor="thread-text">Thread items</Label>
									<Textarea
										id="thread-text"
										value={threadText}
										onChange={(event) => setThreadText(event.target.value)}
										className={longTextareaClassName}
										placeholder="One line per thread item"
									/>
								</AdminFormField>
							) : (
								<AdminFormField className="md:col-span-2">
									<Label htmlFor="content-body">Body</Label>
									<Textarea
										id="content-body"
										value={contentBody}
										onChange={(event) => setContentBody(event.target.value)}
										className={longTextareaClassName}
										placeholder="Draft the canonical copy here"
									/>
								</AdminFormField>
							)}
						</AdminFormGrid>
					)}
				</AdminFormSection>

				<AdminFormSection
					title="Shared assets"
					description="Attach reusable media once here, then let each variant inherit or override it."
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="text-sm text-muted-foreground">
								Root assets are available to every variant unless that variant
								explicitly skips or replaces them.
							</div>
							<ResourcePicker
								resources={resources}
								resourceSets={resourceSets}
								resolveResourceSetIds={resolveResourceSetIds}
								value={rootAssetIds}
								onChange={setRootAssetIds}
								triggerLabel="Attach shared assets"
							/>
						</div>
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
					title="Variants"
					description="Create only the platform-specific deliveries you actually need to schedule, review, or track separately."
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div className="text-sm text-muted-foreground">
								Each variant has four concerns: target, content behavior, asset
								behavior, and publication state.
							</div>
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
								No platform variants yet. Add one only when a channel needs its
								own version, assets, or publish plan.
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
									className="space-y-5 p-5 md:p-6"
								>
									<div className="flex flex-wrap items-start justify-between gap-4">
										<div className="space-y-2">
											<div className="text-lg font-semibold">
												Variant {index + 1}
											</div>
											<div className="flex flex-wrap gap-2">
												<VariantStateBadge
													label="Target"
													value={`${variant.platform} · ${variant.surface}`}
												/>
												<VariantStateBadge
													label="Content"
													value={variant.contentMode}
												/>
												<VariantStateBadge
													label="Assets"
													value={variant.assetMode}
												/>
												<VariantStateBadge
													label="Publish"
													value={variant.publicationState}
													tone={
														variant.publicationState === "scheduled"
															? "warning"
															: variant.publicationState === "published"
																? "success"
																: "muted"
													}
												/>
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

									<AdminFormSubsection
										title="Target and behavior"
										description="Choose where this variant goes and whether it inherits the generic source."
									>
										<AdminFormGrid>
											<AdminFormField>
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
													<SelectTrigger
														className={adminSelectTriggerClassName}
													>
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
											</AdminFormField>
											<AdminFormField>
												<Label>Surface</Label>
												<Select
													value={variant.surface}
													onValueChange={(value) =>
														updateVariant(index, { surface: value })
													}
												>
													<SelectTrigger
														className={adminSelectTriggerClassName}
													>
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
											</AdminFormField>
											<AdminFormField>
												<Label>Content behavior</Label>
												<Select
													value={variant.contentMode}
													onValueChange={(value) =>
														updateVariant(index, {
															contentMode: value as "inherit" | "custom",
														})
													}
												>
													<SelectTrigger
														className={adminSelectTriggerClassName}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="inherit">
															Inherit generic post
														</SelectItem>
														<SelectItem value="custom">
															Custom variant
														</SelectItem>
													</SelectContent>
												</Select>
											</AdminFormField>
											<AdminFormField>
												<Label>Asset behavior</Label>
												<Select
													value={variant.assetMode}
													onValueChange={(value) =>
														updateVariant(index, {
															assetMode: value as "inherit" | "replace",
														})
													}
												>
													<SelectTrigger
														className={adminSelectTriggerClassName}
													>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="inherit">
															Inherit shared assets
														</SelectItem>
														<SelectItem value="replace">
															Replace with variant assets
														</SelectItem>
													</SelectContent>
												</Select>
											</AdminFormField>
										</AdminFormGrid>
									</AdminFormSubsection>

									<AdminFormSubsection
										title="Content"
										description={
											variant.contentMode === "custom"
												? "Override the canonical copy for this platform target."
												: "This variant currently inherits the generic content."
										}
									>
										{variant.contentMode === "custom" ? (
											<AdminFormGrid>
												<AdminFormField>
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
														<SelectTrigger
															className={adminSelectTriggerClassName}
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="text">Text</SelectItem>
															<SelectItem value="article">Article</SelectItem>
															<SelectItem value="thread">Thread</SelectItem>
														</SelectContent>
													</Select>
												</AdminFormField>
												<AdminFormField>
													<Label htmlFor={`variant-notes-${index}`}>
														Variant notes
													</Label>
													<Input
														id={`variant-notes-${index}`}
														value={variant.notes}
														onChange={(event) =>
															updateVariant(index, {
																notes: event.target.value,
															})
														}
														className={adminInputClassName}
														placeholder="Why this version differs"
													/>
												</AdminFormField>
												{variant.contentKind === "article" ? (
													<AdminFormField className="md:col-span-2">
														<Label>Custom article headline</Label>
														<Input
															value={variant.contentTitle}
															onChange={(event) =>
																updateVariant(index, {
																	contentTitle: event.target.value,
																})
															}
															className={adminInputClassName}
														/>
													</AdminFormField>
												) : null}
												{variant.contentKind === "thread" ? (
													<AdminFormField className="md:col-span-2">
														<Label>Custom thread items</Label>
														<Textarea
															value={variant.threadText}
															onChange={(event) =>
																updateVariant(index, {
																	threadText: event.target.value,
																})
															}
															className={mediumTextareaClassName}
															placeholder="One line per thread item"
														/>
													</AdminFormField>
												) : (
													<AdminFormField className="md:col-span-2">
														<Label>Custom body</Label>
														<Textarea
															value={variant.contentBody}
															onChange={(event) =>
																updateVariant(index, {
																	contentBody: event.target.value,
																})
															}
															className={mediumTextareaClassName}
														/>
													</AdminFormField>
												)}
											</AdminFormGrid>
										) : (
											<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] px-4 py-3 text-sm text-muted-foreground">
												This variant inherits the generic post content.
											</div>
										)}
									</AdminFormSubsection>

									<AdminFormSubsection
										title="Assets"
										description="Attach variant-only media or explicitly skip inherited assets."
										actions={
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
										}
									>
										<div className="space-y-4">
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
												<div className="space-y-3">
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
									</AdminFormSubsection>

								</SurfaceCard>
							);
						})}
					</div>
				</AdminFormSection>

				<AdminFormSection
					title="Publish plans"
					description="Store the current manual publication state and schedule for each delivery variant."
				>
					<div className="space-y-4">
						{variants.length === 0 ? (
							<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
								Add at least one variant to capture a publish state or planned
								time.
							</div>
						) : (
							variants.map((variant, index) => (
								<AdminFormSubsection
									key={`publish-${variant.id ?? "draft"}-${index}`}
									title={`Variant ${index + 1} publish plan`}
									description={`${variant.platform} · ${variant.surface}`}
								>
									<AdminFormGrid>
										<AdminFormField>
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
												<SelectTrigger
													className={adminSelectTriggerClassName}
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="unscheduled">
														Unscheduled
													</SelectItem>
													<SelectItem value="scheduled">Scheduled</SelectItem>
													<SelectItem value="publishing">
														Publishing
													</SelectItem>
													<SelectItem value="published">Published</SelectItem>
													<SelectItem value="failed">Failed</SelectItem>
													<SelectItem value="cancelled">Cancelled</SelectItem>
												</SelectContent>
											</Select>
										</AdminFormField>
										<AdminFormField>
											<Label htmlFor={`planned-at-${index}`}>
												Planned publish time
											</Label>
											<DateTimePicker
												id={`planned-at-${index}`}
												value={variant.plannedAt}
												onChange={(nextValue) =>
													updateVariant(index, {
														plannedAt: nextValue,
													})
												}
											/>
										</AdminFormField>
									</AdminFormGrid>
								</AdminFormSubsection>
							))
						)}
					</div>
				</AdminFormSection>

				{dataWarning ? (
					<SurfaceCard className="flex items-start gap-3 border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div>{dataWarning}</div>
					</SurfaceCard>
				) : null}

				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}

				<AdminFormSection
					title="Review and save"
					description="Confirm the overall shape, then save the canonical post and all related variant state."
				>
					<div className="space-y-4">
						<div className="grid gap-4 md:grid-cols-3">
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Globe2 className="size-4 text-primary" />
									Canonical post
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{title
										? "Title and canonical source are ready to save."
										: "Add a title before saving."}
								</div>
							</div>
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Sparkles className="size-4 text-primary" />
									Variants
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{variants.length === 0
										? "No variants yet. The generic post can still be saved alone."
										: `${variants.length} variant${variants.length === 1 ? "" : "s"} will be synchronized.`}
								</div>
							</div>
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Clock3 className="size-4 text-primary" />
									Publish state
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Publication plans are stored manually for each variant in this
									phase.
								</div>
							</div>
						</div>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="text-sm text-muted-foreground">
								Saving updates the canonical post first, then syncs shared
								assets, variants, variant assets, and publication plans.
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
						</div>
					</div>
				</AdminFormSection>
			</form>
		</AdminFormPage>
	);
}
