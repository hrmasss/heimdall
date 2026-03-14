import {
	AlertTriangle,
	ArrowUpRight,
	CalendarDays,
	CalendarRange,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock3,
	FilePlus2,
	FolderKanban,
	Globe2,
	GripVertical,
	LoaderCircle,
	Plus,
	Search,
	Send,
	XCircle,
} from "lucide-react";
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
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
import type {
	ApiListResponse,
	CalendarBacklogItem,
	CalendarEntry,
	CalendarResponse,
	PostDetail,
	PostVariant,
	ResourceCapabilityMatrix,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
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

type CalendarView = "week" | "month" | "timeline";
type CalendarStatusFilter =
	| "all"
	| "ready"
	| "blocked"
	| "in_review"
	| "tentative"
	| "approval_blocked"
	| "asset_blocked"
	| "ready_to_finalize";

type CalendarPanelState =
	| { mode: "closed" }
	| { mode: "entry"; item: CalendarEntry }
	| { mode: "backlog"; item: CalendarBacklogItem }
	| { mode: "gap"; platform: string; date: Date }
	| { mode: "new"; platform?: string; date?: Date };

type PanelDraft = {
	title: string;
	excerpt: string;
	notes: string;
	requiresApproval: boolean;
	plannedLocal: string;
	platform: string;
	surface: string;
	contentMode: "inherit" | "custom";
	assetMode: "inherit" | "replace";
	assetIds: string[];
	reviewIntent: "draft" | "submit" | "approved";
};

type CalendarCardItem =
	| { kind: "entry"; item: CalendarEntry }
	| { kind: "backlog"; item: CalendarBacklogItem };

type DragPayload = {
	source: "entry" | "backlog";
	variantId: string;
	postId: string;
	platform: string;
	plannedAt?: string;
	planningState?: CalendarEntry["planningState"];
};

type ActiveDropTarget =
	| {
			kind: "week";
			platform: string;
			dateKey: string;
			valid: boolean;
	  }
	| {
			kind: "timeline";
			platform: string;
			hour: number;
			valid: boolean;
	  }
	| {
			kind: "backlog";
			platform?: string;
			valid: boolean;
	  };

type WeekHeaderDragState = {
	pointerId: number;
	startClientX: number;
	startScrollLeft: number;
};

const TIMELINE_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);
const WEEK_PLATFORM_COLUMN_WIDTH = 220;
const WEEK_DAY_COLUMN_MIN_WIDTH = 172;
const WEEK_VISIBLE_STACK_COUNT = 2;

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

function addMonths(value: Date, amount: number) {
	return new Date(
		value.getFullYear(),
		value.getMonth() + amount,
		value.getDate(),
	);
}

function addWeeks(value: Date, amount: number) {
	return addDays(value, amount * 7);
}

function isSameDay(left: Date, right: Date) {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

function toLocalDateTimeValue(date: Date) {
	return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(
		date.getDate(),
	)}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function parseIso(value?: string) {
	if (!value) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLocalDateTime(value: string) {
	if (!value) {
		return null;
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalInputValue(value?: string) {
	const parsed = parseIso(value);
	return parsed ? toLocalDateTimeValue(parsed) : "";
}

function toIsoValue(value: string) {
	const parsed = parseLocalDateTime(value);
	return parsed ? parsed.toISOString() : "";
}

function formatDayHeader(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	}).format(value);
}

function formatMonthLabel(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		month: "long",
		year: "numeric",
	}).format(value);
}

function formatTimeLabel(value?: string) {
	const parsed = parseIso(value);
	return parsed
		? parsed.toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})
		: "Set time";
}

function formatDateTimeLabel(value?: string) {
	const parsed = parseIso(value);
	return parsed
		? parsed.toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			})
		: "Unscheduled";
}

function surfaceLabel(surface: string) {
	return surface
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function itemIsBlocked(item: CalendarEntry | CalendarBacklogItem) {
	return (
		item.readiness.scheduleBlockers.length > 0 ||
		item.readiness.publishBlockers.length > 0
	);
}

function itemIsTentative(item: CalendarEntry | CalendarBacklogItem) {
	return item.planningState === "tentative";
}

function itemHasIssueCode(
	item: CalendarEntry | CalendarBacklogItem,
	code: string,
) {
	return [
		...item.readiness.scheduleBlockers,
		...item.readiness.publishBlockers,
	].some((issue) => issue.code === code);
}

function itemHasAssetBlocker(item: CalendarEntry | CalendarBacklogItem) {
	return itemHasIssueCode(item, "assets_required");
}

function itemHasApprovalBlocker(item: CalendarEntry | CalendarBacklogItem) {
	return itemHasIssueCode(item, "approval_required");
}

function itemIsReady(item: CalendarEntry | CalendarBacklogItem) {
	return (
		item.readiness.scheduleBlockers.length === 0 &&
		item.readiness.publishBlockers.length === 0
	);
}

function matchesStatusFilter(
	item: CalendarEntry | CalendarBacklogItem,
	filter: CalendarStatusFilter,
) {
	switch (filter) {
		case "ready":
			return itemIsReady(item);
		case "blocked":
			return itemIsBlocked(item);
		case "in_review":
			return item.approvalState === "in_review";
		case "tentative":
			return itemIsTentative(item);
		case "approval_blocked":
			return itemHasApprovalBlocker(item);
		case "asset_blocked":
			return itemHasAssetBlocker(item);
		case "ready_to_finalize":
			return item.planningState === "tentative" && item.finalizable;
		default:
			return true;
	}
}

function itemSearchText(item: CalendarEntry | CalendarBacklogItem) {
	return [
		item.title,
		item.excerpt,
		item.platform,
		item.surface,
		item.planningState,
		item.approvalState,
		item.publicationState,
		item.notes ?? "",
	].join(" ");
}

function statusClassName(value: string) {
	switch (value) {
		case "approved":
		case "published":
			return "pill pill-success";
		case "in_review":
		case "scheduled":
		case "publishing":
			return "pill pill-warning";
		case "changes_requested":
		case "failed":
			return "pill pill-error";
		default:
			return "pill pill-muted";
	}
}

function publicationBadgeTone(item: CalendarEntry | CalendarBacklogItem) {
	if (item.planningState === "tentative") {
		return "pill pill-warning";
	}
	if (itemIsBlocked(item)) {
		return "pill pill-error";
	}
	if (itemIsReady(item)) {
		return "pill pill-success";
	}
	return statusClassName(item.publicationState);
}

function dragDataFor(
	source: "entry" | "backlog",
	item: CalendarEntry | CalendarBacklogItem,
): DragPayload {
	return {
		source,
		variantId: item.variantId,
		postId: item.postId,
		platform: item.platform,
		plannedAt: "plannedAt" in item ? item.plannedAt : undefined,
		planningState: item.planningState,
	};
}

function readDragPayload(event: React.DragEvent) {
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
	if (contentKind === "article") {
		return typeof payload.body === "string" ? payload.body : "";
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
	if (contentKind === "article") {
		return { ...payload, body: value };
	}
	return { ...payload, body: value };
}

function findVariant(post: PostDetail | null, variantId: string | undefined) {
	if (!post || !variantId) {
		return null;
	}
	return (
		[...post.variants, ...post.legacyVariants].find(
			(item) => item.id === variantId,
		) ?? null
	);
}

function defaultDraft(date?: Date, platform = "", surface = ""): PanelDraft {
	const nextDate = date
		? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0)
		: new Date();
	return {
		title: "",
		excerpt: "",
		notes: "",
		requiresApproval: false,
		plannedLocal: toLocalDateTimeValue(nextDate),
		platform,
		surface,
		contentMode: "custom",
		assetMode: "replace",
		assetIds: [],
		reviewIntent: "draft",
	};
}

function resourceRecordsForIds(resources: ResourceRecord[], ids: string[]) {
	const byId = new Map(resources.map((resource) => [resource.id, resource]));
	return ids
		.map((id) => byId.get(id))
		.filter((resource): resource is ResourceRecord => Boolean(resource));
}

function monthGridDays(anchor: Date) {
	const first = startOfMonth(anchor);
	const gridStart = startOfWeek(first);
	return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function selectedRange(view: CalendarView, anchor: Date) {
	if (view === "month") {
		return {
			start: startOfMonth(anchor),
			end: endOfMonth(anchor),
		};
	}
	if (view === "timeline") {
		return {
			start: startOfDay(anchor),
			end: endOfDay(anchor),
		};
	}
	const weekStart = startOfWeek(anchor);
	return {
		start: weekStart,
		end: endOfDay(addDays(weekStart, 6)),
	};
}

function weekDays(anchor: Date) {
	const weekStart = startOfWeek(anchor);
	return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function usePrefersReducedMotion() {
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) {
			return;
		}
		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReducedMotion(mediaQuery.matches);
		update();
		mediaQuery.addEventListener("change", update);
		return () => mediaQuery.removeEventListener("change", update);
	}, []);

	return reducedMotion;
}

function laneChrome(platform: string) {
	const meta = getPlatformMeta(platform);
	if (!meta) {
		return {
			borderColor: "var(--brand-border-soft)",
			headerBackground: "rgba(255,255,255,0.72)",
			bodyBackground: "rgba(255,255,255,0.52)",
			softBackground: "rgba(255,255,255,0.68)",
			highlightBackground:
				"color-mix(in srgb, var(--brand-highlight) 16%, transparent)",
			textColor: "inherit",
		};
	}
	return {
		borderColor: withAlpha(meta.color, 0.2),
		headerBackground: `linear-gradient(135deg, ${withAlpha(
			meta.color,
			0.18,
		)}, ${withAlpha(meta.color, 0.08)})`,
		bodyBackground: `linear-gradient(180deg, ${withAlpha(
			meta.color,
			0.1,
		)}, ${withAlpha(meta.color, 0.03)})`,
		softBackground: withAlpha(meta.color, 0.08),
		highlightBackground: withAlpha(meta.color, 0.14),
		textColor: meta.color,
	};
}

function rebuildPlatformCounts(
	platforms: CalendarResponse["platforms"],
	entries: CalendarEntry[],
	backlog: CalendarBacklogItem[],
) {
	return platforms.map((lane) => ({
		...lane,
		scheduledCount: entries.filter((item) => item.platform === lane.platform)
			.length,
		backlogCount: backlog.filter((item) => item.platform === lane.platform)
			.length,
	}));
}

