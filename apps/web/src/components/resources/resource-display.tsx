import {
	Check,
	ChevronLeft,
	ChevronRight,
	FileText,
	ImageIcon,
	Maximize2,
	Minimize2,
	Minus,
	RotateCcw,
	TriangleAlert,
	Video,
	ZoomIn,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResourcePreviewUrl } from "@/hooks/use-resource-preview-url";
import type { ResourceRecord } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const pdfWorkerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();
const EMPTY_CAPTION_TRACK = "data:text/vtt;charset=utf-8,WEBVTT%0A%0A";

if (
	typeof window !== "undefined" &&
	pdfjs.GlobalWorkerOptions.workerSrc !== pdfWorkerSrc
) {
	pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
}

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

function getDocumentLabel(
	mimeType?: string,
	name?: string,
	defaultLabel = "Document",
) {
	if (mimeType === "application/pdf" || name?.toLowerCase().endsWith(".pdf")) {
		return "PDF";
	}
	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		name?.toLowerCase().endsWith(".docx")
	) {
		return "DOCX";
	}
	if (
		mimeType ===
			"application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
		name?.toLowerCase().endsWith(".pptx")
	) {
		return "PPTX";
	}
	if (
		mimeType === "application/msword" ||
		name?.toLowerCase().endsWith(".doc")
	) {
		return "DOC";
	}
	if (
		mimeType === "application/vnd.ms-powerpoint" ||
		name?.toLowerCase().endsWith(".ppt")
	) {
		return "PPT";
	}
	return defaultLabel;
}

function useClientReady() {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		setReady(true);
	}, []);

	return ready;
}

function useFullscreenTarget() {
	const targetRef = useRef<HTMLDivElement | null>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		function syncState() {
			setIsFullscreen(document.fullscreenElement === targetRef.current);
		}
		document.addEventListener("fullscreenchange", syncState);
		return () => {
			document.removeEventListener("fullscreenchange", syncState);
		};
	}, []);

	async function toggleFullscreen() {
		const target = targetRef.current;
		if (!target) {
			return;
		}
		if (document.fullscreenElement === target) {
			await document.exitFullscreen();
			return;
		}
		await target.requestFullscreen();
	}

	return { isFullscreen, targetRef, toggleFullscreen };
}

function useElementWidth<T extends HTMLElement>() {
	const elementRef = useRef<T | null>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		const target = elementRef.current;
		if (!target || typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = entries[0]?.contentRect.width ?? 0;
			setWidth(nextWidth);
		});

		observer.observe(target);
		setWidth(target.getBoundingClientRect().width);

		return () => {
			observer.disconnect();
		};
	}, []);

	return { elementRef, width };
}

