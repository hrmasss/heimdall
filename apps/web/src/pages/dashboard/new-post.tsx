import {
	AlertTriangle,
	ArrowLeft,
	CalendarClock,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock3,
	Globe2,
	LoaderCircle,
	Plus,
	Save,
	Send,
	Trash2,
	Video,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
	AdminFormField,
	AdminFormGrid,
	AdminFormPage,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	PostDetail,
	PostVariant,
	PublicationPlan,
	ReadinessIssue,
	ResourceCapabilityMatrix,
	ResourceCapabilityRule,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
	ReviewRecord,
	VariantReadiness,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { normalizePostDetail } from "@/lib/post-models";
import { cn } from "@/lib/utils";

type ContentKind = "text" | "article" | "thread";
type DraftContent = {
	kind: ContentKind;
	textBody: string;
	articleTitle: string;
	articleBody: string;
	threadItems: string[];
};

type DraftVariant = {
	id?: string;
	platform: string;
	surface: string;
	inheritSource: string;
	contentMode: "inherit" | "custom";
	content: DraftContent;
	assetMode: "inherit" | "replace";
	assetIds: string[];
	removedInheritedResourceIds: string[];
	approvalState: PostVariant["approvalState"];
	reviewHistory: ReviewRecord[];
	latestPublication?: PublicationPlan;
	notes: string;
};

type VariantSnapshot = {
	rule?: ResourceCapabilityRule;
	sourceLabel: string;
	contentKind: ContentKind;
	contentPayload: Record<string, unknown>;
	sourceAssets: ResourceRecord[];
	effectiveAssets: ResourceRecord[];
	readiness: VariantReadiness;
};

const longTextareaClassName = `${adminTextareaClassName} min-h-40`;
const mediumTextareaClassName = `${adminTextareaClassName} min-h-28`;
const compactTextareaClassName = `${adminTextareaClassName} min-h-24`;

function createDraftContent(kind: ContentKind = "text"): DraftContent {
	return {
		kind,
		textBody: "",
		articleTitle: "",
		articleBody: "",
		threadItems: [""],
	};
}

function blankReadiness(): VariantReadiness {
	return { draftIssues: [], scheduleBlockers: [], publishBlockers: [] };
}

function buildContentPayload(content: DraftContent) {
	if (content.kind === "thread") {
		return {
			items: content.threadItems
				.map((item) => item.trim())
				.filter(Boolean)
				.map((body) => ({ body })),
		};
	}
	if (content.kind === "article") {
		return { title: content.articleTitle, body: content.articleBody };
	}
	return { body: content.textBody };
}

function extractDraftContent(
	kind: ContentKind,
	payload: Record<string, unknown>,
): DraftContent {
	if (kind === "thread") {
		const items = Array.isArray(payload.items)
			? payload.items
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
			kind,
			textBody: "",
			articleTitle: "",
			articleBody: "",
			threadItems: items.length > 0 ? items : [""],
		};
	}
	if (kind === "article") {
		return {
			kind,
			textBody: "",
			articleTitle: typeof payload.title === "string" ? payload.title : "",
			articleBody: typeof payload.body === "string" ? payload.body : "",
			threadItems: [""],
		};
	}
	return {
		kind,
		textBody: typeof payload.body === "string" ? payload.body : "",
		articleTitle: "",
		articleBody: "",
		threadItems: [""],
	};
}

