"use client";
import { cn } from "@/lib/utils";

interface MarqueeProps {
	className?: string;
	reverse?: boolean;
	pauseOnHover?: boolean;
	children?: React.ReactNode;
	vertical?: boolean;
	repeat?: number;
}

export function Marquee({
	className,
	reverse,
	pauseOnHover = false,
	children,
	vertical = false,
	repeat = 4,
}: MarqueeProps) {
	const repeatKeys = Array.from(
		{ length: repeat },
		(_, index) => `marquee-${index + 1}`,
	);

	return (
		<div
			className={cn(
				"group flex overflow-hidden [--duration:40s] [--gap:1rem]",
				{
					"flex-row gap-[var(--gap)]": !vertical,
					"flex-col gap-[var(--gap)]": vertical,
				},
				className,
			)}
		>
			{repeatKeys.map((repeatKey) => (
				<div
					key={repeatKey}
					className={cn("flex shrink-0 justify-around gap-[var(--gap)]", {
						"animate-marquee flex-row": !vertical && !reverse,
						"animate-marquee-vertical flex-col": vertical && !reverse,
						"animate-marquee-reverse flex-row": !vertical && reverse,
						"animate-marquee-vertical-reverse flex-col": vertical && reverse,
						"group-hover:[animation-play-state:paused]": pauseOnHover,
					})}
				>
					{children}
				</div>
			))}
		</div>
	);
}