function DocumentPoster({
	label,
	title,
	subtitle,
	pageCount,
	className,
	children,
	showPageCount = true,
	showDetails = true,
}: {
	label: string;
	title: string;
	subtitle?: string;
	pageCount?: number;
	className?: string;
	children?: React.ReactNode;
	showPageCount?: boolean;
	showDetails?: boolean;
}) {
	return (
		<div
			className={cn(
				"media-poster-surface relative flex h-full w-full overflow-hidden rounded-[inherit] border text-white",
				className,
			)}
		>
			{children ? (
				<div className="absolute inset-0 overflow-hidden">
					{children}
					<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,4,3,0.12),rgba(7,4,3,0.4)_55%,rgba(7,4,3,0.78))]" />
				</div>
			) : (
				<div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.3))]" />
			)}
			<div className="relative flex h-full w-full flex-col justify-between p-4">
				<div className="flex items-start justify-between gap-2">
					<Badge
						variant="outline"
						className="rounded-full border-white/15 bg-white/10 text-[0.62rem] uppercase tracking-[0.24em] text-white"
					>
						{label}
					</Badge>
					{showPageCount && pageCount ? (
						<div className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[0.68rem] font-medium text-white/85">
							{pageCount} pg
						</div>
					) : null}
				</div>
				{showDetails ? (
					<div className="space-y-2">
						<div className="line-clamp-3 text-sm font-semibold leading-tight tracking-tight text-white">
							{title}
						</div>
						{subtitle ? (
							<div className="text-[0.72rem] uppercase tracking-[0.2em] text-white/65">
								{subtitle}
							</div>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

function PdfPagePreview({
	file,
	pageNumber = 1,
	title,
	label,
	subtitle,
	pageCount,
	className,
	pageClassName,
	width = 360,
	minimal = false,
	onLoadError,
}: {
	file: string;
	pageNumber?: number;
	title: string;
	label: string;
	subtitle?: string;
	pageCount?: number;
	className?: string;
	pageClassName?: string;
	width?: number;
	minimal?: boolean;
	onLoadError?: () => void;
}) {
	const isClient = useClientReady();

	const fallback = (
		<DocumentPoster
			label={label}
			title={title}
			subtitle={subtitle}
			pageCount={pageCount}
			className={className}
			showPageCount={!minimal}
			showDetails={!minimal}
		/>
	);

	if (!isClient) {
		return fallback;
	}

	return (
		<DocumentPoster
			label={label}
			title={title}
			subtitle={subtitle}
			pageCount={pageCount}
			className={className}
			showPageCount={!minimal}
			showDetails={!minimal}
		>
			<div className="flex h-full w-full items-center justify-center bg-[#120f0d]">
				<Document
					file={file}
					loading={null}
					error={null}
					noData={null}
					onLoadError={onLoadError}
					externalLinkTarget="_blank"
				>
					<Page
						pageNumber={pageNumber}
						width={width}
						renderAnnotationLayer={false}
						renderTextLayer={false}
						className={cn(
							"pointer-events-none origin-top scale-[1.02] opacity-92 [&_canvas]:!h-auto [&_canvas]:!w-full [&_canvas]:shadow-[0_28px_80px_rgba(0,0,0,0.38)]",
							pageClassName,
						)}
					/>
				</Document>
			</div>
		</DocumentPoster>
	);
}

function PreviewUnavailableState({
	label,
	description,
	downloadUrl,
	compact = false,
	className,
}: {
	label: string;
	description?: string;
	downloadUrl?: string;
	compact?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"media-thumb-fallback flex h-full w-full flex-col items-center justify-center gap-3 rounded-[inherit] border px-4 py-5 text-center",
				compact && "gap-2 px-3 py-4",
				className,
			)}
		>
			<div className="flex size-10 items-center justify-center rounded-full border border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground">
				<TriangleAlert className="size-4" />
			</div>
			<div className="space-y-1">
				<div className="text-sm font-medium text-foreground">
					{compact ? "Preview unavailable" : label}
				</div>
				{compact ? null : (
					<div className="text-xs text-muted-foreground">
						{description ?? "Refresh the resource or open the original file."}
					</div>
				)}
			</div>
			{downloadUrl && !compact ? (
				<Button variant="outline" size="sm" className="rounded-full" asChild>
					<a href={downloadUrl} target="_blank" rel="noreferrer">
						Open original
					</a>
				</Button>
			) : null}
		</div>
	);
}

function ResourceDocumentPoster({
	resource,
	className,
	variant = "default",
}: {
	resource: ResourceRecord;
	className?: string;
	variant?: "default" | "minimal";
}) {
	const { url, broken, handleError } = useResourcePreviewUrl(resource);

	if (resource.mimeType === "application/pdf") {
		if (broken) {
			return (
				<DocumentPoster
					label="PDF"
					title={resource.displayName}
					subtitle="Preview unavailable"
					pageCount={resource.pageCount}
					className={className}
					showPageCount={variant !== "minimal"}
					showDetails={variant !== "minimal"}
				/>
			);
		}

		return (
			<PdfPagePreview
				file={url || resource.previewUrl}
				label="PDF"
				title={resource.displayName}
				subtitle={formatBytes(resource.sizeBytes)}
				pageCount={resource.pageCount}
				className={className}
				pageClassName="translate-y-5 scale-[1.06] [&_canvas]:rounded-[18px]"
				minimal={variant === "minimal"}
				onLoadError={() => {
					void handleError();
				}}
			/>
		);
	}

	return (
		<DocumentPoster
			label={getDocumentLabel(resource.mimeType, resource.originalName)}
			title={resource.displayName}
			subtitle={formatBytes(resource.sizeBytes)}
			pageCount={resource.pageCount}
			className={className}
			showPageCount={variant !== "minimal"}
			showDetails={variant !== "minimal"}
		/>
	);
}

function LocalDocumentPoster({
	file,
	previewUrl,
	className,
	variant = "default",
}: {
	file: File;
	previewUrl: string;
	className?: string;
	variant?: "default" | "minimal";
}) {
	if (
		file.type === "application/pdf" ||
		file.name.toLowerCase().endsWith(".pdf")
	) {
		return (
			<PdfPagePreview
				file={previewUrl}
				label="PDF"
				title={file.name}
				subtitle={formatBytes(file.size)}
				className={className}
				pageClassName="translate-y-5 scale-[1.06] [&_canvas]:rounded-[18px]"
				minimal={variant === "minimal"}
			/>
		);
	}

	return (
		<DocumentPoster
			label={getDocumentLabel(file.type, file.name)}
			title={file.name}
			subtitle={formatBytes(file.size)}
			className={className}
			showDetails={variant !== "minimal"}
		/>
	);
}

function CompactDocumentThumb({
	label,
	className,
}: {
	label: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"media-thumb-fallback flex h-full w-full items-center justify-center rounded-[inherit] border",
				className,
			)}
		>
			<Badge
				variant="outline"
				className="rounded-full border-white/15 bg-white/10 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.26em] text-white"
			>
				{label}
			</Badge>
		</div>
	);
}

