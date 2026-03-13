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
	CalendarBacklogItem,
	CalendarEntry,
	CalendarResponse,
	PostDetail,
	PostVariant,
	ResourceCapabilityMatrix,
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
type CalendarStatusFilter = "all" | "ready" | "blocked" | "in_review";

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

const TIMELINE_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);

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

function itemIsReady(item: CalendarEntry | CalendarBacklogItem) {
	return (
		item.approvalState === "approved" &&
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
	};
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

function CalendarCard({
	card,
	onClick,
	onDragStart,
	onDragEnd,
}: {
	card: CalendarCardItem;
	onClick: () => void;
	onDragStart?: (payload: DragPayload) => void;
	onDragEnd?: () => void;
}) {
	const item = card.item;
	const meta = getPlatformMeta(item.platform);
	const payload = dragDataFor(card.kind, item);

	return (
		<button
			type="button"
			draggable
			onDragStart={(event) => {
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("application/json", JSON.stringify(payload));
				onDragStart?.(payload);
			}}
			onDragEnd={onDragEnd}
			onClick={onClick}
			className={cn(
				"w-full rounded-[20px] border border-[var(--brand-border-soft)] bg-background/88 p-3 text-left shadow-[0_16px_36px_-30px_rgba(15,23,42,0.48)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background",
				card.kind === "backlog" &&
					"bg-[color-mix(in_srgb,var(--background)_88%,var(--brand-highlight)_12%)]",
			)}
			style={
				meta
					? {
							boxShadow: `inset 0 1px 0 ${withAlpha(meta.color, 0.14)}, 0 16px 36px -30px rgba(15,23,42,0.48)`,
						}
					: undefined
			}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-2">
					<div className="flex items-center gap-2">
						{platformIcon(item.platform)}
						<div className="min-w-0">
							<div className="truncate text-sm font-medium">{item.title}</div>
							<div className="text-xs text-muted-foreground">
								{formatPlatformLabel(item.platform)} ·{" "}
								{surfaceLabel(item.surface)}
							</div>
						</div>
					</div>
					{item.excerpt ? (
						<p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
							{item.excerpt}
						</p>
					) : (
						<p className="text-xs text-muted-foreground">
							No draft excerpt yet.
						</p>
					)}
				</div>
				<GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				<span className={statusClassName(item.approvalState)}>
					{item.approvalState}
				</span>
				<span className={publicationBadgeTone(item)}>
					{card.kind === "entry"
						? formatTimeLabel(card.item.plannedAt)
						: item.publicationState}
				</span>
				{itemIsBlocked(item) ? (
					<span className="pill pill-error">Blocked</span>
				) : null}
			</div>
		</button>
	);
}

export function DashboardCalendar() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
	const [capabilities, setCapabilities] =
		useState<ResourceCapabilityMatrix | null>(null);
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
	const weekLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const timelineLaneRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
				const [calendarResponse, capabilityResponse] = await Promise.all([
					customerRequest<CalendarResponse>(`/calendar?${params.toString()}`),
					capabilities
						? Promise.resolve(capabilities)
						: customerRequest<ResourceCapabilityMatrix>(
								"/resources/capabilities",
							),
				]);
				if (cancelled) {
					return;
				}
				setCalendar(calendarResponse);
				setCapabilities(capabilityResponse);
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

	function optimisticSchedule(variantId: string, plannedAt: string) {
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
						publicationState: "scheduled",
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
					publicationState: "scheduled",
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
				platforms: current.platforms.map((lane) => ({
					...lane,
					scheduledCount:
						lane.platform === movedItem.platform
							? lane.scheduledCount +
								(current.entries.some((entry) => entry.variantId === variantId)
									? 0
									: 1)
							: lane.scheduledCount,
					backlogCount:
						lane.platform === movedItem.platform &&
						current.backlog.some((item) => item.variantId === variantId)
							? Math.max(0, lane.backlogCount - 1)
							: lane.backlogCount,
				})),
			};
		});
	}

	function optimisticUnschedule(variantId: string) {
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
					approvalState: entry.approvalState,
					publicationState: "unscheduled",
					requiresApproval: entry.requiresApproval,
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
				platforms: current.platforms.map((lane) => ({
					...lane,
					scheduledCount:
						lane.platform === movedItem.platform
							? Math.max(0, lane.scheduledCount - 1)
							: lane.scheduledCount,
					backlogCount:
						lane.platform === movedItem.platform
							? lane.backlogCount + 1
							: lane.backlogCount,
				})),
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
	}

	async function handleScheduleVariant(variantId: string, plannedAt: string) {
		optimisticSchedule(variantId, plannedAt);
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

	async function handleUnscheduleVariant(variantId: string) {
		optimisticUnschedule(variantId);
		try {
			await customerRequest(
				`/posts/variants/${variantId}/publication/unschedule`,
				{ method: "POST" },
			);
			await reloadCalendar();
		} catch (scheduleError) {
			await reloadCalendar();
			toast.error(
				scheduleError instanceof Error
					? scheduleError.message
					: "Unable to unschedule this variant.",
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
		await handleScheduleVariant(payload.variantId, nextDate.toISOString());
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
		await handleScheduleVariant(payload.variantId, nextDate.toISOString());
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

			const nextPlannedAt = toIsoValue(panelDraft.plannedLocal);
			if (nextPlannedAt) {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/schedule`,
					{
						method: "POST",
						body: { plannedAt: nextPlannedAt, source: "manual" },
					},
				);
			} else if (panelState.mode === "entry") {
				await customerRequest(
					`/posts/variants/${variant.id}/publication/unschedule`,
					{
						method: "POST",
					},
				);
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
						contentMode: "inherit",
						contentKind: "",
						contentPayload: {},
						assetMode: "inherit",
						notes: panelDraft.notes,
					},
				},
			);

			const plannedAt = toIsoValue(panelDraft.plannedLocal);
			if (plannedAt) {
				try {
					await customerRequest(
						`/posts/variants/${createdVariant.id}/publication/schedule`,
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
							: "The draft was created but could not be scheduled.",
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
	const surfaceOptions = surfaceOptionsForPlatform(
		capabilities,
		panelDraft.platform,
	);
	const panelOpen = panelState.mode !== "closed";
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
							<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
								<PlanningStatChip
									label="Scheduled"
									value={String(filteredEntries.length)}
									detail="Visible items in range"
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
									<div className="overflow-x-auto rounded-[28px] border border-[var(--brand-border-soft)] bg-background/55">
										<div className="grid grid-cols-[180px_repeat(7,minmax(0,1fr))] gap-px bg-[var(--brand-border-soft)]">
											<div className="bg-background/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
												Platforms
											</div>
											{currentWeek.map((day) => (
												<div
													key={day.toISOString()}
													className="bg-background/80 px-4 py-3 text-sm"
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
												return (
													<div key={lane.platform} className="contents">
														<div
															ref={(element) => {
																weekLaneRefs.current[lane.platform] = element;
															}}
															className={cn(
																"px-4 py-4 transition duration-200",
																laneEmphasized &&
																	"shadow-[inset_0_0_0_1px_rgba(255,255,255,0.58)]",
															)}
															style={{
																background: chrome.headerBackground,
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
																	<div className="mt-1 text-xs text-muted-foreground">
																		{lane.scheduledCount} scheduled ·{" "}
																		{lane.backlogCount} backlog
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
																				onClick={() =>
																					setPanelState({
																						mode: "gap",
																						platform: lane.platform,
																						date: day,
																					})
																				}
																				className="flex min-h-28 flex-1 flex-col items-center justify-center rounded-[20px] border border-dashed px-3 py-4 text-center text-sm text-muted-foreground transition duration-200 hover:text-foreground"
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
																				<Plus className="mb-2 size-4" />
																				<span className="font-medium text-foreground">
																					{activeWeekTarget?.valid
																						? "Drop to schedule here"
																						: "Gap detected"}
																				</span>
																				<span className="mt-1 text-xs">
																					{activeWeekTarget &&
																					!activeWeekTarget.valid
																						? "This slot only accepts the matching platform."
																						: "Add or drag content into this lane."}
																				</span>
																			</button>
																		) : showGapsOnly ? (
																			<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/80 px-3 py-2 text-xs text-muted-foreground">
																				Covered by {cellEntries.length} item
																				{cellEntries.length === 1 ? "" : "s"}
																			</div>
																		) : (
																			cellEntries.map((item) => (
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
																			0.12,
																		)}`,
																	}}
																>
																	<div className="truncate font-medium">
																		{item.title}
																	</div>
																	<div className="mt-1 text-muted-foreground">
																		{formatTimeLabel(item.plannedAt)}
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
										void handleUnscheduleVariant(payload.variantId);
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
										? "Drop to send this variant back to backlog."
										: "Drop scheduled cards here to unschedule them."}
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
								? "Scheduled item"
								: panelState.mode === "backlog"
									? "Backlog item"
									: panelState.mode === "gap"
										? "Fill this gap"
										: "Create draft"}
						</SheetTitle>
						<SheetDescription>
							{panelState.mode === "entry" || panelState.mode === "backlog"
								? "Adjust the draft, planning time, and review state without leaving the calendar."
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

						{panelState.mode === "entry" || panelState.mode === "backlog" ? (
							<div className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4">
								<div className="flex flex-wrap items-center gap-2">
									<span
										className={statusClassName(panelState.item.approvalState)}
									>
										{panelState.item.approvalState}
									</span>
									<span className={publicationBadgeTone(panelState.item)}>
										{panelState.mode === "entry"
											? formatDateTimeLabel(panelState.item.plannedAt)
											: panelState.item.publicationState}
									</span>
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
									{panelState.mode === "entry" ? (
										<Button
											type="button"
											variant="outline"
											className="rounded-full"
											onClick={() =>
												void handleUnscheduleVariant(panelState.item.variantId)
											}
											disabled={saving}
										>
											<Clock3 className="size-4" />
											Unschedule
										</Button>
									) : null}
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