function resolveInheritedAssets(
	post: PostDetail | null,
	variant: PostVariant | null,
) {
	if (!post || !variant || variant.assetMode !== "inherit") {
		return [];
	}
	if (variant.inheritSource === "shared") {
		return post.assets.filter(
			(asset) => !variant.removedInheritedResourceIds.includes(asset.id),
		);
	}
	if (variant.inheritSource.startsWith("platform:")) {
		const sourcePlatform = variant.inheritSource.slice("platform:".length);
		const sourceVariant =
			[...post.variants, ...post.legacyVariants].find(
				(item) => item.platform === sourcePlatform,
			) ?? null;
		return (
			sourceVariant?.effectiveAssets.filter(
				(asset) => !variant.removedInheritedResourceIds.includes(asset.id),
			) ?? []
		);
	}
	return [];
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
		<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3 shadow-[0_18px_35px_-34px_rgba(15,23,42,0.52)]">
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

function coverageMeta(coveredDays: number, totalDays: number) {
	const ratio = totalDays > 0 ? coveredDays / totalDays : 0;
	if (ratio >= 0.85) {
		return {
			label: `${coveredDays}/${totalDays} days covered`,
			className:
				"border-emerald-500/25 bg-emerald-500/12 text-emerald-800 dark:text-emerald-100",
		};
	}
	if (ratio >= 0.4) {
		return {
			label: `${coveredDays}/${totalDays} days covered`,
			className:
				"border-amber-500/25 bg-amber-500/12 text-amber-800 dark:text-amber-100",
		};
	}
	return {
		label: `${coveredDays}/${totalDays} days covered`,
		className:
			"border-rose-500/25 bg-rose-500/12 text-rose-800 dark:text-rose-100",
	};
}

function CalendarCard({
	card,
	onClick,
	onDragStart,
	onDragEnd,
	displayMode = "default",
	stretch = false,
}: {
	card: CalendarCardItem;
	onClick: () => void;
	onDragStart?: (payload: DragPayload) => void;
	onDragEnd?: () => void;
	displayMode?: "default" | "week";
	stretch?: boolean;
}) {
	const item = card.item;
	const meta = getPlatformMeta(item.platform);
	const payload = dragDataFor(card.kind, item);
	const isWeekSlot = displayMode === "week" && card.kind === "entry";
	const summaryLabel =
		card.kind === "entry"
			? item.planningState === "tentative"
				? `Tentative ${formatTimeLabel(card.item.plannedAt)}`
				: formatTimeLabel(card.item.plannedAt)
			: "Backlog";
	const blockerSummary = [
		...item.readiness.scheduleBlockers,
		...item.readiness.publishBlockers,
	]
		.slice(0, 2)
		.map((issue) => issue.message);
	const compactIndicators = [
		item.planningState === "tentative"
			? {
					key: "tentative",
					label: "Tentative placement",
					className: "bg-amber-500",
				}
			: null,
		{
			key: "approval",
			label: `Approval status: ${item.approvalState}`,
			className:
				item.approvalState === "approved"
					? "bg-emerald-500"
					: item.approvalState === "in_review"
						? "bg-sky-500"
						: item.approvalState === "changes_requested"
							? "bg-amber-500"
							: "bg-slate-400",
		},
		item.assetCount > 0
			? {
					key: "assets",
					label: `${item.assetCount} asset${item.assetCount === 1 ? "" : "s"} attached`,
					className: "bg-slate-500",
				}
			: null,
		itemIsBlocked(item)
			? {
					key: "blocked",
					label: "Blocked from scheduling or publishing",
					className: "bg-red-500",
				}
			: null,
	].filter(
		(
			indicator,
		): indicator is { key: string; label: string; className: string } =>
			Boolean(indicator),
	);
	const weekLegends = [
		item.planningState === "tentative"
			? {
					key: "tentative",
					label: "Tentative",
					className:
						"border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-100",
				}
			: null,
		{
			key: "approval",
			label:
				item.approvalState === "approved"
					? "Approved"
					: item.approvalState === "in_review"
						? "Review"
						: item.approvalState === "changes_requested"
							? "Changes"
							: "Draft",
			className:
				item.approvalState === "approved"
					? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
					: item.approvalState === "in_review"
						? "border-sky-500/20 bg-sky-500/10 text-sky-800 dark:text-sky-100"
						: item.approvalState === "changes_requested"
							? "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-100"
							: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200",
		},
		itemIsBlocked(item)
			? {
					key: "blocked",
					label: "Blocked",
					className:
						"border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-200",
				}
			: null,
	].filter(
		(legend): legend is { key: string; label: string; className: string } =>
			Boolean(legend),
	);

	return (
		<HoverCard openDelay={120} closeDelay={60}>
			<HoverCardTrigger asChild>
				<button
					type="button"
					draggable
					onDragStart={(event) => {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData(
							"application/json",
							JSON.stringify(payload),
						);
						onDragStart?.(payload);
					}}
					onDragEnd={onDragEnd}
					onClick={onClick}
					className={cn(
						"w-full rounded-[18px] border border-[var(--brand-border-soft)] bg-background/90 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background",
						isWeekSlot
							? cn(
									"flex min-h-[84px] flex-col justify-between p-3",
									stretch && "min-h-[112px] flex-1",
								)
							: "p-2.5",
						card.kind === "backlog" &&
							"bg-[color-mix(in_srgb,var(--background)_90%,var(--brand-highlight)_10%)]",
					)}
					style={
						meta
							? {
									boxShadow: `inset 0 1px 0 ${withAlpha(
										meta.color,
										0.14,
									)}, 0 14px 28px -28px rgba(15,23,42,0.5)`,
								}
							: undefined
					}
				>
					{isWeekSlot ? (
						<>
							<div className="flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<div className="truncate text-[0.8rem] font-semibold leading-5">
										{item.title}
									</div>
									<div className="mt-1 flex items-center gap-1.5 overflow-hidden text-[10.5px] text-muted-foreground">
										<span className="truncate">
											{surfaceLabel(item.surface)}
										</span>
										<span className="text-[9px] leading-none text-muted-foreground/70">
											•
										</span>
										<span className="shrink-0 font-medium">{summaryLabel}</span>
									</div>
								</div>
								<GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
							</div>
							<div className="mt-3 flex flex-wrap items-center gap-1.5">
								{weekLegends.map((legend) => (
									<span
										key={legend.key}
										className={cn(
											"rounded-full border px-2 py-1 text-[10px] font-medium leading-none",
											legend.className,
										)}
									>
										{legend.label}
									</span>
								))}
							</div>
						</>
					) : (
						<div className="flex items-start gap-2">
							<div className="min-w-0 flex-1">
								<div className="flex items-start gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate text-[0.78rem] font-semibold leading-5">
											{item.title}
										</div>
										<div className="mt-0.5 flex items-center gap-1.5 overflow-hidden text-[10.5px] text-muted-foreground">
											<span className="truncate">
												{surfaceLabel(item.surface)}
											</span>
											<span className="text-[9px] leading-none text-muted-foreground/70">
												•
											</span>
											<span className="shrink-0 font-medium">
												{summaryLabel}
											</span>
										</div>
									</div>
									{card.kind === "entry" ? (
										<GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
									) : null}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-1.5 pt-1">
								{compactIndicators.map((indicator) => (
									<span
										key={indicator.key}
										className="inline-flex size-2 rounded-full ring-1 ring-black/5 dark:ring-white/10"
										title={indicator.label}
									>
										<span
											className={cn("size-2 rounded-full", indicator.className)}
										/>
										<span className="sr-only">{indicator.label}</span>
									</span>
								))}
								{card.kind === "backlog" ? (
									<span className="rounded-full bg-slate-900/6 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
										B
									</span>
								) : null}
							</div>
						</div>
					)}
				</button>
			</HoverCardTrigger>
			<HoverCardContent
				align="start"
				className="w-[20rem] rounded-[20px] border border-[var(--brand-border-soft)] bg-background/96 p-4 shadow-[0_24px_48px_-32px_rgba(15,23,42,0.58)]"
			>
				<div className="space-y-3">
					<div className="flex items-start gap-3">
						{platformIcon(item.platform)}
						<div className="min-w-0">
							<div className="text-sm font-semibold">{item.title}</div>
							<div className="text-xs text-muted-foreground">
								{formatPlatformLabel(item.platform)} ·{" "}
								{surfaceLabel(item.surface)}
							</div>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className={statusClassName(item.approvalState)}>
							{item.approvalState}
						</span>
						<span className={publicationBadgeTone(item)}>{summaryLabel}</span>
						{item.finalizable ? (
							<span className="pill pill-success">Ready to finalize</span>
						) : null}
						{itemIsBlocked(item) ? (
							<span className="pill pill-error">Blocked</span>
						) : null}
					</div>
					<p className="text-xs leading-5 text-muted-foreground">
						{item.excerpt || "No draft excerpt yet."}
					</p>
					{blockerSummary.length > 0 ? (
						<div className="space-y-1 rounded-[16px] border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-700 dark:text-red-200">
							{blockerSummary.map((message) => (
								<div key={message}>{message}</div>
							))}
						</div>
					) : null}
					<div className="text-[11px] text-muted-foreground">
						Click to open the planner drawer.
					</div>
				</div>
			</HoverCardContent>
		</HoverCard>
	);
}

export function DashboardCalendar() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [resourceSets, setResourceSets] = useState<ResourceSetSummary[]>([]);
	const [view, setView] = useState<CalendarView>("week");
	const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
	const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
	const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
	const [showGapsOnly, setShowGapsOnly] = useState(false);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [panelState, setPanelState] = useState<CalendarPanelState>({
		mode: "closed",
	});
	const [panelDraft, setPanelDraft] = useState<PanelDraft>(defaultDraft());
	const [panelError, setPanelError] = useState<string | null>(null);
	const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);
	const [loadingPost, setLoadingPost] = useState(false);
	const [dragPlatform, setDragPlatform] = useState<string | null>(null);
	const [highlightedLane, setHighlightedLane] = useState<string | null>(null);
	const [activeDropTarget, setActiveDropTarget] =
		useState<ActiveDropTarget | null>(null);
	const deferredSearch = useDeferredValue(search);
	const prefersReducedMotion = usePrefersReducedMotion();
	const timezone = useMemo(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
		[],
	);
	const today = useMemo(() => startOfDay(new Date()), []);
	const currentRange = useMemo(
		() => selectedRange(view, anchorDate),
		[anchorDate, view],
	);
	const currentWeek = useMemo(() => weekDays(anchorDate), [anchorDate]);
	const currentMonthDays = useMemo(
		() => monthGridDays(anchorDate),
		[anchorDate],
	);
	const platformPillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
	const weekScrollRef = useRef<HTMLDivElement | null>(null);
	const weekHeaderDragRef = useRef<WeekHeaderDragState | null>(null);
	const weekLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const timelineLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const [isWeekHeaderDragging, setIsWeekHeaderDragging] = useState(false);

	function endWeekHeaderDrag() {
		weekHeaderDragRef.current = null;
		setIsWeekHeaderDragging(false);
	}

	function handleWeekHeaderPointerDown(
		event: React.PointerEvent<HTMLDivElement>,
	) {
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}
		const container = weekScrollRef.current;
		if (!container || container.scrollWidth <= container.clientWidth + 1) {
			return;
		}
		weekHeaderDragRef.current = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startScrollLeft: container.scrollLeft,
		};
		setIsWeekHeaderDragging(true);
		event.currentTarget.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	function handleWeekHeaderPointerMove(
		event: React.PointerEvent<HTMLDivElement>,
	) {
		const dragState = weekHeaderDragRef.current;
		const container = weekScrollRef.current;
		if (!dragState || !container || dragState.pointerId !== event.pointerId) {
			return;
		}
		container.scrollLeft =
			dragState.startScrollLeft - (event.clientX - dragState.startClientX);
	}

	function handleWeekHeaderPointerUp(event: React.PointerEvent<HTMLDivElement>) {
		const dragState = weekHeaderDragRef.current;
		if (!dragState || dragState.pointerId !== event.pointerId) {
			return;
		}
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		endWeekHeaderDrag();
	}

	function revealPlatformLane(platform: string) {
		const behavior = prefersReducedMotion ? "auto" : "smooth";
		platformPillRefs.current[platform]?.scrollIntoView({
			behavior,
			block: "nearest",
			inline: "nearest",
		});
		if (view === "week") {
			weekLaneRefs.current[platform]?.scrollIntoView({
				behavior,
				block: "nearest",
				inline: "nearest",
			});
		}
		if (view === "timeline") {
			timelineLaneRefs.current[platform]?.scrollIntoView({
				behavior,
				block: "nearest",
				inline: "nearest",
			});
		}
	}

	async function resolveResourceSetIds(resourceSetId: string) {
		const response = await customerRequest<ResourceSetDetail>(
			`/resource-sets/${resourceSetId}`,
		);
		return response.items.map((item) => item.resourceId);
	}

	useEffect(() => {
		if (!activeWorkspaceId) {
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
					timezone,
				});
				if (selectedPlatforms.length > 0) {
					params.set("platform", selectedPlatforms.join(","));
				}
				const [
					calendarResponse,
					capabilityResponse,
					resourceResponse,
					resourceSetResponse,
				] = await Promise.all([
					customerRequest<CalendarResponse>(`/calendar?${params.toString()}`),
					capabilities
						? Promise.resolve(capabilities)
						: customerRequest<ResourceCapabilityMatrix>(
								"/resources/capabilities",
							),
					customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
					customerRequest<ApiListResponse<ResourceSetSummary>>(
						"/resource-sets",
					),
				]);
				if (cancelled) {
					return;
				}
				setCalendar(calendarResponse);
				setCapabilities(capabilityResponse);
				setResources(resourceResponse.items);
				setResourceSets(resourceSetResponse.items);
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
		capabilities,
		currentRange.end,
		currentRange.start,
		customerRequest,
		selectedPlatforms,
		timezone,
	]);

	useEffect(() => {
		if (panelState.mode !== "entry" && panelState.mode !== "backlog") {
			setSelectedPost(null);
			setPanelError(null);
			return;
		}
		const selectedItem = panelState.item;
		let cancelled = false;
		async function loadPost() {
			setLoadingPost(true);
			setPanelError(null);
			try {
				const response = await customerRequest<PostDetail>(
					`/posts/${selectedItem.postId}`,
				);
				if (!cancelled) {
					setSelectedPost(normalizePostDetail(response).value);
				}
			} catch (loadError) {
				if (!cancelled) {
					setPanelError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load the selected post.",
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
	}, [customerRequest, panelState]);

	useEffect(() => {
		if (panelState.mode === "gap") {
			const nextSurface =
				surfaceOptionsForPlatform(capabilities, panelState.platform)[0]
					?.value ?? "";
			setPanelDraft(
				defaultDraft(panelState.date, panelState.platform, nextSurface),
			);
			setPanelError(null);
			return;
		}
		if (panelState.mode === "new") {
			const nextPlatform =
				panelState.platform ??
				calendar?.platforms[0]?.platform ??
				capabilities?.rules[0]?.platform ??
				"";
			const nextSurface =
				surfaceOptionsForPlatform(capabilities, nextPlatform)[0]?.value ?? "";
			setPanelDraft(defaultDraft(panelState.date, nextPlatform, nextSurface));
			setPanelError(null);
		}
	}, [calendar?.platforms, capabilities, panelState]);

	useEffect(() => {
		if (panelState.mode !== "entry" && panelState.mode !== "backlog") {
			return;
		}
		const variant = findVariant(selectedPost, panelState.item.variantId);
		if (!selectedPost || !variant) {
			return;
		}
		const editablePayload =
			variant.contentMode === "custom" && variant.contentPayload
				? variant.contentPayload
				: selectedPost.contentPayload;
		const editableKind =
			(variant.contentMode === "custom" && variant.contentKind) ||
			selectedPost.contentKind;
		setPanelDraft({
			title: selectedPost.title,
			excerpt: contentPayloadText(
				editableKind as PostDetail["contentKind"],
				editablePayload,
			),
			notes: variant.notes ?? "",
			requiresApproval: selectedPost.requiresApproval,
			plannedLocal: toLocalInputValue(
				panelState.mode === "entry" ? panelState.item.plannedAt : undefined,
			),
			platform: variant.platform,
			surface: variant.surface,
			contentMode: variant.contentMode,
			assetMode: variant.assetMode,
			assetIds: variant.assets.map((asset) => asset.id),
			reviewIntent: "draft",
		});
		setPanelError(null);
	}, [panelState, selectedPost]);

	const lanes = calendar?.platforms ?? [];
	const filteredEntries = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase();
		return (calendar?.entries ?? []).filter((item) => {
			if (!matchesStatusFilter(item, statusFilter)) {
				return false;
			}
			if (!query) {
				return true;
			}
			return itemSearchText(item).toLowerCase().includes(query);
		});
	}, [calendar?.entries, deferredSearch, statusFilter]);
	const filteredBacklog = useMemo(() => {
		const query = deferredSearch.trim().toLowerCase();
		return (calendar?.backlog ?? []).filter((item) => {
			if (!matchesStatusFilter(item, statusFilter)) {
				return false;
			}
			if (!query) {
				return true;
			}
			return itemSearchText(item).toLowerCase().includes(query);
		});
	}, [calendar?.backlog, deferredSearch, statusFilter]);

	const entriesByLaneDay = useMemo(() => {
		const index = new Map<string, CalendarEntry[]>();
		for (const item of filteredEntries) {
			const planned = parseIso(item.plannedAt);
			if (!planned) {
				continue;
			}
			const key = `${item.platform}:${startOfDay(planned).toISOString()}`;
			const list = index.get(key) ?? [];
			list.push(item);
			list.sort((left, right) => left.plannedAt.localeCompare(right.plannedAt));
			index.set(key, list);
		}
		return index;
	}, [filteredEntries]);

	const dayCounts = useMemo(() => {
		const counts = new Map<string, CalendarEntry[]>();
		for (const item of filteredEntries) {
			const planned = parseIso(item.plannedAt);
			if (!planned) {
				continue;
			}
			const key = startOfDay(planned).toISOString();
			const list = counts.get(key) ?? [];
			list.push(item);
			counts.set(key, list);
		}
		return counts;
	}, [filteredEntries]);

	const gapCount = useMemo(() => {
		let count = 0;
		for (const lane of lanes) {
			for (const day of currentWeek) {
				const key = `${lane.platform}:${startOfDay(day).toISOString()}`;
				if ((entriesByLaneDay.get(key) ?? []).length === 0) {
					count += 1;
				}
			}
		}
		return count;
	}, [currentWeek, entriesByLaneDay, lanes]);

	const unfinalizedCount = useMemo(
		() =>
			filteredEntries.filter((item) => item.planningState === "tentative")
				.length,
		[filteredEntries],
	);

	const blockedCount = useMemo(
		() =>
			filteredEntries.filter((item) => itemIsBlocked(item)).length +
			filteredBacklog.filter((item) => itemIsBlocked(item)).length,
		[filteredBacklog, filteredEntries],
	);

	function clearDragState() {
		setDragPlatform(null);
		setHighlightedLane(null);
		setActiveDropTarget(null);
	}

	function beginDrag(payload: DragPayload) {
		setDragPlatform(payload.platform);
		setHighlightedLane(payload.platform);
		setActiveDropTarget(null);
		revealPlatformLane(payload.platform);
	}

	function setWeekHoverState(
		targetPlatform: string,
		day: Date,
		event: React.DragEvent,
	) {
		const payload = readDragPayload(event);
		if (!payload) {
			return;
		}
		const dateKey = startOfDay(day).toISOString();
		const valid = payload.platform === targetPlatform;
		setDragPlatform(payload.platform);
		setHighlightedLane(valid ? targetPlatform : payload.platform);
		setActiveDropTarget({
			kind: "week",
			platform: targetPlatform,
			dateKey,
			valid,
		});
		if (valid) {
			revealPlatformLane(targetPlatform);
		}
	}

	function setTimelineHoverState(
		targetPlatform: string,
		hour: number,
		event: React.DragEvent,
	) {
		const payload = readDragPayload(event);
		if (!payload) {
			return;
		}
		const valid = payload.platform === targetPlatform;
		setDragPlatform(payload.platform);
		setHighlightedLane(valid ? targetPlatform : payload.platform);
		setActiveDropTarget({
			kind: "timeline",
			platform: targetPlatform,
			hour,
			valid,
		});
		if (valid) {
			revealPlatformLane(targetPlatform);
		}
	}

	function setBacklogHoverState(event: React.DragEvent) {
		const payload = readDragPayload(event);
		if (!payload) {
			return;
		}
		const valid = payload.source === "entry";
		setDragPlatform(payload.platform);
		setHighlightedLane(payload.platform);
		setActiveDropTarget({
			kind: "backlog",
			platform: payload.platform,
			valid,
		});
	}

	function closePanel() {
		setPanelState({ mode: "closed" });
		setPanelError(null);
	}

	function refreshPostSelection(postId: string) {
		void customerRequest<PostDetail>(`/posts/${postId}`)
			.then((response) => {
				setSelectedPost(normalizePostDetail(response).value);
			})
			.catch(() => undefined);
	}

	function findCalendarItem(variantId: string) {
		return (
			calendar?.entries.find((item) => item.variantId === variantId) ??
			calendar?.backlog.find((item) => item.variantId === variantId) ??
			null
		);
	}

	function optimisticPlaceVariant(
		variantId: string,
		plannedAt: string,
		nextPlanningState: CalendarEntry["planningState"],
	) {
		setCalendar((current) => {
			if (!current) {
				return current;
			}
			let moved: CalendarEntry | null = null;
			const remainingEntries = current.entries
				.map((entry) => {
					if (entry.variantId !== variantId) {
						return entry;
					}
					moved = {
						...entry,
						plannedAt,
						planningState: nextPlanningState,
						publicationState:
							nextPlanningState === "tentative"
								? entry.publicationState
								: "scheduled",
						finalizable:
							nextPlanningState === "tentative" &&
							entry.readiness.scheduleBlockers.length === 0,
					};
					return null;
				})
				.filter((entry): entry is CalendarEntry => Boolean(entry));
			const remainingBacklog = current.backlog.filter((item) => {
				if (item.variantId !== variantId) {
					return true;
				}
				moved = {
					...item,
					plannedAt,
					planningState: nextPlanningState,
					publicationState:
						nextPlanningState === "tentative"
							? item.publicationState
							: "scheduled",
					finalizable:
						nextPlanningState === "tentative" &&
						item.readiness.scheduleBlockers.length === 0,
				};
				return false;
			});
			if (!moved) {
				return current;
			}
			const movedItem = moved as CalendarEntry;
			const nextEntries = [...remainingEntries, movedItem].sort((left, right) =>
				left.plannedAt.localeCompare(right.plannedAt),
			);
			return {
				...current,
				entries: nextEntries,
				backlog: remainingBacklog,
				platforms: rebuildPlatformCounts(
					current.platforms,
					nextEntries,
					remainingBacklog,
				),
			};
		});
	}

	function optimisticClearPlacement(variantId: string) {
		setCalendar((current) => {
			if (!current) {
				return current;
			}
			let moved: CalendarBacklogItem | null = null;
			const nextEntries = current.entries.filter((entry) => {
				if (entry.variantId !== variantId) {
					return true;
				}
				moved = {
					variantId: entry.variantId,
					postId: entry.postId,
					title: entry.title,
					platform: entry.platform,
					surface: entry.surface,
					planningState: "unscheduled",
					approvalState: entry.approvalState,
					publicationState: "unscheduled",
					requiresApproval: entry.requiresApproval,
					finalizable: false,
					readiness: entry.readiness,
					excerpt: entry.excerpt,
					assetCount: entry.assetCount,
					notes: entry.notes,
					contentKind: entry.contentKind,
					createdAt: entry.createdAt,
					updatedAt: new Date().toISOString(),
				};
				return false;
			});
			if (!moved) {
				return current;
			}
			const movedItem = moved as CalendarBacklogItem;
			return {
				...current,
				entries: nextEntries,
				backlog: [movedItem, ...current.backlog],
				platforms: rebuildPlatformCounts(current.platforms, nextEntries, [
					movedItem,
					...current.backlog,
				]),
			};
		});
	}

	async function reloadCalendar() {
		const params = new URLSearchParams({
			start: currentRange.start.toISOString(),
			end: currentRange.end.toISOString(),
			timezone,
		});
		if (selectedPlatforms.length > 0) {
			params.set("platform", selectedPlatforms.join(","));
		}
		const response = await customerRequest<CalendarResponse>(
			`/calendar?${params.toString()}`,
		);
		setCalendar(response);
		setPanelState((current) => {
			if (current.mode !== "entry" && current.mode !== "backlog") {
				return current;
			}
			const nextEntry =
				response.entries.find(
					(item) => item.variantId === current.item.variantId,
				) ?? null;
			if (nextEntry) {
				return { mode: "entry", item: nextEntry };
			}
			const nextBacklog =
				response.backlog.find(
					(item) => item.variantId === current.item.variantId,
				) ?? null;
			if (nextBacklog) {
				return { mode: "backlog", item: nextBacklog };
			}
			return { mode: "closed" };
		});
		return response;
	}

	async function handleScheduleVariant(variantId: string, plannedAt: string) {
		optimisticPlaceVariant(variantId, plannedAt, "scheduled");
		try {
			await customerRequest(
				`/posts/variants/${variantId}/publication/schedule`,
				{
					method: "POST",
					body: { plannedAt, source: "manual" },
				},
			);
			await reloadCalendar();
		} catch (scheduleError) {
			await reloadCalendar();
			toast.error(
				scheduleError instanceof Error
					? scheduleError.message
					: "Unable to schedule this variant.",
			);
		}
	}

	async function handleTentativePlacement(
		variantId: string,
		plannedAt: string,
	) {
		optimisticPlaceVariant(variantId, plannedAt, "tentative");
		try {
			await customerRequest(`/posts/variants/${variantId}/planning`, {
				method: "POST",
				body: { plannedAt, source: "manual" },
			});
			await reloadCalendar();
		} catch (planningError) {
			await reloadCalendar();
			toast.error(
				planningError instanceof Error
					? planningError.message
					: "Unable to place this tentative slot.",
			);
		}
	}

	async function handleClearPlacement(
		variantId: string,
		planningState:
			| CalendarEntry["planningState"]
			| CalendarBacklogItem["planningState"],
	) {
		optimisticClearPlacement(variantId);
		try {
			if (planningState === "tentative") {
				await customerRequest(`/posts/variants/${variantId}/planning`, {
					method: "DELETE",
				});
			} else {
				await customerRequest(
					`/posts/variants/${variantId}/publication/unschedule`,
					{ method: "POST" },
				);
			}
			await reloadCalendar();
		} catch (scheduleError) {
			await reloadCalendar();
			toast.error(
				scheduleError instanceof Error
					? scheduleError.message
					: "Unable to clear this planned slot.",
			);
		} finally {
			clearDragState();
		}
	}

	async function handleWeekDrop(
		targetPlatform: string,
		day: Date,
		event: React.DragEvent,
	) {
		event.preventDefault();
		const payload = readDragPayload(event);
		if (!payload) {
			clearDragState();
			return;
		}
		if (payload.platform !== targetPlatform) {
			setActiveDropTarget({
				kind: "week",
				platform: targetPlatform,
				dateKey: startOfDay(day).toISOString(),
				valid: false,
			});
			toast.error("Move content inside the matching platform lane.");
			return;
		}
		const hourSource = payload.plannedAt ? parseIso(payload.plannedAt) : null;
		const nextDate = new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			hourSource?.getHours() ?? 9,
			hourSource?.getMinutes() ?? 0,
			0,
			0,
		);
		const item = findCalendarItem(payload.variantId);
		const shouldUseTentative =
			payload.planningState === "tentative" ||
			(item ? item.readiness.scheduleBlockers.length > 0 : false);
		if (shouldUseTentative) {
			await handleTentativePlacement(payload.variantId, nextDate.toISOString());
		} else {
			await handleScheduleVariant(payload.variantId, nextDate.toISOString());
		}
		clearDragState();
	}

	async function handleTimelineDrop(
		targetPlatform: string,
		day: Date,
		hour: number,
		event: React.DragEvent,
	) {
		event.preventDefault();
		const payload = readDragPayload(event);
		if (!payload) {
			clearDragState();
			return;
		}
		if (payload.platform !== targetPlatform) {
			setActiveDropTarget({
				kind: "timeline",
				platform: targetPlatform,
				hour,
				valid: false,
			});
			toast.error("Move content inside the matching platform lane.");
			return;
		}
		const minuteSource = payload.plannedAt ? parseIso(payload.plannedAt) : null;
		const nextDate = new Date(
			day.getFullYear(),
			day.getMonth(),
			day.getDate(),
			hour,
			minuteSource?.getMinutes() ?? 0,
			0,
			0,
		);
		const item = findCalendarItem(payload.variantId);
		const shouldUseTentative =
			payload.planningState === "tentative" ||
			(item ? item.readiness.scheduleBlockers.length > 0 : false);
		if (shouldUseTentative) {
			await handleTentativePlacement(payload.variantId, nextDate.toISOString());
		} else {
			await handleScheduleVariant(payload.variantId, nextDate.toISOString());
		}
		clearDragState();
	}

	async function saveExistingItem() {
		if (panelState.mode !== "entry" && panelState.mode !== "backlog") {
			return;
		}
		const variant = findVariant(selectedPost, panelState.item.variantId);
		if (!selectedPost || !variant) {
			setPanelError("The selected calendar item is no longer available.");
			return;
		}

		setSaving(true);
		setPanelError(null);
		try {
			const editableKind =
				(variant.contentMode === "custom" && variant.contentKind) ||
				selectedPost.contentKind;
			if (
				selectedPost.title !== panelDraft.title ||
				selectedPost.requiresApproval !== panelDraft.requiresApproval ||
				(variant.contentMode !== "custom" &&
					editableKind !== "thread" &&
					panelDraft.excerpt !==
						contentPayloadText(
							selectedPost.contentKind,
							selectedPost.contentPayload,
						))
			) {
				await customerRequest<PostDetail>(`/posts/${selectedPost.id}`, {
					method: "PATCH",
					body: {
						title: panelDraft.title,
						contentKind: selectedPost.contentKind,
						contentPayload:
							editableKind === "thread"
								? selectedPost.contentPayload
								: applyContentPayloadText(
										selectedPost.contentKind,
										selectedPost.contentPayload,
										panelDraft.excerpt,
									),
						originPlatform: selectedPost.originPlatform ?? "",
						originSurface: selectedPost.originSurface ?? "",
						requiresApproval: panelDraft.requiresApproval,
						notes: selectedPost.notes ?? "",
					},
				});
			}

			const nextVariantPayload =
				variant.contentMode === "custom" && editableKind !== "thread"
					? applyContentPayloadText(
							(editableKind ?? "text") as PostDetail["contentKind"],
							(variant.contentPayload ?? {}) as Record<string, unknown>,
							panelDraft.excerpt,
						)
					: (variant.contentPayload ?? {});

			await customerRequest<PostVariant>(`/posts/variants/${variant.id}`, {
				method: "PATCH",
				body: {
					platform: variant.platform,
					surface: variant.surface,
					inheritSource: variant.inheritSource,
					contentMode: variant.contentMode,
					contentKind: variant.contentKind ?? "",
					contentPayload: nextVariantPayload,
					assetMode: variant.assetMode,
					notes: panelDraft.notes,
				},
			});

			const refreshedVariant = await customerRequest<PostVariant>(
				`/posts/variants/${variant.id}`,
			);
			const nextPlannedAt = toIsoValue(panelDraft.plannedLocal);
			if (nextPlannedAt) {
				const shouldUseTentative =
					Boolean(refreshedVariant.latestTentativePlan) ||
					refreshedVariant.readiness.scheduleBlockers.length > 0;
				await customerRequest(
					shouldUseTentative
						? `/posts/variants/${variant.id}/planning`
						: `/posts/variants/${variant.id}/publication/schedule`,
					{
						method: "POST",
						body: { plannedAt: nextPlannedAt, source: "manual" },
					},
				);
			} else if (panelState.mode === "entry") {
				if (
					panelState.item.planningState === "tentative" ||
					refreshedVariant.latestTentativePlan
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

			await reloadCalendar();
			refreshPostSelection(selectedPost.id);
			toast.success("Calendar item updated.");
		} catch (saveError) {
			setPanelError(
				saveError instanceof Error
					? saveError.message
					: "Unable to save this calendar item.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function createDraftFromPanel() {
		if (
			!panelDraft.title.trim() ||
			!panelDraft.platform ||
			!panelDraft.surface
		) {
			setPanelError(
				"Add a title, platform, and surface before creating a draft.",
			);
			return;
		}

		setSaving(true);
		setPanelError(null);
		try {
			const createdPost = await customerRequest<PostDetail>("/posts", {
				method: "POST",
				body: {
					title: panelDraft.title,
					contentKind: "text",
					contentPayload: { body: panelDraft.excerpt },
					originPlatform: panelDraft.platform,
					originSurface: panelDraft.surface,
					requiresApproval: panelDraft.requiresApproval,
					notes: "",
				},
			});
			const createdVariant = await customerRequest<PostVariant>(
				`/posts/${createdPost.id}/variants`,
				{
					method: "POST",
					body: {
						platform: panelDraft.platform,
						surface: panelDraft.surface,
						inheritSource: "shared",
						contentMode: panelDraft.contentMode,
						contentKind: panelDraft.contentMode === "custom" ? "text" : "",
						contentPayload:
							panelDraft.contentMode === "custom"
								? { body: panelDraft.excerpt }
								: {},
						assetMode: panelDraft.assetMode,
						notes: panelDraft.notes,
					},
				},
			);
			await customerRequest(`/posts/variants/${createdVariant.id}/assets`, {
				method: "PUT",
				body: {
					resourceIds: panelDraft.assetIds,
					assetMode: panelDraft.assetMode,
					removedInheritedResourceIds: [],
				},
			});
			if (panelDraft.reviewIntent === "submit") {
				try {
					await customerRequest(
						`/posts/variants/${createdVariant.id}/reviews/submit`,
						{
							method: "POST",
							body: { comment: "" },
						},
					);
				} catch (reviewError) {
					toast.error(
						reviewError instanceof Error
							? `${reviewError.message} The draft was created but stayed in draft review state.`
							: "The draft was created, but it could not be submitted for review.",
					);
				}
			} else if (panelDraft.reviewIntent === "approved") {
				try {
					await customerRequest(
						`/posts/variants/${createdVariant.id}/reviews/decision`,
						{
							method: "POST",
							body: { approvalState: "approved", comment: "" },
						},
					);
				} catch (reviewError) {
					toast.error(
						reviewError instanceof Error
							? `${reviewError.message} The draft was created but stayed in draft review state.`
							: "The draft was created, but it could not be approved yet.",
					);
				}
			}

			const plannedAt = toIsoValue(panelDraft.plannedLocal);
			if (plannedAt) {
				try {
					await customerRequest(
						createdVariant.readiness.scheduleBlockers.length > 0
							? `/posts/variants/${createdVariant.id}/planning`
							: `/posts/variants/${createdVariant.id}/publication/schedule`,
						{
							method: "POST",
							body: {
								plannedAt,
								source: "manual",
							},
						},
					);
				} catch (scheduleError) {
					toast.error(
						scheduleError instanceof Error
							? `${scheduleError.message} The draft stayed in backlog.`
							: "The draft was created but could not be placed on the calendar.",
					);
				}
			}

			await reloadCalendar();
			closePanel();
			toast.success("Draft added to the calendar.");
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

	async function syncVariantAssets(
		nextAssetMode: PostVariant["assetMode"],
		resourceIds: string[],
		removedInheritedResourceIds: string[],
	) {
		if (!currentVariant || !selectedPost) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await customerRequest<PostVariant>(
				`/posts/variants/${currentVariant.id}/assets`,
				{
					method: "PUT",
					body: {
						resourceIds,
						assetMode: nextAssetMode,
						removedInheritedResourceIds,
					},
				},
			);
			await reloadCalendar();
			refreshPostSelection(selectedPost.id);
			toast.success("Assets updated.");
		} catch (assetError) {
			setPanelError(
				assetError instanceof Error
					? assetError.message
					: "Unable to update assets from the calendar.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function finalizeTentativeSlot() {
		if (
			panelState.mode !== "entry" ||
			panelState.item.planningState !== "tentative"
		) {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			await customerRequest(
				`/posts/variants/${panelState.item.variantId}/planning/finalize`,
				{
					method: "POST",
				},
			);
			await reloadCalendar();
			refreshPostSelection(panelState.item.postId);
			toast.success("Tentative slot finalized.");
		} catch (finalizeError) {
			setPanelError(
				finalizeError instanceof Error
					? finalizeError.message
					: "Unable to finalize this tentative slot.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function runReviewAction(
		action: "submit" | "approved" | "changes_requested",
	) {
		if (panelState.mode !== "entry" && panelState.mode !== "backlog") {
			return;
		}
		setSaving(true);
		setPanelError(null);
		try {
			if (action === "submit") {
				await customerRequest(
					`/posts/variants/${panelState.item.variantId}/reviews/submit`,
					{
						method: "POST",
						body: { comment: "" },
					},
				);
			} else {
				await customerRequest(
					`/posts/variants/${panelState.item.variantId}/reviews/decision`,
					{
						method: "POST",
						body: { approvalState: action, comment: "" },
					},
				);
			}
			await reloadCalendar();
			refreshPostSelection(panelState.item.postId);
		} catch (reviewError) {
			setPanelError(
				reviewError instanceof Error
					? reviewError.message
					: "Unable to update the review state.",
			);
		} finally {
			setSaving(false);
		}
	}

	const currentVariant =
		panelState.mode === "entry" || panelState.mode === "backlog"
			? findVariant(selectedPost, panelState.item.variantId)
			: null;
	const inheritedAssets = useMemo(
		() => resolveInheritedAssets(selectedPost, currentVariant),
		[selectedPost, currentVariant],
	);
	const variantSpecificAssets = useMemo(
		() => currentVariant?.assets ?? [],
		[currentVariant],
	);
	const panelDraftAssets = useMemo(
		() => resourceRecordsForIds(resources, panelDraft.assetIds),
		[panelDraft.assetIds, resources],
	);
	const surfaceOptions = surfaceOptionsForPlatform(
		capabilities,
		panelDraft.platform,
	);
	const panelOpen = panelState.mode !== "closed";
	const weekGridStyle = useMemo(
		() => ({
			gridTemplateColumns: `${WEEK_PLATFORM_COLUMN_WIDTH}px repeat(${currentWeek.length}, minmax(${WEEK_DAY_COLUMN_MIN_WIDTH}px, 1fr))`,
			minWidth: `${WEEK_PLATFORM_COLUMN_WIDTH + currentWeek.length * WEEK_DAY_COLUMN_MIN_WIDTH}px`,
		}),
		[currentWeek.length],
	);
	const rangeLabel =
		view === "month"
			? formatMonthLabel(anchorDate)
			: view === "timeline"
				? anchorDate.toLocaleDateString(undefined, {
						weekday: "long",
						month: "long",
						day: "numeric",
						year: "numeric",
					})
				: `${formatDayHeader(currentWeek[0])} - ${formatDayHeader(
						currentWeek.at(-1) ?? currentWeek[0],
					)}`;

	return (
		<div className="space-y-6">
			<SurfaceCard className="rounded-[32px] border border-[var(--brand-border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.7))] p-4 sm:p-5 lg:p-6">
				<div className="space-y-5">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
						<div className="space-y-4">
							<div className="space-y-2">
								<div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
									Publishing control
								</div>
								<div className="space-y-2">
									<h1 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">
										Content calendar
									</h1>
									<p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
										See this week’s content coverage by platform, drag work into
										better slots, spot open gaps, and jump straight into the
										right draft from one planning surface.
									</p>
								</div>
							</div>
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
								<PlanningStatChip
									label="On calendar"
									value={String(filteredEntries.length)}
									detail="Scheduled plus tentative slots"
									icon={CalendarRange}
								/>
								<PlanningStatChip
									label="Open gaps"
									value={String(gapCount)}
									detail="Empty platform-day cells"
									icon={AlertTriangle}
								/>
								<PlanningStatChip
									label="Backlog"
									value={String(filteredBacklog.length)}
									detail="Unscheduled variants"
									icon={Clock3}
								/>
								<PlanningStatChip
									label="Unfinalized"
									value={String(unfinalizedCount)}
									detail="Tentative slots still blocked"
									icon={AlertTriangle}
								/>
								<PlanningStatChip
									label="Blocked"
									value={String(blockedCount)}
									detail="Needs an unblock first"
									icon={XCircle}
								/>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-3 xl:justify-end">
							<Button
								variant="outline"
								className="rounded-full bg-background/80"
								onClick={() => {
									startTransition(() => setAnchorDate(startOfDay(new Date())));
								}}
							>
								<CalendarDays className="size-4" />
								Today
							</Button>
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white shadow-[0_18px_40px_-26px_rgba(168,107,76,0.9)]"
								onClick={() => setPanelState({ mode: "new", date: new Date() })}
							>
								<FilePlus2 className="size-4" />
								New draft
							</Button>
						</div>
					</div>

					<div className="space-y-4 rounded-[28px] border border-[var(--brand-border-soft)] bg-background/70 p-4 shadow-[0_22px_44px_-36px_rgba(15,23,42,0.56)]">
						<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
							<div className="flex flex-wrap items-center gap-3">
								<Button
									variant="outline"
									size="icon-sm"
									className="rounded-full bg-background/80"
									onClick={() =>
										startTransition(() =>
											setAnchorDate((current) =>
												view === "month"
													? addMonths(current, -1)
													: view === "timeline"
														? addDays(current, -1)
														: addWeeks(current, -1),
											),
										)
									}
								>
									<ChevronLeft className="size-4" />
								</Button>
								<div className="min-w-[15rem] rounded-[22px] border border-[var(--brand-border-soft)] bg-background/86 px-4 py-3 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
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
												view === "month"
													? addMonths(current, 1)
													: view === "timeline"
														? addDays(current, 1)
														: addWeeks(current, 1),
											),
										)
									}
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>

							<div className="xl:flex-[0_0_auto]">
								<Tabs
									value={view}
									onValueChange={(value) =>
										startTransition(() => setView(value as CalendarView))
									}
								>
									<TabsList
										variant="default"
										className="!h-auto min-h-[4rem] w-full flex-wrap items-stretch justify-start gap-2 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-2 sm:w-auto xl:flex-nowrap"
									>
										<TabsTrigger
											value="week"
											className="h-auto min-h-10 flex-none self-stretch rounded-[16px] border border-transparent px-3 py-2 data-active:border-[var(--brand-border-soft)] data-active:bg-background/90"
										>
											<CalendarRange className="size-4" />
											Week board
										</TabsTrigger>
										<TabsTrigger
											value="month"
											className="h-auto min-h-10 flex-none self-stretch rounded-[16px] border border-transparent px-3 py-2 data-active:border-[var(--brand-border-soft)] data-active:bg-background/90"
										>
											<CalendarDays className="size-4" />
											Month overview
										</TabsTrigger>
										<TabsTrigger
											value="timeline"
											className="h-auto min-h-10 flex-none self-stretch rounded-[16px] border border-transparent px-3 py-2 data-active:border-[var(--brand-border-soft)] data-active:bg-background/90"
										>
											<Clock3 className="size-4" />
											Timeline
										</TabsTrigger>
									</TabsList>
								</Tabs>
							</div>
						</div>

						<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
							<div className="min-w-0 xl:flex-1">
								<div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
									<Button
										variant="outline"
										title="Show all platforms"
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
										<span className="inline-flex size-6 items-center justify-center rounded-full border border-current/10 bg-current/10">
											<Globe2 className="size-3.5" />
										</span>
										<span className="font-medium">All</span>
										{selectedPlatforms.length === 0 ? (
											<span className="text-[11px] opacity-75">
												{lanes.reduce(
													(total, lane) =>
														total + lane.scheduledCount + lane.backlogCount,
													0,
												)}
											</span>
										) : null}
									</Button>
									{lanes.map((lane) => {
										const meta = getPlatformMeta(lane.platform);
										const selected = selectedPlatforms.includes(lane.platform);
										return (
											<Button
												key={lane.platform}
												ref={(element) => {
													platformPillRefs.current[lane.platform] = element;
												}}
												variant="outline"
												title={lane.label}
												className={cn(
													"shrink-0 rounded-full border px-2 py-2 shadow-none transition duration-200",
													dragPlatform &&
														dragPlatform !== lane.platform &&
														"opacity-60",
												)}
												style={{
													borderColor: selected
														? withAlpha(meta?.color ?? "#64748B", 0.3)
														: withAlpha(meta?.color ?? "#64748B", 0.16),
													backgroundColor: selected
														? withAlpha(meta?.color ?? "#64748B", 0.14)
														: withAlpha(meta?.color ?? "#64748B", 0.06),
													color: selected ? meta?.color : undefined,
													boxShadow: selected
														? `inset 0 0 0 1px ${withAlpha(
																meta?.color ?? "#64748B",
																0.28,
															)}`
														: undefined,
												}}
												onClick={() =>
													startTransition(() =>
														setSelectedPlatforms((current) =>
															current.includes(lane.platform)
																? current.filter(
																		(item) => item !== lane.platform,
																	)
																: [...current, lane.platform],
														),
													)
												}
											>
												{platformIcon(lane.platform, {
													containerClassName: "size-6",
													iconClassName: "size-3.5",
													backgroundAlpha: selected ? 0.16 : 0.08,
													borderAlpha: selected ? 0.24 : 0.14,
												})}
												<span
													className={cn(
														"text-sm font-medium",
														selected ? "inline" : "sr-only",
													)}
												>
													{lane.label}
												</span>
												{selected ? (
													<span className="text-[11px] opacity-75">
														{lane.scheduledCount}/{lane.backlogCount}
													</span>
												) : null}
											</Button>
										);
									})}
								</div>
							</div>

							<div className="xl:flex-[0_0_auto]">
								<div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/72 p-2 xl:flex-nowrap">
									<div className="relative min-w-[12rem] flex-1 xl:w-[14rem] xl:flex-none">
										<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											id="calendar-search"
											name="calendar-search"
											aria-label="Search calendar content"
											value={search}
											onChange={(event) =>
												startTransition(() => setSearch(event.target.value))
											}
											placeholder="Search titles, captions..."
											className="h-10 rounded-full border-[var(--brand-border-soft)] bg-background/88 pl-10"
										/>
									</div>
									<Select
										value={statusFilter}
										onValueChange={(value) =>
											startTransition(() =>
												setStatusFilter(value as CalendarStatusFilter),
											)
										}
									>
										<SelectTrigger
											id="calendar-status-filter"
											aria-label="Filter calendar by status"
											className="h-10 rounded-full border-[var(--brand-border-soft)] bg-background/88 px-3.5 xl:w-[8rem]"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All states</SelectItem>
											<SelectItem value="ready">Ready</SelectItem>
											<SelectItem value="blocked">Blocked</SelectItem>
											<SelectItem value="in_review">In review</SelectItem>
											<SelectItem value="tentative">Tentative</SelectItem>
											<SelectItem value="approval_blocked">
												Approval blocked
											</SelectItem>
											<SelectItem value="asset_blocked">
												Asset blocked
											</SelectItem>
											<SelectItem value="ready_to_finalize">
												Ready to finalize
											</SelectItem>
										</SelectContent>
									</Select>
									<div className="flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background/88 px-3 py-2 text-sm">
										<Switch
											id="calendar-show-gaps"
											aria-label="Show gaps only"
											checked={showGapsOnly}
											onCheckedChange={setShowGapsOnly}
											size="sm"
										/>
										<Label htmlFor="calendar-show-gaps">Show gaps</Label>
									</div>
								</div>
							</div>
						</div>
					</div>
					{loading ? (
						<div className="flex min-h-[24rem] items-center justify-center rounded-[28px] border border-[var(--brand-border-soft)] bg-background/45">
							<div className="flex items-center gap-3 text-sm text-muted-foreground">
								<LoaderCircle className="size-4 animate-spin" />
								Loading content calendar...
							</div>
						</div>
					) : error ? (
						<div className="rounded-[24px] border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-200">
							{error}
						</div>
					) : (
						<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
							<div className="space-y-4">
								{view === "week" ? (
									<div
										ref={weekScrollRef}
										className="no-scrollbar overflow-x-auto rounded-[28px] border border-[var(--brand-border-soft)] bg-background/55"
									>
										<div
											className="grid gap-px bg-[var(--brand-border-soft)]"
											style={weekGridStyle}
										>
											<div className="sticky left-0 z-30 bg-background/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur-sm">
												Platforms
											</div>
											{currentWeek.map((day) => (
												<div
													key={day.toISOString()}
													className={cn(
														"select-none bg-background/80 px-4 py-3 text-sm [touch-action:pan-y]",
														isWeekHeaderDragging
															? "cursor-grabbing"
															: "cursor-grab",
													)}
													onPointerDown={handleWeekHeaderPointerDown}
													onPointerMove={handleWeekHeaderPointerMove}
													onPointerUp={handleWeekHeaderPointerUp}
													onPointerCancel={handleWeekHeaderPointerUp}
													onLostPointerCapture={endWeekHeaderDrag}
												>
													<div className="font-medium">
														{formatDayHeader(day)}
													</div>
													<div className="text-xs text-muted-foreground">
														{isSameDay(day, today) ? "Today" : " "}
													</div>
												</div>
											))}

											{lanes.map((lane) => {
												const chrome = laneChrome(lane.platform);
												const laneDimmed =
													Boolean(dragPlatform) &&
													dragPlatform !== lane.platform;
												const laneEmphasized =
													highlightedLane === lane.platform ||
													dragPlatform === lane.platform;
												const coveredDays = currentWeek.reduce(
													(count, day) =>
														count +
														((entriesByLaneDay.get(
															`${lane.platform}:${startOfDay(day).toISOString()}`,
														)?.length ?? 0) > 0
															? 1
															: 0),
													0,
												);
												const coverage = coverageMeta(
													coveredDays,
													currentWeek.length,
												);
												return (
													<div key={lane.platform} className="contents">
														<div
															ref={(element) => {
																weekLaneRefs.current[lane.platform] = element;
															}}
															className={cn(
																"sticky left-0 z-20 px-4 py-4 transition duration-200",
																laneEmphasized &&
																	"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.58)]",
															)}
															style={{
																background: chrome.headerBackground,
																boxShadow: laneEmphasized
																	? `inset -1px 0 0 ${withAlpha(chrome.textColor === "inherit" ? "#64748B" : chrome.textColor, 0.18)}`
																	: "inset -1px 0 0 rgba(148,163,184,0.16)",
																opacity: laneDimmed ? 0.52 : 1,
																transform:
																	laneEmphasized && !prefersReducedMotion
																		? "translateX(2px)"
																		: undefined,
															}}
														>
															<div className="flex items-center gap-3">
																{platformIcon(lane.platform)}
																<div>
																	<div
																		className="font-medium"
																		style={{ color: chrome.textColor }}
																	>
																		{lane.label}
																	</div>
																	<div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
																		<span
																			className={cn(
																				"rounded-full border px-2 py-1 font-medium",
																				coverage.className,
																			)}
																		>
																			{coverage.label}
																		</span>
																		<span className="text-muted-foreground">
																			{lane.backlogCount} backlog
																		</span>
																	</div>
																</div>
															</div>
														</div>
														{currentWeek.map((day) => {
															const dateKey = startOfDay(day).toISOString();
															const key = `${lane.platform}:${dateKey}`;
															const cellEntries =
																entriesByLaneDay.get(key) ?? [];
															const isGap = cellEntries.length === 0;
															const activeWeekTarget =
																activeDropTarget?.kind === "week" &&
																activeDropTarget.platform === lane.platform &&
																activeDropTarget.dateKey === dateKey
																	? activeDropTarget
																	: null;
															return (
																<div
																	key={`${lane.platform}-${day.toISOString()}`}
																	onDragOver={(event) => event.preventDefault()}
																	onDragEnter={(event) =>
																		setWeekHoverState(lane.platform, day, event)
																	}
																	onDragLeave={() =>
																		setActiveDropTarget((current) =>
																			current?.kind === "week" &&
																			current.platform === lane.platform &&
																			current.dateKey === dateKey
																				? null
																				: current,
																		)
																	}
																	onDrop={(event) =>
																		void handleWeekDrop(
																			lane.platform,
																			day,
																			event,
																		)
																	}
																	className={cn(
																		"min-h-40 p-3 align-top transition duration-200",
																		laneDimmed && "opacity-60",
																	)}
																	style={{
																		background: activeWeekTarget?.valid
																			? `linear-gradient(180deg, ${withAlpha(
																					chrome.textColor === "inherit"
																						? "#64748B"
																						: chrome.textColor,
																					0.18,
																				)}, ${chrome.softBackground})`
																			: activeWeekTarget &&
																					!activeWeekTarget.valid
																				? "linear-gradient(180deg, rgba(239,68,68,0.16), rgba(239,68,68,0.04))"
																				: isGap
																					? chrome.bodyBackground
																					: "rgba(255,255,255,0.62)",
																		boxShadow: activeWeekTarget?.valid
																			? `inset 0 0 0 1px ${chrome.borderColor}`
																			: activeWeekTarget &&
																					!activeWeekTarget.valid
																				? "inset 0 0 0 1px rgba(239,68,68,0.28)"
																				: undefined,
																	}}
																>
																	<div className="flex min-h-full flex-col gap-2">
																		{isGap ? (
																			<button
																				type="button"
																				aria-label={`Add or place ${lane.label} content on ${formatDayHeader(day)}`}
																				onClick={() =>
																					setPanelState({
																						mode: "gap",
																						platform: lane.platform,
																						date: day,
																					})
																				}
																				className="flex min-h-28 flex-1 items-center justify-center rounded-[20px] border border-dashed px-3 py-4 text-center text-sm text-muted-foreground transition duration-200 hover:border-foreground/20 hover:text-foreground"
																				style={{
																					borderColor: activeWeekTarget?.valid
																						? chrome.borderColor
																						: activeWeekTarget &&
																								!activeWeekTarget.valid
																							? "rgba(239,68,68,0.32)"
																							: chrome.borderColor,
																					backgroundColor:
																						activeWeekTarget?.valid
																							? chrome.highlightBackground
																							: withAlpha(
																									chrome.textColor === "inherit"
																										? "#64748B"
																										: chrome.textColor,
																									0.04,
																								),
																				}}
																			>
																				<span
																					className={cn(
																						"inline-flex size-9 items-center justify-center rounded-full border border-dashed transition duration-200",
																						activeWeekTarget?.valid
																							? "scale-105 bg-background/85"
																							: activeWeekTarget &&
																									!activeWeekTarget.valid
																								? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-200"
																								: "bg-background/72",
																					)}
																				>
																					<Plus className="size-4" />
																				</span>
																				<span className="sr-only">
																					{activeWeekTarget?.valid
																						? "Drop to place content here"
																						: activeWeekTarget &&
																								!activeWeekTarget.valid
																							? "This slot only accepts the matching platform"
																							: "Add or drag content into this lane"}
																				</span>
																			</button>
																		) : showGapsOnly ? (
																			<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-3 py-2 text-xs text-muted-foreground">
																				Covered by {cellEntries.length} item
																				{cellEntries.length === 1 ? "" : "s"}
																			</div>
																		) : (
																			<>
																				{cellEntries
																					.slice(0, WEEK_VISIBLE_STACK_COUNT)
																					.map((item) => (
																						<CalendarCard
																							key={item.variantId}
																							card={{ kind: "entry", item }}
																							displayMode="week"
																							stretch={cellEntries.length === 1}
																							onDragStart={beginDrag}
																							onDragEnd={clearDragState}
																							onClick={() =>
																								setPanelState({
																									mode: "entry",
																									item,
																								})
																							}
																						/>
																					))}
																				{cellEntries.length >
																				WEEK_VISIBLE_STACK_COUNT ? (
																					<button
																						type="button"
																						className="rounded-[16px] border border-[var(--brand-border-soft)] bg-background/86 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition duration-200 hover:text-foreground"
																						onClick={() =>
																							setPanelState({
																								mode: "entry",
																								item: cellEntries[
																									WEEK_VISIBLE_STACK_COUNT
																								],
																							})
																						}
																					>
																						+
																						{cellEntries.length -
																							WEEK_VISIBLE_STACK_COUNT}{" "}
																						more
																					</button>
																				) : null}
																			</>
																		)}
																	</div>
																</div>
															);
														})}
													</div>
												);
											})}
										</div>
									</div>
								) : null}
								{view === "month" ? (
									<div className="overflow-hidden rounded-[28px] border border-[var(--brand-border-soft)] bg-background/55">
										<div className="grid grid-cols-7 gap-px bg-[var(--brand-border-soft)]">
											{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
												(label) => (
													<div
														key={label}
														className="bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
													>
														{label}
													</div>
												),
											)}
											{currentMonthDays.map((day) => {
												const items =
													dayCounts.get(startOfDay(day).toISOString()) ?? [];
												const visiblePlatforms = Array.from(
													new Set(items.map((item) => item.platform)),
												).slice(0, 3);
												return (
													<button
														key={day.toISOString()}
														type="button"
														className={cn(
															"min-h-32 bg-background/60 px-3 py-3 text-left transition hover:bg-background/85",
															day.getMonth() !== anchorDate.getMonth() &&
																"text-muted-foreground/55",
															isSameDay(day, today) &&
																"bg-[color-mix(in_srgb,var(--brand-highlight)_14%,transparent)]",
														)}
														onClick={() => {
															startTransition(() => {
																setAnchorDate(day);
																setView("week");
															});
														}}
													>
														<div className="flex items-center justify-between">
															<div className="text-sm font-medium">
																{day.getDate()}
															</div>
															<div className="text-xs text-muted-foreground">
																{items.length} item
																{items.length === 1 ? "" : "s"}
															</div>
														</div>
														<div className="mt-3 space-y-2">
															{items.slice(0, 2).map((item) => (
																<div
																	key={item.variantId}
																	className="rounded-[16px] border border-[var(--brand-border-soft)] bg-background/82 px-2.5 py-2 text-xs"
																	style={{
																		boxShadow: `inset 0 1px 0 ${withAlpha(
																			getPlatformMeta(item.platform)?.color ??
																				"#64748B",
																			item.planningState === "tentative"
																				? 0.22
																				: 0.12,
																		)}`,
																		backgroundColor:
																			item.planningState === "tentative"
																				? "rgba(251,191,36,0.08)"
																				: undefined,
																	}}
																>
																	<div className="truncate font-medium">
																		{item.title}
																	</div>
																	<div className="mt-1 text-muted-foreground">
																		{item.planningState === "tentative"
																			? `Tentative ${formatTimeLabel(item.plannedAt)}`
																			: formatTimeLabel(item.plannedAt)}
																	</div>
																</div>
															))}
															{items.length === 0 ? (
																<div className="rounded-[16px] border border-dashed border-[var(--brand-border-soft)] px-2.5 py-2 text-xs text-muted-foreground">
																	No scheduled content
																</div>
															) : null}
															{visiblePlatforms.length > 0 ? (
																<div className="flex flex-wrap gap-1">
																	{visiblePlatforms.map((platform) => {
																		const meta = getPlatformMeta(platform);
																		return (
																			<Badge
																				key={platform}
																				variant="secondary"
																				className="rounded-full border bg-background/85 px-2 py-1 text-[10px] font-medium"
																				style={{
																					borderColor: withAlpha(
																						meta?.color ?? "#64748B",
																						0.18,
																					),
																					backgroundColor: withAlpha(
																						meta?.color ?? "#64748B",
																						0.08,
																					),
																					color: meta?.color,
																				}}
																			>
																				{platformIcon(platform, {
																					containerClassName:
																						"mr-1 size-4 border-0 bg-transparent",
																					iconClassName: "size-3",
																					backgroundAlpha: 0,
																					borderAlpha: 0,
																				})}
																				{formatPlatformLabel(platform)}
																			</Badge>
																		);
																	})}
																</div>
															) : null}
														</div>
													</button>
												);
											})}
										</div>
									</div>
								) : null}

								{view === "timeline" ? (
									<div className="space-y-4">
										{lanes.map((lane) => {
											const chrome = laneChrome(lane.platform);
											const laneDimmed =
												Boolean(dragPlatform) && dragPlatform !== lane.platform;
											const laneEmphasized =
												highlightedLane === lane.platform ||
												dragPlatform === lane.platform;
											return (
												<div
													key={lane.platform}
													ref={(element) => {
														timelineLaneRefs.current[lane.platform] = element;
													}}
												>
													<SurfaceCard
														tone="muted"
														className={cn(
															"overflow-hidden p-0 transition duration-200",
															laneDimmed && "opacity-60",
														)}
														style={{
															boxShadow: laneEmphasized
																? `0 22px 44px -38px ${withAlpha(
																		chrome.textColor === "inherit"
																			? "#64748B"
																			: chrome.textColor,
																		0.62,
																	)}`
																: undefined,
														}}
													>
														<div
															className="border-b px-4 py-4"
															style={{
																borderColor: chrome.borderColor,
																background: chrome.headerBackground,
															}}
														>
															<div className="flex items-center justify-between gap-3">
																<div className="flex items-center gap-3">
																	{platformIcon(lane.platform)}
																	<div>
																		<div
																			className="font-medium"
																			style={{ color: chrome.textColor }}
																		>
																			{lane.label}
																		</div>
																		<div className="text-sm text-muted-foreground">
																			Drop onto an hour to set the precise
																			publish time.
																		</div>
																	</div>
																</div>
																<Badge
																	variant="outline"
																	className="rounded-full bg-background/80"
																	style={{ borderColor: chrome.borderColor }}
																>
																	{
																		(
																			entriesByLaneDay.get(
																				`${lane.platform}:${startOfDay(anchorDate).toISOString()}`,
																			) ?? []
																		).length
																	}{" "}
																	item(s)
																</Badge>
															</div>
														</div>
														<div className="grid gap-2 p-4">
															{TIMELINE_HOURS.map((hour) => {
																const items = (
																	entriesByLaneDay.get(
																		`${lane.platform}:${startOfDay(anchorDate).toISOString()}`,
																	) ?? []
																).filter(
																	(entry) =>
																		parseIso(entry.plannedAt)?.getHours() ===
																		hour,
																);
																const activeTimelineTarget =
																	activeDropTarget?.kind === "timeline" &&
																	activeDropTarget.platform === lane.platform &&
																	activeDropTarget.hour === hour
																		? activeDropTarget
																		: null;
																return (
																	<div
																		key={`${lane.platform}-${hour}`}
																		onDragOver={(event) =>
																			event.preventDefault()
																		}
																		onDragEnter={(event) =>
																			setTimelineHoverState(
																				lane.platform,
																				hour,
																				event,
																			)
																		}
																		onDragLeave={() =>
																			setActiveDropTarget((current) =>
																				current?.kind === "timeline" &&
																				current.platform === lane.platform &&
																				current.hour === hour
																					? null
																					: current,
																			)
																		}
																		onDrop={(event) =>
																			void handleTimelineDrop(
																				lane.platform,
																				anchorDate,
																				hour,
																				event,
																			)
																		}
																		className={cn(
																			"grid gap-3 rounded-[20px] border p-3 transition duration-200 md:grid-cols-[84px_minmax(0,1fr)]",
																			items.length === 0 && "border-dashed",
																		)}
																		style={{
																			borderColor: activeTimelineTarget?.valid
																				? chrome.borderColor
																				: activeTimelineTarget &&
																						!activeTimelineTarget.valid
																					? "rgba(239,68,68,0.28)"
																					: withAlpha(
																							chrome.textColor === "inherit"
																								? "#64748B"
																								: chrome.textColor,
																							items.length === 0 ? 0.22 : 0.16,
																						),
																			background: activeTimelineTarget?.valid
																				? `linear-gradient(180deg, ${chrome.highlightBackground}, rgba(255,255,255,0.74))`
																				: activeTimelineTarget &&
																						!activeTimelineTarget.valid
																					? "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(255,255,255,0.7))"
																					: `linear-gradient(180deg, ${chrome.softBackground}, rgba(255,255,255,0.7))`,
																		}}
																	>
																		<div
																			className="pt-1 text-sm font-medium"
																			style={{ color: chrome.textColor }}
																		>
																			{new Date(
																				anchorDate.getFullYear(),
																				anchorDate.getMonth(),
																				anchorDate.getDate(),
																				hour,
																			).toLocaleTimeString(undefined, {
																				hour: "numeric",
																				minute: "2-digit",
																			})}
																		</div>
																		<div className="flex min-h-16 flex-col gap-2">
																			{items.length === 0 ? (
																				<button
																					type="button"
																					className="flex min-h-16 items-center justify-center rounded-[16px] border border-dashed px-3 text-sm text-muted-foreground transition duration-200 hover:text-foreground"
																					style={{
																						borderColor:
																							activeTimelineTarget?.valid
																								? chrome.borderColor
																								: withAlpha(
																										chrome.textColor ===
																											"inherit"
																											? "#64748B"
																											: chrome.textColor,
																										0.18,
																									),
																						backgroundColor:
																							activeTimelineTarget?.valid
																								? chrome.highlightBackground
																								: "rgba(255,255,255,0.72)",
																					}}
																					onClick={() =>
																						setPanelState({
																							mode: "gap",
																							platform: lane.platform,
																							date: new Date(
																								anchorDate.getFullYear(),
																								anchorDate.getMonth(),
																								anchorDate.getDate(),
																								hour,
																								0,
																								0,
																								0,
																							),
																						})
																					}
																				>
																					<Plus className="mr-2 size-4" />
																					{activeTimelineTarget?.valid
																						? "Drop to place here"
																						: "Plan content here"}
																				</button>
																			) : (
																				items.map((item) => (
																					<CalendarCard
																						key={item.variantId}
																						card={{ kind: "entry", item }}
																						onDragStart={beginDrag}
																						onDragEnd={clearDragState}
																						onClick={() =>
																							setPanelState({
																								mode: "entry",
																								item,
																							})
																						}
																					/>
																				))
																			)}
																		</div>
																	</div>
																);
															})}
														</div>
													</SurfaceCard>
												</div>
											);
										})}
									</div>
								) : null}
							</div>
							<SurfaceCard className="space-y-4 p-4 xl:sticky xl:top-24 xl:self-start">
								<div className="flex items-start justify-between gap-3">
									<div>
										<div className="text-lg font-semibold">
											Unscheduled backlog
										</div>
										<div className="text-sm text-muted-foreground">
											Drag these variants into any gap or exact-time slot.
											Blocked drafts stay tentative until finalized.
										</div>
									</div>
									<Badge variant="outline" className="rounded-full">
										{filteredBacklog.length}
									</Badge>
								</div>
								<div
									onDragOver={(event) => event.preventDefault()}
									onDragEnter={setBacklogHoverState}
									onDragLeave={() =>
										setActiveDropTarget((current) =>
											current?.kind === "backlog" ? null : current,
										)
									}
									onDrop={(event) => {
										const payload = readDragPayload(event);
										if (!payload || payload.source !== "entry") {
											return;
										}
										void handleClearPlacement(
											payload.variantId,
											payload.planningState ?? "scheduled",
										);
									}}
									className="rounded-[20px] border border-dashed p-3 text-xs text-muted-foreground transition duration-200"
									style={{
										borderColor:
											activeDropTarget?.kind === "backlog" &&
											activeDropTarget.valid
												? withAlpha(
														getPlatformMeta(activeDropTarget.platform ?? "")
															?.color ?? "#64748B",
														0.28,
													)
												: "var(--brand-border-soft)",
										background:
											activeDropTarget?.kind === "backlog" &&
											activeDropTarget.valid
												? `linear-gradient(180deg, ${withAlpha(
														getPlatformMeta(activeDropTarget.platform ?? "")
															?.color ?? "#64748B",
														0.12,
													)}, rgba(255,255,255,0.6))`
												: "rgba(255,255,255,0.55)",
									}}
								>
									{activeDropTarget?.kind === "backlog" &&
									activeDropTarget.valid
										? "Drop to clear this slot and send the variant back to backlog."
										: "Drop scheduled or tentative cards here to return them to backlog."}
								</div>
								<div className="space-y-3">
									{filteredBacklog.length === 0 ? (
										<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-6 text-sm text-muted-foreground">
											No unscheduled variants match the current filters.
										</div>
									) : (
										filteredBacklog.map((item) => (
											<CalendarCard
												key={item.variantId}
												card={{ kind: "backlog", item }}
												onDragStart={beginDrag}
												onDragEnd={clearDragState}
												onClick={() => setPanelState({ mode: "backlog", item })}
											/>
										))
									)}
								</div>
							</SurfaceCard>
						</div>
					)}
				</div>
			</SurfaceCard>

			<Sheet
				open={panelOpen}
				onOpenChange={(open) => (!open ? closePanel() : undefined)}
			>
				<SheetContent
					side="right"
					className="w-full gap-0 border-l border-[var(--brand-border-soft)] bg-[color-mix(in_srgb,var(--background)_94%,white_6%)] p-0 sm:max-w-[560px]"
				>
					<SheetHeader className="border-b border-[var(--brand-border-soft)] px-5 py-5">
						<SheetTitle>
							{panelState.mode === "entry"
								? panelState.item.planningState === "tentative"
									? "Tentative slot"
									: "Scheduled item"
								: panelState.mode === "backlog"
									? "Backlog item"
									: panelState.mode === "gap"
										? "Fill this gap"
										: "Create draft"}
						</SheetTitle>
						<SheetDescription>
							{panelState.mode === "entry" || panelState.mode === "backlog"
								? "Adjust the draft, assets, planning time, and review state without leaving the calendar."
								: "Create a new draft already pointed at the right platform and time slot."}
						</SheetDescription>
					</SheetHeader>

					<div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
						{loadingPost ? (
							<div className="flex items-center gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-4 text-sm text-muted-foreground">
								<LoaderCircle className="size-4 animate-spin" />
								Loading draft details...
							</div>
						) : null}
						{panelError ? (
							<div className="rounded-[20px] border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-700 dark:text-red-200">
								{panelError}
							</div>
						) : null}

						<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
							<div className="space-y-2">
								<Label htmlFor="calendar-title">Title</Label>
								<Input
									id="calendar-title"
									name="title"
									value={panelDraft.title}
									onChange={(event) =>
										setPanelDraft((current) => ({
											...current,
											title: event.target.value,
										}))
									}
									placeholder="Platform launch update"
									className="h-11 rounded-2xl"
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="calendar-platform">Platform</Label>
									<Select
										value={panelDraft.platform}
										onValueChange={(value) => {
											const nextSurface =
												surfaceOptionsForPlatform(capabilities, value)[0]
													?.value ?? "";
											setPanelDraft((current) => ({
												...current,
												platform: value,
												surface: nextSurface,
											}));
										}}
										disabled={
											panelState.mode === "entry" ||
											panelState.mode === "backlog"
										}
									>
										<SelectTrigger
											id="calendar-platform"
											aria-label="Platform"
											className="h-11 w-full rounded-2xl px-4"
										>
											<SelectValue placeholder="Choose platform" />
										</SelectTrigger>
										<SelectContent>
											{(
												calendar?.platforms.map((lane) => lane.platform) ?? []
											).map((platform) => (
												<SelectItem key={platform} value={platform}>
													{formatPlatformLabel(platform)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="calendar-surface">Surface</Label>
									<Select
										value={panelDraft.surface}
										onValueChange={(value) =>
											setPanelDraft((current) => ({
												...current,
												surface: value,
											}))
										}
										disabled={
											(panelState.mode === "entry" ||
												panelState.mode === "backlog") &&
											Boolean(currentVariant)
										}
									>
										<SelectTrigger
											id="calendar-surface"
											aria-label="Surface"
											className="h-11 w-full rounded-2xl px-4"
										>
											<SelectValue placeholder="Choose surface" />
										</SelectTrigger>
										<SelectContent>
											{surfaceOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>

							{panelState.mode === "gap" || panelState.mode === "new" ? (
								<div className="grid gap-4 md:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="calendar-content-mode">
											Content behavior
										</Label>
										<Select
											value={panelDraft.contentMode}
											onValueChange={(value) =>
												setPanelDraft((current) => ({
													...current,
													contentMode: value as "inherit" | "custom",
												}))
											}
										>
											<SelectTrigger
												id="calendar-content-mode"
												className="h-11 w-full rounded-2xl px-4"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="custom">
													Override on variant
												</SelectItem>
												<SelectItem value="inherit">
													Use shared draft
												</SelectItem>
											</SelectContent>
										</Select>
										<div className="text-xs text-muted-foreground">
											Blank drafts default to override so there is no empty
											inheritance chain to untangle later.
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor="calendar-asset-mode">Asset behavior</Label>
										<Select
											value={panelDraft.assetMode}
											onValueChange={(value) =>
												setPanelDraft((current) => ({
													...current,
													assetMode: value as "inherit" | "replace",
												}))
											}
										>
											<SelectTrigger
												id="calendar-asset-mode"
												className="h-11 w-full rounded-2xl px-4"
											>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="replace">
													Replace / attach now
												</SelectItem>
												<SelectItem value="inherit">Inherit later</SelectItem>
											</SelectContent>
										</Select>
										<div className="text-xs text-muted-foreground">
											New calendar drafts start in replace mode because there
											are no shared assets to inherit yet.
										</div>
									</div>
								</div>
							) : null}

							<div className="space-y-2">
								<Label htmlFor="calendar-excerpt">Caption / excerpt</Label>
								<Textarea
									id="calendar-excerpt"
									name="excerpt"
									value={panelDraft.excerpt}
									onChange={(event) =>
										setPanelDraft((current) => ({
											...current,
											excerpt: event.target.value,
										}))
									}
									disabled={currentVariant?.contentKind === "thread"}
									placeholder="Draft the core message for this slot..."
									className="min-h-28 rounded-[24px] bg-background/90"
								/>
								{currentVariant?.contentKind === "thread" ? (
									<div className="text-xs text-muted-foreground">
										Thread content still opens in the full editor to avoid
										losing structure.
									</div>
								) : null}
							</div>
							<div className="space-y-2">
								<Label htmlFor="calendar-notes">Notes</Label>
								<Textarea
									id="calendar-notes"
									name="notes"
									value={panelDraft.notes}
									onChange={(event) =>
										setPanelDraft((current) => ({
											...current,
											notes: event.target.value,
										}))
									}
									placeholder="Review context, owner note, or next unblock step..."
									className="min-h-24 rounded-[24px] bg-background/90"
								/>
							</div>

							<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
								<div className="space-y-2">
									<Label htmlFor="calendar-planned-time">Planned time</Label>
									<DateTimePicker
										id="calendar-planned-time"
										value={panelDraft.plannedLocal}
										onChange={(value) =>
											setPanelDraft((current) => ({
												...current,
												plannedLocal: value,
											}))
										}
									/>
								</div>
								<div className="flex items-center justify-between gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/80 px-4 py-3 md:min-w-[180px]">
									<div>
										<div className="text-sm font-medium">Needs approval</div>
										<div className="text-xs text-muted-foreground">
											Block scheduling until approved
										</div>
									</div>
									<Switch
										id="calendar-requires-approval"
										aria-label="Requires approval"
										checked={panelDraft.requiresApproval}
										onCheckedChange={(checked) =>
											setPanelDraft((current) => ({
												...current,
												requiresApproval: checked,
											}))
										}
									/>
								</div>
							</div>
						</div>

						{panelState.mode === "gap" || panelState.mode === "new" ? (
							<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4">
								<div className="space-y-1">
									<div className="text-sm font-medium">Approval flow</div>
									<div className="text-sm text-muted-foreground">
										Set the initial review state now so the draft does not need
										an extra reopen just to enter review.
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant={
											panelDraft.reviewIntent === "draft"
												? "default"
												: "outline"
										}
										className="rounded-full"
										onClick={() =>
											setPanelDraft((current) => ({
												...current,
												reviewIntent: "draft",
											}))
										}
									>
										<Clock3 className="size-4" />
										Keep as draft
									</Button>
									<Button
										type="button"
										variant={
											panelDraft.reviewIntent === "submit"
												? "default"
												: "outline"
										}
										className="rounded-full border-sky-500/20 bg-sky-500/10 text-sky-800 hover:bg-sky-500/15 hover:text-sky-900 dark:text-sky-100"
										onClick={() =>
											setPanelDraft((current) => ({
												...current,
												reviewIntent: "submit",
											}))
										}
									>
										<Send className="size-4" />
										Create and submit
									</Button>
									<Button
										type="button"
										variant={
											panelDraft.reviewIntent === "approved"
												? "default"
												: "outline"
										}
										className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 hover:text-emerald-900 dark:text-emerald-100"
										onClick={() =>
											setPanelDraft((current) => ({
												...current,
												reviewIntent: "approved",
											}))
										}
									>
										<CheckCircle2 className="size-4" />
										Create approved
									</Button>
								</div>
								<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-3 py-3 text-sm text-muted-foreground">
									{panelDraft.reviewIntent === "draft"
										? "The draft will be created with its default review state."
										: panelDraft.reviewIntent === "submit"
											? "After creation, the variant will immediately move into review."
											: "After creation, the variant will be marked approved so it can move toward final scheduling faster."}
								</div>
							</div>
						) : null}

						{panelState.mode === "entry" || panelState.mode === "backlog" ? (
							<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4">
								<div className="flex flex-wrap items-center gap-2">
									{panelState.item.planningState === "tentative" ? (
										<span className="pill pill-warning">Tentative slot</span>
									) : null}
									<span
										className={statusClassName(panelState.item.approvalState)}
									>
										{panelState.item.approvalState}
									</span>
									<span className={publicationBadgeTone(panelState.item)}>
										{panelState.mode === "entry"
											? panelState.item.planningState === "tentative"
												? `Tentative ${formatDateTimeLabel(panelState.item.plannedAt)}`
												: formatDateTimeLabel(panelState.item.plannedAt)
											: panelState.item.publicationState}
									</span>
									{panelState.item.finalizable ? (
										<span className="pill pill-success">Ready to finalize</span>
									) : null}
									{panelState.item.requiresApproval ? (
										<span className="pill pill-warning">Approval required</span>
									) : null}
								</div>

								<div className="grid gap-3 md:grid-cols-2">
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 p-3">
										<div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
											Assets
										</div>
										<div className="mt-2 text-sm font-medium">
											{panelState.item.assetCount} effective asset
											{panelState.item.assetCount === 1 ? "" : "s"}
										</div>
									</div>
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 p-3">
										<div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
											Inheritance
										</div>
										<div className="mt-2 text-sm font-medium">
											{currentVariant?.contentMode === "inherit"
												? "Using inherited content"
												: "Custom variant content"}
										</div>
									</div>
								</div>

								{panelState.item.readiness.scheduleBlockers.length > 0 ? (
									<div className="rounded-[18px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200">
										<div className="mb-2 font-medium">Scheduling blockers</div>
										<div className="space-y-1.5">
											{panelState.item.readiness.scheduleBlockers.map(
												(issue) => (
													<div key={`${issue.code}-${issue.message}`}>
														{issue.message}
													</div>
												),
											)}
										</div>
									</div>
								) : panelState.item.planningState === "tentative" ? (
									<div className="rounded-[18px] border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 dark:text-amber-100">
										This slot is placed on the calendar, but it will not run
										until you finalize it into a real schedule.
									</div>
								) : (
									<div className="rounded-[18px] border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700 dark:text-emerald-200">
										This item is clear to move or schedule from the calendar.
									</div>
								)}

								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										className="rounded-full border-sky-500/20 bg-sky-500/10 text-sky-800 hover:bg-sky-500/15 hover:text-sky-900 dark:text-sky-100"
										onClick={() => void runReviewAction("submit")}
										disabled={saving}
									>
										<Send className="size-4" />
										Submit
									</Button>
									<Button
										type="button"
										variant="outline"
										className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 hover:text-emerald-900 dark:text-emerald-100"
										onClick={() => void runReviewAction("approved")}
										disabled={saving}
									>
										<CheckCircle2 className="size-4" />
										Approve
									</Button>
									<Button
										type="button"
										variant="outline"
										className="rounded-full border-amber-500/20 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-100"
										onClick={() => void runReviewAction("changes_requested")}
										disabled={saving}
									>
										<XCircle className="size-4" />
										Request changes
									</Button>
									{panelState.mode === "entry" &&
									panelState.item.planningState === "tentative" ? (
										<Button
											type="button"
											variant="outline"
											className="rounded-full border-emerald-500/20 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 hover:text-emerald-900 dark:text-emerald-100"
											onClick={() => void finalizeTentativeSlot()}
											disabled={saving || !panelState.item.finalizable}
										>
											<CheckCircle2 className="size-4" />
											Finalize schedule
										</Button>
									) : null}
									{panelState.mode === "entry" ? (
										<Button
											type="button"
											variant="outline"
											className="rounded-full"
											onClick={() =>
												void handleClearPlacement(
													panelState.item.variantId,
													panelState.item.planningState,
												)
											}
											disabled={saving}
										>
											<Clock3 className="size-4" />
											{panelState.item.planningState === "tentative"
												? "Clear tentative slot"
												: "Unschedule"}
										</Button>
									) : null}
								</div>
							</div>
						) : null}

						{panelState.mode === "entry" || panelState.mode === "backlog" ? (
							<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium">Assets</div>
										<div className="text-sm text-muted-foreground">
											Attach missing media and resolve blockers without leaving
											the calendar.
										</div>
									</div>
									{currentVariant ? (
										<ResourcePicker
											resources={resources}
											resourceSets={resourceSets}
											resolveResourceSetIds={resolveResourceSetIds}
											value={variantSpecificAssets.map((asset) => asset.id)}
											onChange={(nextValue) => {
												void syncVariantAssets(
													currentVariant.assetMode,
													nextValue,
													currentVariant.removedInheritedResourceIds,
												);
											}}
											triggerLabel={
												currentVariant.assetMode === "replace"
													? "Choose assets"
													: "Append assets"
											}
										/>
									) : null}
								</div>

								{currentVariant ? (
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant={
												currentVariant.assetMode === "inherit"
													? "default"
													: "outline"
											}
											className="rounded-full"
											onClick={() =>
												void syncVariantAssets(
													"inherit",
													variantSpecificAssets.map((asset) => asset.id),
													currentVariant.removedInheritedResourceIds,
												)
											}
											disabled={saving}
										>
											Inherit
										</Button>
										<Button
											type="button"
											variant={
												currentVariant.assetMode === "replace"
													? "default"
													: "outline"
											}
											className="rounded-full"
											onClick={() =>
												void syncVariantAssets(
													"replace",
													variantSpecificAssets.map((asset) => asset.id),
													[],
												)
											}
											disabled={saving}
										>
											Replace
										</Button>
									</div>
								) : null}

								{currentVariant?.assetMode === "inherit" ? (
									<div className="space-y-4">
										<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 p-3">
											<div className="mb-3 text-sm font-medium">
												Inherited assets
											</div>
											<ResourceChipList
												resources={inheritedAssets}
												onRemove={(resourceId) => {
													void syncVariantAssets(
														"inherit",
														variantSpecificAssets.map((asset) => asset.id),
														currentVariant.removedInheritedResourceIds.includes(
															resourceId,
														)
															? currentVariant.removedInheritedResourceIds.filter(
																	(item) => item !== resourceId,
																)
															: [
																	...currentVariant.removedInheritedResourceIds,
																	resourceId,
																],
													);
												}}
											/>
										</div>
										<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 p-3">
											<div className="mb-3 text-sm font-medium">
												Appended assets
											</div>
											<ResourceChipList
												resources={variantSpecificAssets}
												onRemove={(resourceId) => {
													void syncVariantAssets(
														"inherit",
														variantSpecificAssets
															.filter((asset) => asset.id !== resourceId)
															.map((asset) => asset.id),
														currentVariant.removedInheritedResourceIds,
													);
												}}
											/>
										</div>
									</div>
								) : currentVariant ? (
									<ResourceChipList
										resources={variantSpecificAssets}
										onRemove={(resourceId) => {
											void syncVariantAssets(
												"replace",
												variantSpecificAssets
													.filter((asset) => asset.id !== resourceId)
													.map((asset) => asset.id),
												[],
											);
										}}
									/>
								) : null}

								{currentVariant?.effectiveAssets?.length ? (
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 p-3">
										<div className="mb-3 text-sm font-medium">
											Effective assets
										</div>
										<ResourceChipList
											resources={currentVariant.effectiveAssets}
										/>
									</div>
								) : null}
							</div>
						) : null}

						{panelState.mode === "gap" || panelState.mode === "new" ? (
							<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<div className="text-sm font-medium">Assets</div>
										<div className="text-sm text-muted-foreground">
											Attach the first assets here so the draft does not get
											stuck waiting on the editor later.
										</div>
									</div>
									<ResourcePicker
										resources={resources}
										resourceSets={resourceSets}
										resolveResourceSetIds={resolveResourceSetIds}
										value={panelDraft.assetIds}
										onChange={(nextValue) =>
											setPanelDraft((current) => ({
												...current,
												assetIds: nextValue,
											}))
										}
										triggerLabel={
											panelDraft.assetMode === "replace"
												? "Choose assets"
												: "Append assets"
										}
									/>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant={
											panelDraft.assetMode === "replace" ? "default" : "outline"
										}
										className="rounded-full"
										onClick={() =>
											setPanelDraft((current) => ({
												...current,
												assetMode: "replace",
											}))
										}
									>
										Replace / attach now
									</Button>
									<Button
										type="button"
										variant={
											panelDraft.assetMode === "inherit" ? "default" : "outline"
										}
										className="rounded-full"
										onClick={() =>
											setPanelDraft((current) => ({
												...current,
												assetMode: "inherit",
											}))
										}
									>
										Inherit later
									</Button>
								</div>
								<ResourceChipList
									resources={panelDraftAssets}
									onRemove={(resourceId) =>
										setPanelDraft((current) => ({
											...current,
											assetIds: current.assetIds.filter(
												(item) => item !== resourceId,
											),
										}))
									}
								/>
								<div
									className={cn(
										"rounded-[18px] border px-3 py-3 text-sm",
										panelDraft.assetMode === "inherit"
											? "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-100"
											: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
									)}
								>
									{panelDraft.assetMode === "inherit"
										? "This draft will inherit assets later in the full editor. Replace mode is the clearer default when nothing exists yet."
										: "Attached assets will be saved directly onto the first variant created from this calendar draft."}
								</div>
							</div>
						) : null}

						{panelState.mode === "entry" || panelState.mode === "backlog" ? (
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" className="rounded-full" asChild>
									<Link to={`/dashboard/posts/${panelState.item.postId}`}>
										Open detail
										<ArrowUpRight className="size-4" />
									</Link>
								</Button>
								<Button variant="outline" className="rounded-full" asChild>
									<Link
										to={`/dashboard/posts/${panelState.item.postId}/edit?tab=${panelState.item.platform}`}
									>
										Open editor
										<ArrowUpRight className="size-4" />
									</Link>
								</Button>
								{panelState.item.readiness.scheduleBlockers.some(
									(issue) => issue.code === "assets_required",
								) ? (
									<Button variant="outline" className="rounded-full" asChild>
										<Link to="/dashboard/library">
											Open library
											<FolderKanban className="size-4" />
										</Link>
									</Button>
								) : null}
							</div>
						) : null}
					</div>

					<SheetFooter className="border-t border-[var(--brand-border-soft)] px-5 py-4">
						<div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-between">
							<Button
								variant="outline"
								className="rounded-full"
								onClick={closePanel}
							>
								Close
							</Button>
							<Button
								className="rounded-full border-0 bg-gradient-brand text-white"
								onClick={() =>
									void (panelState.mode === "entry" ||
									panelState.mode === "backlog"
										? saveExistingItem()
										: createDraftFromPanel())
								}
								disabled={saving}
							>
								{saving ? (
									<LoaderCircle className="size-4 animate-spin" />
								) : (
									<Plus className="size-4" />
								)}
								{panelState.mode === "entry" || panelState.mode === "backlog"
									? "Save changes"
									: "Create draft"}
							</Button>
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
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