function ViewerSurface({
	title,
	description,
	controls,
	children,
	className,
	contentClassName,
	surfaceRef,
}: {
	title: string;
	description: string;
	controls?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
	contentClassName?: string;
	surfaceRef?: React.Ref<HTMLDivElement>;
}) {
	return (
		<div
			ref={surfaceRef}
			className={cn(
				"media-viewer-shell flex min-h-0 flex-col overflow-hidden rounded-[28px] border",
				className,
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--brand-border-soft)] px-4 py-3">
				<div className="space-y-1">
					<div className="text-sm font-medium">{title}</div>
					<div className="text-xs text-muted-foreground">{description}</div>
				</div>
				{controls ? (
					<div className="flex flex-wrap items-center gap-2">{controls}</div>
				) : null}
			</div>
			<div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
		</div>
	);
}

function ImageResourceViewer({ resource }: { resource: ResourceRecord }) {
	const [zoom, setZoom] = useState(1);
	const [fitMode, setFitMode] = useState<"contain" | "edge">("contain");
	const { isFullscreen, targetRef, toggleFullscreen } = useFullscreenTarget();
	const { url, broken, refreshing, handleError } = useResourcePreviewUrl(resource);

	return (
		<ViewerSurface
			surfaceRef={targetRef}
			title="Image viewer"
			description="Zoom, inspect, and expand the original image without leaving the library."
			className={cn(
				isFullscreen &&
					"h-screen w-screen rounded-none border-0",
			)}
			contentClassName={cn(isFullscreen && "media-preview-canvas")}
			controls={
				<>
					<Button
						type="button"
						variant={fitMode === "contain" ? "secondary" : "outline"}
						size="sm"
						className="rounded-full"
						onClick={() => setFitMode("contain")}
					>
						Fit
					</Button>
					<Button
						type="button"
						variant={fitMode === "edge" ? "secondary" : "outline"}
						size="sm"
						className="rounded-full"
						onClick={() => setFitMode("edge")}
					>
						Edge to edge
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="rounded-full"
						onClick={() => setZoom((current) => Math.max(0.5, current - 0.25))}
						aria-label="Zoom out"
					>
						<Minus className="size-4" />
					</Button>
					<div className="min-w-14 text-center text-xs font-medium text-muted-foreground">
						{Math.round(zoom * 100)}%
					</div>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="rounded-full"
						onClick={() => setZoom((current) => Math.min(3, current + 0.25))}
						aria-label="Zoom in"
					>
						<ZoomIn className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="rounded-full"
						onClick={() => setZoom(1)}
					>
						<RotateCcw className="size-4" />
						Reset
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="rounded-full"
						onClick={() => void toggleFullscreen()}
					>
						{isFullscreen ? (
							<Minimize2 className="size-4" />
						) : (
							<Maximize2 className="size-4" />
						)}
						{isFullscreen ? "Exit full screen" : "Full screen"}
					</Button>
				</>
			}
		>
			<div
				className={cn(
					"media-preview-canvas relative",
					isFullscreen ? "h-full" : "h-[min(74vh,920px)]",
				)}
			>
				<ScrollArea
					className="h-full"
					viewportClassName="h-full w-full"
					scrollbarClassName="dashboard-content-scrollbar"
					thumbClassName="dashboard-content-scrollbar-thumb"
					showHorizontalScrollbar
				>
					<div className="flex min-h-full min-w-full items-center justify-center p-6">
						{broken ? (
							<PreviewUnavailableState
								label={resource.displayName}
								description={
									refreshing
										? "Refreshing the image preview..."
										: "The preview expired or could not be loaded."
								}
								downloadUrl={resource.downloadUrl}
								className="max-w-md"
							/>
						) : (
							<img
								src={url || resource.previewUrl}
								alt={resource.displayName}
								onError={() => {
									void handleError();
								}}
								className={cn(
									"rounded-[24px] border border-black/5 shadow-[0_30px_80px_rgba(15,10,7,0.12)]",
									fitMode === "contain"
										? "h-auto object-contain"
										: "h-full max-h-none w-full object-cover",
								)}
								style={
									fitMode === "contain"
										? { maxWidth: "none", width: `${zoom * 100}%` }
										: {
												transform: `scale(${zoom})`,
												transformOrigin: "center center",
											}
								}
							/>
						)}
					</div>
				</ScrollArea>
			</div>
		</ViewerSurface>
	);
}

