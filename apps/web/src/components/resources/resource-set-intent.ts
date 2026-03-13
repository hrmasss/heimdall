import type { ResourceCapabilityMatrix } from "@/lib/api-types";

export type ResourceSetIntentPlatformOption = {
	value: string;
	label: string;
	surfaces: ResourceSetIntentSurfaceOption[];
};

export type ResourceSetIntentSurfaceOption = {
	value: string;
	label: string;
};

const fallbackPlatformOptions: ResourceSetIntentPlatformOption[] = [
	{
		value: "instagram",
		label: "Instagram",
		surfaces: [
			{ value: "feed", label: "Feed" },
			{ value: "carousel", label: "Carousel" },
			{ value: "stories", label: "Stories" },
			{ value: "reels", label: "Reels" },
		],
	},
	{
		value: "facebook",
		label: "Facebook",
		surfaces: [
			{ value: "feed", label: "Feed" },
			{ value: "carousel", label: "Carousel" },
			{ value: "stories", label: "Stories" },
			{ value: "reels", label: "Reels" },
		],
	},
	{
		value: "linkedin",
		label: "LinkedIn",
		surfaces: [
			{ value: "feed", label: "Feed" },
			{ value: "carousel", label: "Carousel" },
			{ value: "document", label: "Document" },
			{ value: "video", label: "Video" },
		],
	},
	{
		value: "x",
		label: "X",
		surfaces: [
			{ value: "post", label: "Post" },
			{ value: "thread", label: "Thread" },
			{ value: "video", label: "Video" },
		],
	},
	{
		value: "tiktok",
		label: "TikTok",
		surfaces: [
			{ value: "post", label: "Post" },
			{ value: "carousel", label: "Carousel" },
			{ value: "video", label: "Video" },
		],
	},
	{
		value: "youtube",
		label: "YouTube",
		surfaces: [
			{ value: "video", label: "Video" },
			{ value: "shorts", label: "Shorts" },
		],
	},
];

function titleize(value: string) {
	return value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function getResourceSetIntentOptions(
	capabilities?: ResourceCapabilityMatrix | null,
) {
	if (!capabilities?.rules?.length) {
		return fallbackPlatformOptions;
	}

	const platformMap = new Map<string, ResourceSetIntentPlatformOption>();

	for (const rule of capabilities.rules) {
		const platformKey = rule.platform.trim();
		const surfaceKey = rule.surface.trim();
		if (!platformKey || !surfaceKey) {
			continue;
		}

		const existingPlatform = platformMap.get(platformKey) ?? {
			value: platformKey,
			label: titleize(platformKey),
			surfaces: [],
		};
		if (
			!existingPlatform.surfaces.some((surface) => surface.value === surfaceKey)
		) {
			existingPlatform.surfaces.push({
				value: surfaceKey,
				label: titleize(surfaceKey),
			});
		}
		platformMap.set(platformKey, existingPlatform);
	}

	const options = Array.from(platformMap.values()).sort((left, right) =>
		left.label.localeCompare(right.label),
	);
	for (const option of options) {
		option.surfaces.sort((left, right) =>
			left.label.localeCompare(right.label),
		);
	}
	return options.length > 0 ? options : fallbackPlatformOptions;
}

export function getIntentSurfaceOptions(
	platformOptions: ResourceSetIntentPlatformOption[],
	platform: string,
) {
	return (
		platformOptions.find((option) => option.value === platform)?.surfaces ?? []
	);
}
