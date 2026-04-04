import { Grid2x2Plus, GripVertical, Images, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

import {
	ResourceCompatibilityBadge,
	ResourceKindIcon,
	ResourceThumb,
	formatResourceMeta,
} from "./resource-display";

export function formatAssetSetIntent(set: {
	intentType: string;
	intentPlatform?: string;
	intentSurface?: string;
}) {
	if (set.intentType === "social_surface") {
		const platform = set.intentPlatform?.replaceAll("_", " ") ?? "social";
		const surface = set.intentSurface?.replaceAll("_", " ") ?? "surface";
		return `${capitalize(platform)} ${surface}`;
	}
	return "Generic asset set";
}

function capitalize(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function SetPlaceholder({ compact = false }: { compact?: boolean }) {
	return (
		<div className="media-thumb-fallback flex h-full w-full items-center justify-center">
			<div className="flex flex-col items-center gap-3 text-white/90">
				<div className="flex size-12 items-center justify-center rounded-2xl border border-white/12 bg-white/10">
					<Images className="size-5" />
				</div>
				{compact ? null : (
					<div className="text-center text-xs uppercase tracking-[0.28em] text-white/65">
						Asset set
					</div>
				)}
			</div>
		</div>
	);
}

export function ResourceSetCover({
	set,
	className,
	compact = false,
}: {
	set: ResourceSetSummary | ResourceSetDetail;
	className?: string;
	compact?: boolean;
}) {
	const coverResource =
		"coverResource" in set && set.coverResource
			? set.coverResource
			: set.membersPreview[0];

	if (coverResource) {
		return (
			<div className={cn("relative h-full w-full overflow-hidden", className)}>
				<ResourceThumb
					resource={coverResource}
					variant={compact ? "compact" : "minimal"}
					className="h-full w-full"
				/>
				<div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(12,8,6,0.24)_70%,rgba(12,8,6,0.5))]" />
				<div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
					<Badge
						variant="outline"
						className="rounded-full border-white/15 bg-white/10 text-[0.62rem] uppercase tracking-[0.22em] text-white"
					>
						Set
					</Badge>
					<Badge
						variant="outline"
						className="rounded-full border-white/15 bg-white/10 text-white"
					>
						{set.itemCount} items
					</Badge>
				</div>
			</div>
		);
	}

	return <SetPlaceholder compact={compact} />;
}