function VideoResourceViewer({ resource }: { resource: ResourceRecord }) {
	const { isFullscreen, targetRef, toggleFullscreen } = useFullscreenTarget();
	const { url, broken, refreshing, handleError } = useResourcePreviewUrl(resource);

	return (
		<ViewerSurface
			surfaceRef={targetRef}
			title="Video viewer"
			description="Playback controls stay available inline, including sound and scrub."
			className={cn(
				isFullscreen && "h-screen w-screen rounded-none border-0 bg-black",
			)}
			contentClassName={cn(isFullscreen && "bg-black")}
			controls={
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={() => void toggleFullscreen()}
				>
					{isFullscreen ? (
						<Minimize2 className="size-4" />
					) : (
						<Maximize2 className="size-4" />
					)}
					{isFullscreen ? "Exit full screen" : "Full screen"}
				</Button>
			}
		>
			<div
				className={cn(
					"flex items-center justify-center bg-black",
					isFullscreen ? "h-full" : "h-[min(74vh,920px)]",
				)}
			>
				{broken ? (
					<PreviewUnavailableState
						label={resource.displayName}
						description={
							refreshing
								? "Refreshing the video preview..."
								: "The video preview expired or could not be loaded."
						}
						downloadUrl={resource.downloadUrl}
						className="max-w-md"
					/>
				) : (
					<video
						src={url || resource.previewUrl}
						onError={() => {
							void handleError();
						}}
						className="h-full w-full object-contain"
						preload="metadata"
						controls
						playsInline
					>
						<track
							default
							kind="captions"
							label="Captions unavailable"
							src={EMPTY_CAPTION_TRACK}
							srcLang="en"
						/>
					</video>
				)}
			</div>
		</ViewerSurface>
	);
}

