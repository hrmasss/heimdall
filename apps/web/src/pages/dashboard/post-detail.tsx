import {
	RiFacebookCircleFill,
	RiInstagramFill,
	RiLinkedinFill,
	RiTiktokFill,
	RiTwitterXFill,
	RiYoutubeFill,
} from "@remixicon/react";
import {
	AlertTriangle,
	ArrowLeft,
	CalendarClock,
	CalendarDays,
	CheckCircle2,
	ChevronDown,
	Clock3,
	FileText,
	Globe2,
	LoaderCircle,
	PencilLine,
	Plus,
	RefreshCw,
	Send,
	Trash2,
	XCircle,
} from "lucide-react";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { ResourceChipList } from "@/components/resources/resource-display";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
	PostDetail,
	PostVariant,
	PublishabilityPreview,
	ReadinessIssue,
	ReviewRecord,
	SocialConnectionsResponse,
	SocialTargetRecord,
	TikTokPublishOptions,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { normalizePostDetail } from "@/lib/post-models";
import { cn } from "@/lib/utils";

type ContentKind = "text" | "article" | "thread";

type PlannedTimeDraft = {
	hour: string;
	minute: string;
	meridiem: "AM" | "PM";
};

type ResolvedContent = {
	kind: ContentKind;
	payload: Record<string, unknown>;
	sourceLabel: string;
	sourceTab: string;
};

type TikTokPreviewConfig = {
	creatorAvatarUrl?: string;
	creatorNickname?: string;
	creatorUsername?: string;
	privacyLevels: string[];
	maxVideoDurationSec?: number;
	commentAllowed: boolean;
	duetAllowed: boolean;
	stitchAllowed: boolean;
	isSelfOnly: boolean;
	credentialSource?: string;
};

const DEFAULT_HOUR = 9;
const DEFAULT_MINUTE = 0;
const PLATFORM_META: Record<
	string,
	{
		label: string;
		color: string;
		icon: ComponentType<{ className?: string; style?: CSSProperties }>;
	}
> = {
	facebook: {
		label: "Facebook",
		color: "#1877F2",
		icon: RiFacebookCircleFill,
	},
	instagram: {
		label: "Instagram",
		color: "#E1306C",
		icon: RiInstagramFill,
	},
	linkedin: {
		label: "LinkedIn",
		color: "#0A66C2",
		icon: RiLinkedinFill,
	},
	tiktok: {
		label: "TikTok",
		color: "#FF0050",
		icon: RiTiktokFill,
	},
	x: {
		label: "X",
		color: "#94A3B8",
		icon: RiTwitterXFill,
	},
	youtube: {
		label: "YouTube",
		color: "#FF0000",
		icon: RiYoutubeFill,
	},
};

