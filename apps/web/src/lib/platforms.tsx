import {
	RiFacebookCircleFill,
	RiInstagramFill,
	RiLinkedinFill,
	RiTiktokFill,
	RiTwitterXFill,
	RiYoutubeFill,
} from "@remixicon/react";
import type { CSSProperties, ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PlatformMeta = {
	label: string;
	color: string;
	icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

export const PLATFORM_META: Record<string, PlatformMeta> = {
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

export function getPlatformMeta(platform: string) {
	return PLATFORM_META[platform] ?? null;
}

export function formatPlatformLabel(platform: string) {
	const knownPlatform = getPlatformMeta(platform);
	if (knownPlatform) {
		return knownPlatform.label;
	}
	return platform
		.split(/[_-]/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function withAlpha(color: string, alpha: number) {
	const normalized = color.trim();
	if (!normalized.startsWith("#")) {
		return color;
	}
	const hex = normalized.slice(1);
	const safeAlpha = Math.max(0, Math.min(1, alpha));
	const expanded =
		hex.length === 3
			? hex
					.split("")
					.map((part) => `${part}${part}`)
					.join("")
			: hex;
	if (expanded.length !== 6) {
		return color;
	}
	const red = Number.parseInt(expanded.slice(0, 2), 16);
	const green = Number.parseInt(expanded.slice(2, 4), 16);
	const blue = Number.parseInt(expanded.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function platformIcon(
	platform: string,
	options?: {
		containerClassName?: string;
		iconClassName?: string;
		backgroundAlpha?: number;
		borderAlpha?: number;
	},
): ReactNode {
	const knownPlatform = getPlatformMeta(platform);
	if (!knownPlatform) {
		return (
			<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border-soft)] text-[0.65rem] font-semibold uppercase">
				{platform.slice(0, 1)}
			</span>
		);
	}
	const Icon = knownPlatform.icon;
	return (
		<span
			className={cn(
				"inline-flex size-7 shrink-0 items-center justify-center rounded-full border",
				options?.containerClassName,
			)}
			style={{
				color: knownPlatform.color,
				borderColor: withAlpha(
					knownPlatform.color,
					options?.borderAlpha ?? 0.2,
				),
				backgroundColor: withAlpha(
					knownPlatform.color,
					options?.backgroundAlpha ?? 0.12,
				),
			}}
		>
			<Icon className={cn("size-4", options?.iconClassName)} />
		</span>
	);
}