export function ResourceSetMembersPreview({
	resources,
	max = 4,
	className,
}: {
	resources: ResourceRecord[];
	max?: number;
	className?: string;
}) {
	const visibleItems = resources.slice(0, max);

	if (visibleItems.length === 0) {
		return (
			<div
				className={cn(
					"rounded-[22px] border border-dashed border-[var(--brand-border-soft)] px-4 py-3 text-sm text-muted-foreground",
					className,
				)}
			>
				No related resources yet.
			</div>
		);
	}

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{visibleItems.map((resource, index) => (
				<div
					key={resource.id}
					className="flex items-center gap-3 rounded-full border border-[var(--brand-border-soft)] bg-background/80 px-3 py-2"
				>
					<div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted">
						<ResourceThumb resource={resource} variant="compact" />
					</div>
					<div className="min-w-0">
						<div className="max-w-40 truncate text-sm font-medium">
							{resource.displayName}
						</div>
						<div className="text-xs text-muted-foreground">
							Item {index + 1}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function ResourceSetIntentBadge({
	set,
	className,
}: {
	set: Pick<
		ResourceSetSummary,
		"intentType" | "intentPlatform" | "intentSurface"
	>;
	className?: string;
}) {
	return (
		<Badge
			variant="outline"
			className={cn("rounded-full capitalize", className)}
		>
			<Sparkles className="size-3.5" />
			{formatAssetSetIntent(set)}
		</Badge>
	);
}

export function ResourceSetItemList({
	items,
	onOpenResource,
	showPosition = true,
	draggable = false,
	draggingResourceId,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onRemove,
	onMoveUp,
	onMoveDown,
}: {
	items: {
		resource: ResourceRecord;
		resourceId: string;
		position?: number;
		role?: string;
	}[];
	onOpenResource?: (resourceId: string) => void;
	showPosition?: boolean;
	draggable?: boolean;
	draggingResourceId?: string | null;
	onDragStart?: (resourceId: string) => void;
	onDragOver?: (resourceId: string) => void;
	onDrop?: (resourceId: string) => void;
	onDragEnd?: () => void;
	onRemove?: (resourceId: string) => void;
	onMoveUp?: (resourceId: string) => void;
	onMoveDown?: (resourceId: string) => void;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-6 text-sm text-muted-foreground">
				No resources in this asset set yet.
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{items.map((item, index) => (
				<div
					key={`${item.resourceId}-${index}`}
					draggable={draggable}
					onDragStart={() => onDragStart?.(item.resourceId)}
					onDragEnd={() => onDragEnd?.()}
					onDragOver={(event) => {
						if (!draggable) {
							return;
						}
						event.preventDefault();
						onDragOver?.(item.resourceId);
					}}
					onDrop={(event) => {
						if (!draggable) {
							return;
						}
						event.preventDefault();
						onDrop?.(item.resourceId);
					}}
					className={cn(
						"flex flex-wrap items-center gap-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 px-4 py-4",
						draggingResourceId === item.resourceId && "opacity-60",
					)}
				>
					{showPosition ? (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							{draggable ? (
								<div className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background">
									<GripVertical className="size-4" />
								</div>
							) : null}
							<span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background px-2 font-medium">
								{index + 1}
							</span>
						</div>
					) : null}
					<div className="h-20 w-24 overflow-hidden rounded-[18px] bg-muted">
						<ResourceThumb resource={item.resource} variant="compact" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<div className="truncate font-medium">
								{item.resource.displayName}
							</div>
							<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
								<ResourceKindIcon mediaKind={item.resource.mediaKind} />
								{item.resource.mediaKind}
							</span>
						</div>
						<div className="mt-1 text-sm text-muted-foreground">
							{formatResourceMeta(item.resource)}
						</div>
						<div className="mt-2 flex flex-wrap gap-2">
							<ResourceCompatibilityBadge resource={item.resource} />
							{item.role ? (
								<Badge variant="outline" className="rounded-full">
									{item.role}
								</Badge>
							) : null}
						</div>
					</div>
					<div className="ml-auto flex flex-wrap items-center gap-2">
						{onOpenResource ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() => onOpenResource(item.resourceId)}
							>
								Open
							</Button>
						) : null}
						{onMoveUp ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() => onMoveUp(item.resourceId)}
								disabled={index === 0}
							>
								Up
							</Button>
						) : null}
						{onMoveDown ? (
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() => onMoveDown(item.resourceId)}
								disabled={index === items.length - 1}
							>
								Down
							</Button>
						) : null}
						{onRemove ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="rounded-full text-red-600"
								onClick={() => onRemove(item.resourceId)}
							>
								Remove
							</Button>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
}

export function ResourceSetSummaryStrip({
	set,
	className,
}: {
	set: ResourceSetSummary;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 p-3",
				className,
			)}
		>
			<div className="flex size-16 items-center justify-center overflow-hidden rounded-[18px] bg-muted">
				<ResourceSetCover set={set} compact className="rounded-[18px]" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium">{set.name}</div>
				<div className="mt-1 text-sm text-muted-foreground">
					{formatAssetSetIntent(set)} · {set.itemCount} items
				</div>
			</div>
			<div className="hidden flex-wrap gap-2 md:flex">
				{set.membersPreview.slice(0, 3).map((resource) => (
					<div
						key={resource.id}
						className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted"
					>
						<ResourceThumb resource={resource} variant="compact" />
					</div>
				))}
			</div>
			<div className="flex size-11 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background text-muted-foreground">
				<Grid2x2Plus className="size-4" />
			</div>
		</div>
	);
}