function PdfThumbnailRail({
	file,
	numPages,
	currentPage,
	onSelectPage,
	isFullscreen,
}: {
	file: string;
	numPages: number;
	currentPage: number;
	onSelectPage: (pageNumber: number) => void;
	isFullscreen?: boolean;
}) {
	return (
		<ScrollArea
			className={cn(
				"min-h-0 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65",
				isFullscreen ? "h-full" : "h-[min(72vh,920px)]",
			)}
			viewportClassName="h-full w-full"
			scrollbarClassName="dashboard-content-scrollbar"
			thumbClassName="dashboard-content-scrollbar-thumb"
		>
			<div className="space-y-3 p-3">
				{Array.from({ length: numPages }, (_, index) => {
					const pageNumber = index + 1;
					return (
						<button
							key={`pdf-thumbnail-${pageNumber}`}
							type="button"
							onClick={() => onSelectPage(pageNumber)}
							className={cn(
								"w-full rounded-[20px] border p-2 text-left transition-colors",
								pageNumber === currentPage
									? "border-primary/35 bg-primary/10"
									: "border-[var(--brand-border-soft)] bg-background/75 hover:bg-accent/25",
							)}
						>
							<PdfPagePreview
								file={file}
								pageNumber={pageNumber}
								label="Page"
								title={`Page ${pageNumber}`}
								pageCount={numPages}
								className="aspect-[3/4] rounded-[14px]"
								pageClassName="translate-y-0 scale-100 [&_canvas]:rounded-[10px]"
								width={180}
							/>
							<div className="mt-2 px-1 text-xs font-medium text-muted-foreground">
								Page {pageNumber}
							</div>
						</button>
					);
				})}
			</div>
		</ScrollArea>
	);
}

