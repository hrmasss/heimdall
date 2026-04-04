import {
	AlertTriangle,
	CalendarDays,
	CalendarRange,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	FilePlus2,
	FolderKanban,
	GripVertical,
	LoaderCircle,
	Plus,
	Search,
	XCircle,
} from "lucide-react";
import {
	type DragEvent,
	startTransition,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { ResourceChipList } from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import { useSocialConnectionSummary } from "@/hooks/use-social-connection-summary";
import type {
	ApiListResponse,
	CalendarBacklogItem,
	CalendarCampaignEntry,
	CalendarEntry,
	CalendarResponse,
	PostDetail,
	PostVariant,
	ResourceCapabilityMatrix,
	ResourceRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	formatPlatformLabel,
	getPlatformMeta,
	platformIcon,
	withAlpha,
} from "@/lib/platforms";
import { normalizePostDetail } from "@/lib/post-models";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "week";
type PlanningStatusFilter =
	| "all"
	| "ready"
	| "attention"
	| "blocked"
	| "backlog"
	| "tentative"
	| "split";

type CalendarSourceItem = CalendarEntry | CalendarBacklogItem;

type PlanningNode = {
	kind: "entry" | "backlog";
	item: CalendarSourceItem;
	plannedDate: Date | null;
	placementKey: string;
};

type PlanningCalendarItem = {
	postId: string;
	title: string;
	excerpt: string;
	campaign?: CalendarSourceItem["campaign"];
	nodes: PlanningNode[];
	platforms: string[];
	surfaces: string[];
	primaryDate: Date | null;
	primaryDayKey: string | null;
	splitSchedule: boolean;
	partialPlacement: boolean;
	readinessState: "ready" | "attention" | "blocked";
	approvalState:
		| "draft"
		| "in_review"
		| "approved"
		| "changes_requested"
		| "mixed";
	displayState: "backlog" | "tentative" | "scheduled" | "published" | "mixed";
	assetCount: number;
	blockedCount: number;
	tentativeCount: number;
	finalizableCount: number;
	publishedCount: number;
	calendarCount: number;
	backlogCount: number;
	createdAt: string;
	updatedAt: string;
};

type PanelState =
	| { mode: "closed" }
	| { mode: "item"; item: PlanningCalendarItem }
	| { mode: "quick-add"; date?: Date };

type PlanningDraft = {
	title: string;
	excerpt: string;
	plannedLocal: string;
	schedulingMode: "tentative" | "exact";
	requiresApproval: boolean;
	notes: string;
	assetIds: string[];
	destinations: string[];
};

type MonthPillLegendState = "ready" | "attention" | "blocked" | "neutral";

type MonthPlanningPill = {
	title: string;
	primaryMeta: string;
	visiblePlatforms: string[];
	extraPlatformCount: number;
	planningLabel: string;
	readinessLabel: string;
	planningTone: MonthPillLegendState;
	readinessTone: MonthPillLegendState;
	assetLabel: string | null;
};

type DragPayload = {
	postId: string;
	source: "calendar" | "backlog";
};

const CALENDAR_VIEW_STORAGE_KEY = "dashboard-calendar-view";
const MONTH_VISIBLE_PILL_COUNT = 2;
const DEFAULT_HOUR = 9;

function padNumber(value: number) {
	return String(value).padStart(2, "0");
}

function startOfDay(value: Date) {
	return new Date(
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		0,
		0,
		0,
		0,
	);
}

function endOfDay(value: Date) {
	return new Date(
		value.getFullYear(),
		value.getMonth(),
		value.getDate(),
		23,
		59,
		59,
		999,
	);
}

function startOfWeek(value: Date) {
	const date = startOfDay(value);
	const day = date.getDay();
	const delta = day === 0 ? -6 : 1 - day;
	date.setDate(date.getDate() + delta);
	return date;
}

function startOfMonth(value: Date) {
	return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(value: Date) {
	return new Date(
		value.getFullYear(),
		value.getMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	);
}

function addDays(value: Date, amount: number) {
	const date = new Date(value);
	date.setDate(date.getDate() + amount);
	return date;
}

function addWeeks(value: Date, amount: number) {
	return addDays(value, amount * 7);
}

function addMonths(value: Date, amount: number) {
	return new Date(
		value.getFullYear(),
		value.getMonth() + amount,
		value.getDate(),
	);
}

function isSameDay(left: Date, right: Date) {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

function parseIso(value?: string) {
	if (!value) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalDateTimeValue(date: Date) {
	return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
		date.getDate(),
	)}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function toIsoValue(value: string) {
	if (!value) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function monthGridDays(anchor: Date) {
	const first = startOfMonth(anchor);
	const gridStart = startOfWeek(first);
	return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function weekDays(anchor: Date) {
	const weekStart = startOfWeek(anchor);
	return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function selectedRange(view: CalendarView, anchor: Date) {
	if (view === "month") {
		return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
	}
	const weekStart = startOfWeek(anchor);
	return { start: weekStart, end: endOfDay(addDays(weekStart, 6)) };
}

function formatMonthLabel(date: Date) {
	return date.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
}

function formatWeekday(date: Date) {
	return date.toLocaleDateString(undefined, {
		weekday: "short",
	});
}

function formatDayHeader(date: Date) {
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

function formatTime(date: Date | null) {
	if (!date) {
		return "No time";
	}
	return date.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function surfaceLabel(surface: string) {
	return surface
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function contentPayloadText(
	contentKind: PostDetail["contentKind"],
	payload: Record<string, unknown>,
) {
	if (contentKind === "thread") {
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
		return items.join("\n\n");
	}
	return typeof payload.body === "string" ? payload.body : "";
}

function applyContentPayloadText(
	contentKind: PostDetail["contentKind"],
	payload: Record<string, unknown>,
	value: string,
) {
	if (contentKind === "thread") {
		return payload;
	}
	return { ...payload, body: value };
}

function itemIsBlocked(item: CalendarSourceItem) {
	return (
		item.readiness.scheduleBlockers.length > 0 ||
		item.readiness.publishBlockers.length > 0
	);
}

function itemNeedsAttention(item: CalendarSourceItem) {
	return (
		item.planningState === "tentative" ||
		item.approvalState === "in_review" ||
		item.approvalState === "changes_requested"
	);
}

function statusTone(item: PlanningCalendarItem) {
	if (item.readinessState === "blocked") {
		return "border-rose-500/20 bg-rose-500/12 text-rose-800 dark:text-rose-100";
	}
	if (item.readinessState === "attention") {
		return "border-amber-500/20 bg-amber-500/12 text-amber-800 dark:text-amber-100";
	}
	return "border-emerald-500/20 bg-emerald-500/12 text-emerald-800 dark:text-emerald-100";
}

function planningStateLabel(item: PlanningCalendarItem) {
	if (item.splitSchedule) {
		return "Split schedule";
	}
	if (item.displayState === "published") {
		return "Published";
	}
	if (item.displayState === "scheduled") {
		return "Scheduled";
	}
	if (item.displayState === "tentative") {
		return "Tentative";
	}
	if (item.displayState === "mixed") {
		return "Mixed";
	}
	return "Backlog";
}

function readinessLabel(item: PlanningCalendarItem) {
	if (item.readinessState === "blocked") {
		return "Blocked";
	}
	if (item.readinessState === "attention") {
		return "Needs attention";
	}
	return "Ready";
}

function monthLegendToneClass(tone: MonthPillLegendState) {
	switch (tone) {
		case "blocked":
			return "bg-rose-500";
		case "attention":
			return "bg-amber-500";
		case "ready":
			return "bg-emerald-500";
		default:
			return "bg-muted-foreground/60";
	}
}

function planningLegendTone(item: PlanningCalendarItem): MonthPillLegendState {
	if (item.splitSchedule) {
		return "attention";
	}
	if (item.displayState === "published" || item.displayState === "scheduled") {
		return "ready";
	}
	if (item.displayState === "tentative" || item.displayState === "mixed") {
		return "attention";
	}
	return "neutral";
}

function buildMonthPlanningPill(item: PlanningCalendarItem): MonthPlanningPill {
	const primaryMeta =
		item.primaryDate && !item.splitSchedule
			? `${item.primaryDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${formatTime(item.primaryDate)}`
			: item.primaryDate
				? `${item.primaryDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · split`
				: "Unscheduled";
	return {
		title: item.title,
		primaryMeta,
		visiblePlatforms: item.platforms.slice(0, 3),
		extraPlatformCount: Math.max(item.platforms.length - 3, 0),
		planningLabel: planningStateLabel(item),
		readinessLabel: readinessLabel(item),
		planningTone: planningLegendTone(item),
		readinessTone:
			item.readinessState === "blocked"
				? "blocked"
				: item.readinessState === "attention"
					? "attention"
					: "ready",
		assetLabel: item.assetCount > 0 ? `${item.assetCount}a` : null,
	};
}

function platformCountForItem(item: PlanningCalendarItem, platform: string) {
	return item.nodes.filter((node) => node.item.platform === platform).length;
}

function itemSearchText(item: PlanningCalendarItem) {
	return [
		item.title,
		item.campaign?.name ?? "",
		item.excerpt,
		item.platforms.map((platform) => formatPlatformLabel(platform)).join(" "),
		item.surfaces.join(" "),
		planningStateLabel(item),
		readinessLabel(item),
	]
		.join(" ")
		.toLowerCase();
}

function campaignBadgeClassName(status: string) {
	switch (status) {
		case "completed":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100";
		case "active":
		case "planned":
			return "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-100";
		case "archived":
			return "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200";
		default:
			return "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-100";
	}
}

function sortPlatforms(platforms: string[]) {
	return [...platforms].sort((left, right) =>
		formatPlatformLabel(left).localeCompare(formatPlatformLabel(right)),
	);
}

function buildPlanningItems(
	entries: CalendarEntry[],
	backlog: CalendarBacklogItem[],
) {
	const groups = new Map<string, PlanningNode[]>();

	for (const entry of entries) {
		const list = groups.get(entry.postId) ?? [];
		list.push({
			kind: "entry",
			item: entry,
			plannedDate: parseIso(entry.plannedAt),
			placementKey: entry.plannedAt,
		});
		groups.set(entry.postId, list);
	}

	for (const item of backlog) {
		const list = groups.get(item.postId) ?? [];
		list.push({
			kind: "backlog",
			item,
			plannedDate: null,
			placementKey: "backlog",
		});
		groups.set(item.postId, list);
	}

	return Array.from(groups.entries())
		.map(([postId, nodes]) => {
			const sortedNodes = [...nodes].sort((left, right) => {
				const leftDate = left.plannedDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
				const rightDate =
					right.plannedDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
				if (leftDate !== rightDate) {
					return leftDate - rightDate;
				}
				return left.item.platform.localeCompare(right.item.platform);
			});
			const first = sortedNodes[0]?.item;
			const calendarNodes = sortedNodes.filter((node) => node.kind === "entry");
			const backlogNodes = sortedNodes.filter(
				(node) => node.kind === "backlog",
			);
			const placementKeys = new Set(
				sortedNodes.map((node) => node.placementKey),
			);
			const splitSchedule = placementKeys.size > 1;
			const primaryDate = calendarNodes[0]?.plannedDate ?? null;
			const approvalStates = new Set(
				sortedNodes.map((node) => node.item.approvalState),
			);
			const readinessState = sortedNodes.some((node) =>
				itemIsBlocked(node.item),
			)
				? "blocked"
				: splitSchedule ||
						sortedNodes.some((node) => itemNeedsAttention(node.item))
					? "attention"
					: "ready";
			const hasTentative = sortedNodes.some(
				(node) => node.item.planningState === "tentative",
			);
			const allPublished =
				calendarNodes.length > 0 &&
				calendarNodes.every(
					(node) => node.item.publicationState === "published",
				);
			const allScheduled =
				calendarNodes.length > 0 &&
				calendarNodes.every(
					(node) =>
						node.item.planningState === "scheduled" ||
						node.item.publicationState === "scheduled" ||
						node.item.publicationState === "publishing" ||
						node.item.publicationState === "published",
				);
			const displayState =
				calendarNodes.length === 0
					? "backlog"
					: splitSchedule
						? "mixed"
						: allPublished
							? "published"
							: hasTentative
								? "tentative"
								: allScheduled
									? "scheduled"
									: "mixed";

			return {
				postId,
				title: first?.title ?? "Untitled post",
				excerpt:
					sortedNodes.find((node) => node.item.excerpt)?.item.excerpt ?? "",
				campaign: sortedNodes.find((node) => node.item.campaign)?.item.campaign,
				nodes: sortedNodes,
				platforms: sortPlatforms(
					Array.from(new Set(sortedNodes.map((node) => node.item.platform))),
				),
				surfaces: Array.from(
					new Set(sortedNodes.map((node) => node.item.surface)),
				).sort(),
				primaryDate,
				primaryDayKey: primaryDate
					? startOfDay(primaryDate).toISOString()
					: null,
				splitSchedule,
				partialPlacement: calendarNodes.length > 0 && backlogNodes.length > 0,
				readinessState,
				approvalState:
					approvalStates.size === 1
						? (sortedNodes[0]?.item.approvalState ?? "draft")
						: "mixed",
				displayState,
				assetCount: Math.max(
					...sortedNodes.map((node) => node.item.assetCount),
					0,
				),
				blockedCount: sortedNodes.filter((node) => itemIsBlocked(node.item))
					.length,
				tentativeCount: sortedNodes.filter(
					(node) => node.item.planningState === "tentative",
				).length,
				finalizableCount: sortedNodes.filter((node) => node.item.finalizable)
					.length,
				publishedCount: sortedNodes.filter(
					(node) => node.item.publicationState === "published",
				).length,
				calendarCount: calendarNodes.length,
				backlogCount: backlogNodes.length,
				createdAt:
					sortedNodes
						.map((node) => node.item.createdAt)
						.sort((left, right) => left.localeCompare(right))[0] ?? "",
				updatedAt:
					sortedNodes
						.map((node) => node.item.updatedAt)
						.sort((left, right) => right.localeCompare(left))[0] ?? "",
			} satisfies PlanningCalendarItem;
		})
		.sort((left, right) => {
			const leftDate = left.primaryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
			const rightDate = right.primaryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
			if (leftDate !== rightDate) {
				return leftDate - rightDate;
			}
			return left.title.localeCompare(right.title);
		});
}

function matchesStatusFilter(
	item: PlanningCalendarItem,
	filter: PlanningStatusFilter,
) {
	switch (filter) {
		case "ready":
			return item.readinessState === "ready";
		case "attention":
			return item.readinessState === "attention";
		case "blocked":
			return item.readinessState === "blocked";
		case "backlog":
			return item.primaryDate === null;
		case "tentative":
			return item.tentativeCount > 0;
		case "split":
			return item.splitSchedule;
		default:
			return true;
	}
}

function planningDraftForItem(
	item: PlanningCalendarItem,
	post: PostDetail | null,
) {
	const sourceDate =
		item.primaryDate ??
		new Date(
			new Date().getFullYear(),
			new Date().getMonth(),
			new Date().getDate(),
			DEFAULT_HOUR,
			0,
			0,
			0,
		);
	return {
		title: post?.title ?? item.title,
		excerpt: post
			? contentPayloadText(post.contentKind, post.contentPayload)
			: item.excerpt,
		plannedLocal: toLocalDateTimeValue(sourceDate),
		schedulingMode:
			item.tentativeCount > 0 || item.primaryDate === null
				? "tentative"
				: "exact",
		requiresApproval:
			post?.requiresApproval ??
			item.nodes.some((node) => node.item.requiresApproval),
		notes: post?.notes ?? "",
		assetIds: post?.assets.map((asset) => asset.id) ?? [],
		destinations: item.platforms,
	} satisfies PlanningDraft;
}

function defaultQuickDraft(date: Date | undefined, destinations: string[]) {
	const seed = date
		? new Date(
				date.getFullYear(),
				date.getMonth(),
				date.getDate(),
				DEFAULT_HOUR,
				0,
				0,
				0,
			)
		: new Date(
				new Date().getFullYear(),
				new Date().getMonth(),
				new Date().getDate(),
				DEFAULT_HOUR,
				0,
				0,
				0,
			);
	return {
		title: "",
		excerpt: "",
		plannedLocal: toLocalDateTimeValue(seed),
		schedulingMode: "tentative",
		requiresApproval: false,
		notes: "",
		assetIds: [],
		destinations: destinations,
	} satisfies PlanningDraft;
}

function findVariant(post: PostDetail | null, variantId: string) {
	if (!post) {
		return null;
	}
	return (
		[...post.variants, ...post.legacyVariants].find(
			(item) => item.id === variantId,
		) ?? null
	);
}

function surfaceOptionsForPlatform(
	capabilities: ResourceCapabilityMatrix | null,
	platform: string,
) {
	if (!capabilities || !platform) {
		return [];
	}
	const seen = new Map<string, { value: string; label: string }>();
	for (const rule of capabilities.rules) {
		if (rule.platform !== platform || seen.has(rule.surface)) {
			continue;
		}
		seen.set(rule.surface, {
			value: rule.surface,
			label: surfaceLabel(rule.surface),
		});
	}
	return Array.from(seen.values());
}

function resolvePlanningPlatformOptions(
	calendar: CalendarResponse | null,
	capabilities: ResourceCapabilityMatrix | null,
) {
	const fromCalendar = calendar?.platforms.map((item) => item.platform) ?? [];
	const fromCapabilities = capabilities
		? Array.from(new Set(capabilities.rules.map((rule) => rule.platform)))
		: [];
	return sortPlatforms(
		Array.from(new Set([...fromCalendar, ...fromCapabilities])),
	);
}

function campaignStrip(campaigns: CalendarCampaignEntry[]) {
	if (campaigns.length === 0) {
		return null;
	}
	return (
		<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Campaign windows
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						Campaign timing stays visible as context, but the board stays
						focused on content planning.
					</div>
				</div>
				<Badge variant="outline" className="rounded-full">
					{campaigns.length} active window{campaigns.length === 1 ? "" : "s"}
				</Badge>
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				{campaigns.map((campaign) => (
					<Link
						key={campaign.id}
						to={`/dashboard/campaigns/${campaign.id}`}
						className={cn(
							"rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/35",
							campaignBadgeClassName(campaign.status),
						)}
					>
						{campaign.name} ·{" "}
						{new Date(campaign.startDate).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
						{" - "}
						{new Date(
							campaign.endDate ?? campaign.startDate,
						).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
					</Link>
				))}
			</div>
		</div>
	);
}

function PlanningStatChip({
	label,
	value,
	detail,
	icon: Icon,
}: {
	label: string;
	value: string;
	detail: string;
	icon: typeof CalendarRange;
}) {
	return (
		<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/76 px-4 py-3 shadow-[0_18px_35px_-34px_rgba(15,23,42,0.52)]">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-1">
					<div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						{label}
					</div>
					<div className="text-xl font-semibold tracking-tight">{value}</div>
					<div className="text-xs text-muted-foreground">{detail}</div>
				</div>
				<span className="inline-flex size-9 items-center justify-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/80 text-muted-foreground">
					<Icon className="size-4" />
				</span>
			</div>
		</div>
	);
}

function DestinationRow({
	platform,
	count,
}: { platform: string; count: number }) {
	return (
		<div
			className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5"
			style={{
				borderColor: withAlpha(
					getPlatformMeta(platform)?.color ?? "#64748B",
					0.18,
				),
				backgroundColor: withAlpha(
					getPlatformMeta(platform)?.color ?? "#64748B",
					0.08,
				),
			}}
		>
			{platformIcon(platform, {
				containerClassName: "size-6",
				iconClassName: "size-3.5",
				backgroundAlpha: 0.12,
				borderAlpha: 0.2,
			})}
			<span className="text-sm font-medium">
				{formatPlatformLabel(platform)}
			</span>
			{count > 1 ? (
				<span className="text-xs text-muted-foreground">×{count}</span>
			) : null}
		</div>
	);
}

function PlanningCard({
	item,
	compact = false,
	draggable,
	dragging,
	onClick,
	onDragStart,
	onDragEnd,
}: {
	item: PlanningCalendarItem;
	compact?: boolean;
	draggable: boolean;
	dragging: boolean;
	onClick: () => void;
	onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
	onDragEnd: () => void;
}) {
	const primaryMeta =
		item.primaryDate && !item.splitSchedule
			? `${formatDayHeader(item.primaryDate)} · ${formatTime(item.primaryDate)}`
			: item.primaryDate
				? `${formatDayHeader(item.primaryDate)} · split`
				: "Unscheduled";
	return (
		<button
			type="button"
			draggable={draggable}
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onClick={onClick}
			className={cn(
				"calendar-card-surface group w-full shrink-0 text-left transition hover:-translate-y-[1px]",
				compact ? "rounded-2xl p-2.5" : "rounded-[22px] p-3",
				dragging && "opacity-45",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							className={cn(
								"rounded-full border",
								statusTone(item),
								compact && "px-2 py-0.5 text-[10px]",
							)}
						>
							{planningStateLabel(item)}
						</Badge>
						<Badge
							variant="outline"
							className={cn(
								"rounded-full text-xs",
								compact && "px-2 py-0.5 text-[10px]",
							)}
						>
							{readinessLabel(item)}
						</Badge>
						{item.campaign ? (
							<Badge
								variant="outline"
								className={cn(
									"rounded-full text-xs",
									compact && "max-w-[9rem] truncate px-2 py-0.5 text-[10px]",
								)}
							>
								{item.campaign.name}
							</Badge>
						) : null}
					</div>
					<div
						className={cn(
							"font-semibold text-foreground",
							compact ? "line-clamp-1 text-[0.82rem]" : "truncate text-sm",
						)}
					>
						{item.title}
					</div>
				</div>
				{draggable ? (
					<span
						className={cn(
							"mt-0.5 inline-flex items-center justify-center rounded-2xl border border-[var(--brand-border-soft)] bg-background/88 text-muted-foreground",
							compact ? "size-7" : "size-8",
						)}
					>
						<GripVertical className="size-4" />
					</span>
				) : null}
			</div>
			{!compact && item.excerpt ? (
				<p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
					{item.excerpt}
				</p>
			) : !compact ? (
				<p className="mt-2 text-xs leading-5 text-muted-foreground">
					Add the core message, then refine any platform-specific details only
					if you need them.
				</p>
			) : null}
			<div
				className={cn(
					"flex flex-wrap items-center gap-2",
					compact ? "mt-2" : "mt-3",
				)}
			>
				{item.platforms.map((platform) => (
					<span key={platform}>
						{platformIcon(platform, {
							containerClassName: compact ? "size-5" : "size-6",
							iconClassName: compact ? "size-3" : "size-3.5",
							backgroundAlpha: 0.1,
							borderAlpha: 0.16,
						})}
					</span>
				))}
				<span
					className={cn(
						"text-muted-foreground",
						compact ? "text-[11px]" : "text-xs",
					)}
				>
					{primaryMeta}
				</span>
				{item.assetCount > 0 ? (
					<span
						className={cn(
							"text-muted-foreground",
							compact ? "text-[11px]" : "text-xs",
						)}
					>
						{item.assetCount} asset{item.assetCount === 1 ? "" : "s"}
					</span>
				) : null}
			</div>
		</button>
	);
}

function MonthPlanningPill({
	item,
	dragging,
	draggable,
	onClick,
	onDragStart,
	onDragEnd,
}: {
	item: PlanningCalendarItem;
	dragging: boolean;
	draggable: boolean;
	onClick: () => void;
	onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
	onDragEnd: () => void;
}) {
	const pill = buildMonthPlanningPill(item);
	return (
		<HoverCard openDelay={120} closeDelay={90}>
			<HoverCardTrigger asChild>
				<button
					type="button"
					draggable={draggable}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
					onClick={onClick}
					className={cn(
						"calendar-month-pill group w-full shrink-0 rounded-[18px] px-2.5 py-2 text-left transition hover:-translate-y-[1px]",
						dragging && "opacity-45",
					)}
				>
					<div className="flex min-w-0 items-start gap-2">
						<div className="flex shrink-0 items-center -space-x-1">
							{pill.visiblePlatforms.map((platform) => (
								<span key={platform}>
									{platformIcon(platform, {
										containerClassName: "size-5 ring-2 ring-background",
										iconClassName: "size-3",
										backgroundAlpha: 0.12,
										borderAlpha: 0.18,
									})}
								</span>
							))}
							{pill.extraPlatformCount > 0 ? (
								<span className="inline-flex size-5 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background/84 text-[10px] font-semibold text-muted-foreground">
									+{pill.extraPlatformCount}
								</span>
							) : null}
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-[0.78rem] font-semibold leading-5 text-foreground">
								{pill.title}
							</div>
							<div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted-foreground">
								<span
									className={cn(
										"calendar-legend-dot",
										monthLegendToneClass(pill.planningTone),
									)}
									aria-hidden="true"
								/>
								<span
									className={cn(
										"calendar-legend-dot",
										monthLegendToneClass(pill.readinessTone),
									)}
									aria-hidden="true"
								/>
								{pill.assetLabel ? (
									<span className="rounded-full border border-[var(--brand-border-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										{pill.assetLabel}
									</span>
								) : null}
								<span className="truncate">{pill.primaryMeta}</span>
							</div>
						</div>
					</div>
				</button>
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				side="right"
				className="calendar-hover-surface w-[18rem] space-y-3 rounded-[22px] border border-[var(--brand-border-soft)] p-4"
			>
				<div className="space-y-2">
					<div className="text-sm font-semibold leading-5 text-foreground">
						{item.title}
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="rounded-full text-[11px]">
							<span
								className={cn(
									"calendar-legend-dot",
									monthLegendToneClass(pill.planningTone),
								)}
								aria-hidden="true"
							/>
							{pill.planningLabel}
						</Badge>
						<Badge variant="outline" className="rounded-full text-[11px]">
							<span
								className={cn(
									"calendar-legend-dot",
									monthLegendToneClass(pill.readinessTone),
								)}
								aria-hidden="true"
							/>
							{pill.readinessLabel}
						</Badge>
						{item.campaign ? (
							<Badge variant="outline" className="rounded-full text-[11px]">
								{item.campaign.name}
							</Badge>
						) : null}
						{item.splitSchedule ? (
							<Badge variant="outline" className="rounded-full text-[11px]">
								Split schedule
							</Badge>
						) : null}
					</div>
				</div>
				<div className="space-y-2 text-xs text-muted-foreground">
					<div>{pill.primaryMeta}</div>
					{pill.assetLabel ? (
						<div>
							{item.assetCount} attached asset{item.assetCount === 1 ? "" : "s"}
						</div>
					) : null}
				</div>
				<div className="flex flex-wrap gap-2">
					{item.platforms.map((platform) => (
						<DestinationRow
							key={platform}
							platform={platform}
							count={platformCountForItem(item, platform)}
						/>
					))}
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}

function BacklogRailPanel({
	backlogItems,
	draggingPostId,
	activeDrop,
	allowDrop = false,
	onOpenItem,
	onDragStart,
	onDragEnd,
	onBacklogOver,
	onBacklogLeave,
	onBacklogDrop,
}: {
	backlogItems: PlanningCalendarItem[];
	draggingPostId: string | null;
	activeDrop: boolean;
	allowDrop?: boolean;
	onOpenItem: (item: PlanningCalendarItem) => void;
	onDragStart: (
		item: PlanningCalendarItem,
		event: DragEvent<HTMLButtonElement>,
	) => void;
	onDragEnd: () => void;
	onBacklogOver?: (event: DragEvent<HTMLDivElement>) => void;
	onBacklogLeave?: () => void;
	onBacklogDrop?: (event: DragEvent<HTMLDivElement>) => void;
}) {
	return (
		<div
			onDragOver={allowDrop ? onBacklogOver : undefined}
			onDragLeave={allowDrop ? onBacklogLeave : undefined}
			onDrop={allowDrop ? onBacklogDrop : undefined}
			className={cn(
				"calendar-rail-surface rounded-[24px] p-4",
				activeDrop && "calendar-drop-target",
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<div>
					<div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Backlog rail
					</div>
					<div className="mt-1 text-sm text-muted-foreground">
						Keep drafts close, then drag them onto the board when you are ready
						to place them.
					</div>
				</div>
				<Badge variant="outline" className="rounded-full">
					{backlogItems.length}
				</Badge>
			</div>
			<div className="mt-4 space-y-3">
				{backlogItems.map((item) => (
					<PlanningCard
						key={item.postId}
						item={item}
						draggable={!item.splitSchedule}
						dragging={draggingPostId === item.postId}
						onClick={() => onOpenItem(item)}
						onDragStart={(event) => onDragStart(item, event)}
						onDragEnd={onDragEnd}
					/>
				))}
				{backlogItems.length === 0 ? (
					<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
						No backlog items in this view. Save a draft here or return posts
						from the board when priorities shift.
					</div>
				) : null}
			</div>
		</div>
	);
}

function alertLine({
	icon: Icon,
	title,
	body,
	tone,
}: {
	icon: typeof AlertTriangle;
	title: string;
	body: string;
	tone: "warning" | "error" | "success";
}) {
	const toneClass =
		tone === "error"
			? "border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-100"
			: tone === "warning"
				? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-100"
				: "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100";
	return (
		<div className={cn("rounded-[20px] border px-4 py-3", toneClass)}>
			<div className="flex gap-3">
				<Icon className="mt-0.5 size-4 shrink-0" />
				<div className="space-y-1">
					<div className="text-sm font-medium">{title}</div>
					<div className="text-sm opacity-90">{body}</div>
				</div>
			</div>
		</div>
	);
}

export function DashboardCalendar() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const { summary } = useSocialConnectionSummary();
	const [view, setView] = useLocalStorageState<CalendarView | "timeline">(
		CALENDAR_VIEW_STORAGE_KEY,
		"month",
	);
	const normalizedView: CalendarView = view === "week" ? "week" : "month";
	const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<PlanningStatusFilter>("all");
	const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
	const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [panelState, setPanelState] = useState<PanelState>({ mode: "closed" });
	const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);
	const [panelDraft, setPanelDraft] = useState<PlanningDraft>(
		defaultQuickDraft(undefined, []),
	);
	const [panelError, setPanelError] = useState<string | null>(null);
	const [loadingPost, setLoadingPost] = useState(false);
	const [saving, setSaving] = useState(false);
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [draggingPostId, setDraggingPostId] = useState<string | null>(null);
	const [activeDropKey, setActiveDropKey] = useState<string | null>(null);
	const [backlogRailOpen, setBacklogRailOpen] = useState(false);
	const deferredSearch = useDeferredValue(search);

	function addUploadedResources(created: ResourceRecord[]) {
		setResources((current) => [
			...created,
			...current.filter(
				(resource) => !created.some((item) => item.id === resource.id),
			),
		]);
	}

	useEffect(() => {
		if (view === "timeline") {
			startTransition(() => setView("month"));
		}
	}, [setView, view]);

	const currentRange = useMemo(
		() => selectedRange(normalizedView, anchorDate),
		[anchorDate, normalizedView],
	);
	const currentWeek = useMemo(() => weekDays(anchorDate), [anchorDate]);
	const monthDays = useMemo(() => monthGridDays(anchorDate), [anchorDate]);

	useEffect(() => {
		if (!activeWorkspaceId) {
			setCalendar(null);
			setResources([]);
			setCapabilities(null);
			setLoading(false);
			setError(null);
			return;
		}
		let cancelled = false;
		async function loadCalendar() {
			setLoading(true);
			setError(null);
			try {
				const params = new URLSearchParams({
					start: currentRange.start.toISOString(),
					end: currentRange.end.toISOString(),
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
				});
				const [calendarResponse, capabilityResponse, resourceResponse] =
					await Promise.all([
						customerRequest<CalendarResponse>(`/calendar?${params.toString()}`),
						customerRequest<ResourceCapabilityMatrix>(
							"/resources/capabilities",
						),
						customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					]);
				if (cancelled) {
					return;
				}
				setCalendar(calendarResponse);
				setCapabilities(capabilityResponse);
				setResources(resourceResponse.items);
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load the content calendar.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadCalendar();
		return () => {
			cancelled = true;
		};
	}, [
		activeWorkspaceId,
		currentRange.end,
		currentRange.start,
		customerRequest,
	]);

	const planningItems = useMemo(
		() => buildPlanningItems(calendar?.entries ?? [], calendar?.backlog ?? []),
		[calendar?.backlog, calendar?.entries],
	);
	const platformOptions = useMemo(
		() => resolvePlanningPlatformOptions(calendar, capabilities),
		[calendar, capabilities],
	);
	const filteredItems = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase();
		return planningItems.filter((item) => {
			if (
				selectedPlatforms.length > 0 &&
				!item.platforms.some((platform) => selectedPlatforms.includes(platform))
			) {
				return false;
			}
			if (!matchesStatusFilter(item, statusFilter)) {
				return false;
			}
			if (!query) {
				return true;
			}
			return itemSearchText(item).includes(query);
		});
	}, [deferredSearch, planningItems, selectedPlatforms, statusFilter]);
	const calendarItems = useMemo(
		() => filteredItems.filter((item) => item.primaryDate),
		[filteredItems],
	);
	const backlogItems = useMemo(
		() => filteredItems.filter((item) => !item.primaryDate),
		[filteredItems],
	);
	const monthBuckets = useMemo(() => {
		const buckets = new Map<string, PlanningCalendarItem[]>();
		for (const item of calendarItems) {
			if (!item.primaryDayKey) {
				continue;
			}
			const list = buckets.get(item.primaryDayKey) ?? [];
			list.push(item);
			list.sort((left, right) => {
				const leftTime = left.primaryDate?.getTime() ?? 0;
				const rightTime = right.primaryDate?.getTime() ?? 0;
				return leftTime - rightTime;
			});
			buckets.set(item.primaryDayKey, list);
		}
		return buckets;
	}, [calendarItems]);

	const currentPanelItem = panelState.mode === "item" ? panelState.item : null;
	const quickAddDate =
		panelState.mode === "quick-add" ? panelState.date : undefined;
	const activeItem = currentPanelItem
		? (filteredItems.find((item) => item.postId === currentPanelItem.postId) ??
			currentPanelItem)
		: null;

	useEffect(() => {
		if (panelState.mode !== "item" || !currentPanelItem) {
			setSelectedPost(null);
			setPanelError(null);
			return;
		}
		const item = currentPanelItem;
		let cancelled = false;
		async function loadPost() {
			setLoadingPost(true);
			setPanelError(null);
			try {
				const response = await customerRequest<PostDetail>(
					`/posts/${item.postId}`,
				);
				if (!cancelled) {
					const normalized = normalizePostDetail(response).value;
					setSelectedPost(normalized);
					setPanelDraft(planningDraftForItem(item, normalized));
				}
			} catch (loadError) {
				if (!cancelled) {
					setPanelError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load this planning item.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoadingPost(false);
				}
			}
		}
		void loadPost();
		return () => {
			cancelled = true;
		};
	}, [currentPanelItem, customerRequest, panelState.mode]);

	useEffect(() => {
		if (panelState.mode !== "quick-add") {
			return;
		}
		const defaultDestinations =
			selectedPlatforms.length > 0
				? selectedPlatforms
				: platformOptions.length > 0
					? platformOptions
					: [];
		setPanelDraft(defaultQuickDraft(quickAddDate, defaultDestinations));
		setPanelError(null);
		setAdvancedOpen(false);
	}, [panelState, platformOptions, quickAddDate, selectedPlatforms]);

	async function reloadCalendar() {
		if (!activeWorkspaceId) {
			return null;
		}
		const params = new URLSearchParams({
			start: currentRange.start.toISOString(),
			end: currentRange.end.toISOString(),
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		});
		const response = await customerRequest<CalendarResponse>(
			`/calendar?${params.toString()}`,
		);
		setCalendar(response);
		return response;
	}

	function closePanel() {
		setPanelState({ mode: "closed" });
		setPanelError(null);
		setAdvancedOpen(false);
	}

	async function persistSharedPostEdits(post: PostDetail) {
		const nextPost = await customerRequest<PostDetail>(`/posts/${post.id}`, {
			method: "PATCH",
			body: {
				title: panelDraft.title,
				contentKind: post.contentKind,
				contentPayload: applyContentPayloadText(
					post.contentKind,
					post.contentPayload,
					panelDraft.excerpt,
				),
				originPlatform: post.originPlatform ?? panelDraft.destinations[0] ?? "",
				originSurface:
					post.originSurface ??
					surfaceOptionsForPlatform(
						capabilities,
						panelDraft.destinations[0] ?? "",
					)[0]?.value ??
					"",
				campaignId: post.campaign?.id ?? "",
				requiresApproval: panelDraft.requiresApproval,
				notes: panelDraft.notes,
			},
		});
		await customerRequest(`/posts/${post.id}/assets`, {
			method: "PUT",
			body: { resourceIds: panelDraft.assetIds },
		});
		setSelectedPost(normalizePostDetail(nextPost).value);
	}

	async function runPlacementAction(
		item: PlanningCalendarItem,
		mode: "tentative" | "exact",
		explicitDate?: string,
	) {
		const post = selectedPost;
		if (!post) {
			throw new Error("The planning drawer is not ready yet.");
		}
		const plannedAt = explicitDate ?? toIsoValue(panelDraft.plannedLocal);
		if (!plannedAt) {
			throw new Error("Choose a planned day before placing this post.");
		}
		const variants = [...post.variants, ...post.legacyVariants].filter(
			(variant) =>
				item.nodes.some((node) => node.item.variantId === variant.id),
		);
		for (const variant of variants) {
			const shouldUseTentative =
				mode === "tentative" || variant.readiness.scheduleBlockers.length > 0;
			await customerRequest(
				shouldUseTentative
					? `/posts/variants/${variant.id}/planning`
					: `/posts/variants/${variant.id}/publication/schedule`,
				{
					method: "POST",
					body: { plannedAt, source: "manual" },
				},
			);
		}
	}

	async function returnItemToBacklog(item: PlanningCalendarItem) {
		const post = selectedPost;
		if (!post) {
			throw new Error("The planning drawer is not ready yet.");
		}
		for (const node of item.nodes) {
			if (node.kind !== "entry") {
				continue;
			}
			const variant = findVariant(post, node.item.variantId);
			if (!variant) {
				continue;
			}
			if (
				node.item.planningState === "tentative" ||
				variant.latestTentativePlan
			) {
				await customerRequest(`/posts/variants/${variant.id}/planning`, {
					method: "DELETE",
				});
			} else {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/unschedule`,
					{
						method: "POST",
					},
				);
			}
		}
	}

	async function finalizeTentative(item: PlanningCalendarItem) {
		const post = selectedPost;
		if (!post) {
			throw new Error("The planning drawer is not ready yet.");
		}
		const tentativeNodes = item.nodes.filter(
			(node) =>
				node.item.planningState === "tentative" && node.item.finalizable,
		);
		if (tentativeNodes.length === 0) {
			throw new Error("Nothing is ready to finalize yet.");
		}
		for (const node of tentativeNodes) {
			const variant = findVariant(post, node.item.variantId);
			if (!variant) {
				continue;
			}
			await customerRequest(`/posts/variants/${variant.id}/planning/finalize`, {
				method: "POST",
			});
		}
	}

	async function handleSaveItem() {
		if (panelState.mode !== "item" || !selectedPost) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await persistSharedPostEdits(selectedPost);
			await reloadCalendar();
			toast.success("Planning details saved.");
		} catch (saveError) {
			setPanelError(
				saveError instanceof Error
					? saveError.message
					: "Unable to save this planning item.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handlePlaceItem() {
		if (panelState.mode !== "item" || !activeItem || !selectedPost) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await persistSharedPostEdits(selectedPost);
			await runPlacementAction(activeItem, panelDraft.schedulingMode);
			await reloadCalendar();
			toast.success(
				panelDraft.schedulingMode === "tentative"
					? "Placed on the calendar as tentative."
					: "Scheduled on the calendar.",
			);
		} catch (actionError) {
			setPanelError(
				actionError instanceof Error
					? actionError.message
					: "Unable to place this post on the calendar.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleReturnToBacklog() {
		if (panelState.mode !== "item" || !activeItem) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await returnItemToBacklog(activeItem);
			await reloadCalendar();
			toast.success("Returned to backlog.");
		} catch (actionError) {
			setPanelError(
				actionError instanceof Error
					? actionError.message
					: "Unable to return this post to backlog.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function handleFinalizeItem() {
		if (panelState.mode !== "item" || !activeItem) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await finalizeTentative(activeItem);
			await reloadCalendar();
			toast.success("Tentative slots finalized.");
		} catch (actionError) {
			setPanelError(
				actionError instanceof Error
					? actionError.message
					: "Unable to finalize the tentative schedule.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function createDraft(shouldPlaceOnCalendar: boolean) {
		const destinations = panelDraft.destinations.filter(Boolean);
		if (!panelDraft.title.trim()) {
			setPanelError("Add a title before creating a draft.");
			return;
		}
		if (destinations.length === 0) {
			setPanelError("Pick at least one destination.");
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			const primaryPlatform = destinations[0] ?? "";
			const primarySurface =
				surfaceOptionsForPlatform(capabilities, primaryPlatform)[0]?.value ??
				"";
			const createdPost = await customerRequest<PostDetail>("/posts", {
				method: "POST",
				body: {
					title: panelDraft.title,
					contentKind: "text",
					contentPayload: { body: panelDraft.excerpt },
					originPlatform: primaryPlatform,
					originSurface: primarySurface,
					requiresApproval: panelDraft.requiresApproval,
					notes: panelDraft.notes,
				},
			});
			await customerRequest(`/posts/${createdPost.id}/assets`, {
				method: "PUT",
				body: { resourceIds: panelDraft.assetIds },
			});
			const createdVariants: PostVariant[] = [];
			for (const platform of destinations) {
				const surface =
					surfaceOptionsForPlatform(capabilities, platform)[0]?.value ?? "";
				if (!surface) {
					continue;
				}
				const createdVariant = await customerRequest<PostVariant>(
					`/posts/${createdPost.id}/variants`,
					{
						method: "POST",
						body: {
							platform,
							surface,
							inheritSource: "shared",
							contentMode: "inherit",
							contentKind: "",
							contentPayload: {},
							assetMode: "inherit",
							notes: "",
						},
					},
				);
				createdVariants.push(createdVariant);
			}
			if (shouldPlaceOnCalendar) {
				const plannedAt = toIsoValue(panelDraft.plannedLocal);
				if (plannedAt) {
					for (const variant of createdVariants) {
						const useTentative =
							panelDraft.schedulingMode === "tentative" ||
							variant.readiness.scheduleBlockers.length > 0;
						await customerRequest(
							useTentative
								? `/posts/variants/${variant.id}/planning`
								: `/posts/variants/${variant.id}/publication/schedule`,
							{
								method: "POST",
								body: { plannedAt, source: "manual" },
							},
						);
					}
				}
			}
			await reloadCalendar();
			closePanel();
			toast.success(
				shouldPlaceOnCalendar
					? "Draft created and placed on the calendar."
					: "Draft saved to backlog.",
			);
		} catch (createError) {
			setPanelError(
				createError instanceof Error
					? createError.message
					: "Unable to create this draft.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function placeExistingBacklogItem(
		item: PlanningCalendarItem,
		day: Date,
	) {
		const planned = new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			DEFAULT_HOUR,
			0,
			0,
			0,
		).toISOString();
		setSaving(true);
		setPanelError(null);
		try {
			const post = normalizePostDetail(
				await customerRequest<PostDetail>(`/posts/${item.postId}`),
			).value;
			for (const node of item.nodes) {
				const variant = findVariant(post, node.item.variantId);
				if (!variant) {
					continue;
				}
				await customerRequest(`/posts/variants/${variant.id}/planning`, {
					method: "POST",
					body: { plannedAt: planned, source: "manual" },
				});
			}
			await reloadCalendar();
			closePanel();
			toast.success("Backlog item placed on the calendar.");
		} catch (placeError) {
			setPanelError(
				placeError instanceof Error
					? placeError.message
					: "Unable to place this backlog item.",
			);
		} finally {
			setSaving(false);
		}
	}

	function beginDrag(
		item: PlanningCalendarItem,
		event: DragEvent<HTMLButtonElement>,
	) {
		if (item.splitSchedule) {
			event.preventDefault();
			return;
		}
		const payload: DragPayload = {
			postId: item.postId,
			source: item.primaryDate ? "calendar" : "backlog",
		};
		event.dataTransfer.setData("application/json", JSON.stringify(payload));
		event.dataTransfer.effectAllowed = "move";
		setDraggingPostId(item.postId);
	}

	function clearDragState() {
		setDraggingPostId(null);
		setActiveDropKey(null);
	}

	function readDragPayload(event: DragEvent) {
		const raw = event.dataTransfer.getData("application/json");
		if (!raw) {
			return null;
		}
		try {
			return JSON.parse(raw) as DragPayload;
		} catch {
			return null;
		}
	}

	async function moveItemToDay(item: PlanningCalendarItem, day: Date) {
		const plannedFromItem =
			item.primaryDate ??
			new Date(
				day.getFullYear(),
				day.getMonth(),
				day.getDate(),
				DEFAULT_HOUR,
				0,
				0,
				0,
			);
		const nextPlanned = new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			plannedFromItem.getHours(),
			plannedFromItem.getMinutes(),
			0,
			0,
		).toISOString();
		const post = normalizePostDetail(
			await customerRequest<PostDetail>(`/posts/${item.postId}`),
		).value;
		for (const node of item.nodes) {
			const variant = findVariant(post, node.item.variantId);
			if (!variant) {
				continue;
			}
			const useTentative =
				node.kind === "backlog" ||
				item.tentativeCount > 0 ||
				variant.readiness.scheduleBlockers.length > 0;
			await customerRequest(
				useTentative
					? `/posts/variants/${variant.id}/planning`
					: `/posts/variants/${variant.id}/publication/schedule`,
				{
					method: "POST",
					body: { plannedAt: nextPlanned, source: "manual" },
				},
			);
		}
	}

	async function moveItemToBacklog(item: PlanningCalendarItem) {
		const post = normalizePostDetail(
			await customerRequest<PostDetail>(`/posts/${item.postId}`),
		).value;
		for (const node of item.nodes) {
			if (node.kind !== "entry") {
				continue;
			}
			const variant = findVariant(post, node.item.variantId);
			if (!variant) {
				continue;
			}
			if (
				node.item.planningState === "tentative" ||
				variant.latestTentativePlan
			) {
				await customerRequest(`/posts/variants/${variant.id}/planning`, {
					method: "DELETE",
				});
			} else {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/unschedule`,
					{
						method: "POST",
					},
				);
			}
		}
	}

	async function handleDayDrop(day: Date, event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		const payload = readDragPayload(event);
		clearDragState();
		if (!payload) {
			return;
		}
		const item = planningItems.find((entry) => entry.postId === payload.postId);
		if (!item) {
			return;
		}
		if (item.splitSchedule) {
			toast.error("Resolve split schedules from the drawer before dragging.");
			return;
		}
		try {
			await moveItemToDay(item, day);
			await reloadCalendar();
			toast.success("Calendar slot updated.");
		} catch (dropError) {
			toast.error(
				dropError instanceof Error
					? dropError.message
					: "Unable to move this post.",
			);
		}
	}

	async function handleBacklogDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		const payload = readDragPayload(event);
		clearDragState();
		if (!payload || payload.source !== "calendar") {
			return;
		}
		const item = planningItems.find((entry) => entry.postId === payload.postId);
		if (!item) {
			return;
		}
		try {
			await moveItemToBacklog(item);
			await reloadCalendar();
			toast.success("Returned to backlog.");
		} catch (dropError) {
			toast.error(
				dropError instanceof Error
					? dropError.message
					: "Unable to return this post to backlog.",
			);
		}
	}

	const scheduledCount = calendarItems.length;
	const splitCount = filteredItems.filter((item) => item.splitSchedule).length;
	const blockedCount = filteredItems.filter(
		(item) => item.readinessState === "blocked",
	).length;
	const monthCoverageCount = new Set(
		calendarItems
			.filter((item) => item.primaryDayKey)
			.map((item) => item.primaryDayKey as string),
	).size;
	const rangeLabel =
		normalizedView === "month"
			? formatMonthLabel(anchorDate)
			: `${formatDayHeader(currentWeek[0])} - ${formatDayHeader(
					currentWeek.at(-1) ?? currentWeek[0],
				)}`;
	const setupNeeded = !summary.hasHealthySelectedTarget;
	return (
		<div className="dashboard-page-stack space-y-6">
			<SurfaceCard className="calendar-shell-surface dashboard-card">
				<div className="space-y-5">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
						<div className="space-y-4">
							<div className="space-y-2">
								<div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
									Planning flow
								</div>
								<div className="space-y-2">
									<h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
										Calendar
									</h1>
									<p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
										Keep the month board dominant, keep backlog close, and only
										open detailed controls when a post needs them.
									</p>
								</div>
							</div>
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<PlanningStatChip
									label="Covered days"
									value={String(monthCoverageCount)}
									detail="Days carrying content this month"
									icon={CalendarDays}
								/>
								<PlanningStatChip
									label="Scheduled"
									value={String(scheduledCount)}
									detail="Cards already placed"
									icon={CalendarRange}
								/>
								<PlanningStatChip
									label="Backlog"
									value={String(backlogItems.length)}
									detail="Ideas waiting for a slot"
									icon={FolderKanban}
								/>
								<PlanningStatChip
									label="Needs attention"
									value={String(blockedCount + splitCount)}
									detail="Blocked items plus split schedules"
									icon={AlertTriangle}
								/>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3 xl:justify-end">
							<Button
								variant="outline"
								className="rounded-full bg-background/80"
								asChild
							>
								<Link to="/dashboard/settings/platforms">
									{setupNeeded ? "Connect platforms" : "Manage publishing"}
								</Link>
							</Button>
							<Button
								variant="outline"
								className="rounded-full bg-background/80"
								onClick={() =>
									startTransition(() => setAnchorDate(startOfDay(new Date())))
								}
							>
								<CalendarDays className="size-4" />
								Today
							</Button>
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white shadow-[0_18px_40px_-26px_rgba(168,107,76,0.9)]"
								onClick={() =>
									setPanelState({ mode: "quick-add", date: new Date() })
								}
							>
								<FilePlus2 className="size-4" />
								Quick add
							</Button>
						</div>
					</div>

					{setupNeeded ? (
						<div className="calendar-callout-surface rounded-[24px] p-5">
							<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
								<div>
									<div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent)]">
										Planning can start now
									</div>
									<div className="mt-2 text-lg font-medium">
										Connect a destination when you are ready to turn calendar
										slots into real publish schedules.
									</div>
									<div className="mt-2 max-w-3xl text-sm text-muted-foreground">
										The calendar still works as your editorial planning board
										without live targets. Platform connections are what let
										Heimdall validate destinations and publish from these slots.
									</div>
								</div>
								<Button className="rounded-full" asChild>
									<Link to="/dashboard/settings/platforms">
										Connect destinations
									</Link>
								</Button>
							</div>
						</div>
					) : null}

					{campaignStrip(calendar?.campaigns ?? [])}
				</div>
			</SurfaceCard>

			<SurfaceCard className="calendar-shell-surface dashboard-card">
				<div className="space-y-5">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								size="icon-sm"
								className="rounded-full bg-background/80"
								onClick={() =>
									startTransition(() =>
										setAnchorDate((current) =>
											normalizedView === "month"
												? addMonths(current, -1)
												: addWeeks(current, -1),
										),
									)
								}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<div className="min-w-[15rem] rounded-[22px] border border-[var(--brand-border-soft)] bg-background/88 px-4 py-3 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
								<div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									Active range
								</div>
								<div className="mt-1">{rangeLabel}</div>
							</div>
							<Button
								variant="outline"
								size="icon-sm"
								className="rounded-full bg-background/80"
								onClick={() =>
									startTransition(() =>
										setAnchorDate((current) =>
											normalizedView === "month"
												? addMonths(current, 1)
												: addWeeks(current, 1),
										),
									)
								}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>

						<Tabs
							value={normalizedView}
							onValueChange={(nextValue) =>
								startTransition(() => setView(nextValue as CalendarView))
							}
						>
							<TabsList
								variant="default"
								className="dashboard-tabs-min-height !h-auto flex-wrap items-stretch justify-start gap-2 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-2"
							>
								<TabsTrigger
									value="month"
									className="h-auto min-h-10 rounded-[16px] border border-transparent px-3 py-2 data-active:border-[var(--brand-border-soft)] data-active:bg-background/90"
								>
									<CalendarDays className="size-4" />
									Month
								</TabsTrigger>
								<TabsTrigger
									value="week"
									className="h-auto min-h-10 rounded-[16px] border border-transparent px-3 py-2 data-active:border-[var(--brand-border-soft)] data-active:bg-background/90"
								>
									<CalendarRange className="size-4" />
									Week
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
						<div className="min-w-0 xl:flex-1">
							<div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
								<Button
									variant="outline"
									className={cn(
										"shrink-0 rounded-full border px-2.5 py-2 shadow-none transition duration-200",
										selectedPlatforms.length === 0
											? "border-transparent bg-foreground text-background"
											: "border-[var(--brand-border-soft)] bg-background/80",
									)}
									onClick={() =>
										startTransition(() => setSelectedPlatforms([]))
									}
								>
									<span className="font-medium">All channels</span>
								</Button>
								{platformOptions.map((platform) => {
									const meta = getPlatformMeta(platform);
									const selected = selectedPlatforms.includes(platform);
									return (
										<Button
											key={platform}
											variant="outline"
											className="shrink-0 rounded-full border px-2 py-2 shadow-none transition duration-200"
											style={{
												borderColor: selected
													? withAlpha(meta?.color ?? "#64748B", 0.3)
													: withAlpha(meta?.color ?? "#64748B", 0.16),
												backgroundColor: selected
													? withAlpha(meta?.color ?? "#64748B", 0.14)
													: withAlpha(meta?.color ?? "#64748B", 0.06),
												color: selected ? meta?.color : undefined,
											}}
											onClick={() =>
												startTransition(() =>
													setSelectedPlatforms((current) =>
														current.includes(platform)
															? current.filter((item) => item !== platform)
															: [...current, platform],
													),
												)
											}
										>
											{platformIcon(platform, {
												containerClassName: "size-6",
												iconClassName: "size-3.5",
												backgroundAlpha: selected ? 0.16 : 0.08,
												borderAlpha: selected ? 0.24 : 0.14,
											})}
											<span className="text-sm font-medium">
												{formatPlatformLabel(platform)}
											</span>
										</Button>
									);
								})}
							</div>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row">
							<div className="relative min-w-[13rem]">
								<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									value={search}
									onChange={(event) =>
										startTransition(() => setSearch(event.target.value))
									}
									placeholder="Search titles, copy, or campaigns..."
									className="dashboard-input-height rounded-full border-[var(--brand-border-soft)] bg-background/88 pl-10"
								/>
							</div>
							<Select
								value={statusFilter}
								onValueChange={(nextValue) =>
									startTransition(() =>
										setStatusFilter(nextValue as PlanningStatusFilter),
									)
								}
							>
								<SelectTrigger className="dashboard-input-height w-[13rem] rounded-full border-[var(--brand-border-soft)] bg-background/88">
									<SelectValue placeholder="Filter status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All planning items</SelectItem>
									<SelectItem value="ready">Ready</SelectItem>
									<SelectItem value="attention">Needs attention</SelectItem>
									<SelectItem value="blocked">Blocked</SelectItem>
									<SelectItem value="backlog">Backlog</SelectItem>
									<SelectItem value="tentative">Tentative</SelectItem>
									<SelectItem value="split">Split schedule</SelectItem>
								</SelectContent>
							</Select>
							<Button
								variant="outline"
								className="hidden rounded-full border-[var(--brand-border-soft)] bg-background/88 xl:inline-flex 2xl:hidden"
								onClick={() => setBacklogRailOpen(true)}
							>
								<FolderKanban className="size-4" />
								Backlog
								<span className="rounded-full border border-[var(--brand-border-soft)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
									{backlogItems.length}
								</span>
							</Button>
						</div>
					</div>

					{error ? (
						<div className="rounded-[22px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
							{error}
						</div>
					) : null}

					<div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
						<div className="space-y-4">
							{loading ? (
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 px-5 py-16 text-center text-sm text-muted-foreground">
									<div className="inline-flex items-center gap-2">
										<LoaderCircle className="size-4 animate-spin" />
										Loading the planning board...
									</div>
								</div>
							) : normalizedView === "month" ? (
								<div className="calendar-board-surface overflow-hidden rounded-[28px]">
									<div className="grid grid-cols-7 border-b border-[var(--brand-border-soft)] bg-background/72">
										{weekDays(anchorDate).map((day) => (
											<div
												key={day.toISOString()}
												className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
											>
												{formatWeekday(day)}
											</div>
										))}
									</div>
									<div className="grid grid-cols-1 md:grid-cols-7 md:auto-rows-[12rem] xl:auto-rows-[12.5rem] 2xl:auto-rows-[13rem]">
										{monthDays.map((day) => {
											const key = startOfDay(day).toISOString();
											const items = monthBuckets.get(key) ?? [];
											const isToday = isSameDay(day, new Date());
											const inActiveMonth =
												day.getMonth() === anchorDate.getMonth();
											return (
												<div
													key={key}
													onDragOver={(event) => {
														event.preventDefault();
														setActiveDropKey(`day:${key}`);
													}}
													onDragLeave={() => {
														setActiveDropKey((current) =>
															current === `day:${key}` ? null : current,
														);
													}}
													onDrop={(event) => void handleDayDrop(day, event)}
													className={cn(
														"min-h-[15rem] overflow-hidden border-b border-r border-[var(--brand-border-soft)] p-3 align-top last:border-r-0 md:flex md:h-full md:min-h-0 md:flex-col",
														!inActiveMonth && "calendar-day-muted",
														activeDropKey === `day:${key}` &&
															"calendar-drop-target",
													)}
												>
													<div className="flex items-center justify-between gap-2">
														<div className="flex items-center gap-2">
															<div
																className={cn(
																	"inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
																	isToday
																		? "bg-foreground text-background"
																		: "bg-background/92 text-foreground",
																)}
															>
																{day.getDate()}
															</div>
															{items.length > 0 ? (
																<Badge
																	variant="outline"
																	className="rounded-full text-[11px]"
																>
																	{items.length} post
																	{items.length === 1 ? "" : "s"}
																</Badge>
															) : null}
														</div>
														<Button
															variant="ghost"
															size="sm"
															className="rounded-full text-xs"
															onClick={() =>
																setPanelState({ mode: "quick-add", date: day })
															}
														>
															<Plus className="size-3.5" />
															Add
														</Button>
													</div>
													<div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
														{items
															.slice(0, MONTH_VISIBLE_PILL_COUNT)
															.map((item) => (
																<MonthPlanningPill
																	key={item.postId}
																	item={item}
																	draggable={!item.splitSchedule}
																	dragging={draggingPostId === item.postId}
																	onClick={() =>
																		setPanelState({ mode: "item", item })
																	}
																	onDragStart={(event) =>
																		beginDrag(item, event)
																	}
																	onDragEnd={clearDragState}
																/>
															))}
														{items.length > MONTH_VISIBLE_PILL_COUNT ? (
															<button
																type="button"
																className="mt-auto w-full rounded-[16px] border border-dashed border-[var(--brand-border-soft)] px-2.5 py-2 text-left text-[11px] font-medium text-muted-foreground transition hover:bg-accent/35"
																onClick={() =>
																	startTransition(() => {
																		setAnchorDate(day);
																		setView("week");
																	})
																}
															>
																+{items.length - MONTH_VISIBLE_PILL_COUNT} more
																in week board
															</button>
														) : items.length === 0 ? (
															<button
																type="button"
																className="calendar-quiet-add mt-1 inline-flex w-full items-center gap-2 rounded-[16px] border border-dashed border-[var(--brand-border-soft)] px-2.5 py-2 text-left text-[11px] font-medium text-muted-foreground transition hover:bg-accent/35"
																onClick={() =>
																	setPanelState({
																		mode: "quick-add",
																		date: day,
																	})
																}
															>
																<Plus className="size-3.5" />
																Plan something here
															</button>
														) : null}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							) : (
								<div className="grid gap-4 xl:grid-cols-7">
									{currentWeek.map((day) => {
										const key = startOfDay(day).toISOString();
										const items = monthBuckets.get(key) ?? [];
										const isToday = isSameDay(day, new Date());
										return (
											<div
												key={key}
												onDragOver={(event) => {
													event.preventDefault();
													setActiveDropKey(`day:${key}`);
												}}
												onDragLeave={() => {
													setActiveDropKey((current) =>
														current === `day:${key}` ? null : current,
													);
												}}
												onDrop={(event) => void handleDayDrop(day, event)}
												className={cn(
													"calendar-rail-surface rounded-[24px] p-4",
													activeDropKey === `day:${key}` &&
														"calendar-drop-target",
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
															{formatWeekday(day)}
														</div>
														<div className="mt-1 flex items-center gap-2">
															<div
																className={cn(
																	"inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold",
																	isToday
																		? "bg-foreground text-background"
																		: "bg-accent/35 text-foreground",
																)}
															>
																{day.getDate()}
															</div>
															<Badge variant="outline" className="rounded-full">
																{items.length}
															</Badge>
														</div>
													</div>
													<Button
														variant="ghost"
														size="sm"
														className="rounded-full text-xs"
														onClick={() =>
															setPanelState({ mode: "quick-add", date: day })
														}
													>
														<Plus className="size-3.5" />
														Add
													</Button>
												</div>
												<div className="mt-4 space-y-3">
													{items.map((item) => (
														<PlanningCard
															key={item.postId}
															item={item}
															draggable={!item.splitSchedule}
															dragging={draggingPostId === item.postId}
															onClick={() =>
																setPanelState({ mode: "item", item })
															}
															onDragStart={(event) => beginDrag(item, event)}
															onDragEnd={clearDragState}
														/>
													))}
													{items.length === 0 ? (
														<button
															type="button"
															className="flex w-full items-center justify-center rounded-[20px] border border-dashed border-[var(--brand-border-soft)] px-3 py-8 text-sm text-muted-foreground transition hover:bg-accent/35"
															onClick={() =>
																setPanelState({ mode: "quick-add", date: day })
															}
														>
															<Plus className="mr-2 size-4" />
															Add or drag a post here
														</button>
													) : null}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						<div className="space-y-4 xl:hidden 2xl:block 2xl:sticky 2xl:self-start 2xl:max-h-[calc(100dvh-var(--density-dashboard-sticky-top)-1rem)] 2xl:overflow-y-auto dashboard-sticky-rail">
							<BacklogRailPanel
								backlogItems={backlogItems}
								draggingPostId={draggingPostId}
								activeDrop={activeDropKey === "backlog"}
								allowDrop
								onOpenItem={(item) => setPanelState({ mode: "item", item })}
								onDragStart={beginDrag}
								onDragEnd={clearDragState}
								onBacklogOver={(event) => {
									event.preventDefault();
									setActiveDropKey("backlog");
								}}
								onBacklogLeave={() => {
									setActiveDropKey((current) =>
										current === "backlog" ? null : current,
									);
								}}
								onBacklogDrop={(event) => void handleBacklogDrop(event)}
							/>
						</div>
					</div>
				</div>
			</SurfaceCard>

			<Sheet open={backlogRailOpen} onOpenChange={setBacklogRailOpen}>
				<SheetContent className="calendar-drawer-surface w-full overflow-y-auto sm:max-w-[28rem]">
					<SheetHeader className="border-b border-[var(--brand-border-soft)] px-5 py-5">
						<SheetTitle>Backlog</SheetTitle>
						<SheetDescription>
							Keep the month board wide on laptop, then open backlog only when
							you need to slot or inspect drafts.
						</SheetDescription>
					</SheetHeader>
					<div className="space-y-5 px-5 py-5">
						<BacklogRailPanel
							backlogItems={backlogItems}
							draggingPostId={draggingPostId}
							activeDrop={false}
							onOpenItem={(item) => {
								setBacklogRailOpen(false);
								setPanelState({ mode: "item", item });
							}}
							onDragStart={beginDrag}
							onDragEnd={clearDragState}
						/>
					</div>
				</SheetContent>
			</Sheet>

			<Sheet
				open={panelState.mode !== "closed"}
				onOpenChange={(open) => (!open ? closePanel() : undefined)}
			>
				<SheetContent className="calendar-drawer-surface w-full overflow-y-auto sm:max-w-[38rem]">
					<SheetHeader className="border-b border-[var(--brand-border-soft)] px-5 py-5">
						<SheetTitle>
							{panelState.mode === "item"
								? (activeItem?.title ?? "Planning drawer")
								: "Quick add"}
						</SheetTitle>
						<SheetDescription>
							{panelState.mode === "item"
								? "Keep the essentials close: title, core copy, destinations, and planning intent."
								: "Create a draft or drop an existing backlog item straight into the selected day."}
						</SheetDescription>
					</SheetHeader>

					<div className="space-y-5 px-5 py-5">
						{panelError ? (
							<div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-100">
								{panelError}
							</div>
						) : null}

						{panelState.mode === "item" ? (
							loadingPost || !activeItem ? (
								<div className="rounded-[20px] border border-[var(--brand-border-soft)] px-4 py-10 text-center text-sm text-muted-foreground">
									<div className="inline-flex items-center gap-2">
										<LoaderCircle className="size-4 animate-spin" />
										Loading planning details...
									</div>
								</div>
							) : (
								<>
									<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/76 p-4">
										<div className="flex flex-wrap items-center gap-2">
											<Badge
												className={cn(
													"rounded-full border",
													statusTone(activeItem),
												)}
											>
												{planningStateLabel(activeItem)}
											</Badge>
											<Badge variant="outline" className="rounded-full">
												{readinessLabel(activeItem)}
											</Badge>
											{activeItem.campaign ? (
												<Badge variant="outline" className="rounded-full">
													{activeItem.campaign.name}
												</Badge>
											) : null}
											{activeItem.partialPlacement ? (
												<Badge variant="outline" className="rounded-full">
													Partial placement
												</Badge>
											) : null}
										</div>
										<div className="mt-4 flex flex-wrap gap-2">
											{activeItem.platforms.map((platform) => (
												<DestinationRow
													key={platform}
													platform={platform}
													count={
														activeItem.nodes.filter(
															(node) => node.item.platform === platform,
														).length
													}
												/>
											))}
										</div>
									</div>

									{activeItem.splitSchedule
										? alertLine({
												icon: AlertTriangle,
												title: "This post has diverging destination schedules.",
												body: "The board still shows one card, but the destinations are no longer aligned. Use the detail list below to keep the split intentionally or straighten it back into one plan.",
												tone: "warning",
											})
										: null}

									{activeItem.readinessState === "blocked"
										? alertLine({
												icon: XCircle,
												title: "Some destinations are blocked.",
												body: "The drawer keeps those blockers visible without making the calendar noisy. You can still adjust content and assets here before placing or finalizing.",
												tone: "error",
											})
										: activeItem.tentativeCount > 0
											? alertLine({
													icon: AlertTriangle,
													title: "This post is still tentative.",
													body: "Tentative slots are great for planning. Finalize them once the copy, assets, and review state are ready.",
													tone: "warning",
												})
											: alertLine({
													icon: CheckCircle2,
													title: "This post is aligned and ready to move.",
													body: "The main flow is simple here: adjust the essentials, then save, place, finalize, or return to backlog.",
													tone: "success",
												})}

									<div className="grid gap-4">
										<div className="space-y-2">
											<Label htmlFor="planning-title">Post title</Label>
											<Input
												id="planning-title"
												value={panelDraft.title}
												onChange={(event) =>
													setPanelDraft((current) => ({
														...current,
														title: event.target.value,
													}))
												}
												className="rounded-2xl"
											/>
										</div>

										<div className="space-y-2">
											<Label htmlFor="planning-excerpt">Core message</Label>
											<Textarea
												id="planning-excerpt"
												value={panelDraft.excerpt}
												onChange={(event) =>
													setPanelDraft((current) => ({
														...current,
														excerpt: event.target.value,
													}))
												}
												className="min-h-[10rem] rounded-2xl"
											/>
										</div>

										<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
											<div className="space-y-2">
												<Label>Planned day</Label>
												<DateTimePicker
													value={panelDraft.plannedLocal}
													onChange={(value) =>
														setPanelDraft((current) => ({
															...current,
															plannedLocal: value,
														}))
													}
												/>
											</div>
											<div className="space-y-2">
												<Label>Scheduling mode</Label>
												<Select
													value={panelDraft.schedulingMode}
													onValueChange={(value) =>
														setPanelDraft((current) => ({
															...current,
															schedulingMode:
																value as PlanningDraft["schedulingMode"],
														}))
													}
												>
													<SelectTrigger className="h-11 rounded-2xl">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="tentative">Tentative</SelectItem>
														<SelectItem value="exact">
															Exact schedule
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<Collapsible
											open={advancedOpen}
											onOpenChange={setAdvancedOpen}
										>
											<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/68 p-4">
												<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
													<div>
														<div className="text-sm font-medium">
															Advanced details
														</div>
														<div className="mt-1 text-sm text-muted-foreground">
															Approval, shared assets, notes, and
															per-destination detail stay tucked away until you
															need them.
														</div>
													</div>
													<ChevronDown
														className={cn(
															"size-4 transition-transform",
															advancedOpen && "rotate-180",
														)}
													/>
												</CollapsibleTrigger>
												<CollapsibleContent>
													<div className="mt-4 space-y-4">
														<div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-4 py-3">
															<div>
																<div className="text-sm font-medium">
																	Require approval
																</div>
																<div className="text-sm text-muted-foreground">
																	Keep review gates available without pushing
																	them into the main planning flow.
																</div>
															</div>
															<Switch
																checked={panelDraft.requiresApproval}
																onCheckedChange={(checked) =>
																	setPanelDraft((current) => ({
																		...current,
																		requiresApproval: checked,
																	}))
																}
															/>
														</div>

														<div className="space-y-2">
															<Label htmlFor="planning-notes">Notes</Label>
															<Textarea
																id="planning-notes"
																value={panelDraft.notes}
																onChange={(event) =>
																	setPanelDraft((current) => ({
																		...current,
																		notes: event.target.value,
																	}))
																}
																className="min-h-[7rem] rounded-2xl"
																placeholder="Internal planning notes, reminders, or operational context"
															/>
														</div>

														<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/78 p-4">
															<div className="text-sm font-medium">
																Shared assets
															</div>
															{panelDraft.assetIds.length > 0 ? (
																<ResourceChipList
																	resources={resources.filter((resource) =>
																		panelDraft.assetIds.includes(resource.id),
																	)}
																/>
															) : (
																<div className="text-sm text-muted-foreground">
																	No shared assets attached yet.
																</div>
															)}
															<ResourcePicker
																resources={resources}
																value={panelDraft.assetIds}
																onChange={(assetIds) =>
																	setPanelDraft((current) => ({
																		...current,
																		assetIds,
																	}))
																}
																triggerLabel="Manage shared assets"
																allowUpload
																onResourcesCreated={addUploadedResources}
															/>
														</div>

														<div className="space-y-3">
															<div className="text-sm font-medium">
																Destination detail
															</div>
															<div className="space-y-2">
																{activeItem.nodes.map((node) => (
																	<div
																		key={node.item.variantId}
																		className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-4 py-3"
																	>
																		<div className="flex flex-wrap items-center justify-between gap-3">
																			<div className="flex items-center gap-3">
																				{platformIcon(node.item.platform)}
																				<div>
																					<div className="text-sm font-medium">
																						{formatPlatformLabel(
																							node.item.platform,
																						)}{" "}
																						· {surfaceLabel(node.item.surface)}
																					</div>
																					<div className="text-xs text-muted-foreground">
																						{node.kind === "entry" &&
																						node.plannedDate
																							? `${node.item.planningState} · ${formatDayHeader(node.plannedDate)} · ${formatTime(node.plannedDate)}`
																							: "Backlog"}
																					</div>
																				</div>
																			</div>
																			<div className="flex flex-wrap items-center gap-2">
																				<Badge
																					variant="outline"
																					className="rounded-full text-xs"
																				>
																					{node.item.approvalState}
																				</Badge>
																				{itemIsBlocked(node.item) ? (
																					<Badge className="rounded-full border border-rose-500/20 bg-rose-500/12 text-rose-800 dark:text-rose-100">
																						blocked
																					</Badge>
																				) : null}
																			</div>
																		</div>
																	</div>
																))}
															</div>
														</div>

														<Button
															variant="outline"
															className="rounded-full"
															asChild
														>
															<Link
																to={`/dashboard/posts/${activeItem.postId}/edit`}
															>
																Open full post editor
															</Link>
														</Button>
													</div>
												</CollapsibleContent>
											</div>
										</Collapsible>
									</div>
								</>
							)
						) : (
							<>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/76 p-4">
									<div className="text-sm font-medium">
										{quickAddDate
											? `Planning for ${quickAddDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`
											: "Create a draft for the backlog or place it immediately"}
									</div>
									<div className="mt-1 text-sm text-muted-foreground">
										Quick add keeps the flow light: draft the idea, choose the
										destinations, then either save it to backlog or place it on
										the board.
									</div>
								</div>

								<div className="grid gap-4">
									<div className="space-y-2">
										<Label htmlFor="quick-title">Post title</Label>
										<Input
											id="quick-title"
											value={panelDraft.title}
											onChange={(event) =>
												setPanelDraft((current) => ({
													...current,
													title: event.target.value,
												}))
											}
											className="rounded-2xl"
										/>
									</div>

									<div className="space-y-2">
										<Label htmlFor="quick-excerpt">Core message</Label>
										<Textarea
											id="quick-excerpt"
											value={panelDraft.excerpt}
											onChange={(event) =>
												setPanelDraft((current) => ({
													...current,
													excerpt: event.target.value,
												}))
											}
											className="min-h-[9rem] rounded-2xl"
											placeholder="What should this post say?"
										/>
									</div>

									<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
										<div className="space-y-2">
											<Label>Placement time</Label>
											<DateTimePicker
												value={panelDraft.plannedLocal}
												onChange={(value) =>
													setPanelDraft((current) => ({
														...current,
														plannedLocal: value,
													}))
												}
											/>
										</div>
										<div className="space-y-2">
											<Label>Placement mode</Label>
											<Select
												value={panelDraft.schedulingMode}
												onValueChange={(value) =>
													setPanelDraft((current) => ({
														...current,
														schedulingMode:
															value as PlanningDraft["schedulingMode"],
													}))
												}
											>
												<SelectTrigger className="h-11 rounded-2xl">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="tentative">Tentative</SelectItem>
													<SelectItem value="exact">Exact schedule</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="space-y-2">
										<Label>Destinations</Label>
										<div className="flex flex-wrap gap-2">
											{platformOptions.map((platform) => {
												const selected =
													panelDraft.destinations.includes(platform);
												const meta = getPlatformMeta(platform);
												return (
													<button
														key={platform}
														type="button"
														onClick={() =>
															setPanelDraft((current) => ({
																...current,
																destinations: current.destinations.includes(
																	platform,
																)
																	? current.destinations.filter(
																			(item) => item !== platform,
																		)
																	: [...current.destinations, platform],
															}))
														}
														className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition"
														style={{
															borderColor: selected
																? withAlpha(meta?.color ?? "#64748B", 0.32)
																: withAlpha(meta?.color ?? "#64748B", 0.16),
															backgroundColor: selected
																? withAlpha(meta?.color ?? "#64748B", 0.14)
																: "rgba(255,255,255,0.82)",
															color: selected ? meta?.color : undefined,
														}}
													>
														{platformIcon(platform, {
															containerClassName: "size-6",
															iconClassName: "size-3.5",
															backgroundAlpha: selected ? 0.16 : 0.08,
															borderAlpha: selected ? 0.24 : 0.14,
														})}
														{formatPlatformLabel(platform)}
													</button>
												);
											})}
										</div>
									</div>

									<Collapsible
										open={advancedOpen}
										onOpenChange={setAdvancedOpen}
									>
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/68 p-4">
											<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
												<div>
													<div className="text-sm font-medium">
														Optional details
													</div>
													<div className="mt-1 text-sm text-muted-foreground">
														Approval, notes, and shared assets stay hidden
														unless they help this draft.
													</div>
												</div>
												<ChevronDown
													className={cn(
														"size-4 transition-transform",
														advancedOpen && "rotate-180",
													)}
												/>
											</CollapsibleTrigger>
											<CollapsibleContent>
												<div className="mt-4 space-y-4">
													<div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-4 py-3">
														<div>
															<div className="text-sm font-medium">
																Require approval
															</div>
															<div className="text-sm text-muted-foreground">
																Turn this on only when the draft needs review
																gates.
															</div>
														</div>
														<Switch
															checked={panelDraft.requiresApproval}
															onCheckedChange={(checked) =>
																setPanelDraft((current) => ({
																	...current,
																	requiresApproval: checked,
																}))
															}
														/>
													</div>
													<div className="space-y-2">
														<Label htmlFor="quick-notes">Notes</Label>
														<Textarea
															id="quick-notes"
															value={panelDraft.notes}
															onChange={(event) =>
																setPanelDraft((current) => ({
																	...current,
																	notes: event.target.value,
																}))
															}
															className="min-h-[7rem] rounded-2xl"
															placeholder="Optional context for collaborators"
														/>
													</div>
													<div className="space-y-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/78 p-4">
														<div className="text-sm font-medium">
															Shared assets
														</div>
														{panelDraft.assetIds.length > 0 ? (
															<ResourceChipList
																resources={resources.filter((resource) =>
																	panelDraft.assetIds.includes(resource.id),
																)}
															/>
														) : (
															<div className="text-sm text-muted-foreground">
																No shared assets attached yet.
															</div>
														)}
														<ResourcePicker
															resources={resources}
															value={panelDraft.assetIds}
															onChange={(assetIds) =>
																setPanelDraft((current) => ({
																	...current,
																	assetIds,
																}))
															}
															triggerLabel="Manage shared assets"
															allowUpload
															onResourcesCreated={addUploadedResources}
														/>
													</div>
												</div>
											</CollapsibleContent>
										</div>
									</Collapsible>

									<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/72 p-4">
										<div className="text-sm font-medium">
											Use something already in backlog
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											Instead of drafting from scratch, you can drop an existing
											idea into this day in one click.
										</div>
										<div className="mt-4 space-y-3">
											{backlogItems.slice(0, 4).map((item) => (
												<button
													key={item.postId}
													type="button"
													className="w-full rounded-[18px] border border-[var(--brand-border-soft)] bg-background/84 px-4 py-3 text-left transition hover:bg-accent/35"
													onClick={() =>
														quickAddDate
															? void placeExistingBacklogItem(
																	item,
																	quickAddDate,
																)
															: undefined
													}
													disabled={!quickAddDate || saving}
												>
													<div className="flex items-center justify-between gap-3">
														<div className="min-w-0">
															<div className="truncate text-sm font-medium">
																{item.title}
															</div>
															<div className="mt-1 truncate text-xs text-muted-foreground">
																{item.platforms
																	.map((platform) =>
																		formatPlatformLabel(platform),
																	)
																	.join(", ")}
															</div>
														</div>
														<Badge variant="outline" className="rounded-full">
															Place
														</Badge>
													</div>
												</button>
											))}
											{backlogItems.length === 0 ? (
												<div className="rounded-[18px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-center text-sm text-muted-foreground">
													No unscheduled ideas are waiting in backlog right now.
												</div>
											) : null}
										</div>
									</div>
								</div>
							</>
						)}
					</div>

					<SheetFooter className="border-t border-[var(--brand-border-soft)] px-5 py-4">
						<div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-between">
							<div className="flex flex-wrap items-center gap-2">
								{panelState.mode === "item" && activeItem?.primaryDate ? (
									<Button
										variant="outline"
										className="rounded-full"
										onClick={() => void handleReturnToBacklog()}
										disabled={saving}
									>
										Return to backlog
									</Button>
								) : null}
								{panelState.mode === "item" &&
								(activeItem?.finalizableCount ?? 0) > 0 ? (
									<Button
										variant="outline"
										className="rounded-full"
										onClick={() => void handleFinalizeItem()}
										disabled={saving}
									>
										Finalize schedule
									</Button>
								) : null}
							</div>
							<div className="flex flex-wrap items-center justify-end gap-2">
								<Button
									variant="outline"
									className="rounded-full"
									onClick={closePanel}
								>
									Close
								</Button>
								{panelState.mode === "item" ? (
									<>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={() => void handleSaveItem()}
											disabled={saving}
										>
											{saving ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : null}
											Save
										</Button>
										<Button
											className="rounded-full border-0 bg-gradient-brand text-white"
											onClick={() => void handlePlaceItem()}
											disabled={saving}
										>
											{saving ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : null}
											Place on calendar
										</Button>
									</>
								) : (
									<>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={() => void createDraft(false)}
											disabled={saving}
										>
											{saving ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : null}
											Save to backlog
										</Button>
										<Button
											className="rounded-full border-0 bg-gradient-brand text-white"
											onClick={() => void createDraft(true)}
											disabled={saving}
										>
											{saving ? (
												<LoaderCircle className="size-4 animate-spin" />
											) : null}
											Place on calendar
										</Button>
									</>
								)}
							</div>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}

export default DashboardCalendar;