function formatPlatformLabel(platform: string) {
	return platform
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function formatSurfaceLabel(rule?: ResourceCapabilityRule, surface?: string) {
	if (rule?.label) {
		return rule.label;
	}
	return (surface ?? "Post format")
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
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
	return capabilities?.rules.filter((rule) => rule.platform === platform) ?? [];
}

function findRule(
	capabilities: ResourceCapabilityMatrix | null,
	platform: string,
	surface: string,
) {
	return capabilities?.rules.find(
		(rule) => rule.platform === platform && rule.surface === surface,
	);
}

function inferMinItems(
	rule: Pick<ResourceCapabilityRule, "surface" | "label">,
) {
	const surfaceKey = `${rule.surface} ${rule.label}`.toLowerCase();
	if (
		surfaceKey.includes("carousel") ||
		surfaceKey.includes("multi-image") ||
		surfaceKey.includes("multi image")
	) {
		return 2;
	}
	return 1;
}

function normalizeCapabilities(
	capabilities: ResourceCapabilityMatrix | null,
): ResourceCapabilityMatrix | null {
	if (!capabilities) {
		return null;
	}
	return {
		rules: capabilities.rules.map((rule) => {
			const accepts = Array.isArray(rule.accepts) ? rule.accepts : [];
			const hardLimit = Array.isArray(rule.hardLimit) ? rule.hardLimit : [];
			const preferred = Array.isArray(rule.preferred) ? rule.preferred : [];
			const assetRequired =
				typeof rule.assetRequired === "boolean"
					? rule.assetRequired
					: accepts.length > 0;
			return {
				...rule,
				accepts,
				hardLimit,
				preferred,
				supportedContentKinds:
					Array.isArray(rule.supportedContentKinds) &&
					rule.supportedContentKinds.length > 0
						? rule.supportedContentKinds
						: ["text", "article", "thread"],
				assetRequired,
				minItems:
					typeof rule.minItems === "number"
						? rule.minItems
						: assetRequired
							? inferMinItems(rule)
							: undefined,
			};
		}),
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
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
		date.getDate(),
	).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes(),
	).padStart(2, "0")}`;
}

function fromDateTimeLocal(value: string) {
	if (!value) {
		return "";
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function resourceMap(resources: ResourceRecord[]) {
	return new Map(resources.map((resource) => [resource.id, resource]));
}

function summarizeIssues(issues: ReadinessIssue[]) {
	return Array.from(
		new Map(issues.map((issue) => [issue.code, issue])).values(),
	);
}

function renderContentPreview(
	contentKind: ContentKind,
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
		return items.length > 0
			? items.map((item, index) => `${index + 1}. ${item}`).join("\n")
			: "No thread items yet.";
	}
	if (contentKind === "article") {
		const parts = [
			typeof contentPayload.title === "string" ? contentPayload.title : "",
			typeof contentPayload.body === "string" ? contentPayload.body : "",
		].filter(Boolean);
		return parts.join("\n\n") || "No article content yet.";
	}
	return (
		(typeof contentPayload.body === "string" ? contentPayload.body : "") ||
		"No body text yet."
	);
}

function platformIcon(platform: string) {
	if (platform === "youtube" || platform === "tiktok") {
		return <Video className="size-4" />;
	}
	return (
		<div className="flex size-4 items-center justify-center text-[0.65rem] font-semibold uppercase">
			{platform.slice(0, 1)}
		</div>
	);
}

function resolveVariantSnapshot(
	variant: DraftVariant,
	variants: DraftVariant[],
	sharedContent: DraftContent,
	sharedAssets: ResourceRecord[],
	resourcesById: Map<string, ResourceRecord>,
	requiresApproval: boolean,
	capabilities: ResourceCapabilityMatrix | null,
	seen = new Set<string>(),
): VariantSnapshot {
	if (seen.has(variant.platform)) {
		return {
			sourceLabel: "Current tab",
			contentKind: variant.content.kind,
			contentPayload: buildContentPayload(variant.content),
			sourceAssets: [],
			effectiveAssets: [],
			readiness: {
				draftIssues: [
					{
						code: "inherit_cycle",
						message:
							"This tab is inheriting in a loop. Switch the source or make it custom.",
					},
				],
				scheduleBlockers: [
					{
						code: "inherit_cycle",
						message:
							"This tab is inheriting in a loop. Switch the source or make it custom.",
					},
				],
				publishBlockers: [
					{
						code: "inherit_cycle",
						message:
							"This tab is inheriting in a loop. Switch the source or make it custom.",
					},
				],
			},
		};
	}

	const nextSeen = new Set(seen);
	nextSeen.add(variant.platform);
	let sourceLabel = "Shared draft";
	let sourceContent = sharedContent;
	let sourceAssets = sharedAssets;
	const sourceIssues: ReadinessIssue[] = [];

	if (variant.inheritSource !== "shared") {
		const sourcePlatform = variant.inheritSource.replace(/^platform:/, "");
		const sourceVariant = variants.find(
			(entry) => entry.platform === sourcePlatform,
		);
		sourceLabel = formatPlatformLabel(sourcePlatform);
		if (!sourceVariant) {
			sourceIssues.push({
				code: "inherit_source_missing",
				message: "The selected source tab does not exist yet.",
			});
		} else {
			const sourceSnapshot = resolveVariantSnapshot(
				sourceVariant,
				variants,
				sharedContent,
				sharedAssets,
				resourcesById,
				requiresApproval,
				capabilities,
				nextSeen,
			);
			sourceContent = extractDraftContent(
				sourceSnapshot.contentKind,
				sourceSnapshot.contentPayload,
			);
			sourceAssets = sourceSnapshot.effectiveAssets;
		}
	}

	const customAssets = variant.assetIds
		.map((assetId) => resourcesById.get(assetId))
		.filter((resource): resource is ResourceRecord => Boolean(resource));
	const keptInheritedAssets =
		variant.assetMode === "replace"
			? []
			: sourceAssets.filter(
					(asset) => !variant.removedInheritedResourceIds.includes(asset.id),
				);
	const effectiveAssets =
		variant.assetMode === "replace"
			? customAssets
			: [
					...keptInheritedAssets,
					...customAssets.filter(
						(asset) =>
							!keptInheritedAssets.some((entry) => entry.id === asset.id),
					),
				];
	const resolvedContent =
		variant.contentMode === "custom" ? variant.content : sourceContent;
	const rule = findRule(capabilities, variant.platform, variant.surface);
	const readiness = blankReadiness();
	const pushBlocker = (issue: ReadinessIssue, draft = false) => {
		if (draft) {
			readiness.draftIssues.push(issue);
		}
		readiness.scheduleBlockers.push(issue);
		readiness.publishBlockers.push(issue);
	};

	for (const issue of sourceIssues) {
		pushBlocker(issue, true);
	}
	if (rule) {
		if (
			rule.supportedContentKinds.length > 0 &&
			!rule.supportedContentKinds.includes(resolvedContent.kind)
		) {
			pushBlocker(
				{
					code: "content_kind_unsupported",
					message: `${rule.label} does not support ${resolvedContent.kind} content.`,
				},
				false,
			);
		}
		if (
			resolvedContent.kind === "thread" &&
			((
				buildContentPayload(resolvedContent).items as
					| { body: string }[]
					| undefined
			)?.length ?? 0) === 0
		) {
			pushBlocker(
				{
					code: "thread_items_required",
					message: "Add at least one thread item.",
				},
				true,
			);
		}
		if (
			resolvedContent.kind === "article" &&
			resolvedContent.articleBody.trim() === ""
		) {
			pushBlocker(
				{ code: "article_body_required", message: "Add article body content." },
				true,
			);
		}
		if (rule.assetRequired && effectiveAssets.length === 0) {
			pushBlocker(
				{ code: "assets_required", message: `${rule.label} requires media.` },
				true,
			);
		}
		if (
			typeof rule.minItems === "number" &&
			effectiveAssets.length < rule.minItems
		) {
			pushBlocker(
				{
					code: "asset_minimum",
					message: `${rule.label} needs at least ${rule.minItems} asset(s).`,
				},
				false,
			);
		}
		if (
			typeof rule.maxItems === "number" &&
			effectiveAssets.length > rule.maxItems
		) {
			pushBlocker(
				{
					code: "asset_limit",
					message: `${rule.label} supports at most ${rule.maxItems} asset(s).`,
				},
				false,
			);
		}
		const incompatibleAsset = effectiveAssets.find(
			(asset) => !rule.accepts.includes(asset.mediaKind),
		);
		if (incompatibleAsset) {
			pushBlocker(
				{
					code: "asset_type_incompatible",
					message: `${rule.label} cannot use ${incompatibleAsset.mediaKind} assets.`,
				},
				false,
			);
		}
	}
	if (requiresApproval && variant.approvalState !== "approved") {
		pushBlocker(
			{
				code: "approval_required",
				message:
					"Approval is required before scheduling or recording this variant as published.",
			},
			false,
		);
	}
	if (variant.latestPublication?.publicationState === "published") {
		readiness.publishBlockers.push({
			code: "already_published",
			message: "This variant has already been recorded as published.",
		});
	}

	return {
		rule,
		sourceLabel,
		contentKind: resolvedContent.kind,
		contentPayload: buildContentPayload(resolvedContent),
		sourceAssets,
		effectiveAssets,
		readiness,
	};
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
	const [postId, setPostId] = useState<string | null>(id ?? null);
	const [baseline, setBaseline] = useState("");
	const [activeTab, setActiveTab] = useState("shared");

	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [requiresApproval, setRequiresApproval] = useState(false);
	const [startsFromPlatform, setStartsFromPlatform] = useState("");
	const [startsFromSurface, setStartsFromSurface] = useState("");
	const [sharedDraft, setSharedDraft] = useState(createDraftContent());
	const [rootAssetIds, setRootAssetIds] = useState<string[]>([]);
	const [variants, setVariants] = useState<DraftVariant[]>([]);
	const [legacyVariants, setLegacyVariants] = useState<PostVariant[]>([]);
	const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

	const platformOptions = useMemo(
		() => uniquePlatforms(capabilities),
		[capabilities],
	);
	const resourcesById = useMemo(() => resourceMap(resources), [resources]);
	const rootAssets = useMemo(
		() =>
			rootAssetIds
				.map((assetId) => resourcesById.get(assetId))
				.filter((asset): asset is ResourceRecord => Boolean(asset)),
		[rootAssetIds, resourcesById],
	);
	const snapshots = useMemo(
		() =>
			new Map(
				variants.map((variant) => [
					variant.platform,
					resolveVariantSnapshot(
						variant,
						variants,
						sharedDraft,
						rootAssets,
						resourcesById,
						requiresApproval,
						capabilities,
					),
				]),
			),
		[
			variants,
			sharedDraft,
			rootAssets,
			resourcesById,
			requiresApproval,
			capabilities,
		],
	);
	const activeVariant =
		activeTab === "shared"
			? null
			: (variants.find((variant) => variant.platform === activeTab) ?? null);
	const activeSnapshot = activeVariant
		? snapshots.get(activeVariant.platform)
		: undefined;
	const signature = JSON.stringify({
		title,
		notes,
		requiresApproval,
		startsFromPlatform,
		startsFromSurface,
		sharedDraft,
		rootAssetIds,
		variants,
		deletedVariantIds,
	});
	const hasUnsavedChanges =
		!loading && baseline !== "" && baseline !== signature;

	const loadEditor = useCallback(
		async (nextId?: string | null) => {
			if (!activeWorkspaceId) {
				return;
			}
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
					nextId
						? customerRequest<PostDetail>(`/posts/${nextId}`)
						: Promise.resolve(null),
				]);
				setResources(resourceResponse.items);
				setResourceSets(setResponse.items);
				setCapabilities(normalizeCapabilities(capabilityResponse));

				if (!postResponse) {
					const emptyState = {
						title: "",
						notes: "",
						requiresApproval: false,
						startsFromPlatform: "",
						startsFromSurface: "",
						sharedDraft: createDraftContent(),
						rootAssetIds: [],
						variants: [],
						deletedVariantIds: [],
					};
					setPostId(null);
					setTitle(emptyState.title);
					setNotes(emptyState.notes);
					setRequiresApproval(emptyState.requiresApproval);
					setStartsFromPlatform(emptyState.startsFromPlatform);
					setStartsFromSurface(emptyState.startsFromSurface);
					setSharedDraft(emptyState.sharedDraft);
					setRootAssetIds(emptyState.rootAssetIds);
					setVariants([]);
					setLegacyVariants([]);
					setDeletedVariantIds([]);
					setActiveTab("shared");
					setBaseline(JSON.stringify(emptyState));
					setDataWarning(null);
					return;
				}

				const normalized = normalizePostDetail(postResponse);
				const post = normalized.value;
				const mappedVariants: DraftVariant[] = post.variants.map((variant) => ({
					id: variant.id,
					platform: variant.platform,
					surface: variant.surface,
					inheritSource: variant.inheritSource,
					contentMode: variant.contentMode,
					content: extractDraftContent(
						(variant.contentKind ?? post.contentKind) as ContentKind,
						variant.contentPayload ?? {},
					),
					assetMode: variant.assetMode,
					assetIds: variant.assets.map((asset) => asset.id),
					removedInheritedResourceIds: variant.removedInheritedResourceIds,
					approvalState: variant.approvalState,
					reviewHistory: variant.reviewHistory,
					latestPublication: variant.latestPublication,
					notes: variant.notes ?? "",
				}));
				const nextState = {
					title: post.title,
					notes: post.notes ?? "",
					requiresApproval: post.requiresApproval,
					startsFromPlatform: post.originPlatform ?? "",
					startsFromSurface: post.originSurface ?? "",
					sharedDraft: extractDraftContent(
						post.contentKind,
						post.contentPayload,
					),
					rootAssetIds: post.assets.map((asset) => asset.id),
					variants: mappedVariants,
					deletedVariantIds: [],
				};
				setPostId(post.id);
				setTitle(nextState.title);
				setNotes(nextState.notes);
				setRequiresApproval(nextState.requiresApproval);
				setStartsFromPlatform(nextState.startsFromPlatform);
				setStartsFromSurface(nextState.startsFromSurface);
				setSharedDraft(nextState.sharedDraft);
				setRootAssetIds(nextState.rootAssetIds);
				setVariants(nextState.variants);
				setLegacyVariants(post.legacyVariants);
				setDeletedVariantIds([]);
				setActiveTab(
					nextState.startsFromPlatform ||
						nextState.variants[0]?.platform ||
						"shared",
				);
				setBaseline(JSON.stringify(nextState));
				setDataWarning(
					normalized.coerced
						? "Some stored post data was normalized so the editor could load safely."
						: null,
				);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Unable to load the post composer.",
				);
			} finally {
				setLoading(false);
			}
		},
		[activeWorkspaceId, customerRequest],
	);

	useEffect(() => {
		void loadEditor(id ?? null);
	}, [id, loadEditor]);

	async function resolveResourceSetIds(resourceSetId: string) {
		const response = await customerRequest<ResourceSetDetail>(
			`/resource-sets/${resourceSetId}`,
		);
		return response.items.map((item) => item.resourceId);
	}

	function ensurePlatformTab(platform: string, surface?: string) {
		setVariants((current) => {
			const existing = current.find((variant) => variant.platform === platform);
			if (existing) {
				return current.map((variant) =>
					variant.platform === platform
						? { ...variant, surface: surface ?? variant.surface }
						: variant,
				);
			}
			return [
				...current,
				{
					id: undefined,
					platform,
					surface:
						surface ??
						surfaceOptions(capabilities, platform)[0]?.surface ??
						"feed_post",
					inheritSource: "shared",
					contentMode: "inherit",
					content: createDraftContent(sharedDraft.kind),
					assetMode: "inherit",
					assetIds: [],
					removedInheritedResourceIds: [],
					approvalState: "draft",
					reviewHistory: [],
					latestPublication: undefined,
					notes: "",
				},
			];
		});
		setActiveTab(platform);
	}

	function updateVariant(platform: string, patch: Partial<DraftVariant>) {
		setVariants((current) =>
			current.map((variant) =>
				variant.platform === platform ? { ...variant, ...patch } : variant,
			),
		);
	}

	function removeVariant(platform: string) {
		setVariants((current) => {
			const removed = current.find((variant) => variant.platform === platform);
			if (removed?.id) {
				setDeletedVariantIds((existing) => [...existing, removed.id as string]);
			}
			return current.filter((variant) => variant.platform !== platform);
		});
		if (startsFromPlatform === platform) {
			setStartsFromPlatform("");
			setStartsFromSurface("");
		}
		setActiveTab("shared");
	}

	async function saveDraft() {
		if (!title.trim()) {
			setError("Post title is required.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			const body = {
				title,
				contentKind: sharedDraft.kind,
				contentPayload: buildContentPayload(sharedDraft),
				originPlatform: startsFromPlatform,
				originSurface: startsFromSurface,
				requiresApproval,
				notes,
			};
			const post = postId
				? await customerRequest<PostDetail>(`/posts/${postId}`, {
						method: "PATCH",
						body,
					})
				: await customerRequest<PostDetail>("/posts", {
						method: "POST",
						body,
					});
			await customerRequest(`/posts/${post.id}/assets`, {
				method: "PUT",
				body: { resourceIds: rootAssetIds },
			});
			for (const variant of variants) {
				const savedVariant = variant.id
					? await customerRequest<PostVariant>(
							`/posts/variants/${variant.id}`,
							{
								method: "PATCH",
								body: {
									platform: variant.platform,
									surface: variant.surface,
									inheritSource: variant.inheritSource,
									contentMode: variant.contentMode,
									contentKind: variant.content.kind,
									contentPayload:
										variant.contentMode === "custom"
											? buildContentPayload(variant.content)
											: {},
									assetMode: variant.assetMode,
									notes: variant.notes,
								},
							},
						)
					: await customerRequest<PostVariant>(`/posts/${post.id}/variants`, {
							method: "POST",
							body: {
								platform: variant.platform,
								surface: variant.surface,
								inheritSource: variant.inheritSource,
								contentMode: variant.contentMode,
								contentKind: variant.content.kind,
								contentPayload:
									variant.contentMode === "custom"
										? buildContentPayload(variant.content)
										: {},
								assetMode: variant.assetMode,
								notes: variant.notes,
							},
						});
				await customerRequest(`/posts/variants/${savedVariant.id}/assets`, {
					method: "PUT",
					body: {
						resourceIds: variant.assetIds,
						assetMode: variant.assetMode,
						removedInheritedResourceIds: variant.removedInheritedResourceIds,
					},
				});
			}
			for (const variantId of deletedVariantIds) {
				await customerRequest(`/posts/variants/${variantId}`, {
					method: "DELETE",
				});
			}
			if (!postId) {
				navigate(`/dashboard/posts/${post.id}/edit`);
				return;
			}
			await loadEditor(post.id);
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to save the draft.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function runVariantAction(
		variant: DraftVariant,
		action:
			| "submit"
			| "approve"
			| "changes"
			| "schedule"
			| "unschedule"
			| "record",
	) {
		if (!variant.id) {
			setError("Save the draft once before using review or publish actions.");
			return;
		}
		if (hasUnsavedChanges) {
			setError(
				"Save your unsaved changes before running review or publish actions.",
			);
			return;
		}
		setSaving(true);
		setError(null);
		try {
			if (action === "submit") {
				await customerRequest(`/posts/variants/${variant.id}/reviews/submit`, {
					method: "POST",
					body: { comment: "" },
				});
			} else if (action === "approve" || action === "changes") {
				await customerRequest(
					`/posts/variants/${variant.id}/reviews/decision`,
					{
						method: "POST",
						body: {
							approvalState:
								action === "approve" ? "approved" : "changes_requested",
							comment: "",
						},
					},
				);
			} else if (action === "schedule") {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/schedule`,
					{
						method: "POST",
						body: {
							plannedAt: variant.latestPublication?.plannedAt,
							source: "manual",
						},
					},
				);
			} else if (action === "unschedule") {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/unschedule`,
					{
						method: "POST",
					},
				);
			} else {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/record-published`,
					{ method: "POST" },
				);
			}
			await loadEditor(postId);
		} catch (actionError) {
			setError(
				actionError instanceof Error
					? actionError.message
					: "Unable to update this variant.",
			);
		} finally {
			setSaving(false);
		}
	}

	function setPlannedAt(platform: string, value: string) {
		const variant = variants.find((entry) => entry.platform === platform);
		if (!variant) {
			return;
		}
		updateVariant(platform, {
			latestPublication: {
				id: variant.latestPublication?.id ?? "",
				variantId: variant.id ?? "",
				publicationState:
					variant.latestPublication?.publicationState ?? "unscheduled",
				plannedAt: fromDateTimeLocal(value) || undefined,
				publishedAt: variant.latestPublication?.publishedAt,
				externalPostId: variant.latestPublication?.externalPostId,
				externalAccountId: variant.latestPublication?.externalAccountId,
				source: variant.latestPublication?.source ?? "manual",
				lastError: variant.latestPublication?.lastError,
				metadata: variant.latestPublication?.metadata,
				createdAt: variant.latestPublication?.createdAt ?? "",
				updatedAt: variant.latestPublication?.updatedAt ?? "",
			},
		});
	}

	function updateThreadItem(platform: string, index: number, value: string) {
		const variant = variants.find((entry) => entry.platform === platform);
		if (!variant) {
			return;
		}
		const next = [...variant.content.threadItems];
		next[index] = value;
		updateVariant(platform, {
			content: { ...variant.content, threadItems: next },
		});
	}

	return (
		<AdminFormPage
			eyebrow="Compose"
			title={isEditMode ? "Edit post" : "Create post"}
			description="Shared draft for reusable source material, platform tabs for the actual variants you schedule and review."
			actions={
				<Button variant="outline" className="rounded-full" asChild>
					<Link to={postId ? `/dashboard/posts/${postId}` : "/dashboard/posts"}>
						<ArrowLeft className="size-4" />
						Back
					</Link>
				</Button>
			}
			aside={
				<div className="space-y-6 xl:sticky xl:top-24">
					<SurfaceCard className="space-y-4 p-5">
						<div className="text-lg font-semibold">
							{title || "Untitled post"}
						</div>
						<div className="text-sm text-muted-foreground">
							{activeTab === "shared"
								? "Keep the shared draft light if the real post starts in a platform tab."
								: "Review and schedule actions stay inside the active platform tab."}
						</div>
						<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
							{hasUnsavedChanges
								? "Unsaved changes are present. Save first to refresh readiness before scheduling."
								: `${variants.length} platform tab(s) active • ${rootAssetIds.length} shared asset(s) attached`}
						</div>
						{activeSnapshot ? (
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
								{activeSnapshot.readiness.scheduleBlockers.length === 0
									? "This tab is locally ready to schedule."
									: `${activeSnapshot.readiness.scheduleBlockers.length} schedule blocker(s) still need attention.`}
							</div>
						) : null}
					</SurfaceCard>
				</div>
			}
		>
			<div className="space-y-6">
				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}
				{dataWarning ? (
					<SurfaceCard className="flex items-start gap-3 border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div>{dataWarning}</div>
					</SurfaceCard>
				) : null}

				<SurfaceCard className="space-y-5 p-5 md:p-6">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<div className="text-lg font-semibold">Post shell</div>
							<div className="text-sm text-muted-foreground">
								Title is the only always-required field. Everything else can
								stay draft-ready until a platform tab needs it.
							</div>
						</div>
						<Button
							type="button"
							className="rounded-full bg-gradient-brand text-white border-0"
							disabled={loading || saving}
							onClick={() => void saveDraft()}
						>
							{saving ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<Save className="size-4" />
							)}
							Save draft
						</Button>
					</div>

					<AdminFormGrid>
						<AdminFormField className="md:col-span-2">
							<Label htmlFor="post-title">Post title</Label>
							<Input
								id="post-title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								className={adminInputClassName}
								placeholder="Q2 product launch story"
							/>
						</AdminFormField>
						<AdminFormField>
							<Label>Starts from</Label>
							<Select
								value={startsFromPlatform || "shared"}
								onValueChange={(value) => {
									if (value === "shared") {
										setStartsFromPlatform("");
										setStartsFromSurface("");
										setActiveTab("shared");
										return;
									}
									const surface =
										surfaceOptions(capabilities, value)[0]?.surface ??
										"feed_post";
									setStartsFromPlatform(value);
									setStartsFromSurface(surface);
									ensurePlatformTab(value, surface);
								}}
							>
								<SelectTrigger className={adminSelectTriggerClassName}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="shared">Shared draft</SelectItem>
									{platformOptions.map((platform) => (
										<SelectItem key={platform} value={platform}>
											{formatPlatformLabel(platform)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</AdminFormField>
						<AdminFormField>
							<Label>Post format</Label>
							<Select
								value={startsFromSurface || "none"}
								onValueChange={(value) => {
									setStartsFromSurface(value);
									if (startsFromPlatform) {
										ensurePlatformTab(startsFromPlatform, value);
									}
								}}
								disabled={!startsFromPlatform}
							>
								<SelectTrigger className={adminSelectTriggerClassName}>
									<SelectValue
										placeholder={
											startsFromPlatform
												? "Choose the primary format"
												: "Pick a platform first"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{surfaceOptions(capabilities, startsFromPlatform).map(
										(rule) => (
											<SelectItem key={rule.surface} value={rule.surface}>
												{rule.label}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</AdminFormField>
					</AdminFormGrid>
					<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
						<AdminFormField>
							<Label htmlFor="post-notes">Internal notes</Label>
							<Textarea
								id="post-notes"
								value={notes}
								onChange={(event) => setNotes(event.target.value)}
								className={mediumTextareaClassName}
								placeholder="Editorial context, approvals, or reminders"
							/>
						</AdminFormField>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
							<div className="flex items-start justify-between gap-4">
								<div>
									<div className="font-medium">Require approval</div>
									<div className="text-sm text-muted-foreground">
										Block schedule and publish actions until a reviewer
										approves.
									</div>
								</div>
								<Switch
									checked={requiresApproval}
									onCheckedChange={setRequiresApproval}
								/>
							</div>
						</div>
					</div>
				</SurfaceCard>

				<SurfaceCard className="space-y-5 p-5 md:p-6">
					<div>
						<div className="text-lg font-semibold">Composer tabs</div>
						<div className="text-sm text-muted-foreground">
							Open only the tab you need. This keeps the form short and the
							publish controls close to the variant they affect.
						</div>
					</div>

					<Tabs
						value={activeTab}
						onValueChange={(value) => {
							if (value === "shared") {
								setActiveTab("shared");
								return;
							}
							ensurePlatformTab(value);
						}}
					>
						<TabsList
							variant="line"
							className="flex w-full flex-wrap justify-start gap-2 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/50 p-2"
						>
							<TabsTrigger
								value="shared"
								className="rounded-[18px] px-3 py-2 data-active:bg-background"
							>
								<Globe2 className="size-4" />
								Shared draft
							</TabsTrigger>
							{platformOptions.map((platform) => {
								const exists = variants.some(
									(variant) => variant.platform === platform,
								);
								return (
									<TabsTrigger
										key={platform}
										value={platform}
										className={cn(
											"rounded-[18px] px-3 py-2 data-active:bg-background",
											!exists && "opacity-65",
										)}
									>
										{platformIcon(platform)}
										{formatPlatformLabel(platform)}
									</TabsTrigger>
								);
							})}
						</TabsList>
						<TabsContent value="shared" className="mt-5">
							<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
								<div className="space-y-5">
									<SurfaceCard className="space-y-4 p-5">
										<div className="text-sm font-medium">Shared content</div>
										<AdminFormField>
											<Label>Content type</Label>
											<Select
												value={sharedDraft.kind}
												onValueChange={(value) =>
													setSharedDraft({
														...sharedDraft,
														kind: value as ContentKind,
													})
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
										{sharedDraft.kind === "article" ? (
											<>
												<Input
													value={sharedDraft.articleTitle}
													onChange={(event) =>
														setSharedDraft({
															...sharedDraft,
															articleTitle: event.target.value,
														})
													}
													className={adminInputClassName}
													placeholder="Article title"
												/>
												<Textarea
													value={sharedDraft.articleBody}
													onChange={(event) =>
														setSharedDraft({
															...sharedDraft,
															articleBody: event.target.value,
														})
													}
													className={longTextareaClassName}
													placeholder="# Heading\n\nWrite the article in markdown."
												/>
											</>
										) : sharedDraft.kind === "thread" ? (
											<div className="space-y-3">
												{sharedDraft.threadItems.map((item, index) => {
													return (
														<div
															key={`shared-thread-${item || "blank"}`}
															className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
														>
															<div className="mb-2 text-sm font-medium">
																Post {index + 1}
															</div>
															<Textarea
																value={item}
																onChange={(event) => {
																	const next = [...sharedDraft.threadItems];
																	next[index] = event.target.value;
																	setSharedDraft({
																		...sharedDraft,
																		threadItems: next,
																	});
																}}
																className={compactTextareaClassName}
															/>
														</div>
													);
												})}
												<Button
													type="button"
													variant="outline"
													className="rounded-full"
													onClick={() =>
														setSharedDraft({
															...sharedDraft,
															threadItems: [...sharedDraft.threadItems, ""],
														})
													}
												>
													<Plus className="size-4" />
													Add thread item
												</Button>
											</div>
										) : (
											<Textarea
												value={sharedDraft.textBody}
												onChange={(event) =>
													setSharedDraft({
														...sharedDraft,
														textBody: event.target.value,
													})
												}
												className={longTextareaClassName}
												placeholder="Shared draft body"
											/>
										)}
									</SurfaceCard>
									<SurfaceCard className="space-y-4 p-5">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<div>
												<div className="text-sm font-medium">Shared assets</div>
												<div className="text-sm text-muted-foreground">
													Available to any variant that inherits shared assets.
												</div>
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
											resources={rootAssets}
											onRemove={(resourceId) =>
												setRootAssetIds((current) =>
													current.filter((item) => item !== resourceId),
												)
											}
										/>
									</SurfaceCard>
								</div>
								<SurfaceCard className="space-y-3 p-5">
									<div className="text-sm font-medium">Shared preview</div>
									<pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
										{renderContentPreview(
											sharedDraft.kind,
											buildContentPayload(sharedDraft),
										)}
									</pre>
								</SurfaceCard>
							</div>
						</TabsContent>

						{platformOptions.map((platform) => {
							const variant = variants.find(
								(entry) => entry.platform === platform,
							);
							const snapshot = snapshots.get(platform);
							if (!variant || !snapshot) {
								return (
									<TabsContent key={platform} value={platform} className="mt-5">
										<SurfaceCard className="rounded-[28px] border border-dashed border-[var(--brand-border-soft)] px-5 py-8 text-sm text-muted-foreground">
											Open this tab to create the first{" "}
											{formatPlatformLabel(platform)} variant.
										</SurfaceCard>
									</TabsContent>
								);
							}

							const scheduleBlockers = summarizeIssues(
								snapshot.readiness.scheduleBlockers,
							);
							const publishBlockers = summarizeIssues(
								snapshot.readiness.publishBlockers,
							);
							const threadItems =
								variant.content.threadItems.length > 0
									? variant.content.threadItems
									: [""];

							return (
								<TabsContent key={platform} value={platform} className="mt-5">
									<div className="space-y-5">
										<SurfaceCard className="space-y-4 p-5">
											<div className="flex flex-wrap items-start justify-between gap-4">
												<div className="space-y-2">
													<div className="flex items-center gap-2 text-lg font-semibold">
														{platformIcon(platform)}
														{formatPlatformLabel(platform)}
													</div>
													<div className="flex flex-wrap gap-2">
														<Badge variant="outline" className="rounded-full">
															{formatSurfaceLabel(
																snapshot.rule,
																variant.surface,
															)}
														</Badge>
														<Badge variant="outline" className="rounded-full">
															Review: {variant.approvalState}
														</Badge>
														<Badge variant="outline" className="rounded-full">
															Publish:{" "}
															{variant.latestPublication?.publicationState ??
																"unscheduled"}
														</Badge>
													</div>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full text-red-600"
													onClick={() => removeVariant(platform)}
												>
													<Trash2 className="size-4" />
													Remove tab
												</Button>
											</div>
											<AdminFormGrid>
												<AdminFormField>
													<Label>Post format</Label>
													<Select
														value={variant.surface}
														onValueChange={(value) =>
															updateVariant(platform, { surface: value })
														}
													>
														<SelectTrigger
															className={adminSelectTriggerClassName}
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{surfaceOptions(capabilities, platform).map(
																(rule) => (
																	<SelectItem
																		key={rule.surface}
																		value={rule.surface}
																	>
																		{rule.label}
																	</SelectItem>
																),
															)}
														</SelectContent>
													</Select>
												</AdminFormField>
												<AdminFormField>
													<Label>Inherit from</Label>
													<Select
														value={variant.inheritSource}
														onValueChange={(value) =>
															updateVariant(platform, { inheritSource: value })
														}
													>
														<SelectTrigger
															className={adminSelectTriggerClassName}
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="shared">
																Shared draft
															</SelectItem>
															{variants
																.filter((entry) => entry.platform !== platform)
																.map((entry) => (
																	<SelectItem
																		key={entry.platform}
																		value={`platform:${entry.platform}`}
																	>
																		{formatPlatformLabel(entry.platform)}
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
															updateVariant(platform, {
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
															<SelectItem value="inherit">Inherited</SelectItem>
															<SelectItem value="custom">Custom</SelectItem>
														</SelectContent>
													</Select>
												</AdminFormField>
												<AdminFormField>
													<Label>Asset behavior</Label>
													<Select
														value={variant.assetMode}
														onValueChange={(value) =>
															updateVariant(platform, {
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
															<SelectItem value="inherit">Inherited</SelectItem>
															<SelectItem value="replace">Replace</SelectItem>
														</SelectContent>
													</Select>
												</AdminFormField>
											</AdminFormGrid>
										</SurfaceCard>

										<SurfaceCard className="space-y-4 p-5">
											<div className="mb-3 flex items-center gap-2 text-sm font-medium">
												<CalendarClock className="size-4 text-primary" />
												Review and publish actions
											</div>
											<div className="grid gap-4 md:grid-cols-2">
												<DateTimePicker
													value={toDateTimeLocal(
														variant.latestPublication?.plannedAt,
													)}
													onChange={(value) => setPlannedAt(platform, value)}
													placeholder="Choose a planned slot"
												/>
												<div className="text-sm text-muted-foreground">
													{variant.latestPublication?.plannedAt
														? `Planned for ${new Date(variant.latestPublication.plannedAt).toLocaleString()}`
														: "No planned time yet"}
												</div>
											</div>
											<div className="mt-4 flex flex-wrap gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "submit")
													}
													disabled={saving}
												>
													<Send className="size-4" />
													Submit
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "approve")
													}
													disabled={saving}
												>
													<CheckCircle2 className="size-4" />
													Approve
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "changes")
													}
													disabled={saving}
												>
													<XCircle className="size-4" />
													Request changes
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "schedule")
													}
													disabled={saving || scheduleBlockers.length > 0}
												>
													<Clock3 className="size-4" />
													Schedule
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "unschedule")
													}
													disabled={saving}
												>
													Unschedule
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													onClick={() =>
														void runVariantAction(variant, "record")
													}
													disabled={saving || publishBlockers.length > 0}
												>
													Record as published
												</Button>
											</div>
											{scheduleBlockers.length > 0 ? (
												<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
													<div className="mb-2 font-medium">
														Needs attention
													</div>
													<div className="space-y-2">
														{scheduleBlockers.map((issue) => (
															<div key={issue.code}>{issue.message}</div>
														))}
													</div>
												</div>
											) : null}
											{publishBlockers.length > 0 ? (
												<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
													<div className="mb-2 font-medium">
														Publish blockers
													</div>
													<div className="space-y-2">
														{publishBlockers.map((issue) => (
															<div key={issue.code}>{issue.message}</div>
														))}
													</div>
												</div>
											) : null}
										</SurfaceCard>

										<SurfaceCard className="space-y-4 p-5">
											<div className="text-sm font-medium">Content</div>
											{variant.contentMode === "inherit" ? (
												<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
													<div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
														Inherited from {snapshot.sourceLabel}
													</div>
													<pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
														{renderContentPreview(
															snapshot.contentKind,
															snapshot.contentPayload,
														)}
													</pre>
												</div>
											) : variant.content.kind === "article" ? (
												<>
													<Input
														value={variant.content.articleTitle}
														onChange={(event) =>
															updateVariant(platform, {
																content: {
																	...variant.content,
																	articleTitle: event.target.value,
																},
															})
														}
														className={adminInputClassName}
														placeholder="Article title"
													/>
													<Textarea
														value={variant.content.articleBody}
														onChange={(event) =>
															updateVariant(platform, {
																content: {
																	...variant.content,
																	articleBody: event.target.value,
																},
															})
														}
														className={longTextareaClassName}
														placeholder="# Heading\n\nWrite the article in markdown."
													/>
												</>
											) : variant.content.kind === "thread" ? (
												<div className="space-y-3">
													{threadItems.map((item, index) => {
														return (
															<div
																key={`${platform}-${item || "blank"}`}
																className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
															>
																<div className="mb-3 flex items-center justify-between gap-3">
																	<div className="text-sm font-medium">
																		Post {index + 1}
																	</div>
																	<div className="flex flex-wrap gap-2">
																		<Button
																			type="button"
																			variant="outline"
																			size="sm"
																			className="rounded-full"
																			disabled={index === 0}
																			onClick={() => {
																				const next = [...threadItems];
																				[next[index - 1], next[index]] = [
																					next[index],
																					next[index - 1],
																				];
																				updateVariant(platform, {
																					content: {
																						...variant.content,
																						threadItems: next,
																					},
																				});
																			}}
																		>
																			<ChevronUp className="size-4" />
																		</Button>
																		<Button
																			type="button"
																			variant="outline"
																			size="sm"
																			className="rounded-full"
																			disabled={
																				index === threadItems.length - 1
																			}
																			onClick={() => {
																				const next = [...threadItems];
																				[next[index + 1], next[index]] = [
																					next[index],
																					next[index + 1],
																				];
																				updateVariant(platform, {
																					content: {
																						...variant.content,
																						threadItems: next,
																					},
																				});
																			}}
																		>
																			<ChevronDown className="size-4" />
																		</Button>
																	</div>
																</div>
																<Textarea
																	value={item}
																	onChange={(event) =>
																		updateThreadItem(
																			platform,
																			index,
																			event.target.value,
																		)
																	}
																	className={compactTextareaClassName}
																/>
															</div>
														);
													})}
													<Button
														type="button"
														variant="outline"
														className="rounded-full"
														onClick={() =>
															updateVariant(platform, {
																content: {
																	...variant.content,
																	threadItems: [...threadItems, ""],
																},
															})
														}
													>
														<Plus className="size-4" />
														Add thread item
													</Button>
												</div>
											) : (
												<Textarea
													value={variant.content.textBody}
													onChange={(event) =>
														updateVariant(platform, {
															content: {
																...variant.content,
																textBody: event.target.value,
															},
														})
													}
													className={longTextareaClassName}
													placeholder="Platform-specific body"
												/>
											)}
										</SurfaceCard>

										<SurfaceCard className="space-y-4 p-5">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div>
													<div className="text-sm font-medium">Assets</div>
													<div className="text-sm text-muted-foreground">
														Inherit by default. Replace or append only when the
														format demands it.
													</div>
												</div>
												<ResourcePicker
													resources={resources}
													resourceSets={resourceSets}
													resolveResourceSetIds={resolveResourceSetIds}
													value={variant.assetIds}
													onChange={(nextValue) =>
														updateVariant(platform, { assetIds: nextValue })
													}
													triggerLabel={
														variant.assetMode === "replace"
															? "Choose assets"
															: "Append assets"
													}
												/>
											</div>
											{variant.assetMode === "inherit" ? (
												<div className="space-y-4">
													<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
														<div className="mb-3 text-sm font-medium">
															Inherited from {snapshot.sourceLabel}
														</div>
														<ResourceChipList
															resources={snapshot.sourceAssets}
															onRemove={(resourceId) =>
																updateVariant(platform, {
																	removedInheritedResourceIds:
																		variant.removedInheritedResourceIds.includes(
																			resourceId,
																		)
																			? variant.removedInheritedResourceIds.filter(
																					(item) => item !== resourceId,
																				)
																			: [
																					...variant.removedInheritedResourceIds,
																					resourceId,
																				],
																})
															}
														/>
													</div>
													<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
														<div className="mb-3 text-sm font-medium">
															Effective assets
														</div>
														<ResourceChipList
															resources={snapshot.effectiveAssets}
														/>
													</div>
												</div>
											) : (
												<ResourceChipList
													resources={variant.assetIds
														.map((assetId) => resourcesById.get(assetId))
														.filter((asset): asset is ResourceRecord =>
															Boolean(asset),
														)}
													onRemove={(resourceId) =>
														updateVariant(platform, {
															assetIds: variant.assetIds.filter(
																(item) => item !== resourceId,
															),
														})
													}
												/>
											)}
										</SurfaceCard>

										<SurfaceCard className="space-y-4 p-5">
											<div className="text-sm font-medium">Variant notes</div>
											<Textarea
												value={variant.notes}
												onChange={(event) =>
													updateVariant(platform, { notes: event.target.value })
												}
												className={compactTextareaClassName}
												placeholder="Anything unique to this platform tab"
											/>
										</SurfaceCard>
									</div>
								</TabsContent>
							);
						})}
					</Tabs>
				</SurfaceCard>

				{legacyVariants.length > 0 ? (
					<SurfaceCard className="p-5 md:p-6">
						<details className="group">
							<summary className="cursor-pointer list-none">
								<div className="flex items-center justify-between gap-4">
									<div>
										<div className="text-lg font-semibold">
											Legacy / advanced variants
										</div>
										<div className="text-sm text-muted-foreground">
											Older posts may contain more than one variant for the same
											platform. They stay visible here so nothing disappears.
										</div>
									</div>
									<Badge variant="outline" className="rounded-full">
										{legacyVariants.length}
									</Badge>
								</div>
							</summary>
							<div className="mt-4 grid gap-4 md:grid-cols-2">
								{legacyVariants.map((variant) => (
									<div
										key={variant.id}
										className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-4"
									>
										<div className="font-medium">
											{formatPlatformLabel(variant.platform)} ·{" "}
											{formatSurfaceLabel(
												findRule(
													capabilities,
													variant.platform,
													variant.surface,
												),
												variant.surface,
											)}
										</div>
										<div className="mt-2 text-sm text-muted-foreground">
											Approval: {variant.approvalState}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											Publication:{" "}
											{variant.latestPublication?.publicationState ??
												"unscheduled"}
										</div>
									</div>
								))}
							</div>
						</details>
					</SurfaceCard>
				) : null}
			</div>
		</AdminFormPage>
	);
}