function PdfResourceViewer({ resource }: { resource: ResourceRecord }) {
	const [pageNumber, setPageNumber] = useState(1);
	const [zoom, setZoom] = useState(1);
	const [numPages, setNumPages] = useState(resource.pageCount ?? 1);
	const { isFullscreen, targetRef, toggleFullscreen } = useFullscreenTarget();
	const { elementRef: viewportRef, width } = useElementWidth<HTMLDivElement>();
	const isClient = useClientReady();
	const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
	const pageNumberRef = useRef(pageNumber);
	const { url, broken, refreshing, handleError } = useResourcePreviewUrl(resource);

	const availablePages = Math.max(1, numPages);
	const basePageWidth = Math.max(360, Math.min((width || 920) - 56, 1040));
	const renderWidth = Math.round(basePageWidth * zoom);

	useEffect(() => {
		setPageNumber((current) => Math.min(current, availablePages));
	}, [availablePages]);

	useEffect(() => {
		pageNumberRef.current = pageNumber;
	}, [pageNumber]);

	function handleLoadSuccess(documentProxy: { numPages: number }) {
		setNumPages(documentProxy.numPages);
	}

	function scrollToPage(nextPage: number) {
		const clampedPage = Math.min(Math.max(1, nextPage), availablePages);
		setPageNumber(clampedPage);
		pageRefs.current[clampedPage]?.scrollIntoView({
			block: "start",
			behavior: "smooth",
		});
	}

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		const viewportElement = viewport;

		let frameId = 0;

		function syncVisiblePage() {
			frameId = 0;

			const viewportRect = viewportElement.getBoundingClientRect();
			let nextPage = pageNumberRef.current;
			let bestDistance = Number.POSITIVE_INFINITY;

			for (let index = 1; index <= availablePages; index += 1) {
				const pageElement = pageRefs.current[index];
				if (!pageElement) {
					continue;
				}

				const rect = pageElement.getBoundingClientRect();
				const distance = Math.abs(rect.top - viewportRect.top - 24);
				if (distance < bestDistance) {
					bestDistance = distance;
					nextPage = index;
				}
			}

			if (nextPage !== pageNumberRef.current) {
				setPageNumber(nextPage);
			}
		}

		function onScroll() {
			if (frameId) {
				return;
			}
			frameId = window.requestAnimationFrame(syncVisiblePage);
		}

		syncVisiblePage();
		viewportElement.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onScroll);

		return () => {
			viewportElement.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onScroll);
			if (frameId) {
				window.cancelAnimationFrame(frameId);
			}
		};
	}, [availablePages, viewportRef]);

	const controls = (
		<>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				onClick={() => scrollToPage(pageNumber - 1)}
				disabled={pageNumber <= 1}
				aria-label="Previous page"
			>
				<ChevronLeft className="size-4" />
			</Button>
			<div className="min-w-24 text-center text-xs font-medium text-muted-foreground">
				Page {pageNumber} / {availablePages}
			</div>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				onClick={() => scrollToPage(pageNumber + 1)}
				disabled={pageNumber >= availablePages}
				aria-label="Next page"
			>
				<ChevronRight className="size-4" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				onClick={() => setZoom((current) => Math.max(0.75, current - 0.2))}
				aria-label="Zoom out"
			>
				<Minus className="size-4" />
			</Button>
			<div className="min-w-14 text-center text-xs font-medium text-muted-foreground">
				{Math.round(zoom * 100)}%
			</div>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				className="rounded-full"
				onClick={() => setZoom((current) => Math.min(2.4, current + 0.2))}
				aria-label="Zoom in"
			>
				<ZoomIn className="size-4" />
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="rounded-full"
				onClick={() => setZoom(1)}
			>
				<RotateCcw className="size-4" />
				Reset
			</Button>
			<Button variant="outline" size="sm" className="rounded-full" asChild>
				<a href={resource.downloadUrl} target="_blank" rel="noreferrer">
					Open in new tab
				</a>
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="rounded-full"
				onClick={() => void toggleFullscreen()}
			>
				{isFullscreen ? (
					<Minimize2 className="size-4" />
				) : (
					<Maximize2 className="size-4" />
				)}
				{isFullscreen ? "Exit full screen" : "Full screen"}
			</Button>
		</>
	);

	return (
		<ViewerSurface
			surfaceRef={targetRef}
			title="PDF reader"
			description="First-page preview in cards, page navigation in detail, and branded scrollbars inside the reader."
			className={cn(
				isFullscreen &&
					"h-[100dvh] w-[100dvw] rounded-none border-0 media-preview-canvas",
			)}
			contentClassName={cn(isFullscreen && "media-preview-canvas")}
			controls={controls}
		>
			<div
				className={cn(
					"media-preview-canvas grid min-h-0 gap-4 overflow-hidden p-4",
					isFullscreen
						? "h-full lg:grid-cols-[220px_minmax(0,1fr)]"
						: "grid-cols-1",
				)}
			>
				{isClient && isFullscreen ? (
					<PdfThumbnailRail
						file={url || resource.previewUrl}
						numPages={availablePages}
						currentPage={pageNumber}
						onSelectPage={scrollToPage}
						isFullscreen={isFullscreen}
					/>
				) : null}
					<ScrollArea
						className={cn(
							"min-h-0 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70",
							isFullscreen ? "h-full" : "h-[min(72vh,920px)]",
						)}
					viewportClassName="h-full w-full"
					viewportRef={viewportRef}
					scrollbarClassName="dashboard-content-scrollbar"
					thumbClassName="dashboard-content-scrollbar-thumb"
					showHorizontalScrollbar
				>
					<div className="flex min-h-full min-w-full items-start justify-center p-6">
						{broken ? (
							<PreviewUnavailableState
								label={resource.displayName}
								description={
									refreshing
										? "Refreshing the PDF preview..."
										: "The PDF preview expired or could not be loaded."
								}
								downloadUrl={resource.downloadUrl}
								className="min-h-[420px] w-full max-w-md"
							/>
						) : isClient ? (
							<Document
								file={url || resource.previewUrl}
								onLoadSuccess={handleLoadSuccess}
								onLoadError={() => {
									void handleError();
								}}
								loading={
									<div className="flex h-full min-h-[480px] items-center justify-center text-sm text-muted-foreground">
										Loading PDF...
									</div>
								}
								error={
									<div className="flex h-full min-h-[480px] items-center justify-center text-sm text-destructive">
										Unable to render this PDF preview.
									</div>
								}
								noData={
									<div className="flex h-full min-h-[480px] items-center justify-center text-sm text-muted-foreground">
										PDF preview unavailable.
									</div>
								}
							>
								<div className="flex min-w-full flex-col items-center gap-6">
									{Array.from({ length: availablePages }, (_, index) => {
										const documentPageNumber = index + 1;
										return (
											<div
												key={`pdf-page-${documentPageNumber}`}
												ref={(element) => {
													pageRefs.current[documentPageNumber] = element;
												}}
												className="flex w-full min-w-fit justify-center"
											>
												<Page
													pageNumber={documentPageNumber}
													width={renderWidth}
													renderAnnotationLayer={false}
													renderTextLayer={false}
													className={cn(
														"[&_canvas]:rounded-[20px] [&_canvas]:shadow-[0_30px_90px_rgba(16,12,10,0.18)]",
														documentPageNumber === pageNumber &&
															"[&_canvas]:ring-1 [&_canvas]:ring-primary/20",
													)}
												/>
											</div>
										);
									})}
								</div>
							</Document>
						) : (
							<DocumentPoster
								label="PDF"
								title={resource.displayName}
								subtitle={formatBytes(resource.sizeBytes)}
								pageCount={resource.pageCount}
								className="aspect-[3/4] w-full max-w-[420px]"
							/>
						)}
					</div>
				</ScrollArea>
			</div>
		</ViewerSurface>
	);
}

