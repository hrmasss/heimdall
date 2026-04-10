import {
	AlertTriangle,
	ArrowLeft,
	CalendarClock,
	CalendarDays,
	CheckCircle2,
	CircleAlert,
	CircleCheckBig,
	CircleSlash,
	ImageIcon,
	LoaderCircle,
	Plus,
	Save,
	Send,
	Settings2,
	WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
	AdminFormField,
	AdminFormGrid,
	adminInputClassName,
	adminSelectTriggerClassName,
	adminTextareaClassName,
} from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { DashboardOperationalHeader } from "@/components/app/dashboard";
import {
	formatResourceMeta,
	ResourceChipList,
	ResourceThumb,
} from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
	AIGeneratedPostDraft,
	AIProviderCatalog,
	CampaignSummary,
	PostDetail,
	PostComposeBootstrapResponse,
	PostVariant,
	PublicationPlan,
	ReadinessIssue,
	ResourceCapabilityMatrix,
	ResourceCapabilityRule,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
	ReviewRecord,
	SocialTargetRecord,
	VariantReadiness,
	WorkspaceAISettings,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { formatPlatformLabel, platformIcon } from "@/lib/platforms";
import { normalizePostDetail } from "@/lib/post-models";
import { isHealthyStatus } from "@/lib/social-connections";
import { cn } from "@/lib/utils";

