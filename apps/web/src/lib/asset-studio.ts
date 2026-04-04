import type { ResourceRecord } from "@/lib/api-types";

export type StudioMode = "image" | "pdf" | "reel";

export type StudioTool =
	| "resize"
	| "fill"
	| "layout"
	| "clip"
	| "caption"
	| "touchup"
	| "extract"
	| "vertical";

export type StudioSource = "library" | "detail" | "set";

export type StudioToolDefinition = {
	value: StudioTool;
	label: string;
	description: string;
	status: "live" | "soon";
};

export const studioModeMeta: Record<
	StudioMode,
	{
		label: string;
		description: string;
		actionType: string;
		promptScope: string;
		outputLabel: string;
	}
> = {
	image: {
		label: "Image prep",
		description:
			"Prepare reusable image variants, filled compositions, and polished graphics from one source asset.",
		actionType: "image_generate",
		promptScope: "studio_image",
		outputLabel: "Reusable image variant",
	},
	pdf: {
		label: "Document / PDF",
		description:
			"Shape slide-style documents and downloadable proof assets without leaving the workspace.",
		actionType: "linkedin_pdf_generate_beta",
		promptScope: "studio_pdf",
		outputLabel: "Reusable document asset",
	},
	reel: {
		label: "Video clip",
		description:
			"Turn a source video into a tighter social-ready cut with captions and pacing instructions.",
		actionType: "reel_generate_beta",
		promptScope: "studio_reel",
		outputLabel: "Reusable video output",
	},
};

export const studioToolsByMode: Record<StudioMode, StudioToolDefinition[]> = {
	image: [
		{
			value: "resize",
			label: "Crop / resize",
			description: "Prepare another aspect ratio or composition from the source image.",
			status: "live",
		},
		{
			value: "fill",
			label: "Expand / fill",
			description:
				"Guide an expanded composition when the target format needs extra room.",
			status: "live",
		},
		{
			value: "touchup",
			label: "Basic touch-up",
			description: "Color and polish tools will land here next.",
			status: "soon",
		},
	],
	pdf: [
		{
			value: "layout",
			label: "Layout document",
			description: "Turn structured notes into a branded, paged PDF.",
			status: "live",
		},
		{
			value: "extract",
			label: "Extract slides",
			description: "Slide extraction and remixing will land here next.",
			status: "soon",
		},
	],
	reel: [
		{
			value: "clip",
			label: "Clip video",
			description: "Create a shorter social-ready cut from a source video.",
			status: "live",
		},
		{
			value: "caption",
			label: "Caption video",
			description: "Generate a tighter cut with guided captioning.",
			status: "live",
		},
		{
			value: "vertical",
			label: "Prepare vertical cut",
			description: "Dedicated vertical reframing is planned next.",
			status: "soon",
		},
	],
};

export function getStudioModeForResource(
	resource?: Pick<ResourceRecord, "mediaKind" | "mimeType"> | null,
): StudioMode {
	if (!resource) {
		return "image";
	}
	if (resource.mediaKind === "video") {
		return "reel";
	}
	if (resource.mediaKind === "document") {
		return "pdf";
	}
	return "image";
}

export function getDefaultStudioTool(mode: StudioMode): StudioTool {
	return studioToolsByMode[mode].find((tool) => tool.status === "live")?.value ?? "resize";
}

export function getStudioToolDefinition(
	mode: StudioMode,
	tool?: string | null,
): StudioToolDefinition {
	return (
		studioToolsByMode[mode].find((item) => item.value === tool) ??
		studioToolsByMode[mode][0]
	);
}

export function buildStudioHref({
	resourceId,
	mode,
	tool,
	source = "library",
}: {
	resourceId?: string | null;
	mode: StudioMode;
	tool?: StudioTool;
	source?: StudioSource;
}) {
	const params = new URLSearchParams();
	params.set("mode", mode);
	params.set("tool", tool ?? getDefaultStudioTool(mode));
	params.set("source", source);
	if (resourceId) {
		params.set("resourceId", resourceId);
	}
	return `/dashboard/studio?${params.toString()}`;
}
