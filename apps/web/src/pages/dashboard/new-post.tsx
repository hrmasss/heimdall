import {
	AlertTriangle,
	ArrowLeft,
	CalendarClock,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock3,
	CircleAlert,
	CircleCheckBig,
	CircleSlash,
	Globe2,
	LoaderCircle,
	PanelRightOpen,
	Plus,
	Save,
	Send,
	Settings2,
	Trash2,
	WandSparkles,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import {
	AdminFormField,
	AdminFormGrid,
	AdminFormPage,
	adminInputClassName,
	adminSelectTriggerClassName,
	adminTextareaClassName,
} from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { ResourceChipList } from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
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
	AIGeneratedPostDraft,
	AIProviderCatalog,
	ApiListResponse,
	CampaignSummary,
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
	SocialConnectionsResponse,
	SocialTargetRecord,
	VariantReadiness,
	WorkspaceAISettings,
	WorkspaceContextResponse,
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

function formatTagsForAppend(tags: string[]) {
	return normalizeTags(tags).map(formatTagLabel).join(" ");
}

function formatTagsForEditor(tags: string[]) {
	return normalizeTags(tags).map(formatTagLabel).join(", ");
}

function appendTagsToBody(body: string, tags: string[]) {
	const formatted = formatTagsForAppend(tags);
	if (!formatted) {
		return body;
	}
	const trimmed = body.trimEnd();
	return trimmed ? `${trimmed}\n\n${formatted}` : formatted;
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

function parseDateTimeValue(value?: string) {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function padNumber(value: number) {
	return String(value).padStart(2, "0");
}

function formatPlannedDateLabel(value?: string) {
	const date = parseDateTimeValue(value);
	if (!date) {
		return "Choose date";
	}
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

function toMeridiem(hours24: number) {
	if (hours24 === 0) {
		return { hour12: 12, meridiem: "AM" as const };
	}
	if (hours24 === 12) {
		return { hour12: 12, meridiem: "PM" as const };
	}
	if (hours24 > 12) {
		return { hour12: hours24 - 12, meridiem: "PM" as const };
	}
	return { hour12: hours24, meridiem: "AM" as const };
}

function to24Hour(hour12: number, meridiem: "AM" | "PM") {
	if (meridiem === "AM") {
		return hour12 === 12 ? 0 : hour12;
	}
	return hour12 === 12 ? 12 : hour12 + 12;
}

function getPlannedTimeParts(value?: string) {
	const date = parseDateTimeValue(value);
	const hours = date?.getHours() ?? DEFAULT_HOUR;
	return {
		hour12: toMeridiem(hours).hour12,
		minute: date?.getMinutes() ?? DEFAULT_MINUTE,
		meridiem: toMeridiem(hours).meridiem,
	};
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(Math.max(value, minimum), maximum);
}

function getPlannedTimeDraft(value?: string): PlannedTimeDraft {
	const { hour12, minute, meridiem } = getPlannedTimeParts(value);
	return {
		hour: padNumber(hour12),
		minute: padNumber(minute),
		meridiem,
	};
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
	const allImages = assetCount > 0 && assetKinds.every((kind) => kind === "image");
	const allVideos = assetCount > 0 && assetKinds.every((kind) => kind === "video");

	const scored = rules.map((rule) => {
		let score = 0;
		const supportsCurrentKind = rule.supportedContentKinds.includes(content.kind);
		if (supportsCurrentKind) {
			score += 18;
		}
		if (assetCount === 0) {
			if (!rule.assetRequired) {
				score += 24;
			}
			if (/text|feed|post/i.test(rule.surface) || /text|feed/i.test(rule.label)) {
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
			if (allImages && /image|photo|carousel|multi/i.test(`${rule.surface} ${rule.label}`)) {
				score += 10;
			}
			if (allVideos && /video|reel|short/i.test(`${rule.surface} ${rule.label}`)) {
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
		surface: rule?.surface ?? surfaceOptions(capabilities, platform)[0]?.surface ?? "feed_post",
		inheritSource: "shared",
		contentMode: defaultModes.contentMode,
		content: coerceDraftContentForRule(createDraftContent(sharedDraft.kind), rule),
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
	const content = contentFromDestination(destination.variant, destination.snapshot);
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

function buildBulkPlannedAt(
	date: Date | null,
	time: PlannedTimeDraft,
) {
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
	const [socialTargets, setSocialTargets] = useState<SocialTargetRecord[]>([]);
	const [plannedTimeDrafts, setPlannedTimeDrafts] = useState<
		Record<string, PlannedTimeDraft>
	>({});
	const [bulkScheduleDate, setBulkScheduleDate] = useState<Date | null>(null);
	const [bulkScheduleTime, setBulkScheduleTime] = useState<PlannedTimeDraft>({
		hour: padNumber(DEFAULT_HOUR),
		minute: padNumber(DEFAULT_MINUTE),
		meridiem: "AM",
	});
	const [bulkActionSummary, setBulkActionSummary] =
		useState<BulkActionSummary | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [selectedDestinationPlatform, setSelectedDestinationPlatform] =
		useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [notes, setNotes] = useState("");
	const [campaignId, setCampaignId] = useState("");
	const [requiresApproval, setRequiresApproval] = useState(false);
	const [startsFromPlatform, setStartsFromPlatform] = useState("");
	const [startsFromSurface, setStartsFromSurface] = useState("");
	const [sharedDraft, setSharedDraft] = useState(createDraftContent());
	const [sharedTagInput, setSharedTagInput] = useState("");
	const [rootAssetIds, setRootAssetIds] = useState<string[]>([]);
	const [variants, setVariants] = useState<DraftVariant[]>([]);
	const [legacyVariants, setLegacyVariants] = useState<PostVariant[]>([]);
	const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);
	const [aiCatalog, setAICatalog] = useState<AIProviderCatalog | null>(null);
	const [aiSettings, setAISettings] = useState<WorkspaceAISettings | null>(null);
	const [aiContext, setAIContext] = useState<WorkspaceContextResponse | null>(null);
	const [aiPrompt, setAIPrompt] = useState("");
	const [aiMode, setAIMode] = useState<"native" | "byok">("native");
	const [aiProvider, setAIProvider] = useState("");
	const [aiModel, setAIModel] = useState("");
	const [aiGenerating, setAIGenerating] = useState(false);
	const [aiWarnings, setAIWarnings] = useState<string[]>([]);
	const [lastAIDraft, setLastAIDraft] = useState<AIGeneratedPostDraft | null>(null);

	const platformOptions = useMemo(
		() => uniquePlatforms(capabilities),
		[capabilities],
	);
	const aiProviders = aiCatalog?.providers ?? [];
	const workspacePermissions = useMemo(
		() =>
			activeWorkspaceMembership?.roles.flatMap((role) => role.permissions) ?? [],
		[activeWorkspaceMembership],
	);
	const canPublish = hasCustomerPermission(
		"content.posts.publish",
		workspacePermissions,
	);
	const activeAIProviderConfig = useMemo(
		() => aiProviders.find((provider) => provider.provider === aiProvider) ?? null,
		[aiProvider, aiProviders],
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
	const signature = JSON.stringify({
		title,
		notes,
		campaignId,
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
				const variant = variants.find((entry) => entry.platform === platform) ?? null;
				const snapshot = variant ? snapshots.get(platform) ?? null : null;
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
						summary: "Connect and select a healthy target to include this platform.",
					};
				}
				if (!variant || !snapshot) {
					return {
						...initialView,
						status: "blocked",
						summary: "Variant setup is still loading for this connected platform.",
						blockers: [
							{
								code: "variant_missing",
								message: "Variant setup is still loading for this connected platform.",
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
						summary: warnings[0]?.message ?? "Needs attention before you publish.",
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
				? destinationViews.find(
						(destination) => destination.platform === selectedDestinationPlatform,
					) ?? null
				: null,
		[destinationViews, selectedDestinationPlatform],
	);
	const selectedVariant = selectedDestination?.variant ?? null;
	const selectedSnapshot = selectedDestination?.snapshot ?? null;

	const loadEditor = useCallback(
		async (nextId?: string | null, requestedTab?: string | null) => {
			if (!activeWorkspaceId) {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const [
					campaignResponse,
					resourceResponse,
					setResponse,
					capabilityResponse,
					socialResponse,
					aiCatalogResponse,
					aiSettingsResponse,
					aiContextResponse,
					postResponse,
				] = await Promise.all([
					customerRequest<ApiListResponse<CampaignSummary>>("/campaigns"),
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					customerRequest<ApiListResponse<ResourceSetSummary>>(
						"/resource-sets",
					),
					customerRequest<ResourceCapabilityMatrix>("/resources/capabilities"),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
					customerRequest<AIProviderCatalog>(
						`/workspaces/${activeWorkspaceId}/ai/catalog`,
					).catch(() => null),
					customerRequest<WorkspaceAISettings>(
						`/workspaces/${activeWorkspaceId}/ai/settings`,
					).catch(() => null),
					customerRequest<WorkspaceContextResponse>(
						`/workspaces/${activeWorkspaceId}/ai/context`,
					).catch(() => null),
					nextId
						? customerRequest<PostDetail>(`/posts/${nextId}`)
						: Promise.resolve(null),
				]);
				const normalizedCapabilities =
					normalizeCapabilities(capabilityResponse);
				setCampaigns(campaignResponse.items);
				setResources(resourceResponse.items);
				setResourceSets(setResponse.items);
				setCapabilities(normalizedCapabilities);
				setSocialTargets(socialResponse.targets);
				setAICatalog(aiCatalogResponse);
				setAISettings(aiSettingsResponse);
				setAIContext(aiContextResponse);
				setAIMode(aiSettingsResponse?.defaultMode ?? "native");
				const defaultAISelection =
					aiSettingsResponse?.capabilityDefaults.post_generation ??
					(aiCatalogResponse?.providers[0]
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
							: "";
					const requestedSurface = requestedPlatform
						? (surfaceOptions(normalizedCapabilities, requestedPlatform)[0]
								?.surface ?? "feed_post")
						: "";
					const requestedRule =
						requestedPlatform && requestedSurface
							? findRule(
									normalizedCapabilities,
									requestedPlatform,
									requestedSurface,
								)
							: undefined;
					const emptySharedDraft = createDraftContent();
					const defaultModes = preferredVariantModes(emptySharedDraft, []);
					const seededVariants = requestedPlatform
						? [
								{
									id: undefined,
									platform: requestedPlatform,
									surface: requestedSurface,
									inheritSource: "shared",
									contentMode: defaultModes.contentMode,
									content: coerceDraftContentForRule(
										createDraftContent(emptySharedDraft.kind),
										requestedRule,
									),
									assetMode: defaultModes.assetMode,
									assetIds: [],
									removedInheritedResourceIds: [],
									approvalState: "draft" as const,
									reviewHistory: [],
									latestPublication: undefined,
									notes: "",
								},
							]
						: [];
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
					setVariants([]);
					setLegacyVariants([]);
					setDeletedVariantIds([]);
					setPlannedTimeDrafts({});
					setBulkActionSummary(null);
					setActiveTab(requestedPlatform || "shared");
					setBaseline(JSON.stringify(emptyState));
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
				setLegacyVariants(post.legacyVariants);
				setDeletedVariantIds([]);
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
		if (loading || !capabilities) {
			return;
		}
		const connectedPlatforms = Array.from(selectedTargetsByPlatform.keys());
		if (connectedPlatforms.length === 0) {
			return;
		}
		setVariants((current) => {
			const existingPlatforms = new Set(current.map((variant) => variant.platform));
			const missing = connectedPlatforms.filter(
				(platform) => !existingPlatforms.has(platform),
			);
			if (missing.length === 0) {
				return current;
			}
			return [
				...current,
				...missing.map((platform) =>
					createAutoVariant(platform, capabilities, sharedDraft, rootAssets),
				),
			];
		});
	}, [
		capabilities,
		loading,
		selectedTargetsByPlatform,
		sharedDraft,
		rootAssets,
	]);

	useEffect(() => {
		if (!activeAIProviderConfig) {
			return;
		}
		if (
			aiModel &&
			activeAIProviderConfig.approvedModels.includes(aiModel)
		) {
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

	function ensurePlatformTab(platform: string, surface?: string) {
		setVariants((current) => {
			const existing = current.find((variant) => variant.platform === platform);
			const nextSurface =
				surface ??
				surfaceOptions(capabilities, platform)[0]?.surface ??
				"feed_post";
			const nextRule = findRule(capabilities, platform, nextSurface);
			const defaultModes = preferredVariantModes(sharedDraft, rootAssets);
			if (existing) {
				return current.map((variant) =>
					variant.platform === platform
						? {
								...variant,
								surface: nextSurface,
								content: coerceDraftContentForRule(variant.content, nextRule),
							}
						: variant,
				);
			}
			return [
				...current,
				{
					id: undefined,
					platform,
					surface: nextSurface,
					inheritSource: "shared",
					contentMode: defaultModes.contentMode,
					content: coerceDraftContentForRule(
						createDraftContent(sharedDraft.kind),
						nextRule,
					),
					assetMode: defaultModes.assetMode,
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

	function appendDraftTagsToBody(content: DraftContent, tags: string[]) {
		if (content.kind === "article") {
			return {
				...content,
				articleBody: appendTagsToBody(content.articleBody, tags),
			};
		}
		if (content.kind === "thread") {
			const nextItems =
				content.threadItems.length > 0 ? [...content.threadItems] : [""];
			nextItems.push(formatTagsForAppend(tags));
			return { ...content, threadItems: nextItems };
		}
		return {
			...content,
			textBody: appendTagsToBody(content.textBody, tags),
		};
	}

	function appendSharedTagsToVariantBody(platform: string) {
		if (sharedDraft.tags.length === 0) {
			return;
		}
		setVariants((current) =>
			current.map((variant) =>
				variant.platform === platform
					? {
							...variant,
							content: appendDraftTagsToBody(variant.content, sharedDraft.tags),
						}
					: variant,
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
				response.title.trim() ||
				title ||
				aiPrompt.trim().slice(0, 80);
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

	async function persistDraft(requestedPlatform = activeTab || "shared") {
		if (!title.trim()) {
			setError("Post title is required.");
			return null;
		}
		setSaving(true);
		setError(null);
		try {
			const primaryVariant = variants[0];
			const body = {
				title,
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
				const normalizedModes = preferredVariantModes(
					snapshot ? contentFromSnapshot(snapshot) : sharedDraft,
					snapshot?.sourceAssets ?? rootAssets,
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
				const effectiveContentMode =
					shouldPromoteContentInheritance
						? "inherit"
						: variant.contentMode === "inherit" &&
							  normalizedModes.contentMode === "custom"
							? "custom"
							: variant.contentMode;
				const effectiveAssetMode =
					shouldPromoteAssetInheritance
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
			await loadEditor(post.id, requestedPlatform);
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

	async function runVariantAction(
		variant: DraftVariant,
		action:
			| "submit"
			| "approve"
			| "publish"
			| "changes"
			| "schedule"
			| "unschedule"
			| "record",
	) {
		setSaving(true);
		setError(null);
		try {
			let variantId = variant.id;
			let latestPlannedAt = variant.latestPublication?.plannedAt;
			if (!variantId || hasUnsavedChanges) {
				const persisted = await persistDraft(variant.platform);
				if (!persisted) {
					return;
				}
				const savedVariant = persisted.savedVariantsByPlatform.get(variant.platform);
				variantId = savedVariant?.id;
				latestPlannedAt = savedVariant?.latestPublication?.plannedAt;
			}
			if (!variantId) {
				setError("Save the draft once before using review or publish actions.");
				return;
			}
			if (action === "submit") {
				await customerRequest(`/posts/variants/${variantId}/reviews/submit`, {
					method: "POST",
					body: { comment: "" },
				});
			} else if (action === "publish") {
				await customerRequest(`/social/variants/${variantId}/publish`, {
					method: "POST",
					body: { source: "social_api" },
				});
			} else if (action === "approve" || action === "changes") {
				await customerRequest(
					`/posts/variants/${variantId}/reviews/decision`,
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
					`/posts/variants/${variantId}/publication/schedule`,
					{
						method: "POST",
						body: {
							plannedAt: latestPlannedAt,
							source: "manual",
						},
					},
				);
			} else if (action === "unschedule") {
				await customerRequest(
					`/posts/variants/${variantId}/publication/unschedule`,
					{
						method: "POST",
					},
				);
			} else {
				await customerRequest(
					`/posts/variants/${variantId}/publication/record-published`,
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
		const bulkPlannedAt = buildBulkPlannedAt(bulkScheduleDate, bulkScheduleTime);
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
						await customerRequest(`/social/variants/${savedVariant.id}/publish`, {
							method: "POST",
							body: { source: "social_api" },
						});
					} else if (action === "schedule") {
						await customerRequest(
							`/posts/variants/${savedVariant.id}/publication/schedule`,
							{
								method: "POST",
								body: { plannedAt: bulkPlannedAt, source: "manual" },
							},
						);
					} else {
						await customerRequest(`/posts/variants/${savedVariant.id}/reviews/submit`, {
							method: "POST",
							body: { comment: "" },
						});
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
				for (const destination of [...blockedDestinations, ...notConnectedDestinations]) {
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

	function setPlannedAt(
		platform: string,
		nextDate: Date | null,
		nextTime?: { hour12: number; minute: number; meridiem: "AM" | "PM" },
	) {
		const variant = variants.find((entry) => entry.platform === platform);
		if (!variant) {
			return;
		}
		if (!nextDate) {
			updateVariant(platform, {
				latestPublication: {
					id: variant.latestPublication?.id ?? "",
					variantId: variant.id ?? "",
					publicationState:
						variant.latestPublication?.publicationState ?? "unscheduled",
					plannedAt: undefined,
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
			return;
		}
		const currentTime = getPlannedTimeParts(
			variant.latestPublication?.plannedAt,
		);
		const resolvedTime = nextTime ?? currentTime;
		const plannedAt = new Date(
			nextDate.getFullYear(),
			nextDate.getMonth(),
			nextDate.getDate(),
			to24Hour(resolvedTime.hour12, resolvedTime.meridiem),
			resolvedTime.minute,
			0,
			0,
		).toISOString();
		updateVariant(platform, {
			latestPublication: {
				id: variant.latestPublication?.id ?? "",
				variantId: variant.id ?? "",
				publicationState:
					variant.latestPublication?.publicationState ?? "unscheduled",
				plannedAt,
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

	function setPlannedDate(platform: string, value?: Date) {
		setPlannedAt(platform, value ?? null);
		const variant = variants.find((entry) => entry.platform === platform);
		setPlannedTimeDrafts((current) => ({
			...current,
			[platform]: getPlannedTimeDraft(variant?.latestPublication?.plannedAt),
		}));
	}

	function setPlannedTime(
		platform: string,
		patch: Partial<{ hour12: number; minute: number; meridiem: "AM" | "PM" }>,
	) {
		const variant = variants.find((entry) => entry.platform === platform);
		if (!variant) {
			return;
		}
		const existingDate = parseDateTimeValue(
			variant.latestPublication?.plannedAt,
		);
		const baseDate =
			existingDate ??
			new Date(
				new Date().getFullYear(),
				new Date().getMonth(),
				new Date().getDate(),
				DEFAULT_HOUR,
				DEFAULT_MINUTE,
				0,
				0,
			);
		const currentTime = getPlannedTimeParts(
			variant.latestPublication?.plannedAt,
		);
		setPlannedAt(platform, baseDate, {
			hour12: patch.hour12 ?? currentTime.hour12,
			minute: patch.minute ?? currentTime.minute,
			meridiem: patch.meridiem ?? currentTime.meridiem,
		});
		const nextTime = {
			hour12: patch.hour12 ?? currentTime.hour12,
			minute: patch.minute ?? currentTime.minute,
			meridiem: patch.meridiem ?? currentTime.meridiem,
		};
		setPlannedTimeDrafts((current) => ({
			...current,
			[platform]: {
				hour: padNumber(nextTime.hour12),
				minute: padNumber(nextTime.minute),
				meridiem: nextTime.meridiem,
			},
		}));
	}

	function updatePlannedTimeDraft(
		platform: string,
		patch: Partial<PlannedTimeDraft>,
	) {
		const variant = variants.find((entry) => entry.platform === platform);
		const fallback = getPlannedTimeDraft(variant?.latestPublication?.plannedAt);
		setPlannedTimeDrafts((current) => ({
			...current,
			[platform]: {
				...(current[platform] ?? fallback),
				...patch,
			},
		}));
	}

	function commitPlannedTime(platform: string) {
		const variant = variants.find((entry) => entry.platform === platform);
		if (!variant) {
			return;
		}
		const draft =
			plannedTimeDrafts[platform] ??
			getPlannedTimeDraft(variant.latestPublication?.plannedAt);
		const hourValue = draft.hour === "" ? DEFAULT_HOUR : Number(draft.hour);
		const minuteValue =
			draft.minute === "" ? DEFAULT_MINUTE : Number(draft.minute);
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
		setError(null);
		setPlannedTime(platform, { hour12, minute, meridiem: draft.meridiem });
	}

	function updateBulkScheduleTime(patch: Partial<PlannedTimeDraft>) {
		setBulkScheduleTime((current) => ({
			...current,
			...patch,
		}));
	}

	function commitBulkScheduleTime() {
		setBulkScheduleTime((current) => {
			const hourValue = current.hour === "" ? DEFAULT_HOUR : Number(current.hour);
			const minuteValue =
				current.minute === "" ? DEFAULT_MINUTE : Number(current.minute);
			return {
				hour: padNumber(
					clamp(
						Number.isFinite(hourValue) ? hourValue : DEFAULT_HOUR,
						1,
						12,
					),
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
	const primaryActionDescription = canPublish
		? bulkEligibleCount === 0
			? "No connected destinations are eligible yet."
			: `${bulkEligibleCount} eligible destination${bulkEligibleCount === 1 ? "" : "s"} will go out together.`
		: bulkEligibleCount === 0
			? "No connected destinations are ready to send for review yet."
			: `${bulkEligibleCount} destination${bulkEligibleCount === 1 ? "" : "s"} will move into review together.`;
	const selectedDestinationAssets = selectedSnapshot?.effectiveAssets ?? [];
	const selectedDestinationContent =
		selectedVariant && selectedSnapshot
			? selectedVariant.contentMode === "custom"
				? selectedVariant.content
				: contentFromSnapshot(selectedSnapshot)
			: null;

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

	return (
		<>
			<AdminFormPage
				eyebrow="Compose"
				title={
					isEditMode
						? "Publish everywhere from one composer"
						: "Create once, publish everywhere"
				}
				description="Build the shared post first, then let Heimdall fan it out to every connected destination that can support it."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to={postId ? `/dashboard/posts/${postId}` : "/dashboard/posts"}>
								<ArrowLeft className="size-4" />
								Back
							</Link>
						</Button>
					</>
				}
				aside={
					<div className="dashboard-page-stack space-y-6 xl:sticky xl:self-start dashboard-sticky-rail">
						<SurfaceCard className="space-y-5 border-[var(--brand-border-soft)] bg-gradient-to-br from-white via-white to-orange-50/70 p-5">
							<div>
								<div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
									Command deck
								</div>
								<div className="mt-2 text-2xl font-semibold">
									{title.trim() || "Untitled post"}
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{primaryActionDescription}
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="rounded-[20px] border border-emerald-200/70 bg-emerald-50/80 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-emerald-700">
										Ready
									</div>
									<div className="mt-2 text-3xl font-semibold text-emerald-900">
										{readyDestinations.length}
									</div>
								</div>
								<div className="rounded-[20px] border border-amber-200/70 bg-amber-50/80 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-amber-700">
										Attention
									</div>
									<div className="mt-2 text-3xl font-semibold text-amber-900">
										{attentionDestinations.length}
									</div>
								</div>
								<div className="rounded-[20px] border border-rose-200/70 bg-rose-50/80 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-rose-700">
										Blocked
									</div>
									<div className="mt-2 text-3xl font-semibold text-rose-900">
										{blockedDestinations.length}
									</div>
								</div>
								<div className="rounded-[20px] border border-slate-200/70 bg-slate-50/80 p-4">
									<div className="text-xs uppercase tracking-[0.2em] text-slate-600">
										Not connected
									</div>
									<div className="mt-2 text-3xl font-semibold text-slate-900">
										{notConnectedDestinations.length}
									</div>
								</div>
							</div>
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/80 p-4">
								<div className="text-sm font-medium">Shared preview</div>
								<pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
									{renderContentPreview(
										sharedDraft.kind,
										buildContentPayload(sharedDraft),
									)}
								</pre>
								<div className="mt-4">
									<TagBadgeRow tags={sharedDraft.tags} />
								</div>
							</div>
							{bulkActionSummary ? (
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/80 p-4 text-sm text-muted-foreground">
									<div className="font-medium text-foreground">
										Latest bulk action
									</div>
									<div className="mt-2">
										{bulkActionSummary.succeeded.length} succeeded,{" "}
										{bulkActionSummary.skipped.length} skipped,{" "}
										{bulkActionSummary.failed.length} failed.
									</div>
								</div>
							) : null}
						</SurfaceCard>
					</div>
				}
			>
				<div className="dashboard-page-stack space-y-6 pb-32">
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

					<SurfaceCard className="space-y-6 border-[var(--brand-border-soft)] bg-gradient-to-br from-white via-white to-orange-50/60 p-6">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
									Unified composer
								</div>
								<div className="mt-2 text-2xl font-semibold">
									Compose the source once
								</div>
								<div className="mt-1 text-sm text-muted-foreground">
									Every healthy selected destination is included by default.
								</div>
							</div>
							<Badge variant="outline" className="rounded-full px-3 py-1">
								{bulkEligibleCount} included by default
							</Badge>
						</div>

						<AdminFormGrid>
							<AdminFormField>
								<Label>Post title</Label>
								<Input
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									className={adminInputClassName}
									placeholder="Q2 product launch story"
								/>
							</AdminFormField>
							<AdminFormField>
								<Label>Campaign</Label>
								<Select
									value={campaignId || "none"}
									onValueChange={(value) =>
										setCampaignId(value === "none" ? "" : value)
									}
								>
									<SelectTrigger className={adminSelectTriggerClassName}>
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

						<div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.95fr)]">
							<div className="space-y-6">
								<SurfaceCard className="space-y-4 rounded-[24px] border-[var(--brand-border-soft)] bg-background/85 p-5">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<div className="text-sm font-medium">Shared content</div>
											<div className="text-sm text-muted-foreground">
												This becomes the default for every destination.
											</div>
										</div>
										<Select
											value={sharedDraft.kind}
											onValueChange={(value) =>
												setSharedDraft(createDraftContent(value as ContentKind))
											}
										>
											<SelectTrigger className="w-[170px] rounded-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="text">Text post</SelectItem>
												<SelectItem value="article">Article</SelectItem>
												<SelectItem value="thread">Thread</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{sharedDraft.kind === "article" ? (
										<div className="space-y-4">
											<Input
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
											<Textarea
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
									) : sharedDraft.kind === "thread" ? (
										<div className="space-y-3">
											{sharedDraft.threadItems.map((item, index) => (
												<Textarea
													key={`shared-thread-${index}`}
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
											placeholder="Write the master caption or body once."
										/>
									)}

									<Textarea
										value={sharedTagInput}
										onChange={(event) => updateSharedTags(event.target.value)}
										onBlur={() =>
											setSharedTagInput(
												formatTagsForEditor(sharedDraft.tags),
											)
										}
										className={compactTextareaClassName}
										placeholder="#launch, #product, #behindthescenes"
									/>
									<TagBadgeRow tags={sharedDraft.tags} />

									<div className="flex flex-wrap items-center justify-between gap-3">
										<div className="text-sm text-muted-foreground">
											Shared assets travel with every inheriting destination.
										</div>
										<ResourcePicker
											resources={resources}
											resourceSets={resourceSets}
											resolveResourceSetIds={resolveResourceSetIds}
											value={rootAssetIds}
											onChange={setRootAssetIds}
											triggerLabel="Attach assets"
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

								<details
									open={showAdvanced}
									onToggle={(event) =>
										setShowAdvanced(event.currentTarget.open)
									}
									className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/85 p-5"
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
										<div>
											<div className="text-sm font-medium">Advanced options</div>
											<div className="text-sm text-muted-foreground">
												Approval, notes, and AI help stay out of the main flow.
											</div>
										</div>
										<Settings2 className="size-4 text-muted-foreground" />
									</summary>
									<div className="mt-5 space-y-4">
										<Textarea
											value={notes}
											onChange={(event) => setNotes(event.target.value)}
											className={mediumTextareaClassName}
											placeholder="Internal notes"
										/>
										<div className="flex items-start justify-between gap-4 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
											<div>
												<div className="text-sm font-medium">Approval gate</div>
												<div className="text-sm text-muted-foreground">
													Only enable this when a reviewer should stay in the loop.
												</div>
											</div>
											<Switch
												checked={requiresApproval}
												onCheckedChange={setRequiresApproval}
											/>
										</div>
										<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
											<div className="flex items-center justify-between gap-3">
												<div className="text-sm font-medium">AI draft assist</div>
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
												value={aiPrompt}
												onChange={(event) => setAIPrompt(event.target.value)}
												className={compactTextareaClassName}
												placeholder="Describe what the post should do."
											/>
										</div>
									</div>
								</details>
							</div>

							<SurfaceCard className="space-y-4 rounded-[24px] border-[var(--brand-border-soft)] bg-background/85 p-5">
								<div>
									<div className="text-sm font-medium">Destinations</div>
									<div className="text-sm text-muted-foreground">
										Ready and warning-only destinations are included by default.
									</div>
								</div>
								{[
									{
										label: "Ready",
										items: readyDestinations,
										tone: "border-emerald-200/70 bg-emerald-50/70",
									},
									{
										label: "Needs attention",
										items: attentionDestinations,
										tone: "border-amber-200/70 bg-amber-50/70",
									},
									{
										label: "Blocked",
										items: blockedDestinations,
										tone: "border-rose-200/70 bg-rose-50/70",
									},
									{
										label: "Not connected",
										items: notConnectedDestinations,
										tone: "border-slate-200/70 bg-slate-50/70",
									},
								].map((group) => (
									<div
										key={group.label}
										className={cn("rounded-[22px] border p-4", group.tone)}
									>
										<div className="flex items-center justify-between gap-3">
											<div className="text-sm font-medium">{group.label}</div>
											<Badge variant="secondary" className="rounded-full">
												{group.items.length}
											</Badge>
										</div>
										<div className="mt-3 grid gap-3">
											{group.items.length > 0 ? (
												group.items.map((destination) => (
													<button
														key={destination.platform}
														type="button"
														onClick={() => {
															setActiveTab(destination.platform);
															setSelectedDestinationPlatform(
																destination.platform,
															);
														}}
														className="flex w-full items-start justify-between gap-3 rounded-[20px] border border-white/80 bg-white/90 px-4 py-4 text-left transition hover:-translate-y-0.5"
													>
														<div className="flex min-w-0 items-start gap-3">
															<div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background">
																{platformIcon(destination.platform)}
															</div>
															<div className="min-w-0">
																<div className="font-medium">
																	{destination.label}
																</div>
																<div className="mt-1 text-sm text-muted-foreground">
																	{destination.summary}
																</div>
															</div>
														</div>
														<div className="flex items-center gap-2">
															{renderDestinationStatusIcon(destination.status)}
															<PanelRightOpen className="size-4 text-muted-foreground" />
														</div>
													</button>
												))
											) : (
												<div className="rounded-[18px] border border-dashed border-[var(--brand-border-soft)] bg-background/70 px-4 py-5 text-sm text-muted-foreground">
													No destinations here yet.
												</div>
											)}
										</div>
									</div>
								))}
							</SurfaceCard>
						</div>
					</SurfaceCard>

					<div className="sticky bottom-4 z-20">
						<div className="rounded-[28px] border border-[var(--brand-border-soft)] bg-background/95 p-4 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
							<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
								<div>
									<div className="text-sm font-medium">{primaryActionLabel}</div>
									<div className="text-sm text-muted-foreground">
										{primaryActionDescription}
									</div>
								</div>
								<div className="flex flex-col gap-3 xl:flex-row xl:items-center">
									<div className="flex flex-wrap items-center gap-3">
										<Popover>
											<PopoverTrigger asChild>
												<Button type="button" variant="outline" className="rounded-full">
													<CalendarDays className="size-4" />
													{bulkScheduleDate
														? bulkScheduleDate.toLocaleDateString()
														: "Pick schedule date"}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0" align="end">
												<Calendar
													mode="single"
													selected={bulkScheduleDate ?? undefined}
													onSelect={(date) => setBulkScheduleDate(date ?? null)}
												/>
											</PopoverContent>
										</Popover>
										<div className="flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background px-3 py-2">
											<Input
												value={bulkScheduleTime.hour}
												onChange={(event) =>
													updateBulkScheduleTime({
														hour: event.target.value,
													})
												}
												onBlur={commitBulkScheduleTime}
												className="h-8 w-10 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
											/>
											<span className="text-muted-foreground">:</span>
											<Input
												value={bulkScheduleTime.minute}
												onChange={(event) =>
													updateBulkScheduleTime({
														minute: event.target.value,
													})
												}
												onBlur={commitBulkScheduleTime}
												className="h-8 w-10 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
											/>
											<Select
												value={bulkScheduleTime.meridiem}
												onValueChange={(value) =>
													setBulkScheduleTime((current) => ({
														...current,
														meridiem: value as "AM" | "PM",
													}))
												}
											>
												<SelectTrigger className="h-8 w-[76px] rounded-full border-0 bg-muted/50 px-3 shadow-none">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="AM">AM</SelectItem>
													<SelectItem value="PM">PM</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="flex flex-wrap items-center gap-2">
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
										{canPublish ? (
											<Button
												type="button"
												variant="outline"
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
												Schedule
											</Button>
										) : null}
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
				</div>
			</AdminFormPage>

			<Sheet
				open={Boolean(selectedDestinationPlatform)}
				onOpenChange={(open) =>
					setSelectedDestinationPlatform(open ? selectedDestinationPlatform : null)
				}
			>
				<SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-3">
							{selectedDestination
								? platformIcon(selectedDestination.platform)
								: null}
							<span>{selectedDestination?.label ?? "Destination details"}</span>
						</SheetTitle>
						<SheetDescription>
							Keep the shared version by default, and only customize this destination when you need to.
						</SheetDescription>
					</SheetHeader>
					{selectedDestination ? (
						<div className="mt-6 space-y-5">
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/80 p-4">
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
									className="rounded-[20px] border border-amber-200/70 bg-amber-50/70 p-4 text-sm text-amber-800"
								>
									{warning.message}
								</div>
							))}
							{selectedDestination.blockers.map((blocker) => (
								<div
									key={blocker.code}
									className="rounded-[20px] border border-rose-200/70 bg-rose-50/70 p-4 text-sm text-rose-800"
								>
									{blocker.message}
								</div>
							))}

							{selectedVariant ? (
								<>
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Surface</Label>
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
												<SelectTrigger className={adminSelectTriggerClassName}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{surfaceOptions(capabilities, selectedVariant.platform).map(
														(option) => (
															<SelectItem key={option.surface} value={option.surface}>
																{formatSurfaceLabel(option)}
															</SelectItem>
														),
													)}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-2">
											<Label>Content mode</Label>
											<Select
												value={selectedVariant.contentMode}
												onValueChange={(value) =>
													updateVariant(selectedVariant.platform, {
														contentMode: value as "inherit" | "custom",
													})
												}
											>
												<SelectTrigger className={adminSelectTriggerClassName}>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="inherit">Use shared version</SelectItem>
													<SelectItem value="custom">Customize here</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>

									{selectedVariant.contentMode === "custom" ? (
										selectedVariant.content.kind === "article" ? (
											<div className="space-y-4">
												<Input
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
												<Textarea
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
										) : selectedVariant.content.kind === "thread" ? (
											<div className="space-y-3">
												{selectedVariant.content.threadItems.map((item, index) => (
													<Textarea
														key={`drawer-thread-${index}`}
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
												))}
											</div>
										) : (
											<Textarea
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
										)
									) : null}

									<div className="space-y-2">
										<Label>Asset mode</Label>
										<Select
											value={selectedVariant.assetMode}
											onValueChange={(value) =>
												updateVariant(selectedVariant.platform, {
													assetMode: value as "inherit" | "replace",
												})
											}
										>
											<SelectTrigger className={adminSelectTriggerClassName}>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="inherit">Use shared assets</SelectItem>
												<SelectItem value="replace">Replace for this destination</SelectItem>
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
										/>
									) : null}
									<ResourceChipList
										resources={
											selectedVariant.assetMode === "replace"
												? selectedVariant.assetIds
														.map((assetId) => resourcesById.get(assetId))
														.filter(
															(asset): asset is ResourceRecord => Boolean(asset),
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
									<Textarea
										value={selectedVariant.notes}
										onChange={(event) =>
											updateVariant(selectedVariant.platform, {
												notes: event.target.value,
											})
										}
										className={compactTextareaClassName}
										placeholder="Optional note for this destination"
									/>
								</>
							) : null}

							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/80 p-4">
								<div className="text-sm font-medium">Preview</div>
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
				</SheetContent>
			</Sheet>
		</>
	);

	return (
		<AdminFormPage
			eyebrow="Compose"
			title={isEditMode ? "Edit post" : "Create post"}
			description="Shared draft for reusable source material, platform tabs for the actual variants you schedule and review."
			actions={
				<>
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/automations">
							<WandSparkles className="size-4" />
							Generate post
						</Link>
					</Button>
					<Button variant="outline" className="rounded-full" asChild>
						<Link to={postId ? `/dashboard/posts/${postId}` : "/dashboard/posts"}>
							<ArrowLeft className="size-4" />
							Back
						</Link>
					</Button>
				</>
			}
			aside={
				<div className="dashboard-page-stack space-y-6 xl:sticky xl:self-start dashboard-sticky-rail">
					<SurfaceCard className="dashboard-card space-y-4">
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
					</SurfaceCard>
				</div>
			}
		>
			<div className="dashboard-page-stack space-y-6">
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

				<SurfaceCard className="dashboard-card space-y-5">
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
						<AdminFormField className="md:col-span-2">
							<Label htmlFor="post-campaign">Campaign</Label>
							<Select
								value={campaignId || "__none"}
								onValueChange={(value) =>
									setCampaignId(value === "__none" ? "" : value)
								}
							>
								<SelectTrigger
									id="post-campaign"
									className={adminSelectTriggerClassName}
								>
									<SelectValue placeholder="No campaign" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="__none">No campaign</SelectItem>
									{campaigns.map((campaign) => (
										<SelectItem key={campaign.id} value={campaign.id}>
											{campaign.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</AdminFormField>
					</AdminFormGrid>
					<div className="dashboard-grid-gap grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
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
						<AdminFormField>
							<Label htmlFor="requires-approval">Require approval</Label>
							<div className="dashboard-card-sm dashboard-textarea-medium flex border border-[var(--brand-border-soft)] bg-background/55">
								<div className="flex w-full items-start justify-between gap-4">
									<div className="pr-3">
										<div className="font-medium">Approval gate</div>
										<div className="text-sm text-muted-foreground">
											Block schedule and publish actions until a reviewer
											approves.
										</div>
									</div>
									<Switch
										id="requires-approval"
										checked={requiresApproval}
										onCheckedChange={setRequiresApproval}
									/>
								</div>
							</div>
						</AdminFormField>
					</div>
				</SurfaceCard>

				<SurfaceCard className="dashboard-card space-y-5">
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
							variant="default"
							className="dashboard-tabs-min-height !h-auto w-full flex-wrap items-stretch justify-start gap-2 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/50 p-2.5"
						>
							<TabsTrigger
								value="shared"
								className="h-auto min-h-11 flex-none self-stretch rounded-[18px] border border-transparent px-3 py-2.5 data-active:border-[var(--brand-border-soft)] data-active:bg-background/85"
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
											"h-auto min-h-11 flex-none self-stretch rounded-[18px] border border-transparent px-3 py-2.5 data-active:border-[var(--brand-border-soft)] data-active:bg-background/85",
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
							<div className="dashboard-grid-gap grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
								<div className="space-y-5">
									<SurfaceCard className="dashboard-card space-y-4">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div>
												<div className="flex items-center gap-2 text-sm font-medium">
													<WandSparkles className="size-4 text-primary" />
													AI draft
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													Generate a shared draft with workspace business context,
													selected campaign context, and brand signals only when they
													help.
												</div>
											</div>
											{aiContext?.readiness ? (
												<Badge variant="outline" className="rounded-full">
													{aiContext?.readiness.complete
														? "Workspace intelligence ready"
														: `Missing: ${aiContext?.readiness.missing.join(", ")}`}
												</Badge>
											) : null}
											{aiSettings?.fallbackPoolEnabled ? (
												<Badge variant="outline" className="rounded-full">
													Fallback key pools enabled
												</Badge>
											) : null}
										</div>
										<div className="space-y-2">
											<Label htmlFor="ai-post-prompt">What should the post do?</Label>
											<Textarea
												id="ai-post-prompt"
												value={aiPrompt}
												onChange={(event) => setAIPrompt(event.target.value)}
												className={mediumTextareaClassName}
												placeholder="Example: Draft a LinkedIn post about how AI helps CFOs and investors validate financial signals faster without replacing judgment."
											/>
										</div>
										<div className="grid gap-4 md:grid-cols-3">
											<AdminFormField>
												<Label>Access mode</Label>
												<Select
													value={aiMode}
													onValueChange={(value) =>
														setAIMode(value as "native" | "byok")
													}
												>
													<SelectTrigger className={adminSelectTriggerClassName}>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="native">Platform native</SelectItem>
														<SelectItem value="byok">Bring your own key</SelectItem>
													</SelectContent>
												</Select>
											</AdminFormField>
											<AdminFormField>
												<Label>Provider</Label>
												<Select
													value={aiProvider}
													onValueChange={(value) => setAIProvider(value)}
												>
													<SelectTrigger className={adminSelectTriggerClassName}>
														<SelectValue placeholder="Select provider" />
													</SelectTrigger>
													<SelectContent>
														{aiProviders.map((provider) => (
															<SelectItem
																key={provider.provider}
																value={provider.provider}
															>
																{provider.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</AdminFormField>
											<AdminFormField>
												<Label>Model</Label>
												<Select value={aiModel} onValueChange={setAIModel}>
													<SelectTrigger className={adminSelectTriggerClassName}>
														<SelectValue placeholder="Select model" />
													</SelectTrigger>
													<SelectContent>
														{(activeAIProviderConfig?.approvedModels ?? []).map(
															(model) => (
																<SelectItem key={model} value={model}>
																	{model}
																</SelectItem>
															),
														)}
													</SelectContent>
												</Select>
											</AdminFormField>
										</div>
										<div className="flex flex-wrap items-center gap-2">
											<Button
												type="button"
												className="rounded-full border-0 bg-gradient-brand text-white"
												disabled={
													aiGenerating ||
													loading ||
													!aiPrompt.trim() ||
													!aiProvider ||
													!aiModel
												}
												onClick={() => void generateAIDraft()}
											>
												{aiGenerating ? (
													<>
														<LoaderCircle className="size-4 animate-spin" />
														Generating draft...
													</>
												) : (
													<>
														<WandSparkles className="size-4" />
														Generate AI draft
													</>
												)}
											</Button>
											<Button
												type="button"
												variant="outline"
												className="rounded-full"
												asChild
											>
												<Link to="/dashboard/settings/intelligence">
													Edit intelligence setup
												</Link>
											</Button>
										</div>
										{aiWarnings.length > 0 ? (
											<div className="rounded-[20px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800">
												{aiWarnings.join(" ")}
											</div>
										) : null}
										{lastAIDraft ? (
											<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
												Generated with {lastAIDraft?.provider} / {lastAIDraft?.model}
												{lastAIDraft?.runEvent
													? ` · run ${lastAIDraft?.runEvent?.id?.slice(0, 8) ?? ""}`
													: ""}
											</div>
										) : null}
									</SurfaceCard>

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
										<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/45 p-4">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div>
													<div className="text-sm font-medium">Shared tags</div>
													<div className="text-sm text-muted-foreground">
														Stored separately from the body so we can adapt them
														per platform later.
													</div>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="rounded-full"
													disabled={sharedDraft.tags.length === 0}
													onClick={() =>
														setSharedDraft((current) =>
															appendDraftTagsToBody(current, current.tags),
														)
													}
												>
													<Plus className="size-4" />
													{sharedDraft.kind === "thread"
														? "Add tags as final item"
														: "Append tags to body"}
												</Button>
											</div>
											<Textarea
												value={sharedTagInput}
												onChange={(event) =>
													updateSharedTags(event.target.value)
												}
												onBlur={() =>
													setSharedTagInput(
														formatTagsForEditor(sharedDraft.tags),
													)
												}
												className={compactTextareaClassName}
												placeholder="#launch, #behindthescenes"
											/>
											<TagBadgeRow tags={sharedDraft.tags} />
										</div>
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
									<TagBadgeRow tags={sharedDraft.tags} />
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
										<SurfaceCard className="dashboard-card border border-dashed border-[var(--brand-border-soft)] text-sm text-muted-foreground">
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
							const actionBlockers = summarizeIssues([
								...scheduleBlockers,
								...publishBlockers,
							]);
							const threadItems =
								variant.content.threadItems.length > 0
									? variant.content.threadItems
									: [""];
							const plannedAt = variant.latestPublication?.plannedAt;
							const plannedDate = parseDateTimeValue(plannedAt);
							const plannedTimeDraft =
								plannedTimeDrafts[platform] ?? getPlannedTimeDraft(plannedAt);

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
														onValueChange={(value) => {
															const nextRule = findRule(
																capabilities,
																platform,
																value,
															);
															updateVariant(platform, {
																surface: value,
																content: coerceDraftContentForRule(
																	variant.content,
																	nextRule,
																),
															});
														}}
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
														onValueChange={(value) => {
															const sourceSnapshot =
																value === "shared"
																	? {
																			content: sharedDraft,
																			sourceAssets: rootAssets,
																		}
																	: (() => {
																			const sourcePlatform = value.replace(
																				/^platform:/,
																				"",
																			);
																			const sourceVariant =
																				variants.find(
																					(entry) =>
																						entry.platform === sourcePlatform,
																				) ?? null;
																			if (!sourceVariant) {
																				return {
																					content: createDraftContent(
																						sharedDraft.kind,
																					),
																					sourceAssets: [],
																				};
																			}
																			const snapshot = resolveVariantSnapshot(
																				sourceVariant,
																				variants,
																				sharedDraft,
																				rootAssets,
																				resourcesById,
																				requiresApproval,
																				capabilities,
																			);
																			return {
																				content: contentFromSnapshot(snapshot),
																				sourceAssets: snapshot.sourceAssets,
																			};
																		})();
															const defaultModes = preferredVariantModes(
																sourceSnapshot.content,
																sourceSnapshot.sourceAssets,
															);
															updateVariant(platform, {
																inheritSource: value,
																contentMode:
																	variant.contentMode === "inherit" &&
																	defaultModes.contentMode === "custom"
																		? "custom"
																		: variant.contentMode,
																content:
																	variant.contentMode === "inherit" &&
																	defaultModes.contentMode === "custom"
																		? sourceSnapshot.content
																		: variant.content,
																assetMode:
																	variant.assetMode === "inherit" &&
																	defaultModes.assetMode === "replace"
																		? "replace"
																		: variant.assetMode,
															});
														}}
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
														onValueChange={(value) => {
															const nextMode = value as "inherit" | "custom";
															updateVariant(platform, {
																contentMode: nextMode,
																content:
																	nextMode === "custom"
																		? contentFromSnapshot(snapshot)
																		: variant.content,
															});
														}}
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
											<div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_220px]">
												<div className="space-y-2">
													<Label>Planned date</Label>
													<Popover>
														<PopoverTrigger asChild>
															<Button
																type="button"
																variant="outline"
																className="dashboard-input-height w-full justify-between rounded-2xl px-4 text-left font-normal"
															>
																<span className="flex items-center gap-3">
																	<CalendarDays className="size-4 text-muted-foreground" />
																	<span
																		className={cn(
																			plannedDate
																				? "text-foreground"
																				: "text-muted-foreground",
																		)}
																	>
																		{formatPlannedDateLabel(plannedAt)}
																	</span>
																</span>
																<ChevronDown className="size-4 text-muted-foreground" />
															</Button>
														</PopoverTrigger>
														<PopoverContent
															align="start"
															className="w-auto rounded-[28px] border border-[var(--brand-border-soft)] bg-background/95 p-3 shadow-xl backdrop-blur"
														>
															<Calendar
																mode="single"
																selected={plannedDate ?? undefined}
																onSelect={(value) =>
																	setPlannedDate(platform, value)
																}
																className="p-0"
															/>
															<div className="flex justify-end pt-2">
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="rounded-full"
																	onClick={() => setPlannedDate(platform)}
																>
																	Clear
																</Button>
															</div>
														</PopoverContent>
													</Popover>
												</div>
												<div className="space-y-2">
													<div className="text-sm font-medium">
														Planned time
													</div>
													<div
														id={`planned-time-${platform}`}
														className="dashboard-input-height flex items-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/60 px-3 shadow-sm"
													>
														<Input
															aria-label="Planned hour"
															name={`planned-hour-${platform}`}
															inputMode="numeric"
															value={plannedTimeDraft.hour}
															onChange={(event) =>
																updatePlannedTimeDraft(platform, {
																	hour: event.target.value
																		.replace(/\D/g, "")
																		.slice(0, 2),
																})
															}
															onBlur={() => commitPlannedTime(platform)}
															className="h-auto w-8 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
															placeholder="09"
														/>
														<span className="px-1 text-sm text-muted-foreground">
															:
														</span>
														<Input
															aria-label="Planned minute"
															name={`planned-minute-${platform}`}
															inputMode="numeric"
															value={plannedTimeDraft.minute}
															onChange={(event) =>
																updatePlannedTimeDraft(platform, {
																	minute: event.target.value
																		.replace(/\D/g, "")
																		.slice(0, 2),
																})
															}
															onBlur={() => commitPlannedTime(platform)}
															className="h-auto w-8 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
															placeholder="00"
														/>
														<div className="ml-auto flex items-center gap-1 rounded-full border border-[var(--brand-border-soft)] bg-background/70 p-1">
															<Button
																type="button"
																variant="ghost"
																size="sm"
																className={cn(
																	"h-7 rounded-full px-2 text-xs",
																	plannedTimeDraft.meridiem === "AM" &&
																		"bg-background text-foreground shadow-sm",
																)}
																onClick={() => {
																	updatePlannedTimeDraft(platform, {
																		meridiem: "AM",
																	});
																	setPlannedTime(platform, { meridiem: "AM" });
																}}
															>
																AM
															</Button>
															<Button
																type="button"
																variant="ghost"
																size="sm"
																className={cn(
																	"h-7 rounded-full px-2 text-xs",
																	plannedTimeDraft.meridiem === "PM" &&
																		"bg-background text-foreground shadow-sm",
																)}
																onClick={() => {
																	updatePlannedTimeDraft(platform, {
																		meridiem: "PM",
																	});
																	setPlannedTime(platform, { meridiem: "PM" });
																}}
															>
																PM
															</Button>
														</div>
													</div>
												</div>
											</div>
											<div className="mt-4 flex flex-wrap gap-2">
												<Button
													type="button"
													variant="outline"
													className="h-10 rounded-full border-sky-500/20 bg-sky-500/10 px-4 text-sky-800 hover:bg-sky-500/15 hover:text-sky-900 dark:text-sky-100 dark:hover:text-sky-50"
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
													className="h-10 rounded-full border-emerald-500/20 bg-emerald-500/10 px-4 text-emerald-800 hover:bg-emerald-500/15 hover:text-emerald-900 dark:text-emerald-100 dark:hover:text-emerald-50"
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
													className="h-10 rounded-full border-amber-500/20 bg-amber-500/10 px-4 text-amber-800 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-100 dark:hover:text-amber-50"
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
													className="h-10 rounded-full border-indigo-500/20 bg-indigo-500/10 px-4 text-indigo-800 hover:bg-indigo-500/15 hover:text-indigo-900 dark:text-indigo-100 dark:hover:text-indigo-50"
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
													className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-foreground hover:bg-white/10"
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
													className="h-10 rounded-full border-fuchsia-500/20 bg-fuchsia-500/10 px-4 text-fuchsia-800 hover:bg-fuchsia-500/15 hover:text-fuchsia-900 dark:text-fuchsia-100 dark:hover:text-fuchsia-50"
													onClick={() =>
														void runVariantAction(variant, "record")
													}
													disabled={saving || publishBlockers.length > 0}
												>
													Record as published
												</Button>
											</div>
											{actionBlockers.length > 0 ? (
												<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
													<div className="mb-3 flex flex-wrap items-center gap-2">
														<div className="font-medium">Action blockers</div>
														{scheduleBlockers.length > 0 ? (
															<Badge
																variant="outline"
																className="rounded-full border-red-500/25 text-red-700"
															>
																Blocks scheduling
															</Badge>
														) : null}
														{publishBlockers.length > 0 ? (
															<Badge
																variant="outline"
																className="rounded-full border-red-500/25 text-red-700"
															>
																Blocks publish
															</Badge>
														) : null}
													</div>
													<div className="space-y-2">
														{actionBlockers.map((issue) => (
															<div key={issue.code}>{issue.message}</div>
														))}
													</div>
												</div>
											) : null}
											{actionBlockers.length === 0 ? (
												<div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
													This variant is ready for review and scheduling
													actions.
												</div>
											) : null}
										</SurfaceCard>

										<SurfaceCard className="space-y-4 p-5">
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div className="text-sm font-medium">Content</div>
												{variant.contentMode === "custom" ? (
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="rounded-full"
														disabled={sharedDraft.tags.length === 0}
														onClick={() =>
															appendSharedTagsToVariantBody(platform)
														}
													>
														<Plus className="size-4" />
														Append shared tags
													</Button>
												) : null}
											</div>
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
													<div className="mt-4">
														<TagBadgeRow
															tags={extractTagsFromPayload(
																snapshot.contentPayload,
															)}
														/>
													</div>
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
													<TagBadgeRow tags={sharedDraft.tags} />
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
													<div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/45 p-4">
														<div className="space-y-2">
															<div className="text-sm font-medium">
																Shared tags
															</div>
															<TagBadgeRow tags={sharedDraft.tags} />
														</div>
													</div>
												</div>
											) : (
												<div className="space-y-3">
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
													<TagBadgeRow tags={sharedDraft.tags} />
												</div>
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
					<SurfaceCard className="dashboard-card">
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