type ContentKind = "text" | "article" | "thread";
type DraftContent = {
	kind: ContentKind;
	textBody: string;
	articleTitle: string;
	articleBody: string;
	threadItems: string[];
	tags: string[];
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

type ComposerDrawerMode = "platforms" | "schedule" | "platform-detail";

type PlannedTimeDraft = {
	hour: string;
	minute: string;
	meridiem: "AM" | "PM";
};

type DestinationStatus = "ready" | "attention" | "blocked" | "not_connected";

type DestinationView = {
	platform: string;
	target: SocialTargetRecord | null;
	variant: DraftVariant | null;
	snapshot: VariantSnapshot | null;
	status: DestinationStatus;
	label: string;
	summary: string;
	blockers: ReadinessIssue[];
	warnings: ReadinessIssue[];
};

type BulkActionSummary = {
	action: "publish" | "schedule" | "submit";
	succeeded: { platform: string; detail: string }[];
	skipped: { platform: string; detail: string }[];
	failed: { platform: string; detail: string }[];
};

const longTextareaClassName = `${adminTextareaClassName} dashboard-textarea-large`;
const mediumTextareaClassName = `${adminTextareaClassName} dashboard-textarea-medium`;
const compactTextareaClassName = `${adminTextareaClassName} dashboard-textarea-medium`;
const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;

function mergeResources(
	current: ResourceRecord[],
	incoming: ResourceRecord[],
): ResourceRecord[] {
	const next = new Map(current.map((resource) => [resource.id, resource]));
	for (const resource of incoming) {
		next.set(resource.id, resource);
	}
	return Array.from(next.values()).sort((left, right) =>
		right.createdAt.localeCompare(left.createdAt),
	);
}

function createDraftContent(kind: ContentKind = "text"): DraftContent {
	return {
		kind,
		textBody: "",
		articleTitle: "",
		articleBody: "",
		threadItems: [""],
		tags: [],
	};
}

function blankReadiness(): VariantReadiness {
	return { draftIssues: [], scheduleBlockers: [], publishBlockers: [] };
}

function normalizeTags(values: string[]) {
	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const tag = value.trim().replace(/^#+/, "");
		if (!tag) {
			continue;
		}
		const key = tag.toLowerCase();
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		normalized.push(tag);
	}
	return normalized;
}

function parseTagInput(value: string) {
	return normalizeTags(value.replace(/\s+#/g, "\n#").split(/[\n,]+|(?=#)/g));
}

function extractTagsFromPayload(payload: Record<string, unknown>) {
	return normalizeTags(
		Array.isArray(payload.tags)
			? payload.tags.filter((tag): tag is string => typeof tag === "string")
			: [],
	);
}

function formatTagLabel(tag: string) {
	return tag.startsWith("#") ? tag : `#${tag}`;
}

function formatTagsForEditor(tags: string[]) {
	return normalizeTags(tags).map(formatTagLabel).join(", ");
}

function buildContentPayload(content: DraftContent) {
	if (content.kind === "thread") {
		return {
			items: content.threadItems
				.map((item) => item.trim())
				.filter(Boolean)
				.map((body) => ({ body })),
			tags: content.tags,
		};
	}
	if (content.kind === "article") {
		return {
			title: content.articleTitle,
			body: content.articleBody,
			tags: content.tags,
		};
	}
	return { body: content.textBody, tags: content.tags };
}

function extractCaptionFromDraftContent(content: DraftContent): string {
	if (content.kind === "article") {
		return [content.articleTitle.trim(), content.articleBody.trim()]
			.filter(Boolean)
			.join("\n\n");
	}
	if (content.kind === "thread") {
		return content.threadItems
			.map((item) => item.trim())
			.filter(Boolean)
			.join("\n\n");
	}
	return content.textBody;
}

function hasMeaningfulDraftContent(content: DraftContent) {
	return extractCaptionFromDraftContent(content).trim().length > 0;
}

function hasMeaningfulCustomContent(content: DraftContent) {
	if (hasMeaningfulDraftContent(content)) {
		return true;
	}
	if (content.tags.some((tag) => tag.trim().length > 0)) {
		return true;
	}
	return false;
}

function preferredVariantModes(
	sourceContent: DraftContent,
	sourceAssets: ResourceRecord[],
) {
	return {
		contentMode: (hasMeaningfulDraftContent(sourceContent)
			? "inherit"
			: "custom") as DraftVariant["contentMode"],
		assetMode: (sourceAssets.length > 0
			? "inherit"
			: "replace") as DraftVariant["assetMode"],
	};
}

function deriveDraftTitle(content: DraftContent) {
	if (content.kind === "article") {
		return content.articleTitle.trim().slice(0, 80);
	}
	if (content.kind === "thread") {
		return content.threadItems
			.map((item) => item.trim())
			.find(Boolean)
			?.slice(0, 80) ?? "";
	}
	return content.textBody.trim().slice(0, 80);
}

function hasMeaningfulSharedDraft(content: DraftContent) {
	if (content.kind === "article") {
		return Boolean(content.articleTitle.trim() || content.articleBody.trim());
	}
	if (content.kind === "thread") {
		return content.threadItems.some((item) => item.trim());
	}
	return Boolean(content.textBody.trim());
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
			tags: extractTagsFromPayload(payload),
		};
	}
	if (kind === "article") {
		return {
			kind,
			textBody: "",
			articleTitle: typeof payload.title === "string" ? payload.title : "",
			articleBody: typeof payload.body === "string" ? payload.body : "",
			threadItems: [""],
			tags: extractTagsFromPayload(payload),
		};
	}
	return {
		kind,
		textBody: typeof payload.body === "string" ? payload.body : "",
		articleTitle: "",
		articleBody: "",
		threadItems: [""],
		tags: extractTagsFromPayload(payload),
	};
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

function preferredContentKindForRule(
	rule: ResourceCapabilityRule | undefined,
	currentKind: ContentKind,
): ContentKind {
	if (!rule || rule.supportedContentKinds.length === 0) {
		return currentKind;
	}
	if (shouldPreferTextCaption(rule, currentKind)) {
		return "text";
	}
	if (rule.supportedContentKinds.includes(currentKind)) {
		return currentKind;
	}
	if (rule.supportedContentKinds.includes("text")) {
		return "text";
	}
	return (rule.supportedContentKinds[0] as ContentKind) ?? currentKind;
}

function shouldPreferTextCaption(
	rule: Pick<ResourceCapabilityRule, "accepts" | "supportedContentKinds">,
	currentKind: ContentKind,
) {
	if (currentKind === "text" || !rule.supportedContentKinds.includes("text")) {
		return false;
	}
	return rule.accepts.some((accepted) =>
		["image", "video", "audio"].includes(accepted),
	);
}

function coerceDraftContentForRule(
	content: DraftContent,
	rule: ResourceCapabilityRule | undefined,
): DraftContent {
	const preferredKind = preferredContentKindForRule(rule, content.kind);
	if (preferredKind === content.kind) {
		return content;
	}
	if (preferredKind === "text") {
		return {
			kind: "text",
			textBody: extractCaptionFromDraftContent(content),
			articleTitle: "",
			articleBody: "",
			threadItems: [""],
			tags: content.tags,
		};
	}
	return createDraftContent(preferredKind);
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

function inferSupportedContentKinds(
	rule: Pick<
		ResourceCapabilityRule,
		"platform" | "surface" | "label" | "accepts"
	>,
): ContentKind[] {
	const kinds: ContentKind[] = ["text"];
	const surfaceKey =
		`${rule.platform} ${rule.surface} ${rule.label}`.toLowerCase();
	const accepts = Array.isArray(rule.accepts) ? rule.accepts : [];
	if (surfaceKey.includes("thread") || rule.platform === "x") {
		kinds.push("thread");
	}
	if (
		accepts.includes("document") ||
		surfaceKey.includes("article") ||
		surfaceKey.includes("document") ||
		rule.platform === "linkedin" ||
		rule.platform === "facebook" ||
		rule.platform === "instagram"
	) {
		kinds.push("article");
	}
	return Array.from(new Set(kinds));
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
						: inferSupportedContentKinds({
								platform: rule.platform,
								surface: rule.surface,
								label: rule.label,
								accepts,
							}),
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

function padNumber(value: number) {
	return String(value).padStart(2, "0");
}

function to24Hour(hour12: number, meridiem: "AM" | "PM") {
	if (meridiem === "AM") {
		return hour12 === 12 ? 0 : hour12;
	}
	return hour12 === 12 ? 12 : hour12 + 12;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(Math.max(value, minimum), maximum);
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

function TagBadgeRow({ tags }: { tags: string[] }) {
	if (tags.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">No shared tags yet.</div>
		);
	}
	return (
		<div className="flex flex-wrap gap-2">
			{tags.map((tag) => (
				<Badge
					key={tag}
					variant="secondary"
					className="rounded-full border border-[var(--brand-border-soft)] bg-background/70 px-3 py-1 text-xs font-medium"
				>
					{formatTagLabel(tag)}
				</Badge>
			))}
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
	const normalizedContent = coerceDraftContentForRule(resolvedContent, rule);
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
			!rule.supportedContentKinds.includes(normalizedContent.kind)
		) {
			pushBlocker(
				{
					code: "content_kind_unsupported",
					message: `${rule.label} does not support ${normalizedContent.kind} content.`,
				},
				false,
			);
		}
		if (
			normalizedContent.kind === "thread" &&
			((
				buildContentPayload(normalizedContent).items as
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
			normalizedContent.kind === "article" &&
			normalizedContent.articleBody.trim() === ""
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
		contentKind: normalizedContent.kind,
		contentPayload: buildContentPayload(normalizedContent),
		sourceAssets,
		effectiveAssets,
		readiness,
	};
}

function targetPlatform(target: SocialTargetRecord) {
	if (target.provider === "meta") {
		if (target.targetType === "facebook_page") {
			return "facebook";
		}
		if (target.targetType === "instagram_professional") {
			return "instagram";
		}
	}
	return target.provider;
}

function healthySelectedTargetsByPlatform(targets: SocialTargetRecord[]) {
	const result = new Map<string, SocialTargetRecord>();
	for (const target of targets) {
		if (!target.isSelected || !isHealthyStatus(target.status)) {
			continue;
		}
		const platform = targetPlatform(target);
		if (!platform || result.has(platform)) {
			continue;
		}
		result.set(platform, target);
	}
	return result;
}

function pickBestRuleForPlatform(
	platform: string,
	capabilities: ResourceCapabilityMatrix | null,
	content: DraftContent,
	assets: ResourceRecord[],
) {
	const rules = surfaceOptions(capabilities, platform);
	if (rules.length === 0) {
		return undefined;
	}
	const assetKinds = assets.map((asset) => asset.mediaKind);
	const assetCount = assets.length;
	const allImages =
		assetCount > 0 && assetKinds.every((kind) => kind === "image");
	const allVideos =
		assetCount > 0 && assetKinds.every((kind) => kind === "video");

	const scored = rules.map((rule) => {
		let score = 0;
		const supportsCurrentKind = rule.supportedContentKinds.includes(
			content.kind,
		);
		if (supportsCurrentKind) {
			score += 18;
		}
		if (assetCount === 0) {
			if (!rule.assetRequired) {
				score += 24;
			}
			if (
				/text|feed|post/i.test(rule.surface) ||
				/text|feed/i.test(rule.label)
			) {
				score += 12;
			}
		} else {
			const acceptedCount = assets.filter((asset) =>
				rule.accepts.includes(asset.mediaKind),
			).length;
			score += acceptedCount * 8;
			if (acceptedCount === assetCount) {
				score += 36;
			}
			if (!rule.assetRequired) {
				score += 4;
			}
			if (typeof rule.minItems === "number" && assetCount >= rule.minItems) {
				score += 6;
			}
			if (typeof rule.maxItems === "number" && assetCount <= rule.maxItems) {
				score += 6;
			}
			if (
				allImages &&
				/image|photo|carousel|multi/i.test(`${rule.surface} ${rule.label}`)
			) {
				score += 10;
			}
			if (
				allVideos &&
				/video|reel|short/i.test(`${rule.surface} ${rule.label}`)
			) {
				score += 10;
			}
		}
		return { rule, score };
	});

	scored.sort((left, right) => right.score - left.score);
	return scored[0]?.rule;
}

function createAutoVariant(
	platform: string,
	capabilities: ResourceCapabilityMatrix | null,
	sharedDraft: DraftContent,
	rootAssets: ResourceRecord[],
): DraftVariant {
	const rule = pickBestRuleForPlatform(
		platform,
		capabilities,
		sharedDraft,
		rootAssets,
	);
	const defaultModes = preferredVariantModes(sharedDraft, rootAssets);
	return {
		id: undefined,
		platform,
		surface:
			rule?.surface ??
			surfaceOptions(capabilities, platform)[0]?.surface ??
			"feed_post",
		inheritSource: "shared",
		contentMode: defaultModes.contentMode,
		content: coerceDraftContentForRule(
			createDraftContent(sharedDraft.kind),
			rule,
		),
		assetMode: defaultModes.assetMode,
		assetIds: [],
		removedInheritedResourceIds: [],
		approvalState: "draft",
		reviewHistory: [],
		latestPublication: undefined,
		notes: "",
	};
}

function destinationWarnings(
	destination: Pick<DestinationView, "platform" | "snapshot" | "variant">,
) {
	const warnings: ReadinessIssue[] = [];
	if (!destination.snapshot || !destination.variant) {
		return warnings;
	}
	const content = contentFromDestination(
		destination.variant,
		destination.snapshot,
	);
	const bodyLength = extractCaptionFromDraftContent(content).trim().length;
	if (destination.platform === "x" && bodyLength > 240) {
		warnings.push({
			code: "x_compactness_warning",
			message:
				bodyLength > 280
					? "X will likely need a shorter rewrite or a thread before publishing cleanly."
					: "X is nearing the compact post limit and may need a shorter rewrite.",
		});
	}
	if (
		destination.snapshot.rule &&
		destination.snapshot.contentKind !== destination.variant.content.kind
	) {
		warnings.push({
			code: "content_coerced",
			message: `${destination.snapshot.rule.label} will use a compact caption-style version of this content.`,
		});
	}
	return warnings;
}

function contentFromDestination(
	variant: DraftVariant,
	snapshot: VariantSnapshot,
): DraftContent {
	return variant.contentMode === "custom"
		? variant.content
		: extractDraftContent(snapshot.contentKind, snapshot.contentPayload);
}

function buildBulkPlannedAt(date: Date | null, time: PlannedTimeDraft) {
	if (!date) {
		return undefined;
	}
	const hourValue = time.hour === "" ? DEFAULT_HOUR : Number(time.hour);
	const minuteValue = time.minute === "" ? DEFAULT_MINUTE : Number(time.minute);
	const hour12 = clamp(
		Number.isFinite(hourValue) ? hourValue : DEFAULT_HOUR,
		1,
		12,
	);
	const minute = clamp(
		Number.isFinite(minuteValue) ? minuteValue : DEFAULT_MINUTE,
		0,
		59,
	);
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		to24Hour(hour12, time.meridiem),
		minute,
		0,
		0,
	).toISOString();
}

function formatPlannedAtLabel(value?: string) {
	if (!value) {
		return "Unscheduled";
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "Unscheduled";
	}
	return parsed.toLocaleString([], {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function isCustomOverride(
	variant: DraftVariant,
	capabilities: ResourceCapabilityMatrix | null,
	sharedDraft: DraftContent,
	rootAssets: ResourceRecord[],
) {
	const defaultVariant = createAutoVariant(
		variant.platform,
		capabilities,
		sharedDraft,
		rootAssets,
	);
	return (
		variant.contentMode === "custom" ||
		variant.assetMode === "replace" ||
		variant.notes.trim() !== "" ||
		variant.surface !== defaultVariant.surface
	);
}

export function DashboardNewPost() {
	const navigate = useNavigate();
	const { id } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const isEditMode = Boolean(id);
	const {
		activeWorkspaceId,
		activeWorkspaceMembership,
		customerRequest,
		hasCustomerPermission,
	} = useAuth();
	const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
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
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [drawerMode, setDrawerMode] = useState<ComposerDrawerMode>("platforms");
	const [lastDrawerMode, setLastDrawerMode] = useState<
		Exclude<ComposerDrawerMode, "platform-detail">
	>("platforms");
	const [socialTargets, setSocialTargets] = useState<SocialTargetRecord[]>([]);
	const [resourceLibraryLoaded, setResourceLibraryLoaded] = useState(false);
	const [resourceLibraryLoading, setResourceLibraryLoading] = useState(false);
	const [_plannedTimeDrafts, setPlannedTimeDrafts] = useState<
		Record<string, PlannedTimeDraft>
	>({});
	const [bulkScheduleDate, setBulkScheduleDate] = useState<Date | null>(null);
	const [bulkScheduleTime, setBulkScheduleTime] = useState<PlannedTimeDraft>({
		hour: padNumber(DEFAULT_HOUR),
		minute: padNumber(DEFAULT_MINUTE),
		meridiem: "AM",
	});
	const [_bulkActionSummary, setBulkActionSummary] =
		useState<BulkActionSummary | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [selectedDestinationPlatform, setSelectedDestinationPlatform] =
		useState<string | null>(null);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [drawerDockMetrics, setDrawerDockMetrics] = useState<{
		left: number;
		width: number;
	} | null>(null);
	const dockRef = useRef<HTMLDivElement | null>(null);

	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [campaignId, setCampaignId] = useState("");
	const [requiresApproval, setRequiresApproval] = useState(false);
	const [, setStartsFromPlatform] = useState("");
	const [, setStartsFromSurface] = useState("");
	const [sharedDraft, setSharedDraft] = useState(createDraftContent());
	const [sharedTagInput, setSharedTagInput] = useState("");
	const [rootAssetIds, setRootAssetIds] = useState<string[]>([]);
	const [prefillAssetsKey, setPrefillAssetsKey] = useState<string | null>(null);
	const [variants, setVariants] = useState<DraftVariant[]>([]);
	const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
	const [excludedPlatforms, setExcludedPlatforms] = useState<string[]>([]);
	const [aiCatalog, setAICatalog] = useState<AIProviderCatalog | null>(null);

	useEffect(() => {
		if (!drawerOpen) {
			return;
		}

		const updateDrawerDockMetrics = () => {
			const rect = dockRef.current?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			setDrawerDockMetrics({
				left: rect.left,
				width: rect.width,
			});
		};

		updateDrawerDockMetrics();

		const resizeObserver =
			typeof ResizeObserver !== "undefined" && dockRef.current
				? new ResizeObserver(() => {
						updateDrawerDockMetrics();
					})
				: null;

		if (resizeObserver && dockRef.current) {
			resizeObserver.observe(dockRef.current);
		}

		window.addEventListener("resize", updateDrawerDockMetrics);

		return () => {
			window.removeEventListener("resize", updateDrawerDockMetrics);
			resizeObserver?.disconnect();
		};
	}, [drawerOpen]);
	const [_aiSettings, setAISettings] = useState<WorkspaceAISettings | null>(
		null,
	);
	const [aiPrompt, setAIPrompt] = useState("");
	const [aiMode, setAIMode] = useState<"native" | "byok">("native");
	const [aiProvider, setAIProvider] = useState("");
	const [aiModel, setAIModel] = useState("");
	const [aiGenerating, setAIGenerating] = useState(false);
	const [_aiWarnings, setAIWarnings] = useState<string[]>([]);
	const [_lastAIDraft, setLastAIDraft] = useState<AIGeneratedPostDraft | null>(
		null,
	);

	function addUploadedResources(created: ResourceRecord[]) {
		setResources((current) => mergeResources(current, created));
	}

	const platformOptions = useMemo(
		() => uniquePlatforms(capabilities),
		[capabilities],
	);
	const aiProviders = aiCatalog?.providers ?? [];
	const workspacePermissions = useMemo(
		() =>
			activeWorkspaceMembership?.roles.flatMap((role) => role.permissions) ??
			[],
		[activeWorkspaceMembership],
	);
	const canPublish = hasCustomerPermission(
		"content.posts.publish",
		workspacePermissions,
	);
	const activeAIProviderConfig = useMemo(
		() =>
			aiProviders.find((provider) => provider.provider === aiProvider) ?? null,
		[aiProvider, aiProviders],
	);
	const loadResourceLibrary = useCallback(async () => {
		if (resourceLibraryLoaded || resourceLibraryLoading) {
			return;
		}
		setResourceLibraryLoading(true);
		try {
			const [resourceResponse, setResponse] = await Promise.all([
				customerRequest<{ items: ResourceRecord[] }>("/resources"),
				customerRequest<{ items: ResourceSetSummary[] }>("/resource-sets"),
			]);
			setResources((current) => mergeResources(current, resourceResponse.items));
			setResourceSets(setResponse.items);
			setResourceLibraryLoaded(true);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load the resource library.",
			);
		} finally {
			setResourceLibraryLoading(false);
		}
	}, [
		customerRequest,
		resourceLibraryLoaded,
		resourceLibraryLoading,
	]);
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
	const selectedTargetsByPlatform = useMemo(
		() => healthySelectedTargetsByPlatform(socialTargets),
		[socialTargets],
	);
	const allDestinationPlatforms = useMemo(
		() =>
			Array.from(
				new Set([
					...platformOptions,
					...variants.map((variant) => variant.platform),
					...selectedTargetsByPlatform.keys(),
				]),
			).sort(),
		[platformOptions, variants, selectedTargetsByPlatform],
	);
	const destinationViews = useMemo<DestinationView[]>(
		() =>
			allDestinationPlatforms.map((platform) => {
				const target = selectedTargetsByPlatform.get(platform) ?? null;
				const variant =
					variants.find((entry) => entry.platform === platform) ?? null;
				const snapshot = variant ? (snapshots.get(platform) ?? null) : null;
				const blockers = snapshot
					? summarizeIssues(snapshot.readiness.publishBlockers)
					: [];
				const initialView: DestinationView = {
					platform,
					target,
					variant,
					snapshot,
					status: "ready",
					label: formatPlatformLabel(platform),
					summary: "Ready to publish.",
					blockers,
					warnings: [],
				};
				if (!target) {
					return {
						...initialView,
						status: "not_connected",
						summary:
							"Connect and select a healthy target to include this platform.",
					};
				}
				if (!variant || !snapshot) {
					return {
						...initialView,
						status: "blocked",
						summary:
							"Variant setup is still loading for this connected platform.",
						blockers: [
							{
								code: "variant_missing",
								message:
									"Variant setup is still loading for this connected platform.",
							},
						],
					};
				}
				const warnings = destinationWarnings(initialView);
				if (blockers.length > 0) {
					return {
						...initialView,
						status: "blocked",
						summary: blockers[0]?.message ?? "Blocked for publish.",
						warnings,
					};
				}
				if (warnings.length > 0) {
					return {
						...initialView,
						status: "attention",
						summary:
							warnings[0]?.message ?? "Needs attention before you publish.",
						warnings,
					};
				}
				return initialView;
			}),
		[allDestinationPlatforms, selectedTargetsByPlatform, variants, snapshots],
	);
	const readyDestinations = destinationViews.filter(
		(destination) => destination.status === "ready",
	);
	const attentionDestinations = destinationViews.filter(
		(destination) => destination.status === "attention",
	);
	const blockedDestinations = destinationViews.filter(
		(destination) => destination.status === "blocked",
	);
	const notConnectedDestinations = destinationViews.filter(
		(destination) => destination.status === "not_connected",
	);
	const selectedDestination = useMemo(
		() =>
			selectedDestinationPlatform
				? (destinationViews.find(
						(destination) =>
							destination.platform === selectedDestinationPlatform,
					) ?? null)
				: null,
		[destinationViews, selectedDestinationPlatform],
	);
	const selectedVariant = selectedDestination?.variant ?? null;
	const selectedSnapshot = selectedDestination?.snapshot ?? null;
	const draftTitle = title.trim() || deriveDraftTitle(sharedDraft) || "Untitled post";
	const hasMeaningfulDraft = useMemo(
		() =>
			hasMeaningfulSharedDraft(sharedDraft) ||
			rootAssetIds.length > 0 ||
			variants.some(
				(variant) =>
					variant.contentMode === "custom" ||
					variant.assetMode === "replace" ||
					variant.notes.trim() !== "",
			),
		[sharedDraft, rootAssetIds.length, variants],
	);
	const currentDraftFingerprint = useMemo(
		() =>
			JSON.stringify({
				title,
				notes,
				campaignId,
				requiresApproval,
				sharedDraft,
				rootAssetIds,
				variants,
				deletedVariantIds,
				excludedPlatforms,
			}),
		[
			campaignId,
			deletedVariantIds,
			excludedPlatforms,
			notes,
			requiresApproval,
			rootAssetIds,
			sharedDraft,
			title,
			variants,
		],
	);
	const isDirty = baseline !== "" && currentDraftFingerprint !== baseline;
	const saveStateLabel = saving
		? "Saving..."
		: error
			? "Needs attention"
			: isDirty
				? "Unsaved changes"
				: lastSavedAt
					? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
							hour: "numeric",
							minute: "2-digit",
						})}`
					: "New draft";
	const nextRequiredStep =
		!hasMeaningfulSharedDraft(sharedDraft) && rootAssetIds.length === 0
			? "Add shared content"
			: readyDestinations.length + attentionDestinations.length === 0
				? "Check destinations"
				: !bulkScheduleDate
					? canPublish
						? "Pick a publish time"
						: "Confirm review flow"
					: "Ready to send";

	const loadEditor = useCallback(
		async (nextId?: string | null, requestedTab?: string | null) => {
			if (!activeWorkspaceId) {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const bootstrap =
					await customerRequest<PostComposeBootstrapResponse>(
						nextId
							? `/posts/compose/bootstrap?postId=${encodeURIComponent(nextId)}`
							: "/posts/compose/bootstrap",
					);
				const normalizedCapabilities = normalizeCapabilities(
					bootstrap.capabilities,
				);
				const socialResponse = bootstrap.social;
				const postResponse = bootstrap.post ?? null;
				const aiCatalogResponse = bootstrap.ai.catalog ?? null;
				const aiSettingsResponse = bootstrap.ai.settings ?? null;
				const connectedPlatforms = Array.from(
					healthySelectedTargetsByPlatform(socialResponse.targets).keys(),
				);
				setCampaigns(bootstrap.campaigns);
				setResources(bootstrap.resourceLibrary.seedResources);
				setResourceSets(bootstrap.resourceLibrary.seedResourceSets);
				setResourceLibraryLoaded(false);
				setCapabilities(normalizedCapabilities);
				setSocialTargets(socialResponse.targets);
				setAICatalog(aiCatalogResponse);
				setAISettings(aiSettingsResponse);
				setAIMode(aiSettingsResponse?.defaultMode ?? "native");
				const defaultAISelection =
					aiSettingsResponse?.capabilityDefaults.post_generation ??
					(bootstrap.ai.defaultProvider && bootstrap.ai.defaultModel
						? {
								provider: bootstrap.ai.defaultProvider,
								model: bootstrap.ai.defaultModel,
							}
						: aiCatalogResponse?.providers[0]
						? {
								provider: aiCatalogResponse.providers[0].provider,
								model:
									aiCatalogResponse.providers[0].defaultModel ??
									aiCatalogResponse.providers[0].approvedModels[0] ??
									"",
							}
						: { provider: "", model: "" });
				setAIProvider(defaultAISelection.provider);
				setAIModel(defaultAISelection.model);

				if (!postResponse) {
					const requestedPlatform =
						requestedTab &&
						requestedTab !== "shared" &&
						uniquePlatforms(normalizedCapabilities).includes(requestedTab)
							? requestedTab
							: null;
					const emptySharedDraft = createDraftContent();
					const seedPlatforms =
						requestedPlatform !== null
							? [requestedPlatform]
							: connectedPlatforms.length > 0
								? connectedPlatforms
								: [];
					const seededVariants = seedPlatforms.map((platform) =>
						createAutoVariant(platform, normalizedCapabilities, emptySharedDraft, []),
					);
					const emptyState = {
						title: "",
						notes: "",
						campaignId: "",
						requiresApproval: false,
						startsFromPlatform: "",
						startsFromSurface: "",
						sharedDraft: emptySharedDraft,
						rootAssetIds: [],
						variants: seededVariants,
						deletedVariantIds: [],
						excludedPlatforms: [],
					};
					setPostId(null);
					setTitle(emptyState.title);
					setNotes(emptyState.notes);
					setCampaignId(emptyState.campaignId);
					setRequiresApproval(emptyState.requiresApproval);
					setStartsFromPlatform(emptyState.startsFromPlatform);
					setStartsFromSurface(emptyState.startsFromSurface);
					setSharedDraft(emptyState.sharedDraft);
					setSharedTagInput(formatTagsForEditor(emptyState.sharedDraft.tags));
					setRootAssetIds(emptyState.rootAssetIds);
					setVariants(emptyState.variants);
					setDeletedVariantIds([]);
					setExcludedPlatforms([]);
					setPlannedTimeDrafts({});
					setBulkActionSummary(null);
					setActiveTab(requestedPlatform ?? emptyState.variants[0]?.platform ?? "shared");
					setDrawerOpen(false);
					setDrawerMode("platforms");
					setLastDrawerMode("platforms");
					setSelectedDestinationPlatform(null);
					setLastSavedAt(null);
					setBaseline(
						JSON.stringify({
							title: emptyState.title,
							notes: emptyState.notes,
							campaignId: emptyState.campaignId,
							requiresApproval: emptyState.requiresApproval,
							sharedDraft: emptyState.sharedDraft,
							rootAssetIds: emptyState.rootAssetIds,
							variants: emptyState.variants,
							deletedVariantIds: emptyState.deletedVariantIds,
							excludedPlatforms: emptyState.excludedPlatforms,
						}),
					);
					setDataWarning(null);
					return;
				}

				const normalized = normalizePostDetail(postResponse);
				const post = normalized.value;
				const mappedVariants: DraftVariant[] = post.variants.map((variant) => ({
					content: coerceDraftContentForRule(
						extractDraftContent(
							(variant.contentKind ?? post.contentKind) as ContentKind,
							variant.contentPayload ?? {},
						),
						findRule(normalizedCapabilities, variant.platform, variant.surface),
					),
					id: variant.id,
					platform: variant.platform,
					surface: variant.surface,
					inheritSource: variant.inheritSource,
					contentMode: variant.contentMode,
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
					campaignId: post.campaign?.id ?? "",
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
					excludedPlatforms: [],
				};
				setPostId(post.id);
				setTitle(nextState.title);
				setNotes(nextState.notes);
				setCampaignId(nextState.campaignId);
				setRequiresApproval(nextState.requiresApproval);
				setStartsFromPlatform(nextState.startsFromPlatform);
				setStartsFromSurface(nextState.startsFromSurface);
				setSharedDraft(nextState.sharedDraft);
				setSharedTagInput(formatTagsForEditor(nextState.sharedDraft.tags));
				setRootAssetIds(nextState.rootAssetIds);
				setVariants(nextState.variants);
				setDeletedVariantIds([]);
				setExcludedPlatforms([]);
				setPlannedTimeDrafts({});
				setBulkActionSummary(null);
				const defaultTab =
					nextState.startsFromPlatform ||
					nextState.variants[0]?.platform ||
					"shared";
				const nextActiveTab =
					(requestedTab === "shared" ||
						nextState.variants.some(
							(variant) => variant.platform === requestedTab,
						)) &&
					requestedTab
						? requestedTab
						: defaultTab;
				setActiveTab(nextActiveTab);
				setDrawerOpen(false);
				setDrawerMode("platforms");
				setLastDrawerMode("platforms");
				setSelectedDestinationPlatform(null);
				setLastSavedAt(post.updatedAt);
				setBaseline(
					JSON.stringify({
						title: nextState.title,
						notes: nextState.notes,
						campaignId: nextState.campaignId,
						requiresApproval: nextState.requiresApproval,
						sharedDraft: nextState.sharedDraft,
						rootAssetIds: nextState.rootAssetIds,
						variants: nextState.variants,
						deletedVariantIds: nextState.deletedVariantIds,
						excludedPlatforms: nextState.excludedPlatforms,
					}),
				);
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
		if (loading) {
			return;
		}
		if (!activeTab) {
			return;
		}
		const currentTab = searchParams.get("tab") ?? "shared";
		if (currentTab === activeTab) {
			return;
		}
		const nextParams = new URLSearchParams(searchParams);
		if (activeTab === "shared") {
			nextParams.delete("tab");
		} else {
			nextParams.set("tab", activeTab);
		}
		setSearchParams(nextParams, { replace: true });
	}, [activeTab, loading, searchParams, setSearchParams]);

	useEffect(() => {
		const requestedTab =
			typeof window === "undefined"
				? null
				: new URLSearchParams(window.location.search).get("tab");
		void loadEditor(id ?? null, requestedTab);
	}, [id, loadEditor]);

	useEffect(() => {
		if (loading) {
			return;
		}
		const resourceId = searchParams.get("resourceId");
		const resourceSetId = searchParams.get("resourceSetId");
		if (!resourceId && !resourceSetId) {
			return;
		}
		const nextKey = `${postId ?? "new"}:${resourceId ?? ""}:${resourceSetId ?? ""}`;
		if (prefillAssetsKey === nextKey) {
			return;
		}

		let cancelled = false;

		async function applyPrefill() {
			try {
				const idsToAdd: string[] = [];
				const resourcesToMerge: ResourceRecord[] = [];
				if (resourceId) {
					idsToAdd.push(resourceId);
					const resource = await customerRequest<ResourceRecord>(
						`/resources/${resourceId}`,
					);
					resourcesToMerge.push(resource);
				}
				if (resourceSetId) {
					const resourceSet = await customerRequest<ResourceSetDetail>(
						`/resource-sets/${resourceSetId}`,
					);
					idsToAdd.push(...resourceSet.items.map((item) => item.resourceId));
					resourcesToMerge.push(...resourceSet.items.map((item) => item.resource));
				}
				if (!cancelled && resourcesToMerge.length > 0) {
					setResources((current) => mergeResources(current, resourcesToMerge));
				}
				if (!cancelled && idsToAdd.length > 0) {
					setRootAssetIds((current) => {
						const next = [...current];
						for (const idToAdd of idsToAdd) {
							if (!next.includes(idToAdd)) {
								next.push(idToAdd);
							}
						}
						return next;
					});
					toast.success(
						resourceSetId
							? "Collection assets added to the shared composer."
							: "Asset added to the shared composer.",
					);
				}
			} catch (prefillError) {
				if (!cancelled) {
					setError(
						prefillError instanceof Error
							? prefillError.message
							: "Unable to attach the selected asset.",
					);
				}
			} finally {
				if (!cancelled) {
					const nextParams = new URLSearchParams(searchParams);
					nextParams.delete("resourceId");
					nextParams.delete("resourceSetId");
					setSearchParams(nextParams, { replace: true });
					setPrefillAssetsKey(nextKey);
				}
			}
		}

		void applyPrefill();

		return () => {
			cancelled = true;
		};
	}, [
		customerRequest,
		loading,
		prefillAssetsKey,
		postId,
		searchParams,
		setSearchParams,
	]);

	useEffect(() => {
		if (!activeAIProviderConfig) {
			return;
		}
		if (aiModel && activeAIProviderConfig.approvedModels.includes(aiModel)) {
			return;
		}
		setAIModel(
			activeAIProviderConfig.defaultModel ??
				activeAIProviderConfig.approvedModels[0] ??
				"",
		);
	}, [activeAIProviderConfig, aiModel]);

	async function resolveResourceSetIds(resourceSetId: string) {
		const response = await customerRequest<ResourceSetDetail>(
			`/resource-sets/${resourceSetId}`,
		);
		return response.items.map((item) => item.resourceId);
	}

	function toggleDestination(platform: string, included: boolean) {
		if (!capabilities) {
			return;
		}
		if (included) {
			setExcludedPlatforms((current) => current.filter((item) => item !== platform));
			setVariants((current) => {
				if (current.some((variant) => variant.platform === platform)) {
					return current;
				}
				return [
					...current,
					createAutoVariant(platform, capabilities, sharedDraft, rootAssets),
				];
			});
			setActiveTab(platform);
			return;
		}
		const existing = variants.find((variant) => variant.platform === platform);
		if (!existing) {
			return;
		}
		setExcludedPlatforms((current) =>
			current.includes(platform) ? current : [...current, platform],
		);
		if (existing.id) {
			setDeletedVariantIds((current) =>
				current.includes(existing.id!) ? current : [...current, existing.id!],
			);
		}
		setVariants((current) =>
			current.filter((variant) => variant.platform !== platform),
		);
		if (activeTab === platform) {
			setActiveTab("shared");
		}
	}

	function applySchedulePreset(preset: "later_today" | "tomorrow_morning" | "next_best_slot") {
		const next = new Date();
		if (preset === "tomorrow_morning") {
			next.setDate(next.getDate() + 1);
			next.setHours(9, 0, 0, 0);
		} else if (preset === "next_best_slot") {
			next.setDate(next.getDate() + (next.getHours() >= 10 ? 1 : 0));
			next.setHours(10, 0, 0, 0);
		} else {
			next.setHours(Math.min(next.getHours() + 2, 18), 0, 0, 0);
		}
		const hours24 = next.getHours();
		const meridiem = hours24 >= 12 ? "PM" : "AM";
		const hour12 = hours24 % 12 || 12;
		setBulkScheduleDate(next);
		setBulkScheduleTime({
			hour: padNumber(hour12),
			minute: padNumber(next.getMinutes()),
			meridiem,
		});
	}

	function updateVariant(platform: string, patch: Partial<DraftVariant>) {
		setVariants((current) =>
			current.map((variant) =>
				variant.platform === platform ? { ...variant, ...patch } : variant,
			),
		);
	}

	function contentFromSnapshot(snapshot: VariantSnapshot): DraftContent {
		return extractDraftContent(snapshot.contentKind, snapshot.contentPayload);
	}

	function updateSharedTags(value: string) {
		setSharedTagInput(value);
		setSharedDraft((current) => ({
			...current,
			tags: parseTagInput(value),
		}));
	}

	async function generateAIDraft() {
		if (!activeWorkspaceId) {
			return;
		}
		if (!aiPrompt.trim()) {
			setError("Add a goal or topic before generating an AI draft.");
			return;
		}
		setAIGenerating(true);
		setAIWarnings([]);
		setError(null);
		try {
			const response = await customerRequest<AIGeneratedPostDraft>(
				`/workspaces/${activeWorkspaceId}/ai/post-drafts`,
				{
					method: "POST",
					body: {
						prompt: aiPrompt,
						provider: aiProvider,
						model: aiModel,
						mode: aiMode,
						campaignId: campaignId || null,
					},
				},
			);
			setLastAIDraft(response);
			setAIWarnings(response.warnings);
			const nextTitle =
				response.title.trim() || title || aiPrompt.trim().slice(0, 80);
			setTitle(nextTitle);
			const nextKind = response.contentKind as ContentKind;
			const nextDraft = extractDraftContent(nextKind, response.contentPayload);
			setSharedDraft(nextDraft);
			setSharedTagInput(formatTagsForEditor(nextDraft.tags));
			setActiveTab("shared");
			toast.success("AI draft inserted into the shared composer.");
		} catch (generationError) {
			setError(
				generationError instanceof Error
					? generationError.message
					: "Unable to generate an AI draft.",
			);
		} finally {
			setAIGenerating(false);
		}
	}

	async function persistDraft(
		requestedPlatform = activeTab || "shared",
		options?: { rehydrate?: boolean },
	) {
		const shouldRehydrate = options?.rehydrate ?? false;
		const resolvedTitle = title.trim() || deriveDraftTitle(sharedDraft) || "Untitled post";
		if (!hasMeaningfulDraft) {
			return null;
		}
		setSaving(true);
		setError(null);
		try {
			const primaryVariant = variants[0];
			const body = {
				title: resolvedTitle,
				contentKind: sharedDraft.kind,
				contentPayload: buildContentPayload(sharedDraft),
				originPlatform: primaryVariant?.platform ?? "",
				originSurface: primaryVariant?.surface ?? "",
				campaignId,
				requiresApproval,
				notes,
			};
			const savedVariantsByPlatform = new Map<string, PostVariant>();
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
				const snapshot = snapshots.get(variant.platform);
				const inheritanceSourceContent =
					variant.inheritSource === "shared" || !snapshot
						? sharedDraft
						: contentFromSnapshot(snapshot);
				const inheritanceSourceAssets =
					variant.inheritSource === "shared" || !snapshot
						? rootAssets
						: snapshot.sourceAssets;
				const normalizedModes = preferredVariantModes(
					inheritanceSourceContent,
					inheritanceSourceAssets,
				);
				const shouldPromoteContentInheritance =
					variant.contentMode === "custom" &&
					normalizedModes.contentMode === "inherit" &&
					!hasMeaningfulCustomContent(variant.content);
				const shouldPromoteAssetInheritance =
					variant.assetMode === "replace" &&
					normalizedModes.assetMode === "inherit" &&
					variant.assetIds.length === 0 &&
					variant.removedInheritedResourceIds.length === 0;
				const effectiveContentMode = shouldPromoteContentInheritance
					? "inherit"
					: variant.contentMode === "inherit" &&
							normalizedModes.contentMode === "custom"
						? "custom"
						: variant.contentMode;
				const effectiveAssetMode = shouldPromoteAssetInheritance
					? "inherit"
					: variant.assetMode === "inherit" &&
							normalizedModes.assetMode === "replace"
						? "replace"
						: variant.assetMode;
				const savedVariant = variant.id
					? await customerRequest<PostVariant>(
							`/posts/variants/${variant.id}`,
							{
								method: "PATCH",
								body: {
									platform: variant.platform,
									surface: variant.surface,
									inheritSource: variant.inheritSource,
									contentMode: effectiveContentMode,
									contentKind: variant.content.kind,
									contentPayload:
										effectiveContentMode === "custom"
											? buildContentPayload(variant.content)
											: {},
									assetMode: effectiveAssetMode,
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
								contentMode: effectiveContentMode,
								contentKind: variant.content.kind,
								contentPayload:
									effectiveContentMode === "custom"
										? buildContentPayload(variant.content)
										: {},
								assetMode: effectiveAssetMode,
								notes: variant.notes,
							},
						});
				savedVariantsByPlatform.set(variant.platform, savedVariant);
				await customerRequest(`/posts/variants/${savedVariant.id}/assets`, {
					method: "PUT",
					body: {
						resourceIds:
							effectiveAssetMode === "inherit" ? [] : variant.assetIds,
						assetMode: effectiveAssetMode,
						removedInheritedResourceIds: variant.removedInheritedResourceIds,
					},
				});
			}
			for (const variantId of deletedVariantIds) {
				await customerRequest(`/posts/variants/${variantId}`, {
					method: "DELETE",
				});
			}
			const nextHref =
				requestedPlatform === "shared"
					? `/dashboard/posts/${post.id}/edit`
					: `/dashboard/posts/${post.id}/edit?tab=${requestedPlatform}`;
			if (!postId) {
				navigate(nextHref, { replace: true });
			}
			setPostId(post.id);
			setTitle(resolvedTitle);
			setDeletedVariantIds([]);
			setVariants((current) =>
				current.map((variant) => {
					const savedVariant = savedVariantsByPlatform.get(variant.platform);
					if (!savedVariant) {
						return variant;
					}
					return {
						...variant,
						id: savedVariant.id,
						approvalState: savedVariant.approvalState,
						reviewHistory: savedVariant.reviewHistory,
						latestPublication: savedVariant.latestPublication,
					};
				}),
			);
			const nextState = JSON.stringify({
				title: resolvedTitle,
				notes,
				campaignId,
				requiresApproval,
				sharedDraft,
				rootAssetIds,
				variants: variants.map((variant) => {
					const savedVariant = savedVariantsByPlatform.get(variant.platform);
					return savedVariant
						? {
								...variant,
								id: savedVariant.id,
								approvalState: savedVariant.approvalState,
								reviewHistory: savedVariant.reviewHistory,
								latestPublication: savedVariant.latestPublication,
							}
						: variant;
				}),
				deletedVariantIds: [],
				excludedPlatforms,
			});
			setBaseline(nextState);
			setLastSavedAt(new Date().toISOString());
			if (shouldRehydrate) {
				await loadEditor(post.id, requestedPlatform);
			}
			return { postId: post.id, savedVariantsByPlatform };
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to save the draft.",
			);
			return null;
		} finally {
			setSaving(false);
		}
	}

	async function saveDraft() {
		const result = await persistDraft(activeTab || "shared");
		if (result) {
			toast.success("Draft saved.");
		}
	}

	useEffect(() => {
		if (
			loading ||
			saving ||
			!postId ||
			!hasMeaningfulDraft ||
			!isDirty ||
			selectedDestinationPlatform
		) {
			return;
		}
		const timeout = window.setTimeout(() => {
			void persistDraft(activeTab || "shared");
		}, 1200);
		return () => window.clearTimeout(timeout);
	}, [
		activeTab,
		hasMeaningfulDraft,
		isDirty,
		loading,
		postId,
		saving,
		selectedDestinationPlatform,
	]);

	async function runBulkAction(action: BulkActionSummary["action"]) {
		setBulkActionSummary(null);
		setError(null);
		const executable =
			action === "submit"
				? destinationViews.filter(
						(destination) => destination.target && destination.variant,
					)
				: [...readyDestinations, ...attentionDestinations];
		if (executable.length === 0) {
			setError(
				action === "submit"
					? "No connected destination is ready to submit."
					: "No eligible destinations are ready for this action.",
			);
			return;
		}
		const bulkPlannedAt = buildBulkPlannedAt(
			bulkScheduleDate,
			bulkScheduleTime,
		);
		if (action === "schedule" && !bulkPlannedAt) {
			setError("Choose a date and time before scheduling.");
			return;
		}

		setSaving(true);
		try {
			const persisted = await persistDraft(activeTab || "shared");
			if (!persisted) {
				return;
			}

			const summary: BulkActionSummary = {
				action,
				succeeded: [],
				skipped: [],
				failed: [],
			};

			for (const destination of executable) {
				const savedVariant = persisted.savedVariantsByPlatform.get(
					destination.platform,
				);
				if (!savedVariant?.id) {
					summary.failed.push({
						platform: destination.platform,
						detail: "Variant could not be saved for execution.",
					});
					continue;
				}
				try {
					if (action === "publish") {
						await customerRequest(
							`/social/variants/${savedVariant.id}/publish`,
							{
								method: "POST",
								body: { source: "social_api" },
							},
						);
					} else if (action === "schedule") {
						await customerRequest(
							`/posts/variants/${savedVariant.id}/publication/schedule`,
							{
								method: "POST",
								body: { plannedAt: bulkPlannedAt, source: "manual" },
							},
						);
					} else {
						await customerRequest(
							`/posts/variants/${savedVariant.id}/reviews/submit`,
							{
								method: "POST",
								body: { comment: "" },
							},
						);
					}
					summary.succeeded.push({
						platform: destination.platform,
						detail:
							action === "publish"
								? "Queued for direct publish."
								: action === "schedule"
									? "Scheduled successfully."
									: "Submitted for review.",
					});
				} catch (actionError) {
					summary.failed.push({
						platform: destination.platform,
						detail:
							actionError instanceof Error
								? actionError.message
								: "This destination could not be processed.",
					});
				}
			}

			if (action !== "submit") {
				for (const destination of [
					...blockedDestinations,
					...notConnectedDestinations,
				]) {
					summary.skipped.push({
						platform: destination.platform,
						detail: destination.summary,
					});
				}
			}

			setBulkActionSummary(summary);
			await loadEditor(persisted.postId, activeTab || "shared");
			toast.success(
				action === "publish"
					? "Bulk publish finished."
					: action === "schedule"
						? "Bulk schedule finished."
						: "Submitted for review.",
			);
		} finally {
			setSaving(false);
		}
	}

	function updateBulkScheduleTime(patch: Partial<PlannedTimeDraft>) {
		setBulkScheduleTime((current) => ({
			...current,
			...patch,
		}));
	}

	function commitBulkScheduleTime() {
		setBulkScheduleTime((current) => {
			const hourValue =
				current.hour === "" ? DEFAULT_HOUR : Number(current.hour);
			const minuteValue =
				current.minute === "" ? DEFAULT_MINUTE : Number(current.minute);
			return {
				hour: padNumber(
					clamp(Number.isFinite(hourValue) ? hourValue : DEFAULT_HOUR, 1, 12),
				),
				minute: padNumber(
					clamp(
						Number.isFinite(minuteValue) ? minuteValue : DEFAULT_MINUTE,
						0,
						59,
					),
				),
				meridiem: current.meridiem,
			};
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

	const bulkEligibleCount =
		readyDestinations.length + attentionDestinations.length;
	const primaryActionLabel = canPublish ? "Publish now" : "Submit for review";
	const selectedDestinationAssets = selectedSnapshot?.effectiveAssets ?? [];
	const selectedDestinationContent =
		selectedVariant && selectedSnapshot
			? selectedVariant.contentMode === "custom"
				? selectedVariant.content
				: contentFromSnapshot(selectedSnapshot)
			: null;
	const includedDestinations = destinationViews.filter((destination) =>
		Boolean(destination.variant),
	);
	const bulkPlannedAt = useMemo(
		() => buildBulkPlannedAt(bulkScheduleDate, bulkScheduleTime),
		[bulkScheduleDate, bulkScheduleTime],
	);
	const platformSummaries = useMemo(
		() =>
			includedDestinations.map((destination) => {
				const variant = destination.variant!;
				const plannedAt = bulkPlannedAt ?? variant.latestPublication?.plannedAt;
				const hasCustomOverride = isCustomOverride(
					variant,
					capabilities,
					sharedDraft,
					rootAssets,
				);
				return {
					platform: destination.platform,
					label: destination.label,
					targetName: destination.target?.displayName ?? "No target selected",
					status: destination.status,
					summary: destination.summary,
					surface: formatSurfaceLabel(undefined, variant.surface),
					hasCustomOverride,
					overrideLabel: hasCustomOverride ? "Custom" : "Shared",
					plannedAt,
					scheduleLabel: formatPlannedAtLabel(plannedAt),
					warningDetail:
						destination.blockers[0]?.message ??
						destination.warnings[0]?.message ??
						destination.summary,
				};
			}),
		[bulkPlannedAt, capabilities, includedDestinations, rootAssets, sharedDraft],
	);
	const scheduleSummary = useMemo(() => {
		if (platformSummaries.length === 0) {
			return {
				hasSchedule: false,
				label: "Unscheduled",
				detail: "No included platform has a publish time yet.",
			};
		}
		if (bulkPlannedAt) {
			return {
				hasSchedule: true,
				label: formatPlannedAtLabel(bulkPlannedAt),
				detail: "Shared draft time will be applied to included destinations.",
			};
		}
		const uniquePlannedTimes = Array.from(
			new Set(
				platformSummaries
					.map((platform) => platform.plannedAt)
					.filter((value): value is string => Boolean(value)),
			),
		);
		if (uniquePlannedTimes.length === 0) {
			return {
				hasSchedule: false,
				label: "Unscheduled",
				detail: "Choose a preset or custom timing when this post is ready.",
			};
		}
		if (uniquePlannedTimes.length === 1) {
			return {
				hasSchedule: true,
				label: formatPlannedAtLabel(uniquePlannedTimes[0]),
				detail: "All included destinations share the same planned time.",
			};
		}
		return {
			hasSchedule: true,
			label: "Mixed times",
			detail: "Included destinations already have different planned times.",
		};
	}, [bulkPlannedAt, platformSummaries]);

	function renderDestinationStatusIcon(status: DestinationStatus) {
		if (status === "ready") {
			return <CircleCheckBig className="size-4 text-emerald-600" />;
		}
		if (status === "attention") {
			return <CircleAlert className="size-4 text-amber-600" />;
		}
		if (status === "blocked") {
			return <CircleSlash className="size-4 text-rose-600" />;
		}
		return <CircleSlash className="size-4 text-slate-500" />;
	}

	function destinationStatusTone(status: DestinationStatus) {
		if (status === "ready") {
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
		}
		if (status === "attention") {
			return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
		}
		if (status === "blocked") {
			return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
		}
		return "border-[var(--brand-border-soft)] bg-background/75 text-muted-foreground";
	}

	function destinationStatusDotTone(status: DestinationStatus) {
		if (status === "ready") {
			return "bg-emerald-500";
		}
		if (status === "attention") {
			return "bg-amber-500";
		}
		if (status === "blocked") {
			return "bg-rose-500";
		}
		return "bg-slate-400";
	}

	function destinationStatusRingTone(status: DestinationStatus) {
		if (status === "ready") {
			return "ring-emerald-500/35";
		}
		if (status === "attention") {
			return "ring-amber-500/35";
		}
		if (status === "blocked") {
			return "ring-rose-500/35";
		}
		return "ring-[var(--brand-border-soft)]";
	}

	function destinationStatusLabel(status: DestinationStatus) {
		if (status === "not_connected") {
			return "Disconnected";
		}
		if (status === "attention") {
			return "Warning";
		}
		if (status === "blocked") {
			return "Blocked";
		}
		return "Ready";
	}

	function openDrawer(mode: Exclude<ComposerDrawerMode, "platform-detail">) {
		setDrawerMode(mode);
		setLastDrawerMode(mode);
		setDrawerOpen(true);
	}

	function openPlatformDetail(platform: string) {
		setActiveTab(platform);
		setSelectedDestinationPlatform(platform);
		setDrawerMode("platform-detail");
		setLastDrawerMode("platforms");
		setDrawerOpen(true);
	}

	function openSummaryDrawer() {
		if (blockedDestinations.length + attentionDestinations.length > 0) {
			openDrawer("platforms");
			return;
		}
		if (!scheduleSummary.hasSchedule) {
			openDrawer("schedule");
			return;
		}
		openDrawer(lastDrawerMode);
	}

	return (
		<>
			<div className="dashboard-page-stack space-y-5 pb-28">
				<DashboardOperationalHeader
					title={isEditMode ? "Refine your next post" : "Create your next post"}
					description="Write the shared version first, validate destinations without scrolling through everything, then schedule or publish in one short pass."
					meta={
						<span className="rounded-full border border-[var(--brand-border-soft)] bg-background/70 px-2.5 py-1 text-xs font-medium">
							{saveStateLabel}
						</span>
					}
					primaryAction={
						<Button variant="outline" className="rounded-full" asChild>
							<Link
								to={postId ? `/dashboard/posts/${postId}` : "/dashboard/posts"}
							>
								<ArrowLeft className="size-4" />
								Back
							</Link>
						</Button>
					}
				/>

				{error ? (
					<SurfaceCard className="dashboard-card-sm border border-destructive/20 bg-destructive/10 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}
				{dataWarning ? (
					<SurfaceCard className="dashboard-card-sm flex items-start gap-3 border border-amber-500/20 bg-amber-500/10 text-sm text-amber-700">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div>{dataWarning}</div>
					</SurfaceCard>
				) : null}

				<SurfaceCard className="space-y-5 border-[var(--brand-border-soft)] bg-background/80 p-5">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<div className="text-base font-semibold tracking-tight">
								Shared draft
							</div>
							<div className="mt-1 text-sm text-muted-foreground">
								Write the source version once. Platforms, overrides, and timing
								stay in the dock drawer.
							</div>
						</div>
						<Select
							value={sharedDraft.kind}
							onValueChange={(value) =>
								setSharedDraft(createDraftContent(value as ContentKind))
							}
						>
							<SelectTrigger
								className="w-[170px] rounded-full"
								aria-label="Post format"
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="text">Text post</SelectItem>
								<SelectItem value="article">Article</SelectItem>
								<SelectItem value="thread">Thread</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] xl:items-start">
						<div className="space-y-5">
							<div className="space-y-5 rounded-[26px] border border-[var(--brand-border-soft)] bg-background/86 p-5">
								{sharedDraft.kind === "article" ? (
									<div className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="shared-article-title">Article title</Label>
											<Input
												id="shared-article-title"
												name="sharedArticleTitle"
												value={sharedDraft.articleTitle}
												onChange={(event) =>
													setSharedDraft({
														...sharedDraft,
														articleTitle: event.target.value,
													})
												}
												className={adminInputClassName}
												placeholder="Article headline"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="shared-article-body">Article body</Label>
											<Textarea
												id="shared-article-body"
												name="sharedArticleBody"
												value={sharedDraft.articleBody}
												onChange={(event) =>
													setSharedDraft({
														...sharedDraft,
														articleBody: event.target.value,
													})
												}
												className={longTextareaClassName}
												placeholder="Write the long-form source version once."
											/>
										</div>
									</div>
								) : sharedDraft.kind === "thread" ? (
									<div className="space-y-3">
										<Label htmlFor="shared-thread-item-0">Thread</Label>
										{sharedDraft.threadItems.map((item, index) => (
											<Textarea
												key={`shared-thread-${index}`}
												id={`shared-thread-item-${index}`}
												name={`sharedThreadItem${index + 1}`}
												aria-label={`Thread item ${index + 1}`}
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
												placeholder={`Thread item ${index + 1}`}
											/>
										))}
										<Button
											type="button"
											variant="outline"
											className="w-fit rounded-full"
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
									<div className="space-y-2">
										<Label htmlFor="shared-text-body">Caption or body</Label>
										<Textarea
											id="shared-text-body"
											name="sharedTextBody"
											value={sharedDraft.textBody}
											onChange={(event) =>
												setSharedDraft({
													...sharedDraft,
													textBody: event.target.value,
												})
											}
											className={longTextareaClassName}
											placeholder="Write the master caption or body once."
										/>
									</div>
								)}

								<div className="space-y-2">
									<Label htmlFor="shared-tags">Tags</Label>
									<Textarea
										id="shared-tags"
										name="sharedTags"
										value={sharedTagInput}
										onChange={(event) => updateSharedTags(event.target.value)}
										onBlur={() =>
											setSharedTagInput(formatTagsForEditor(sharedDraft.tags))
										}
										className={compactTextareaClassName}
										placeholder="#launch, #product, #behindthescenes"
									/>
									<TagBadgeRow tags={sharedDraft.tags} />
								</div>
							</div>

							<details
								open={showAdvanced}
								onToggle={(event) => setShowAdvanced(event.currentTarget.open)}
								className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/85 p-5"
							>
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
									<div className="text-sm font-medium">Advanced options</div>
									<Settings2 className="size-4 text-muted-foreground" />
								</summary>
								<div className="mt-4 space-y-4">
									<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/72 p-4">
										<div className="flex flex-wrap items-center justify-between gap-3">
											<Label htmlFor="ai-draft-prompt" className="text-sm">
												AI prompt
											</Label>
											<Button
												type="button"
												variant="outline"
												className="rounded-full"
												onClick={generateAIDraft}
												disabled={aiGenerating}
											>
												{aiGenerating ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<WandSparkles className="size-4" />
												)}
												Generate
											</Button>
										</div>
										<Textarea
											id="ai-draft-prompt"
											name="aiDraftPrompt"
											value={aiPrompt}
											onChange={(event) => setAIPrompt(event.target.value)}
											className={compactTextareaClassName}
											placeholder="Describe what the post should do."
										/>
									</div>
								</div>
							</details>
						</div>

						<SurfaceCard className="composer-assets-rail space-y-4 border-[var(--brand-border-soft)] bg-background/88 p-4 xl:sticky xl:self-start">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-sm font-medium">Assets</div>
									<div className="mt-1 text-sm text-muted-foreground">
										Shared assets carry into every destination that stays on the
										default version.
									</div>
								</div>
								<ResourcePicker
									resources={resources}
									resourceSets={resourceSets}
									resolveResourceSetIds={resolveResourceSetIds}
									value={rootAssetIds}
									onChange={setRootAssetIds}
									triggerLabel="Attach assets"
									allowUpload
									onResourcesCreated={addUploadedResources}
									onOpenChange={(open) => {
										if (open) {
											void loadResourceLibrary();
										}
									}}
								/>
							</div>

							<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
								The full library loads only when you open the picker
							</div>

							{rootAssets.length > 0 ? (
								<div className="space-y-3">
									<div className="overflow-hidden rounded-[24px] border border-[var(--brand-border-soft)] bg-background/76">
										<div className="aspect-[4/3] overflow-hidden">
											<ResourceThumb resource={rootAssets[0]} className="h-full w-full" />
										</div>
										<div className="space-y-1 border-t border-[var(--brand-border-soft)] px-4 py-3">
											<div className="truncate text-sm font-medium">
												{rootAssets[0].displayName}
											</div>
											<div className="text-xs text-muted-foreground">
												{formatResourceMeta(rootAssets[0])}
											</div>
										</div>
									</div>
									{rootAssets.length > 1 ? (
										<div className="grid grid-cols-3 gap-2">
											{rootAssets.slice(1, 4).map((asset) => (
												<div
													key={asset.id}
													className="overflow-hidden rounded-[18px] border border-[var(--brand-border-soft)] bg-background/76"
												>
													<div className="aspect-square overflow-hidden">
														<ResourceThumb
															resource={asset}
															variant="compact"
															className="h-full w-full"
														/>
													</div>
												</div>
											))}
										</div>
									) : null}
								</div>
							) : (
								<div className="media-preview-canvas flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-[var(--brand-border-soft)] bg-background/72 px-6 text-center">
									<div className="space-y-3">
										<div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background/86">
											<ImageIcon className="size-5 text-muted-foreground" />
										</div>
										<div>
											<div className="text-sm font-medium">No shared assets yet</div>
											<div className="mt-1 text-sm text-muted-foreground">
												Add images, video, or documents once and keep them in
												sync across the shared version.
											</div>
										</div>
									</div>
								</div>
							)}

							{resourceLibraryLoading ? (
								<div className="text-sm text-muted-foreground">
									Loading the full asset library.
								</div>
							) : null}

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
				</SurfaceCard>

				<div className="sticky bottom-4 z-20">
					<div
						ref={dockRef}
						data-state={drawerOpen ? "open" : "closed"}
						className="composer-dock-shell mx-auto w-full max-w-[72rem] p-3"
					>
						<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
							<button
								type="button"
								onClick={openSummaryDrawer}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										openSummaryDrawer();
									}
								}}
								className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[var(--brand-border-soft)] bg-background/84 px-3 py-2 text-left transition hover:border-[var(--brand-border-strong)] hover:bg-background xl:max-w-[18rem]"
								aria-label="Open composer summary"
							>
								<div className="min-w-0">
									<div className="truncate text-sm font-semibold">
										{draftTitle}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										Next: {nextRequiredStep}
									</div>
								</div>
							</button>

							<div className="flex min-w-0 flex-wrap items-center gap-2 xl:flex-nowrap">
								{platformSummaries.length > 0 ? (
									platformSummaries.map((platform) => (
										<HoverCard
											key={platform.platform}
											openDelay={120}
											closeDelay={90}
										>
											<HoverCardTrigger asChild>
												<button
													type="button"
													onClick={() => openPlatformDetail(platform.platform)}
													className="composer-summary-marker relative inline-flex size-10 items-center justify-center rounded-full"
													aria-label={`${platform.label}: ${platform.warningDetail}`}
												>
													<span
														className={cn(
															"rounded-full ring-2 ring-offset-2 ring-offset-background",
															destinationStatusRingTone(platform.status),
														)}
													>
														{platformIcon(platform.platform, {
															containerClassName: "size-8 border",
															iconClassName: "size-4",
															backgroundAlpha: 0.12,
															borderAlpha: 0.18,
														})}
													</span>
													<span
														className={cn(
															"absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background shadow-sm",
															destinationStatusDotTone(platform.status),
														)}
														aria-hidden="true"
													/>
													<span
														className={cn(
															"absolute -top-1 -right-1 inline-flex min-w-[16px] items-center justify-center rounded-full border border-background px-1 text-[9px] font-semibold leading-4 shadow-sm",
															platform.hasCustomOverride
																? "bg-foreground text-background"
																: "bg-background text-muted-foreground",
														)}
														aria-hidden="true"
													>
														{platform.hasCustomOverride ? "C" : "S"}
													</span>
												</button>
											</HoverCardTrigger>
											<HoverCardContent
												align="center"
												side="top"
												className="composer-summary-hover-card w-[18rem] rounded-[22px] border border-[var(--brand-border-soft)] p-4"
											>
												<div className="space-y-3">
													<div className="space-y-1">
														<div className="text-sm font-semibold text-foreground">
															{platform.label}
														</div>
														<div className="text-xs text-muted-foreground">
															{platform.targetName}
														</div>
													</div>
													<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
														<div className="text-muted-foreground">Status</div>
														<div>{destinationStatusLabel(platform.status)}</div>
														<div className="text-muted-foreground">Mode</div>
														<div>{platform.overrideLabel}</div>
														<div className="text-muted-foreground">Surface</div>
														<div>{platform.surface}</div>
														<div className="text-muted-foreground">Schedule</div>
														<div>{platform.scheduleLabel}</div>
													</div>
													<div className="rounded-[16px] border border-[var(--brand-border-soft)] bg-background/76 px-3 py-2 text-xs text-muted-foreground">
														{platform.warningDetail}
													</div>
												</div>
											</HoverCardContent>
										</HoverCard>
									))
								) : (
									<span className="rounded-full border border-dashed border-[var(--brand-border-soft)] px-2.5 py-1 text-[11px] text-muted-foreground">
										No platforms included
									</span>
								)}

								{scheduleSummary.label === "Mixed times" ? (
									platformSummaries.map((platform) => (
										<HoverCard
											key={`${platform.platform}-schedule`}
											openDelay={120}
											closeDelay={90}
										>
											<HoverCardTrigger asChild>
												<button
													type="button"
													onClick={() => openDrawer("schedule")}
													className="relative inline-flex size-9 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background/82 text-muted-foreground transition hover:border-[var(--brand-border-strong)] hover:bg-background"
													aria-label={`${platform.label}: ${platform.scheduleLabel}`}
												>
													{platformIcon(platform.platform, {
														containerClassName:
															"size-6 border-0 bg-transparent shadow-none",
														iconClassName: "size-3.5",
														backgroundAlpha: 0,
														borderAlpha: 0,
													})}
													<span className="absolute -bottom-0.5 -right-0.5 inline-flex size-4 items-center justify-center rounded-full border border-background bg-background shadow-sm">
														<CalendarClock className="size-2.5 text-muted-foreground" />
													</span>
												</button>
											</HoverCardTrigger>
											<HoverCardContent
												side="top"
												className="composer-summary-hover-card w-auto rounded-[18px] border border-[var(--brand-border-soft)] px-3 py-2 text-xs"
											>
												{platform.label}: {platform.scheduleLabel}
											</HoverCardContent>
										</HoverCard>
									))
								) : (
									<button
										type="button"
										onClick={() => openDrawer("schedule")}
										className={cn(
											"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
											scheduleSummary.hasSchedule
												? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
												: "border-[var(--brand-border-soft)] bg-background/84 text-muted-foreground hover:border-[var(--brand-border-strong)] hover:bg-background",
										)}
									>
										<CalendarClock className="size-3.5" />
										{scheduleSummary.label}
									</button>
								)}
							</div>

							<div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
							<Button
								type="button"
								variant="outline"
								className="rounded-full"
								onClick={() => openDrawer("platforms")}
							>
								{blockedDestinations.length + attentionDestinations.length > 0 ? (
									<CircleAlert className="size-4" />
								) : (
									<CircleCheckBig className="size-4" />
								)}
								Platforms
							</Button>
							<Button
								type="button"
								variant="outline"
								className="rounded-full"
								onClick={() => openDrawer("schedule")}
							>
								<CalendarClock className="size-4" />
								Schedule
							</Button>
							<Button
								type="button"
								variant="outline"
								className="rounded-full"
								onClick={saveDraft}
								disabled={saving || loading}
							>
								<Save className="size-4" />
								Save draft
							</Button>
							<Button
								type="button"
								className="rounded-full"
								onClick={() =>
									runBulkAction(canPublish ? "publish" : "submit")
								}
								disabled={saving || loading || bulkEligibleCount === 0}
							>
								{canPublish ? (
									<Send className="size-4" />
								) : (
									<CheckCircle2 className="size-4" />
								)}
								{primaryActionLabel}
							</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			<Drawer
				open={drawerOpen}
				onOpenChange={(open) => {
					setDrawerOpen(open);
					if (!open) {
						setSelectedDestinationPlatform(null);
						setDrawerMode(lastDrawerMode);
					}
				}}
			>
				<DrawerContent
					className="composer-drawer-shell mx-auto flex w-full flex-col overflow-hidden"
					style={{
						insetInline: "auto",
						left: drawerDockMetrics ? `${drawerDockMetrics.left}px` : "50%",
						right: "auto",
						bottom: "5.25rem",
						width: drawerDockMetrics
							? `${drawerDockMetrics.width}px`
							: "min(calc(100vw - 1.25rem), 72rem)",
						maxHeight: "calc(85vh - 5.25rem)",
						transform: drawerDockMetrics ? "none" : "translateX(-50%)",
					}}
				>
					<div className="composer-drawer-header sticky top-0 z-10 border-b">
						<DrawerHeader className="px-4 sm:px-6">
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div>
									<DrawerTitle className="flex items-center gap-3">
										{drawerMode === "platform-detail" && selectedDestination ? (
											platformIcon(selectedDestination.platform)
										) : drawerMode === "schedule" ? (
											<CalendarClock className="size-5" />
										) : (
											<CircleCheckBig className="size-5" />
										)}
										<span>
											{drawerMode === "platform-detail"
												? selectedDestination?.label ?? "Destination details"
												: drawerMode === "schedule"
													? "Schedule"
													: "Platforms"}
										</span>
									</DrawerTitle>
									<DrawerDescription className="mt-1 text-sm">
										{drawerMode === "platform-detail"
											? "Customize only when this destination needs to diverge."
											: drawerMode === "schedule"
												? "Set the shared timing, then expand metadata only if you need it."
												: "Check readiness, inclusion, overrides, and timing without leaving the composer."}
									</DrawerDescription>
								</div>
								{drawerMode === "platform-detail" ? (
									<Button
										type="button"
										variant="ghost"
										className="rounded-full"
										onClick={() => {
											setDrawerMode("platforms");
											setLastDrawerMode("platforms");
											setSelectedDestinationPlatform(null);
										}}
									>
										<ArrowLeft className="size-4" />
										Back to platforms
									</Button>
								) : null}
							</div>
						</DrawerHeader>
					</div>
					<div className="overflow-y-auto px-4 pb-5 pt-2 sm:px-6">
						{drawerMode === "platforms" ? (
							<div className="space-y-3">
								{destinationViews.map((destination) => {
									const included = Boolean(destination.variant);
									const summary =
										platformSummaries.find(
											(entry) => entry.platform === destination.platform,
										) ?? null;
									const scheduleLabel =
										summary?.scheduleLabel ??
										formatPlannedAtLabel(
											destination.variant?.latestPublication?.plannedAt,
										);
									const overrideLabel = summary?.overrideLabel ?? "Shared";
									const issueLine =
										destination.blockers[0]?.message ??
										destination.warnings[0]?.message ??
										destination.summary;

									return (
										<div
											key={destination.platform}
											className="grid gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/82 px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
										>
											<button
												type="button"
												onClick={() => {
													if (destination.target && included) {
														openPlatformDetail(destination.platform);
													}
												}}
												disabled={!destination.target || !included}
												className="flex min-w-0 items-start gap-3 text-left disabled:cursor-default"
											>
												<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background">
													{platformIcon(destination.platform, {
														containerClassName: "size-7",
														iconClassName: "size-4",
													})}
												</div>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-2">
														<div className="font-medium">
															{destination.label}
														</div>
														<span
															className={cn(
																"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
																destinationStatusTone(destination.status),
															)}
														>
															{renderDestinationStatusIcon(destination.status)}
															{destinationStatusLabel(destination.status)}
														</span>
														<span className="rounded-full border border-[var(--brand-border-soft)] px-2 py-0.5 text-[11px] text-muted-foreground">
															{overrideLabel}
														</span>
														<span className="rounded-full border border-[var(--brand-border-soft)] px-2 py-0.5 text-[11px] text-muted-foreground">
															{scheduleLabel}
														</span>
													</div>
													<div className="mt-0.5 text-sm text-muted-foreground">
														{destination.target?.displayName ??
															"No healthy target selected yet."}
													</div>
													<div className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
														{issueLine}
													</div>
												</div>
											</button>
											<div className="flex flex-wrap items-center gap-2 md:justify-end">
												{destination.target ? (
													<>
														<div className="flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background px-3 py-1.5">
															<span className="text-xs text-muted-foreground">
																Include
															</span>
															<Switch
																checked={included}
																onCheckedChange={(checked) =>
																	toggleDestination(
																		destination.platform,
																		checked,
																	)
																}
																aria-label={`Include ${destination.label}`}
															/>
														</div>
														<Button
															type="button"
															variant="outline"
															className="rounded-full"
															onClick={() =>
																openPlatformDetail(destination.platform)
															}
															disabled={!included}
														>
															Customize
														</Button>
													</>
												) : (
													<Button
														type="button"
														variant="outline"
														className="rounded-full"
														asChild
													>
														<Link to="/dashboard/settings/platforms">
															Connect
														</Link>
													</Button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						) : drawerMode === "schedule" ? (
							<div className="space-y-4">
								<SurfaceCard className="space-y-4 rounded-[24px] border-[var(--brand-border-soft)] bg-background/85 p-4">
									<div className="space-y-1">
										<div className="text-sm font-medium">Schedule presets</div>
										<div className="text-sm text-muted-foreground">
											Use the fastest preset first, then fine-tune the date and
											time only when needed.
										</div>
									</div>
									<div className="grid gap-2 sm:grid-cols-3">
										<Button
											type="button"
											variant="outline"
											className="justify-start rounded-[18px]"
											onClick={() => applySchedulePreset("later_today")}
										>
											Later today
										</Button>
										<Button
											type="button"
											variant="outline"
											className="justify-start rounded-[18px]"
											onClick={() => applySchedulePreset("tomorrow_morning")}
										>
											Tomorrow morning
										</Button>
										<Button
											type="button"
											variant="outline"
											className="justify-start rounded-[18px]"
											onClick={() => applySchedulePreset("next_best_slot")}
										>
											Next best slot
										</Button>
									</div>
									<div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3">
										<div>
											<div className="text-sm font-medium">Current timing</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{scheduleSummary.detail}
											</div>
										</div>
										<div className="rounded-full border border-[var(--brand-border-soft)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
											{scheduleSummary.label}
										</div>
									</div>
									<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
										<Popover>
											<PopoverTrigger asChild>
												<Button
													type="button"
													variant="outline"
													className="rounded-full"
												>
													<CalendarDays className="size-4" />
													{bulkScheduleDate
														? bulkScheduleDate.toLocaleDateString()
														: "Pick schedule date"}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="start">
												<Calendar
													mode="single"
													selected={bulkScheduleDate ?? undefined}
													onSelect={(date) => setBulkScheduleDate(date ?? null)}
												/>
											</PopoverContent>
										</Popover>
										<div className="flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background px-3 py-2">
											<Label htmlFor="schedule-hour" className="sr-only">
												Schedule hour
											</Label>
											<Input
												id="schedule-hour"
												name="scheduleHour"
												value={bulkScheduleTime.hour}
												onChange={(event) =>
													updateBulkScheduleTime({
														hour: event.target.value,
													})
												}
												onBlur={commitBulkScheduleTime}
												className="h-8 w-10 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
												aria-label="Schedule hour"
											/>
											<span className="text-muted-foreground">:</span>
											<Label htmlFor="schedule-minute" className="sr-only">
												Schedule minute
											</Label>
											<Input
												id="schedule-minute"
												name="scheduleMinute"
												value={bulkScheduleTime.minute}
												onChange={(event) =>
													updateBulkScheduleTime({
														minute: event.target.value,
													})
												}
												onBlur={commitBulkScheduleTime}
												className="h-8 w-10 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
												aria-label="Schedule minute"
											/>
											<Label htmlFor="schedule-meridiem" className="sr-only">
												Schedule meridiem
											</Label>
											<Select
												value={bulkScheduleTime.meridiem}
												onValueChange={(value) =>
													setBulkScheduleTime((current) => ({
														...current,
														meridiem: value as "AM" | "PM",
													}))
												}
											>
												<SelectTrigger
													id="schedule-meridiem"
													className="h-8 w-[76px] rounded-full border-0 bg-muted/50 px-3 shadow-none"
													aria-label="Schedule meridiem"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="AM">AM</SelectItem>
													<SelectItem value="PM">PM</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
								</SurfaceCard>

								<details className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/85 p-4">
									<summary className="cursor-pointer list-none text-sm font-medium">
										Metadata
									</summary>
									<div className="mt-4 space-y-4">
										<AdminFormGrid>
											<AdminFormField>
												<Label htmlFor="post-title">
													Internal title (optional)
												</Label>
												<Input
													id="post-title"
													name="postTitle"
													value={title}
													onChange={(event) => setTitle(event.target.value)}
													className={adminInputClassName}
													placeholder={
														deriveDraftTitle(sharedDraft) ||
														"Optional internal label"
													}
												/>
											</AdminFormField>
											<AdminFormField>
												<Label htmlFor="campaign-select">Campaign</Label>
												<Select
													value={campaignId || "none"}
													onValueChange={(value) =>
														setCampaignId(value === "none" ? "" : value)
													}
												>
													<SelectTrigger
														id="campaign-select"
														className={adminSelectTriggerClassName}
														aria-label="Campaign"
													>
														<SelectValue placeholder="No campaign" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="none">No campaign</SelectItem>
														{campaigns.map((campaign) => (
															<SelectItem key={campaign.id} value={campaign.id}>
																{campaign.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</AdminFormField>
										</AdminFormGrid>

										<div className="flex items-start justify-between gap-4 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
											<div>
												<div className="text-sm font-medium">
													Approval gate
												</div>
												<div className="text-sm text-muted-foreground">
													Only enable this when a reviewer should stay in the
													loop.
												</div>
											</div>
											<Switch
												checked={requiresApproval}
												onCheckedChange={setRequiresApproval}
												aria-label="Require approval"
											/>
										</div>

										<div className="space-y-2">
											<Label htmlFor="post-notes">Internal notes</Label>
											<Textarea
												id="post-notes"
												name="postNotes"
												value={notes}
												onChange={(event) => setNotes(event.target.value)}
												className={mediumTextareaClassName}
												placeholder="Internal notes"
											/>
										</div>
									</div>
								</details>

								{canPublish ? (
									<div className="flex justify-end">
										<Button
											type="button"
											className="rounded-full"
											onClick={() => runBulkAction("schedule")}
											disabled={
												saving ||
												loading ||
												!bulkScheduleDate ||
												bulkEligibleCount === 0
											}
										>
											<CalendarClock className="size-4" />
											Schedule included destinations
										</Button>
									</div>
								) : null}
							</div>
						) : drawerMode === "platform-detail" && selectedDestination ? (
						<div className="mt-4 space-y-4">
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/80 p-4">
								<div className="flex items-center gap-2 font-medium">
									{renderDestinationStatusIcon(selectedDestination.status)}
									<span>{selectedDestination.summary}</span>
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{selectedDestination.target?.displayName ??
										"No healthy selected target connected yet."}
								</div>
							</div>

							{selectedDestination.warnings.map((warning) => (
								<div
									key={warning.code}
									className="rounded-[18px] border border-amber-200/70 bg-amber-50/70 p-3 text-sm text-amber-800"
								>
									{warning.message}
								</div>
							))}
							{selectedDestination.blockers.map((blocker) => (
								<div
									key={blocker.code}
									className="rounded-[18px] border border-rose-200/70 bg-rose-50/70 p-3 text-sm text-rose-800"
								>
									{blocker.message}
								</div>
							))}

							{selectedVariant ? (
									<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor={`surface-${selectedVariant.platform}`}>
											Surface
										</Label>
										<Select
											value={selectedVariant.surface}
											onValueChange={(value) => {
												const nextRule = findRule(
													capabilities,
													selectedVariant.platform,
													value,
												);
												updateVariant(selectedVariant.platform, {
													surface: value,
													content: coerceDraftContentForRule(
														selectedVariant.content,
														nextRule,
													),
												});
											}}
										>
											<SelectTrigger
												id={`surface-${selectedVariant.platform}`}
												className={adminSelectTriggerClassName}
												aria-label="Surface"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{surfaceOptions(
													capabilities,
													selectedVariant.platform,
												).map((option) => (
													<SelectItem
														key={option.surface}
														value={option.surface}
													>
														{formatSurfaceLabel(option)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`content-mode-${selectedVariant.platform}`}>
											Content mode
										</Label>
										<Select
											value={selectedVariant.contentMode}
											onValueChange={(value) =>
												updateVariant(selectedVariant.platform, {
													contentMode: value as "inherit" | "custom",
												})
											}
										>
											<SelectTrigger
												id={`content-mode-${selectedVariant.platform}`}
												className={adminSelectTriggerClassName}
												aria-label="Content mode"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="inherit">
													Use shared version
												</SelectItem>
												<SelectItem value="custom">Customize here</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{selectedVariant.contentMode === "custom" ? (
										selectedVariant.content.kind === "article" ? (
											<div className="space-y-4">
												<div className="space-y-2">
													<Label
														htmlFor={`article-title-${selectedVariant.platform}`}
													>
														Article title
													</Label>
													<Input
														id={`article-title-${selectedVariant.platform}`}
														name={`articleTitle-${selectedVariant.platform}`}
														value={selectedVariant.content.articleTitle}
														onChange={(event) =>
															updateVariant(selectedVariant.platform, {
																content: {
																	...selectedVariant.content,
																	articleTitle: event.target.value,
																},
															})
														}
														className={adminInputClassName}
													/>
												</div>
												<div className="space-y-2">
													<Label
														htmlFor={`article-body-${selectedVariant.platform}`}
													>
														Article body
													</Label>
													<Textarea
														id={`article-body-${selectedVariant.platform}`}
														name={`articleBody-${selectedVariant.platform}`}
														value={selectedVariant.content.articleBody}
														onChange={(event) =>
															updateVariant(selectedVariant.platform, {
																content: {
																	...selectedVariant.content,
																	articleBody: event.target.value,
																},
															})
														}
														className={mediumTextareaClassName}
													/>
												</div>
											</div>
										) : selectedVariant.content.kind === "thread" ? (
											<div className="space-y-3">
												<Label
													htmlFor={`thread-${selectedVariant.platform}-0`}
												>
													Thread
												</Label>
												{selectedVariant.content.threadItems.map(
													(item, index) => (
														<Textarea
															key={`${selectedVariant.platform}-${index}`}
															id={`thread-${selectedVariant.platform}-${index}`}
															name={`thread-${selectedVariant.platform}-${index}`}
															aria-label={`Thread item ${index + 1}`}
															value={item}
															onChange={(event) =>
																updateThreadItem(
																	selectedVariant.platform,
																	index,
																	event.target.value,
																)
															}
															className={compactTextareaClassName}
														/>
													),
												)}
											</div>
										) : (
											<div className="space-y-2">
												<Label
													htmlFor={`text-body-${selectedVariant.platform}`}
												>
													Caption or body
												</Label>
												<Textarea
													id={`text-body-${selectedVariant.platform}`}
													name={`textBody-${selectedVariant.platform}`}
													value={selectedVariant.content.textBody}
													onChange={(event) =>
														updateVariant(selectedVariant.platform, {
															content: {
																...selectedVariant.content,
																textBody: event.target.value,
															},
														})
													}
													className={mediumTextareaClassName}
												/>
											</div>
										)
									) : null}

									<div className="space-y-2">
										<Label htmlFor={`asset-mode-${selectedVariant.platform}`}>
											Asset mode
										</Label>
										<Select
											value={selectedVariant.assetMode}
											onValueChange={(value) =>
												updateVariant(selectedVariant.platform, {
													assetMode: value as "inherit" | "replace",
												})
											}
										>
											<SelectTrigger
												id={`asset-mode-${selectedVariant.platform}`}
												className={adminSelectTriggerClassName}
												aria-label="Asset mode"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="inherit">
													Use shared assets
												</SelectItem>
												<SelectItem value="replace">
													Replace for this destination
												</SelectItem>
											</SelectContent>
										</Select>
									</div>
									{selectedVariant.assetMode === "replace" ? (
										<ResourcePicker
											resources={resources}
											resourceSets={resourceSets}
											resolveResourceSetIds={resolveResourceSetIds}
											value={selectedVariant.assetIds}
											onChange={(next) =>
												updateVariant(selectedVariant.platform, {
													assetIds: next,
												})
											}
											triggerLabel="Choose override assets"
											allowUpload
											onResourcesCreated={addUploadedResources}
											onOpenChange={(open) => {
												if (open) {
													void loadResourceLibrary();
												}
											}}
										/>
									) : null}
									<ResourceChipList
										resources={
											selectedVariant.assetMode === "replace"
												? selectedVariant.assetIds
														.map((assetId) => resourcesById.get(assetId))
														.filter((asset): asset is ResourceRecord =>
															Boolean(asset),
														)
												: selectedDestinationAssets
										}
										onRemove={
											selectedVariant.assetMode === "replace"
												? (resourceId) =>
														updateVariant(selectedVariant.platform, {
															assetIds: selectedVariant.assetIds.filter(
																(item) => item !== resourceId,
															),
														})
												: undefined
										}
									/>
									<div className="space-y-2">
										<Label htmlFor={`notes-${selectedVariant.platform}`}>
											Destination notes
										</Label>
										<Textarea
											id={`notes-${selectedVariant.platform}`}
											name={`notes-${selectedVariant.platform}`}
											value={selectedVariant.notes}
											onChange={(event) =>
												updateVariant(selectedVariant.platform, {
													notes: event.target.value,
												})
											}
											className={compactTextareaClassName}
											placeholder="Optional note for this destination"
										/>
									</div>
								</div>
							) : null}

							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/72 p-4">
								<div className="text-sm font-medium text-muted-foreground">
									Preview
								</div>
								<pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
									{selectedDestinationContent
										? renderContentPreview(
												selectedDestinationContent.kind,
												buildContentPayload(selectedDestinationContent),
											)
										: "No destination preview yet."}
								</pre>
							</div>
						</div>
					) : null}
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
