import { Check, FileText, ImageIcon, TriangleAlert, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ResourceRecord } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function formatBytes(sizeBytes: number) {
	if (sizeBytes < 1024) {
		return `${sizeBytes} B`;
	}
	if (sizeBytes < 1024 * 1024) {
		return `${(sizeBytes / 1024).toFixed(1)} KB`;
	}
	if (sizeBytes < 1024 * 1024 * 1024) {
		return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatResourceMeta(resource: ResourceRecord) {
	if (resource.mediaKind === "image") {
		if (resource.widthPx && resource.heightPx) {
			return `${resource.widthPx} x ${resource.heightPx} · ${formatBytes(resource.sizeBytes)}`;
		}
		return formatBytes(resource.sizeBytes);
	}
	if (resource.mediaKind === "video") {
		const parts = [formatBytes(resource.sizeBytes)];
		if (resource.widthPx && resource.heightPx) {
			parts.unshift(`${resource.widthPx} x ${resource.heightPx}`);
		}
		if (resource.durationMs) {
			parts.push(formatDuration(resource.durationMs));
		}
		return parts.join(" · ");
	}
	return resource.pageCount
		? `${resource.pageCount} pages · ${formatBytes(resource.sizeBytes)}`
		: formatBytes(resource.sizeBytes);
}

function formatDuration(durationMs: number) {
	const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildPdfPreviewUrl(source: string) {
	return `${source}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

function DocumentPlaceholder({
	className,
	icon: Icon = FileText,
	label,
}: {
	className?: string;
	icon?: typeof FileText;
	label: string;
}) {
	return (
		<div
			className={cn(
				"flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,var(--brand-highlight),transparent)] text-primary",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-2 text-center">
				<Icon className="size-8" />
				<div className="max-w-[80%] truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
					{label}
				</div>
			</div>
		</div>
	);
}

export function LocalFileThumb({
	file,
	previewUrl,
	className,
}: {
	file: File;
	previewUrl: string;
	className?: string;
}) {
	if (file.type.startsWith("image/")) {
		return (
			<img
				src={previewUrl}
				alt={file.name}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
			/>
		);
	}

	if (file.type.startsWith("video/")) {
		return (
			<video
				src={previewUrl}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
				preload="metadata"
				muted
				playsInline
			/>
		);
	}

	if (
		file.type === "application/pdf" ||
		file.name.toLowerCase().endsWith(".pdf")
	) {
		return (
			<iframe
				title={file.name}
				src={buildPdfPreviewUrl(previewUrl)}
				className={cn(
					"pointer-events-none h-full w-full border-0 bg-background",
					className,
				)}
			/>
		);
	}

	return <DocumentPlaceholder className={className} label="Document" />;
}

export function ResourceThumb({
	resource,
	className,
}: {
	resource: ResourceRecord;
	className?: string;
}) {
	if (resource.mediaKind === "image") {
		return (
			<img
				src={resource.previewUrl}
				alt={resource.displayName}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
			/>
		);
	}

	if (resource.mediaKind === "video") {
		return (
			<video
				src={resource.previewUrl}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
				preload="metadata"
				muted
				playsInline
			/>
		);
	}

	if (resource.mimeType === "application/pdf") {
		return (
			<iframe
				title={resource.displayName}
				src={buildPdfPreviewUrl(resource.previewUrl)}
				className={cn(
					"pointer-events-none h-full w-full border-0 bg-background",
					className,
				)}
			/>
		);
	}

	return <DocumentPlaceholder className={className} label="Document" />;
}

export function ResourceCompatibilityBadge({
	resource,
}: {
	resource: ResourceRecord;
}) {
	const unsupportedCount = resource.compatibility.filter(
		(item) => item.status === "unsupported",
	).length;
	const warningCount = resource.compatibility.filter(
		(item) => item.status === "warning",
	).length;

	if (unsupportedCount > 0) {
		return (
			<Badge
				variant="outline"
				className="rounded-full border-red-500/25 text-red-600"
			>
				<TriangleAlert className="size-3.5" />
				{unsupportedCount} blockers
			</Badge>
		);
	}
	if (warningCount > 0) {
		return (
			<Badge
				variant="outline"
				className="rounded-full border-amber-500/25 text-amber-600"
			>
				<TriangleAlert className="size-3.5" />
				{warningCount} warnings
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="rounded-full border-emerald-500/25 text-emerald-600"
		>
			<Check className="size-3.5" />
			Ready
		</Badge>
	);
}

export function ResourceKindIcon({
	mediaKind,
}: {
	mediaKind: ResourceRecord["mediaKind"];
}) {
	if (mediaKind === "image") {
		return <ImageIcon className="size-4" />;
	}
	if (mediaKind === "video") {
		return <Video className="size-4" />;
	}
	return <FileText className="size-4" />;
}

export function ResourceChipList({
	resources,
	onRemove,
}: {
	resources: ResourceRecord[];
	onRemove?: (resourceId: string) => void;
}) {
	if (resources.length === 0) {
		return (
			<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] px-4 py-3 text-sm text-muted-foreground">
				No resources attached yet.
			</div>
		);
	}

	return (
		<div className="flex flex-wrap gap-2">
			{resources.map((resource) => (
				<div
					key={resource.id}
					className="flex items-center gap-3 rounded-full border border-[var(--brand-border-soft)] bg-background/80 px-3 py-2"
				>
					<div className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-muted">
						<ResourceThumb resource={resource} />
					</div>
					<div className="min-w-0">
						<div className="max-w-44 truncate text-sm font-medium">
							{resource.displayName}
						</div>
						<div className="text-xs text-muted-foreground">
							{formatResourceMeta(resource)}
						</div>
					</div>
					{onRemove ? (
						<button
							type="button"
							className="text-sm text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => onRemove(resource.id)}
						>
							Remove
						</button>
					) : null}
				</div>
			))}
		</div>
	);
}