function DocumentFallbackViewer({ resource }: { resource: ResourceRecord }) {
	return (
		<ViewerSurface
			title="Document preview"
			description="This format does not have an inline reader yet. Open the original file for the full experience."
		>
			<div className="h-[min(60vh,680px)] p-6">
				<ResourceDocumentPoster resource={resource} />
			</div>
		</ViewerSurface>
	);
}

export function LocalFileThumb({
	file,
	previewUrl,
	className,
	variant = "default",
}: {
	file: File;
	previewUrl: string;
	className?: string;
	variant?: "default" | "compact" | "minimal";
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
			>
				<track
					default
					kind="captions"
					label="Captions unavailable"
					src={EMPTY_CAPTION_TRACK}
					srcLang="en"
				/>
			</video>
		);
	}

	if (variant === "compact") {
		return (
			<CompactDocumentThumb
				label={getDocumentLabel(file.type, file.name)}
				className={className}
			/>
		);
	}

	return (
		<LocalDocumentPoster
			file={file}
			previewUrl={previewUrl}
			className={className}
			variant={variant}
		/>
	);
}

export function ResourceThumb({
	resource,
	className,
	variant = "default",
}: {
	resource: ResourceRecord;
	className?: string;
	variant?: "default" | "compact" | "minimal";
}) {
	const { url, broken, handleError } = useResourcePreviewUrl(resource);

	if (resource.mediaKind === "image") {
		if (broken) {
			return (
				<PreviewUnavailableState
					label={resource.displayName}
					compact
					className={className}
				/>
			);
		}
		return (
			<img
				src={url || resource.previewUrl}
				alt={resource.displayName}
				onError={() => {
					void handleError();
				}}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
			/>
		);
	}

	if (resource.mediaKind === "video") {
		if (broken) {
			return (
				<PreviewUnavailableState
					label={resource.displayName}
					compact
					className={className}
				/>
			);
		}
		return (
			<video
				src={url || resource.previewUrl}
				onError={() => {
					void handleError();
				}}
				className={cn(
					"pointer-events-none h-full w-full object-cover",
					className,
				)}
				preload="metadata"
				muted
				playsInline
			>
				<track
					default
					kind="captions"
					label="Captions unavailable"
					src={EMPTY_CAPTION_TRACK}
					srcLang="en"
				/>
			</video>
		);
	}

	if (variant === "compact") {
		return (
			<CompactDocumentThumb
				label={getDocumentLabel(resource.mimeType, resource.originalName)}
				className={className}
			/>
		);
	}

	return (
		<ResourceDocumentPoster
			resource={resource}
			className={className}
			variant={variant}
		/>
	);
}

export function ResourceViewer({
	resource,
	className,
}: {
	resource: ResourceRecord;
	className?: string;
}) {
	if (resource.mediaKind === "image") {
		return (
			<div className={cn("w-full", className)}>
				<ImageResourceViewer resource={resource} />
			</div>
		);
	}
	if (resource.mediaKind === "video") {
		return (
			<div className={cn("w-full", className)}>
				<VideoResourceViewer resource={resource} />
			</div>
		);
	}
	if (resource.mimeType === "application/pdf") {
		return (
			<div className={cn("w-full", className)}>
				<PdfResourceViewer resource={resource} />
			</div>
		);
	}
	return (
		<div className={cn("w-full", className)}>
			<DocumentFallbackViewer resource={resource} />
		</div>
	);
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
				className="rounded-full border-red-500/25 text-red-600 dark:text-red-300"
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
				className="rounded-full border-amber-500/25 text-amber-600 dark:text-amber-300"
			>
				<TriangleAlert className="size-3.5" />
				{warningCount} warnings
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="rounded-full border-emerald-500/25 text-emerald-600 dark:text-emerald-300"
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