function formatPlatformLabel(platform: string) {
	const knownPlatform = PLATFORM_META[platform];
	if (knownPlatform) {
		return knownPlatform.label;
	}
	return platform
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function formatSurfaceLabel(surface?: string) {
	return (surface ?? "Post format")
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function platformIcon(platform: string) {
	const knownPlatform = PLATFORM_META[platform];
	if (!knownPlatform) {
		return (
			<span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background/70 text-xs font-semibold uppercase">
				{platform.slice(0, 1)}
			</span>
		);
	}
	const Icon = knownPlatform.icon;
	return (
		<span
			className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border"
			style={{
				color: knownPlatform.color,
				borderColor: `${knownPlatform.color}33`,
				backgroundColor: `${knownPlatform.color}14`,
			}}
		>
			<Icon className="size-4" />
		</span>
	);
}

function extractTags(payload: Record<string, unknown>) {
	return Array.isArray(payload.tags)
		? payload.tags.filter((tag): tag is string => typeof tag === "string")
		: [];
}

function formatTagLabel(tag: string) {
	return tag.startsWith("#") ? tag : `#${tag}`;
}

function renderContentText(
	contentKind: ContentKind,
	payload: Record<string, unknown>,
) {
	if (contentKind === "thread" && Array.isArray(payload.items)) {
		const items = payload.items
			.map((item, index) =>
				typeof item === "object" &&
				item !== null &&
				"body" in item &&
				typeof item.body === "string"
					? `${index + 1}. ${item.body}`
					: "",
			)
			.filter(Boolean);
		return items.join("\n");
	}
	if (contentKind === "article") {
		return [
			typeof payload.title === "string" ? payload.title : "",
			typeof payload.body === "string" ? payload.body : "",
		]
			.filter(Boolean)
			.join("\n\n");
	}
	return typeof payload.body === "string" ? payload.body : "";
}

function summarizeIssues(issues: ReadinessIssue[]) {
	return Array.from(
		new Map(
			issues.map((issue) => [`${issue.code}:${issue.message}`, issue]),
		).values(),
	);
}

function issueKeys(issues: ReadinessIssue[]) {
	return summarizeIssues(issues).map(
		(issue) => `${issue.code}:${issue.message}`,
	);
}

function issueSetsMatch(left: ReadinessIssue[], right: ReadinessIssue[]) {
	const leftKeys = issueKeys(left);
	const rightKeys = issueKeys(right);
	if (leftKeys.length !== rightKeys.length) {
		return false;
	}
	return leftKeys.every((key, index) => key === rightKeys[index]);
}

function parseDateTimeValue(value?: string) {
	if (!value) {
		return null;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function targetMatchesVariantPlatform(
	target: SocialTargetRecord,
	platform: string,
) {
	if (target.provider === platform) {
		return true;
	}
	if (target.provider !== "meta") {
		return false;
	}
	if (platform === "facebook") {
		return target.targetType === "facebook_page";
	}
	if (platform === "instagram") {
		return target.targetType === "instagram_professional";
	}
	return false;
}

function extractTikTokPreviewConfig(
	preview?: PublishabilityPreview | null,
): TikTokPreviewConfig | null {
	const payload = preview?.publicationMetadata?.tiktok;
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const source = payload as Record<string, unknown>;
	return {
		creatorAvatarUrl:
			typeof source.creatorAvatarUrl === "string"
				? source.creatorAvatarUrl
				: undefined,
		creatorNickname:
			typeof source.creatorNickname === "string"
				? source.creatorNickname
				: undefined,
		creatorUsername:
			typeof source.creatorUsername === "string"
				? source.creatorUsername
				: undefined,
		privacyLevels: Array.isArray(source.privacyLevels)
			? source.privacyLevels.filter(
					(value): value is string => typeof value === "string",
				)
			: [],
		maxVideoDurationSec:
			typeof source.maxVideoDurationSec === "number"
				? source.maxVideoDurationSec
				: undefined,
		commentAllowed: source.commentAllowed !== false,
		duetAllowed: source.duetAllowed !== false,
		stitchAllowed: source.stitchAllowed !== false,
		isSelfOnly: source.isSelfOnly === true,
		credentialSource:
			typeof source.credentialSource === "string"
				? source.credentialSource
				: undefined,
	};
}

function defaultTikTokDraftFromPreview(
	preview?: PublishabilityPreview | null,
): TikTokPublishOptions {
	const config = extractTikTokPreviewConfig(preview);
	const defaultPrivacy = config?.privacyLevels.includes("SELF_ONLY")
		? "SELF_ONLY"
		: config?.privacyLevels[0];
	return {
		privacyLevel: defaultPrivacy,
		allowComment: config?.commentAllowed ?? true,
		allowDuet: config?.duetAllowed ?? true,
		allowStitch: config?.stitchAllowed ?? true,
		brandContent: false,
		brandedContent: false,
	};
}

function padNumber(value: number) {
	return value.toString().padStart(2, "0");
}

function formatPlannedDateLabel(value?: string) {
	const date = parseDateTimeValue(value);
	return date
		? date.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "Pick a date";
}

function formatPlannedTimeLabel(value?: string) {
	const date = parseDateTimeValue(value);
	return date
		? date.toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})
		: "Set time";
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

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(Math.max(value, minimum), maximum);
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

function getPlannedTimeDraft(value?: string): PlannedTimeDraft {
	const { hour12, minute, meridiem } = getPlannedTimeParts(value);
	return {
		hour: padNumber(hour12),
		minute: padNumber(minute),
		meridiem,
	};
}

function resolveInheritedContent(
	post: PostDetail,
	variant: PostVariant,
	seen = new Set<string>(),
): ResolvedContent {
	if (variant.contentMode === "custom" && variant.contentKind) {
		return {
			kind: variant.contentKind,
			payload: variant.contentPayload ?? {},
			sourceLabel: "Custom content",
			sourceTab: variant.platform,
		};
	}

	if (seen.has(variant.platform)) {
		return {
			kind: post.contentKind,
			payload: post.contentPayload,
			sourceLabel: "Shared draft",
			sourceTab: "shared",
		};
	}

	const inheritSource = variant.inheritSource || "shared";
	if (inheritSource === "shared") {
		return {
			kind: post.contentKind,
			payload: post.contentPayload,
			sourceLabel: "Shared draft",
			sourceTab: "shared",
		};
	}

	const sourcePlatform = inheritSource.replace(/^platform:/, "");
	const sourceVariant = post.variants.find(
		(entry) => entry.platform === sourcePlatform,
	);
	if (!sourceVariant) {
		return {
			kind: post.contentKind,
			payload: post.contentPayload,
			sourceLabel: "Shared draft",
			sourceTab: "shared",
		};
	}

	seen.add(variant.platform);
	const resolved = resolveInheritedContent(post, sourceVariant, seen);
	return {
		...resolved,
		sourceLabel: formatPlatformLabel(sourcePlatform),
		sourceTab: sourcePlatform,
	};
}

function parseMarkdownBlocks(markdown: string) {
	return markdown
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean);
}

function renderMarkdownPreview(markdown: string) {
	const blocks = parseMarkdownBlocks(markdown);
	if (blocks.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No article content yet.
			</div>
		);
	}
	return (
		<div className="space-y-4 text-sm leading-7 text-foreground">
			{blocks.map((block) => {
				const blockKey = `${block.slice(0, 40)}-${block.length}`;
				const lines = block.split("\n").filter(Boolean);
				if (lines.every((line) => /^[-*]\s+/.test(line))) {
					return (
						<ul key={blockKey} className="list-disc space-y-1 pl-5">
							{lines.map((line) => (
								<li key={line}>{line.replace(/^[-*]\s+/, "")}</li>
							))}
						</ul>
					);
				}
				if (lines.every((line) => /^\d+\.\s+/.test(line))) {
					return (
						<ol key={blockKey} className="list-decimal space-y-1 pl-5">
							{lines.map((line) => (
								<li key={line}>{line.replace(/^\d+\.\s+/, "")}</li>
							))}
						</ol>
					);
				}
				const heading = block.match(/^(#{1,3})\s+(.+)$/);
				if (heading) {
					const level = heading[1].length;
					const className =
						level === 1
							? "text-xl font-semibold"
							: level === 2
								? "text-lg font-semibold"
								: "text-base font-semibold";
					return (
						<div key={blockKey} className={className}>
							{heading[2]}
						</div>
					);
				}
				if (lines.every((line) => /^>\s+/.test(line))) {
					return (
						<blockquote
							key={blockKey}
							className="border-l-2 border-[var(--brand-border-soft)] pl-4 text-muted-foreground"
						>
							{lines.map((line) => line.replace(/^>\s+/, "")).join(" ")}
						</blockquote>
					);
				}
				return (
					<p key={blockKey} className="whitespace-pre-wrap">
						{block}
					</p>
				);
			})}
		</div>
	);
}

function TagRow({ tags }: { tags: string[] }) {
	if (tags.length === 0) {
		return <div className="text-sm text-muted-foreground">No tags yet.</div>;
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

function MetricStrip({
	items,
}: { items: { label: string; value: number; unit: string }[] }) {
	if (items.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">
				No KPI observations recorded yet.
			</div>
		);
	}
	return (
		<div className="grid gap-3 md:grid-cols-3">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
				>
					<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{item.label}
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{item.value.toLocaleString()}{" "}
						<span className="text-sm font-normal text-muted-foreground">
							{item.unit}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

function SummaryStat({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
			<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
				{label}
			</div>
			<div className="mt-2 text-sm font-medium text-foreground">{value}</div>
		</div>
	);
}

function ContentPreview({
	content,
	rawMarkdown,
}: {
	content: ResolvedContent;
	rawMarkdown: boolean;
}) {
	if (content.kind === "thread") {
		const items = Array.isArray(content.payload.items)
			? content.payload.items
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
		if (items.length === 0) {
			return (
				<div className="text-sm text-muted-foreground">
					No thread items yet.
				</div>
			);
		}
		return (
			<div className="space-y-3">
				{items.map((item, index) => (
					<div
						key={`${index + 1}-${item.slice(0, 24)}`}
						className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 p-4"
					>
						<div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
							Item {index + 1}
						</div>
						<div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
							{item}
						</div>
					</div>
				))}
			</div>
		);
	}

	if (content.kind === "article") {
		const title =
			typeof content.payload.title === "string" ? content.payload.title : "";
		const body =
			typeof content.payload.body === "string" ? content.payload.body : "";
		return (
			<div className="space-y-4">
				{title ? <div className="text-xl font-semibold">{title}</div> : null}
				{rawMarkdown ? (
					<pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
						{body || "No article content yet."}
					</pre>
				) : (
					renderMarkdownPreview(body)
				)}
			</div>
		);
	}

	return (
		<pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-foreground">
			{typeof content.payload.body === "string" && content.payload.body
				? content.payload.body
				: "No body text yet."}
		</pre>
	);
}

function ReadinessChips({ variant }: { variant: PostVariant }) {
	const chips: { label: string; className: string }[] = [];
	if (
		variant.readiness.draftIssues.length === 0 &&
		variant.readiness.scheduleBlockers.length === 0 &&
		variant.readiness.publishBlockers.length === 0
	) {
		chips.push({
			label: "Draft ready",
			className:
				"border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100",
		});
	}
	if (variant.readiness.draftIssues.length > 0) {
		chips.push({
			label: `${variant.readiness.draftIssues.length} draft issue${
				variant.readiness.draftIssues.length > 1 ? "s" : ""
			}`,
			className:
				"border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-100",
		});
	}
	if (variant.readiness.scheduleBlockers.length > 0) {
		chips.push({
			label: "Schedule blocked",
			className:
				"border-red-500/20 bg-red-500/10 text-red-800 dark:text-red-100",
		});
	}
	if (variant.readiness.publishBlockers.length > 0) {
		chips.push({
			label: "Publish blocked",
			className:
				"border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-100",
		});
	}
	return (
		<div className="flex flex-wrap gap-2">
			{chips.map((chip) => (
				<Badge
					key={chip.label}
					variant="outline"
					className={cn("rounded-full border", chip.className)}
				>
					{chip.label}
				</Badge>
			))}
		</div>
	);
}

function ActionBlockers({
	scheduleBlockers,
	publishBlockers,
}: {
	scheduleBlockers: ReadinessIssue[];
	publishBlockers: ReadinessIssue[];
}) {
	const nextScheduleBlockers = summarizeIssues(scheduleBlockers);
	const nextPublishBlockers = summarizeIssues(publishBlockers);
	if (nextScheduleBlockers.length === 0 && nextPublishBlockers.length === 0) {
		return (
			<div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
				This variant is ready for review and scheduling actions.
			</div>
		);
	}

	if (issueSetsMatch(nextScheduleBlockers, nextPublishBlockers)) {
		return (
			<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<div className="font-medium">Action blockers</div>
					<Badge
						variant="outline"
						className="rounded-full border-red-500/25 text-red-700 dark:text-red-200"
					>
						Blocks scheduling and publish
					</Badge>
				</div>
				<div className="space-y-2">
					{nextScheduleBlockers.map((issue) => (
						<div key={`${issue.code}:${issue.message}`}>{issue.message}</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
			<div className="mb-3 font-medium">Action blockers</div>
			<div className="space-y-4">
				{nextScheduleBlockers.length > 0 ? (
					<div>
						<div className="mb-2">
							<Badge
								variant="outline"
								className="rounded-full border-red-500/25 text-red-700 dark:text-red-200"
							>
								Blocks scheduling
							</Badge>
						</div>
						<div className="space-y-2">
							{nextScheduleBlockers.map((issue) => (
								<div key={`schedule-${issue.code}:${issue.message}`}>
									{issue.message}
								</div>
							))}
						</div>
					</div>
				) : null}
				{nextPublishBlockers.length > 0 ? (
					<div>
						<div className="mb-2">
							<Badge
								variant="outline"
								className="rounded-full border-red-500/25 text-red-700 dark:text-red-200"
							>
								Blocks publish
							</Badge>
						</div>
						<div className="space-y-2">
							{nextPublishBlockers.map((issue) => (
								<div key={`publish-${issue.code}:${issue.message}`}>
									{issue.message}
								</div>
							))}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function TikTokPublishPanel({
	variant,
	target,
	preview,
	draft,
	busyKey,
	saving,
	onRefresh,
	onPublish,
	onChange,
}: {
	variant: PostVariant;
	target: SocialTargetRecord | null;
	preview: PublishabilityPreview | null;
	draft: TikTokPublishOptions;
	busyKey: string | null;
	saving: boolean;
	onRefresh: () => void;
	onPublish: () => void;
	onChange: (patch: Partial<TikTokPublishOptions>) => void;
}) {
	const config = extractTikTokPreviewConfig(preview);
	const issues = summarizeIssues(preview?.issues ?? []);
	const warnings = summarizeIssues(preview?.warnings ?? []);
	const previewBusy = busyKey === `preview:${variant.id}`;
	const publishBusy = busyKey === `publish:${variant.id}`;
	const canPublish =
		Boolean(target) &&
		Boolean(preview?.ready) &&
		!previewBusy &&
		!publishBusy &&
		!saving;

	return (
		<SurfaceCard tone="muted" className="space-y-4 p-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-sm font-medium">Publish to TikTok</div>
					<div className="mt-1 text-sm text-muted-foreground">
						Preview creator restrictions, choose privacy, then send this variant
						through TikTok’s direct-post flow.
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={onRefresh}
					disabled={!target || previewBusy || publishBusy}
				>
					{previewBusy ? (
						<LoaderCircle className="size-4 animate-spin" />
					) : (
						<RefreshCw className="size-4" />
					)}
					Refresh checks
				</Button>
			</div>

			{target ? (
				<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
					<div className="font-medium">{target.displayName}</div>
					<div className="mt-1 text-sm text-muted-foreground">
						{target.username ? `@${target.username} • ` : ""}
						{target.targetType.replaceAll("_", " ")}
						{config?.credentialSource
							? ` • ${config.credentialSource === "managed" ? "Managed app" : "Workspace BYOK"}`
							: ""}
					</div>
				</div>
			) : (
				<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] bg-background/40 p-4 text-sm text-muted-foreground">
					Select a TikTok connection in workspace settings before publishing
					from this page.
				</div>
			)}

			{config ? (
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>Privacy level</Label>
						<Select
							value={
								draft.privacyLevel ?? config.privacyLevels[0] ?? "SELF_ONLY"
							}
							onValueChange={(value) => onChange({ privacyLevel: value })}
						>
							<SelectTrigger className="h-11 rounded-2xl px-4">
								<SelectValue placeholder="Select privacy" />
							</SelectTrigger>
							<SelectContent>
								{config.privacyLevels.map((value) => (
									<SelectItem key={value} value={value}>
										{value}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{config.isSelfOnly ? (
							<div className="text-xs text-muted-foreground">
								This app is currently restricted to private `SELF_ONLY`
								publishing.
							</div>
						) : null}
					</div>
					<div className="space-y-2 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/50 p-4 text-sm">
						<div className="font-medium">Creator info</div>
						<div className="text-muted-foreground">
							{config.creatorNickname ??
								target?.displayName ??
								"TikTok creator"}
							{config.creatorUsername ? ` (@${config.creatorUsername})` : ""}
						</div>
						<div className="text-muted-foreground">
							Max video duration:{" "}
							{config.maxVideoDurationSec
								? `${config.maxVideoDurationSec} seconds`
								: "Not reported"}
						</div>
					</div>
				</div>
			) : null}

			{config ? (
				<div className="grid gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/50 p-4">
					<div className="text-sm font-medium">Post options</div>
					<div className="flex items-center justify-between gap-3">
						<div className="text-sm">Allow comments</div>
						<Switch
							checked={draft.allowComment ?? config.commentAllowed}
							onCheckedChange={(checked) => onChange({ allowComment: checked })}
							disabled={!config.commentAllowed}
						/>
					</div>
					{variant.surface === "video_post" ? (
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm">Allow duet</div>
							<Switch
								checked={draft.allowDuet ?? config.duetAllowed}
								onCheckedChange={(checked) => onChange({ allowDuet: checked })}
								disabled={!config.duetAllowed}
							/>
						</div>
					) : null}
					{variant.surface === "video_post" ? (
						<div className="flex items-center justify-between gap-3">
							<div className="text-sm">Allow stitch</div>
							<Switch
								checked={draft.allowStitch ?? config.stitchAllowed}
								onCheckedChange={(checked) =>
									onChange({ allowStitch: checked })
								}
								disabled={!config.stitchAllowed}
							/>
						</div>
					) : null}
					<div className="flex items-center justify-between gap-3">
						<div className="text-sm">Brand content</div>
						<Switch
							checked={draft.brandContent ?? false}
							onCheckedChange={(checked) => onChange({ brandContent: checked })}
						/>
					</div>
					<div className="flex items-center justify-between gap-3">
						<div className="text-sm">Branded content</div>
						<Switch
							checked={draft.brandedContent ?? false}
							onCheckedChange={(checked) =>
								onChange({ brandedContent: checked })
							}
						/>
					</div>
				</div>
			) : null}

			{issues.length > 0 ? (
				<div className="rounded-[20px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
					<div className="mb-2 font-medium">TikTok publish blockers</div>
					<div className="space-y-2">
						{issues.map((issue) => (
							<div key={`${issue.code}:${issue.message}`}>{issue.message}</div>
						))}
					</div>
				</div>
			) : null}
			{warnings.length > 0 ? (
				<div className="rounded-[20px] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
					<div className="mb-2 font-medium">TikTok notes</div>
					<div className="space-y-2">
						{warnings.map((issue) => (
							<div key={`${issue.code}:${issue.message}`}>{issue.message}</div>
						))}
					</div>
				</div>
			) : null}

			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					className="rounded-full"
					onClick={onPublish}
					disabled={!canPublish}
				>
					{publishBusy ? (
						<LoaderCircle className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
					)}
					Publish to TikTok
				</Button>
				<div className="text-xs text-muted-foreground">
					Accepted by TikTok first, then promoted to a public post link once
					TikTok finishes processing and the post is publicly visible.
				</div>
			</div>
		</SurfaceCard>
	);
}

function ReviewTimeline({ reviews }: { reviews: ReviewRecord[] }) {
	if (reviews.length === 0) {
		return (
			<div className="text-sm text-muted-foreground">No review events yet.</div>
		);
	}
	return (
		<div className="space-y-2 text-sm">
			{reviews.map((review) => (
				<div
					key={review.id}
					className="rounded-[16px] border border-[var(--brand-border-soft)] bg-background/55 px-3 py-2 text-muted-foreground"
				>
					<span className="font-medium text-foreground">{review.decision}</span>{" "}
					· {new Date(review.createdAt).toLocaleString()}
				</div>
			))}
		</div>
	);
}

export function DashboardPostDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [post, setPost] = useState<PostDetail | null>(null);
	const [socialTargets, setSocialTargets] = useState<SocialTargetRecord[]>([]);
	const [socialPreviews, setSocialPreviews] = useState<
		Record<string, PublishabilityPreview | null>
	>({});
	const [tikTokDrafts, setTikTokDrafts] = useState<
		Record<string, TikTokPublishOptions>
	>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [socialBusyKey, setSocialBusyKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dataWarning, setDataWarning] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState("shared");
	const [plannedTimeDrafts, setPlannedTimeDrafts] = useState<
		Record<string, PlannedTimeDraft>
	>({});
	const [rawMarkdownTargets, setRawMarkdownTargets] = useState<
		Record<string, boolean>
	>({});

	const loadPost = useCallback(
		async (requestedTab?: string | null) => {
			if (!activeWorkspaceId) {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const [postResponse, socialResponse] = await Promise.all([
					customerRequest<PostDetail>(`/posts/${id}`),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
				]);
				const normalized = normalizePostDetail(postResponse);
				setPost(normalized.value);
				setSocialTargets(socialResponse.targets);
				setDataWarning(
					normalized.coerced
						? "Some post data was incomplete and has been safely normalized for display."
						: null,
				);
				const defaultTab = normalized.value.variants[0]?.platform ?? "shared";
				const nextTab =
					(requestedTab === "shared" ||
						normalized.value.variants.some(
							(variant) => variant.platform === requestedTab,
						)) &&
					requestedTab
						? requestedTab
						: defaultTab;
				setActiveTab(nextTab);
			} catch (loadError) {
				setError(
					loadError instanceof Error
						? loadError.message
						: "Unable to load this post.",
				);
				setPost(null);
				setSocialTargets([]);
				setDataWarning(null);
			} finally {
				setLoading(false);
			}
		},
		[activeWorkspaceId, customerRequest, id],
	);

	useEffect(() => {
		const requestedTab =
			typeof window === "undefined"
				? null
				: new URLSearchParams(window.location.search).get("tab");
		void loadPost(requestedTab);
	}, [loadPost]);

	useEffect(() => {
		if (!post) {
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
	}, [activeTab, post, searchParams, setSearchParams]);

	const sharedTags = useMemo(
		() => extractTags(post?.contentPayload ?? {}),
		[post?.contentPayload],
	);
	const aggregateMetrics = useMemo(
		() =>
			post?.metricSnapshot.slice(0, 3).map((item) => ({
				label: item.label,
				value: item.value,
				unit: item.unit,
			})) ?? [],
		[post?.metricSnapshot],
	);
	const activeVariant = useMemo(
		() =>
			post?.variants.find((variant) => variant.platform === activeTab) ?? null,
		[activeTab, post?.variants],
	);
	const currentEditHref =
		activeTab === "shared"
			? `/dashboard/posts/${id}/edit`
			: `/dashboard/posts/${id}/edit?tab=${activeTab}`;
	const selectedTargetForVariant = useCallback(
		(variant: PostVariant) =>
			socialTargets.find(
				(target) =>
					target.isSelected &&
					targetMatchesVariantPlatform(target, variant.platform),
			) ?? null,
		[socialTargets],
	);
	const activeSelectedTarget = useMemo(
		() => (activeVariant ? selectedTargetForVariant(activeVariant) : null),
		[activeVariant, selectedTargetForVariant],
	);

	const updateTikTokDraft = useCallback(
		(variantId: string, patch: Partial<TikTokPublishOptions>) => {
			setTikTokDrafts((current) => ({
				...current,
				[variantId]: {
					...(current[variantId] ?? {}),
					...patch,
				},
			}));
		},
		[],
	);

	const loadSocialPreview = useCallback(
		async (variant: PostVariant, target: SocialTargetRecord) => {
			setSocialBusyKey(`preview:${variant.id}`);
			try {
				const preview = await customerRequest<PublishabilityPreview>(
					`/social/variants/${variant.id}/preview`,
					{
						method: "POST",
						body: { socialTargetId: target.id },
					},
				);
				setSocialPreviews((current) => ({
					...current,
					[variant.id]: preview,
				}));
				setTikTokDrafts((current) => ({
					...current,
					[variant.id]: {
						...defaultTikTokDraftFromPreview(preview),
						...(current[variant.id] ?? {}),
					},
				}));
				return preview;
			} finally {
				setSocialBusyKey(null);
			}
		},
		[customerRequest],
	);

	async function publishVariantToSocial(
		variant: PostVariant,
		target: SocialTargetRecord,
	) {
		setSaving(true);
		setError(null);
		setSocialBusyKey(`publish:${variant.id}`);
		try {
			const body: Record<string, unknown> = {
				socialTargetId: target.id,
				source: "social_api",
			};
			if (variant.platform === "tiktok") {
				body.tiktok =
					tikTokDrafts[variant.id] ??
					defaultTikTokDraftFromPreview(socialPreviews[variant.id]);
			}
			await customerRequest(`/social/variants/${variant.id}/publish`, {
				method: "POST",
				body,
			});
			await loadPost();
			if (variant.platform === "tiktok") {
				await loadSocialPreview(variant, target);
			}
		} catch (publishError) {
			setError(
				publishError instanceof Error
					? publishError.message
					: "Unable to publish this variant to social.",
			);
		} finally {
			setSocialBusyKey(null);
			setSaving(false);
		}
	}

	function updateVariantPlannedAt(variantId: string, plannedAt?: string) {
		setPost((current) =>
			current
				? {
						...current,
						variants: current.variants.map((variant) =>
							variant.id === variantId
								? {
										...variant,
										latestPublication: {
											id: variant.latestPublication?.id ?? "",
											variantId: variant.id,
											publicationState:
												variant.latestPublication?.publicationState ??
												"unscheduled",
											plannedAt,
											publishedAt: variant.latestPublication?.publishedAt,
											externalPostId: variant.latestPublication?.externalPostId,
											externalPostUrl:
												variant.latestPublication?.externalPostUrl,
											externalAccountId:
												variant.latestPublication?.externalAccountId,
											source: variant.latestPublication?.source ?? "manual",
											lastError: variant.latestPublication?.lastError,
											metadata: variant.latestPublication?.metadata,
											createdAt: variant.latestPublication?.createdAt ?? "",
											updatedAt: variant.latestPublication?.updatedAt ?? "",
										},
									}
								: variant,
						),
					}
				: current,
		);
	}

	useEffect(() => {
		if (
			!activeVariant ||
			activeVariant.platform !== "tiktok" ||
			!activeSelectedTarget
		) {
			return;
		}
		const existing = socialPreviews[activeVariant.id];
		if (existing?.target?.id === activeSelectedTarget.id) {
			return;
		}
		void loadSocialPreview(activeVariant, activeSelectedTarget);
	}, [activeSelectedTarget, activeVariant, loadSocialPreview, socialPreviews]);

	function setPlannedAt(
		variant: PostVariant,
		nextDate: Date | null,
		nextTime?: { hour12: number; minute: number; meridiem: "AM" | "PM" },
	) {
		if (!nextDate) {
			updateVariantPlannedAt(variant.id, undefined);
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
		updateVariantPlannedAt(variant.id, plannedAt);
	}

	function setPlannedDate(variant: PostVariant, value?: Date) {
		setPlannedAt(variant, value ?? null);
		setPlannedTimeDrafts((current) => ({
			...current,
			[variant.id]: getPlannedTimeDraft(variant.latestPublication?.plannedAt),
		}));
	}

	function setPlannedTime(
		variant: PostVariant,
		patch: Partial<{ hour12: number; minute: number; meridiem: "AM" | "PM" }>,
	) {
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
		const nextTime = {
			hour12: patch.hour12 ?? currentTime.hour12,
			minute: patch.minute ?? currentTime.minute,
			meridiem: patch.meridiem ?? currentTime.meridiem,
		};
		setPlannedAt(variant, baseDate, nextTime);
		setPlannedTimeDrafts((current) => ({
			...current,
			[variant.id]: {
				hour: padNumber(nextTime.hour12),
				minute: padNumber(nextTime.minute),
				meridiem: nextTime.meridiem,
			},
		}));
	}

	function updatePlannedTimeDraft(
		variant: PostVariant,
		patch: Partial<PlannedTimeDraft>,
	) {
		const fallback = getPlannedTimeDraft(variant.latestPublication?.plannedAt);
		setPlannedTimeDrafts((current) => ({
			...current,
			[variant.id]: {
				...(current[variant.id] ?? fallback),
				...patch,
			},
		}));
	}

	function commitPlannedTime(variant: PostVariant) {
		const draft =
			plannedTimeDrafts[variant.id] ??
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
		setPlannedTime(variant, { hour12, minute, meridiem: draft.meridiem });
	}

	async function deletePost() {
		setSaving(true);
		setError(null);
		try {
			await customerRequest(`/posts/${id}`, { method: "DELETE" });
			navigate("/dashboard/posts");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this post.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function runVariantAction(
		variant: PostVariant,
		action:
			| "submit"
			| "approved"
			| "changes_requested"
			| "schedule"
			| "unschedule"
			| "record"
			| "sync_metrics",
	) {
		setSaving(true);
		setError(null);
		try {
			if (action === "submit") {
				await customerRequest(`/posts/variants/${variant.id}/reviews/submit`, {
					method: "POST",
					body: { comment: "" },
				});
			} else if (action === "approved" || action === "changes_requested") {
				await customerRequest(
					`/posts/variants/${variant.id}/reviews/decision`,
					{
						method: "POST",
						body: { approvalState: action, comment: "" },
					},
				);
			} else if (action === "schedule") {
				if (!variant.latestPublication?.plannedAt) {
					setError("Pick a planned date and time before scheduling.");
					setSaving(false);
					return;
				}
				await customerRequest(
					`/posts/variants/${variant.id}/publication/schedule`,
					{
						method: "POST",
						body: {
							plannedAt: variant.latestPublication.plannedAt,
							source: "manual",
						},
					},
				);
			} else if (action === "unschedule") {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/unschedule`,
					{ method: "POST" },
				);
			} else if (action === "sync_metrics") {
				await customerRequest(`/social/variants/${variant.id}/metrics/sync`, {
					method: "POST",
				});
			} else {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/record-published`,
					{ method: "POST" },
				);
			}
			await loadPost();
		} catch (reviewError) {
			setError(
				reviewError instanceof Error
					? reviewError.message
					: "Unable to update this variant.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Posts"
				title={post?.title ?? "Post detail"}
				description="Inspect the shared draft, move between platform variants, and keep review plus publication actions close to the active tab."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/posts">
								<ArrowLeft className="size-4" />
								Back
							</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to={currentEditHref}>
								<PencilLine className="size-4" />
								Edit
							</Link>
						</Button>
						<Button
							variant="outline"
							className="rounded-full text-red-600"
							onClick={() => void deletePost()}
							disabled={saving}
						>
							<Trash2 className="size-4" />
							Delete
						</Button>
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			{dataWarning ? (
				<SurfaceCard className="flex items-start gap-3 border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700">
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<div>{dataWarning}</div>
				</SurfaceCard>
			) : null}

			<SurfaceCard className="space-y-5 p-5 md:p-6">
				{loading || !post ? (
					<div className="flex items-center gap-3 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Loading post details...
					</div>
				) : (
					<>
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div className="space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="rounded-full">
										{post.variantCount} platform tab
										{post.variantCount === 1 ? "" : "s"}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										Review: {post.aggregateApprovalState}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										Publish: {post.aggregatePublicationState}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										Approval {post.requiresApproval ? "required" : "optional"}
									</Badge>
								</div>
								<div className="max-w-3xl text-sm text-muted-foreground">
									{post.notes?.trim()
										? post.notes
										: "No internal notes recorded yet."}
								</div>
							</div>
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={currentEditHref}>
									<PencilLine className="size-4" />
									{activeTab === "shared"
										? "Edit shared draft"
										: "Edit active variant"}
								</Link>
							</Button>
						</div>

						<div className="grid gap-3 md:grid-cols-4">
							<SummaryStat label="Shared assets" value={post.assets.length} />
							<SummaryStat label="Shared tags" value={sharedTags.length} />
							<SummaryStat
								label="Latest planned slot"
								value={
									post.latestPlannedAt
										? new Date(post.latestPlannedAt).toLocaleString()
										: "No scheduled variants yet"
								}
							/>
							<SummaryStat
								label="Updated"
								value={new Date(post.updatedAt).toLocaleString()}
							/>
						</div>
						{post.campaign ? (
							<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
											Campaign
										</div>
										<div className="mt-2 text-lg font-semibold">
											{post.campaign.name}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{post.campaign.startDate} to {post.campaign.endDate} ·{" "}
											{post.campaign.status}
										</div>
									</div>
									<Button variant="outline" className="rounded-full" asChild>
										<Link to={`/dashboard/campaigns/${post.campaign.id}`}>
											Open campaign
										</Link>
									</Button>
								</div>
							</div>
						) : null}
					</>
				)}
			</SurfaceCard>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="space-y-6">
					<SurfaceCard className="space-y-5 p-5 md:p-6">
						<div>
							<div className="text-lg font-semibold">Post tabs</div>
							<div className="text-sm text-muted-foreground">
								Use the same shared-draft and platform-tab model as the
								composer, but keep full edits on the edit screen.
							</div>
						</div>
						{loading || !post ? (
							<div className="text-sm text-muted-foreground">
								Loading tabs...
							</div>
						) : (
							<Tabs value={activeTab} onValueChange={setActiveTab}>
								<TabsList
									variant="default"
									className="!h-auto min-h-[4.5rem] w-full flex-wrap items-stretch justify-start gap-2 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/50 p-2.5"
								>
									<TabsTrigger
										value="shared"
										className="h-auto min-h-11 flex-none self-stretch rounded-[18px] border border-transparent px-3 py-2.5 data-active:border-[var(--brand-border-soft)] data-active:bg-background/85"
									>
										<Globe2 className="size-4" />
										Shared draft
									</TabsTrigger>
									{post.variants.map((variant) => (
										<TabsTrigger
											key={variant.id}
											value={variant.platform}
											className="h-auto min-h-11 flex-none self-stretch rounded-[18px] border border-transparent px-3 py-2.5 data-active:border-[var(--brand-border-soft)] data-active:bg-background/85"
										>
											{platformIcon(variant.platform)}
											{formatPlatformLabel(variant.platform)}
										</TabsTrigger>
									))}
								</TabsList>

								<TabsContent value="shared" className="mt-5 space-y-5">
									<SurfaceCard className="space-y-4 p-5">
										<div className="flex flex-wrap items-start justify-between gap-4">
											<div className="space-y-2">
												<div className="flex items-center gap-2 text-lg font-semibold">
													<FileText className="size-4 text-primary" />
													Shared draft
												</div>
												<div className="flex flex-wrap gap-2">
													<Badge variant="outline" className="rounded-full">
														{post.contentKind}
													</Badge>
													<Badge variant="outline" className="rounded-full">
														{post.assets.length} shared asset
														{post.assets.length === 1 ? "" : "s"}
													</Badge>
												</div>
											</div>
											<Button
												variant="outline"
												className="rounded-full"
												asChild
											>
												<Link to={`/dashboard/posts/${id}/edit`}>
													<PencilLine className="size-4" />
													Edit shared draft
												</Link>
											</Button>
										</div>

										<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
											<div className="space-y-5">
												<SurfaceCard tone="muted" className="space-y-4 p-5">
													<div className="flex items-center justify-between gap-3">
														<div className="text-sm font-medium">Content</div>
														{post.contentKind === "article" ? (
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="rounded-full"
																onClick={() =>
																	setRawMarkdownTargets((current) => ({
																		...current,
																		shared: !current.shared,
																	}))
																}
															>
																{rawMarkdownTargets.shared
																	? "Markdown preview"
																	: "Raw markdown"}
															</Button>
														) : null}
													</div>
													<ContentPreview
														content={{
															kind: post.contentKind,
															payload: post.contentPayload,
															sourceLabel: "Shared draft",
															sourceTab: "shared",
														}}
														rawMarkdown={Boolean(rawMarkdownTargets.shared)}
													/>
												</SurfaceCard>

												<SurfaceCard tone="muted" className="space-y-4 p-5">
													<div className="text-sm font-medium">
														Shared assets for inheritance
													</div>
													<div className="text-sm text-muted-foreground">
														Platform variants can inherit these assets or
														replace them with format-specific media.
													</div>
													<ResourceChipList resources={post.assets} />
												</SurfaceCard>
											</div>

											<div className="space-y-5">
												<SurfaceCard tone="muted" className="space-y-4 p-5">
													<div className="flex items-center justify-between gap-3">
														<div>
															<div className="text-sm font-medium">
																Shared tags
															</div>
															<div className="text-sm text-muted-foreground">
																Stored separately so variants can append or
																adapt them later.
															</div>
														</div>
														{activeVariant ? (
															<Button
																variant="outline"
																size="sm"
																className="rounded-full"
																asChild
															>
																<Link
																	to={`/dashboard/posts/${id}/edit?tab=${activeVariant.platform}`}
																>
																	<Plus className="size-4" />
																	Append in editor
																</Link>
															</Button>
														) : null}
													</div>
													<TagRow tags={sharedTags} />
												</SurfaceCard>

												<SurfaceCard tone="muted" className="space-y-4 p-5">
													<div className="text-sm font-medium">
														Downstream usage
													</div>
													<div className="text-sm text-muted-foreground">
														Open a platform tab to inspect inheritance,
														readiness, and publish actions for that specific
														variant.
													</div>
												</SurfaceCard>
											</div>
										</div>
									</SurfaceCard>
								</TabsContent>

								{post.variants.map((variant) => {
									const resolvedContent = resolveInheritedContent(
										post,
										variant,
									);
									const plannedAt = variant.latestPublication?.plannedAt;
									const plannedDate = parseDateTimeValue(plannedAt);
									const plannedTimeDraft =
										plannedTimeDrafts[variant.id] ??
										getPlannedTimeDraft(plannedAt);
									const variantMetrics = variant.metricSnapshot
										.slice(0, 3)
										.map((item) => ({
											label: item.label,
											value: item.value,
											unit: item.unit,
										}));
									const isPublished =
										variant.latestPublication?.publicationState === "published";
									const contentText = renderContentText(
										resolvedContent.kind,
										resolvedContent.payload,
									).toLowerCase();
									const selectedSocialTarget =
										selectedTargetForVariant(variant);
									const variantSocialPreview =
										variant.platform === "tiktok"
											? (socialPreviews[variant.id] ?? null)
											: null;
									const tikTokDraft =
										tikTokDrafts[variant.id] ??
										defaultTikTokDraftFromPreview(variantSocialPreview);
									const sharedTagsPresent = sharedTags.filter((tag) =>
										contentText.includes(formatTagLabel(tag).toLowerCase()),
									);
									const editSourceHref =
										resolvedContent.sourceTab === "shared"
											? `/dashboard/posts/${id}/edit`
											: `/dashboard/posts/${id}/edit?tab=${resolvedContent.sourceTab}`;
									return (
										<TabsContent
											key={variant.id}
											value={variant.platform}
											className="mt-5 space-y-5"
										>
											<SurfaceCard className="space-y-5 p-5">
												<div className="flex flex-wrap items-start justify-between gap-4">
													<div className="space-y-3">
														<div className="flex items-center gap-2 text-lg font-semibold">
															{platformIcon(variant.platform)}
															{formatPlatformLabel(variant.platform)}
														</div>
														<div className="flex flex-wrap gap-2">
															<Badge variant="outline" className="rounded-full">
																Post format:{" "}
																{formatSurfaceLabel(variant.surface)}
															</Badge>
															<Badge variant="outline" className="rounded-full">
																Content:{" "}
																{variant.contentMode === "inherit"
																	? "Inherited"
																	: "Custom"}
															</Badge>
															<Badge variant="outline" className="rounded-full">
																Assets:{" "}
																{variant.assetMode === "inherit"
																	? "Inherited"
																	: "Replace"}
															</Badge>
														</div>
														<ReadinessChips variant={variant} />
													</div>
													<div className="flex flex-wrap gap-2">
														<Button
															variant="outline"
															className="rounded-full"
															asChild
														>
															<Link
																to={`/dashboard/posts/${id}/edit?tab=${variant.platform}`}
															>
																<PencilLine className="size-4" />
																Edit this variant
															</Link>
														</Button>
														{variant.contentMode === "inherit" ? (
															<Button
																variant="outline"
																className="rounded-full"
																asChild
															>
																<Link to={editSourceHref}>
																	<PencilLine className="size-4" />
																	Edit source
																</Link>
															</Button>
														) : null}
													</div>
												</div>

												<div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
													<div className="space-y-5">
														<SurfaceCard tone="muted" className="space-y-4 p-5">
															<div className="flex flex-wrap items-center justify-between gap-3">
																<div>
																	<div className="text-sm font-medium">
																		Content
																	</div>
																	<div className="text-sm text-muted-foreground">
																		{variant.contentMode === "inherit"
																			? `Inheriting from ${resolvedContent.sourceLabel}.`
																			: "Platform-specific content preview."}
																	</div>
																</div>
																<div className="flex flex-wrap gap-2">
																	{resolvedContent.kind === "article" ? (
																		<Button
																			type="button"
																			variant="outline"
																			size="sm"
																			className="rounded-full"
																			onClick={() =>
																				setRawMarkdownTargets((current) => ({
																					...current,
																					[variant.id]: !current[variant.id],
																				}))
																			}
																		>
																			{rawMarkdownTargets[variant.id]
																				? "Markdown preview"
																				: "Raw markdown"}
																		</Button>
																	) : null}
																	{sharedTags.length > 0 ? (
																		<Button
																			variant="outline"
																			size="sm"
																			className="rounded-full"
																			asChild
																		>
																			<Link
																				to={`/dashboard/posts/${id}/edit?tab=${variant.platform}`}
																			>
																				<Plus className="size-4" />
																				Append shared tags
																			</Link>
																		</Button>
																	) : null}
																</div>
															</div>
															{variant.contentMode === "inherit" ? (
																<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 p-4 text-sm text-muted-foreground">
																	Source: {resolvedContent.sourceLabel}
																</div>
															) : null}
															<ContentPreview
																content={resolvedContent}
																rawMarkdown={Boolean(
																	rawMarkdownTargets[variant.id],
																)}
															/>
															<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/50 p-4">
																<div className="flex flex-wrap items-center justify-between gap-3">
																	<div className="text-sm font-medium">
																		Shared tags available here
																	</div>
																	{sharedTagsPresent.length > 0 ? (
																		<Badge
																			variant="outline"
																			className="rounded-full border-emerald-500/25 text-emerald-700 dark:text-emerald-100"
																		>
																			{sharedTagsPresent.length ===
																			sharedTags.length
																				? "Already present in content"
																				: `${sharedTagsPresent.length} already used`}
																		</Badge>
																	) : null}
																</div>
																<TagRow tags={sharedTags} />
															</div>
														</SurfaceCard>

														<SurfaceCard tone="muted" className="space-y-4 p-5">
															<div className="text-sm font-medium">
																Asset inheritance and effective media
															</div>
															<div className="grid gap-4 lg:grid-cols-2">
																<div className="space-y-3">
																	<div className="text-sm text-muted-foreground">
																		{variant.assetMode === "inherit"
																			? "Inherited from shared draft"
																			: "Variant-specific assets"}
																	</div>
																	<ResourceChipList
																		resources={
																			variant.assetMode === "inherit"
																				? post.assets
																				: variant.assets
																		}
																	/>
																</div>
																<div className="space-y-3">
																	<div className="text-sm text-muted-foreground">
																		Effective assets
																	</div>
																	<ResourceChipList
																		resources={variant.effectiveAssets}
																	/>
																</div>
															</div>
														</SurfaceCard>

														<SurfaceCard tone="muted" className="space-y-4 p-5">
															<div className="text-sm font-medium">
																Review timeline
															</div>
															<ReviewTimeline reviews={variant.reviewHistory} />
														</SurfaceCard>
													</div>

													<div className="space-y-5">
														<SurfaceCard className="space-y-4 p-5">
															<div className="mb-1 flex items-center gap-2 text-sm font-medium">
																<CalendarClock className="size-4 text-primary" />
																{isPublished
																	? "Published post"
																	: "Review and publish actions"}
															</div>
															{isPublished ? (
																<div className="space-y-4">
																	<div className="grid gap-3 sm:grid-cols-2">
																		<SummaryStat
																			label="Published at"
																			value={
																				variant.latestPublication?.publishedAt
																					? new Date(
																							variant.latestPublication
																								.publishedAt,
																						).toLocaleString()
																					: "Recorded as published"
																			}
																		/>
																		<SummaryStat
																			label="Platform post id"
																			value={
																				variant.latestPublication
																					?.externalPostId ??
																				"Waiting for provider id"
																			}
																		/>
																	</div>
																	<div className="flex flex-wrap gap-2">
																		{variant.latestPublication
																			?.externalPostUrl ? (
																			<Button
																				variant="outline"
																				className="rounded-full"
																				asChild
																			>
																				<a
																					href={
																						variant.latestPublication
																							.externalPostUrl
																					}
																					target="_blank"
																					rel="noreferrer"
																				>
																					<Globe2 className="size-4" />
																					View on{" "}
																					{formatPlatformLabel(
																						variant.platform,
																					)}
																				</a>
																			</Button>
																		) : null}
																		<Button
																			type="button"
																			variant="outline"
																			className="rounded-full"
																			onClick={() =>
																				void runVariantAction(
																					variant,
																					"sync_metrics",
																				)
																			}
																			disabled={saving}
																		>
																			<Send className="size-4" />
																			Refresh KPIs
																		</Button>
																	</div>
																	<div className="text-xs text-muted-foreground">
																		{variant.platform === "tiktok" &&
																		!variant.latestPublication?.externalPostUrl
																			? "TikTok has accepted this publish request. A public link appears after processing finishes and the post becomes publicly visible."
																			: "Published variants no longer need review or scheduling controls. Use the link above to inspect the live post and refresh KPIs after new interactions."}
																	</div>
																</div>
															) : (
																<>
																	<div className="grid gap-4">
																		<div className="space-y-2">
																			<Label>Planned date</Label>
																			<Popover>
																				<PopoverTrigger asChild>
																					<Button
																						type="button"
																						variant="outline"
																						className="h-11 w-full justify-between rounded-2xl px-4 text-left font-normal"
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
																								{formatPlannedDateLabel(
																									plannedAt,
																								)}
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
																							setPlannedDate(variant, value)
																						}
																						className="p-0"
																					/>
																					<div className="flex justify-end pt-2">
																						<Button
																							type="button"
																							variant="ghost"
																							size="sm"
																							className="rounded-full"
																							onClick={() =>
																								setPlannedDate(variant)
																							}
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
																				id={`planned-time-${variant.id}`}
																				className="flex h-11 items-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/60 px-3 shadow-sm"
																			>
																				<Input
																					aria-label="Planned hour"
																					name={`planned-hour-${variant.id}`}
																					inputMode="numeric"
																					value={plannedTimeDraft.hour}
																					onChange={(event) =>
																						updatePlannedTimeDraft(variant, {
																							hour: event.target.value
																								.replace(/\D/g, "")
																								.slice(0, 2),
																						})
																					}
																					onBlur={() =>
																						commitPlannedTime(variant)
																					}
																					className="h-auto w-8 border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0"
																					placeholder="09"
																				/>
																				<span className="px-1 text-sm text-muted-foreground">
																					:
																				</span>
																				<Input
																					aria-label="Planned minute"
																					name={`planned-minute-${variant.id}`}
																					inputMode="numeric"
																					value={plannedTimeDraft.minute}
																					onChange={(event) =>
																						updatePlannedTimeDraft(variant, {
																							minute: event.target.value
																								.replace(/\D/g, "")
																								.slice(0, 2),
																						})
																					}
																					onBlur={() =>
																						commitPlannedTime(variant)
																					}
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
																							plannedTimeDraft.meridiem ===
																								"AM" &&
																								"bg-background text-foreground shadow-sm",
																						)}
																						onClick={() => {
																							updatePlannedTimeDraft(variant, {
																								meridiem: "AM",
																							});
																							setPlannedTime(variant, {
																								meridiem: "AM",
																							});
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
																							plannedTimeDraft.meridiem ===
																								"PM" &&
																								"bg-background text-foreground shadow-sm",
																						)}
																						onClick={() => {
																							updatePlannedTimeDraft(variant, {
																								meridiem: "PM",
																							});
																							setPlannedTime(variant, {
																								meridiem: "PM",
																							});
																						}}
																					>
																						PM
																					</Button>
																				</div>
																			</div>
																			<div className="text-xs text-muted-foreground">
																				{plannedAt
																					? `Scheduled for ${formatPlannedDateLabel(plannedAt)} at ${formatPlannedTimeLabel(plannedAt)}`
																					: "No publish slot selected yet."}
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
																				void runVariantAction(
																					variant,
																					"approved",
																				)
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
																				void runVariantAction(
																					variant,
																					"changes_requested",
																				)
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
																				void runVariantAction(
																					variant,
																					"schedule",
																				)
																			}
																			disabled={
																				saving ||
																				!plannedAt ||
																				variant.readiness.scheduleBlockers
																					.length > 0
																			}
																		>
																			<Clock3 className="size-4" />
																			Schedule
																		</Button>
																		<Button
																			type="button"
																			variant="outline"
																			className="h-10 rounded-full border-white/10 bg-white/5 px-4 text-foreground hover:bg-white/10"
																			onClick={() =>
																				void runVariantAction(
																					variant,
																					"unschedule",
																				)
																			}
																			disabled={saving}
																		>
																			Unschedule
																		</Button>
																		{variant.platform !== "tiktok" ? (
																			<Button
																				type="button"
																				variant="outline"
																				className="h-10 rounded-full border-fuchsia-500/20 bg-fuchsia-500/10 px-4 text-fuchsia-800 hover:bg-fuchsia-500/15 hover:text-fuchsia-900 dark:text-fuchsia-100 dark:hover:text-fuchsia-50"
																				onClick={() =>
																					void runVariantAction(
																						variant,
																						"record",
																					)
																				}
																				disabled={
																					saving ||
																					variant.readiness.publishBlockers
																						.length > 0
																				}
																			>
																				Record as published
																			</Button>
																		) : null}
																	</div>

																	<ActionBlockers
																		scheduleBlockers={
																			variant.readiness.scheduleBlockers
																		}
																		publishBlockers={
																			variant.readiness.publishBlockers
																		}
																	/>
																	{variant.platform === "tiktok" ? (
																		<TikTokPublishPanel
																			variant={variant}
																			target={selectedSocialTarget}
																			preview={variantSocialPreview}
																			draft={tikTokDraft}
																			busyKey={socialBusyKey}
																			saving={saving}
																			onRefresh={() => {
																				if (!selectedSocialTarget) {
																					return;
																				}
																				void loadSocialPreview(
																					variant,
																					selectedSocialTarget,
																				);
																			}}
																			onPublish={() => {
																				if (!selectedSocialTarget) {
																					return;
																				}
																				void publishVariantToSocial(
																					variant,
																					selectedSocialTarget,
																				);
																			}}
																			onChange={(patch) =>
																				updateTikTokDraft(variant.id, patch)
																			}
																		/>
																	) : null}
																</>
															)}
														</SurfaceCard>

														<SurfaceCard tone="muted" className="space-y-4 p-5">
															<div className="flex items-center justify-between gap-3">
																<div className="text-sm font-medium">
																	Variant performance
																</div>
																{variant.latestPublication?.publicationState ===
																"published" ? (
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		className="rounded-full"
																		onClick={() =>
																			void runVariantAction(
																				variant,
																				"sync_metrics",
																			)
																		}
																		disabled={saving}
																	>
																		<Send className="size-4" />
																		Refresh KPIs
																	</Button>
																) : null}
															</div>
															<MetricStrip items={variantMetrics} />
														</SurfaceCard>
													</div>
												</div>
											</SurfaceCard>
										</TabsContent>
									);
								})}
							</Tabs>
						)}
					</SurfaceCard>

					{post && post.legacyVariants.length > 0 ? (
						<details className="group rounded-[28px] border border-[var(--brand-border-soft)] bg-background/55 p-5">
							<summary className="cursor-pointer list-none">
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="text-lg font-semibold">
											Legacy / advanced variants
										</div>
										<div className="text-sm text-muted-foreground">
											Extra variants on the same platform stay visible here, but
											the primary detail experience shows one main tab per
											platform.
										</div>
									</div>
									<Badge variant="outline" className="rounded-full">
										{post.legacyVariants.length}
									</Badge>
								</div>
							</summary>
							<div className="mt-4 grid gap-4 md:grid-cols-2">
								{post.legacyVariants.map((variant) => (
									<div
										key={variant.id}
										className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm"
									>
										<div className="font-medium">
											{formatPlatformLabel(variant.platform)} ·{" "}
											{formatSurfaceLabel(variant.surface)}
										</div>
										<div className="mt-2 text-muted-foreground">
											Approval: {variant.approvalState}
										</div>
										<div className="mt-1 text-muted-foreground">
											Publication:{" "}
											{variant.latestPublication?.publicationState ??
												"unscheduled"}
										</div>
									</div>
								))}
							</div>
						</details>
					) : null}
				</div>

				<div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
					<SurfaceCard className="space-y-4 p-5">
						<div className="text-lg font-semibold">
							{activeTab === "shared"
								? "Shared draft summary"
								: `${formatPlatformLabel(activeTab)} summary`}
						</div>
						{loading || !post ? (
							<div className="text-sm text-muted-foreground">Loading...</div>
						) : activeVariant ? (
							<>
								<SummaryStat
									label="Post format"
									value={formatSurfaceLabel(activeVariant.surface)}
								/>
								<SummaryStat
									label="Review state"
									value={activeVariant.approvalState}
								/>
								<SummaryStat
									label="Publication"
									value={
										activeVariant.latestPublication?.publicationState ??
										"unscheduled"
									}
								/>
								<SummaryStat
									label="Live post"
									value={
										activeVariant.latestPublication?.externalPostUrl ? (
											<a
												href={activeVariant.latestPublication.externalPostUrl}
												target="_blank"
												rel="noreferrer"
												className="inline-flex items-center gap-2 text-primary hover:underline"
											>
												<Globe2 className="size-4" />
												Open published post
											</a>
										) : (
											"No public link recorded yet"
										)
									}
								/>
								<SummaryStat
									label="Planned slot"
									value={
										activeVariant.latestPublication?.plannedAt
											? new Date(
													activeVariant.latestPublication.plannedAt,
												).toLocaleString()
											: "No planned slot"
									}
								/>
							</>
						) : (
							<>
								<SummaryStat label="Shared assets" value={post.assets.length} />
								<SummaryStat label="Shared tags" value={sharedTags.length} />
								<SummaryStat
									label="Review state"
									value={post.aggregateApprovalState}
								/>
								<SummaryStat
									label="Publication"
									value={post.aggregatePublicationState}
								/>
							</>
						)}
					</SurfaceCard>

					<SurfaceCard className="space-y-4 p-5">
						<div className="text-lg font-semibold">Aggregate performance</div>
						<MetricStrip items={aggregateMetrics} />
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
