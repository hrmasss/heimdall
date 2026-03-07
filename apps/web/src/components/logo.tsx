import { cn } from "@/lib/utils";

interface LogoProps {
	className?: string;
	showText?: boolean;
	size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
	const sizes = {
		sm: { icon: 28, text: "text-lg" },
		md: { icon: 34, text: "text-xl" },
		lg: { icon: 42, text: "text-2xl" },
	};

	const { icon, text } = sizes[size];

	return (
		<div className={cn("flex items-center gap-2.5", className)}>
			<svg
				width={icon}
				height={icon}
				viewBox="0 0 44 44"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="shrink-0"
			>
				<rect
					x="2"
					y="2"
					width="40"
					height="40"
					rx="14"
					fill="color-mix(in srgb, var(--card) 88%, transparent)"
					stroke="var(--brand-border-strong)"
				/>
				<path
					d="M10 22C12.8 16.9 17 14.4 22 14.4C27 14.4 31.2 16.9 34 22C31.2 27.1 27 29.6 22 29.6C17 29.6 12.8 27.1 10 22Z"
					stroke="var(--brand-primary)"
					strokeWidth="1.8"
				/>
				<circle cx="22" cy="22" r="5.8" fill="var(--brand-primary)" />
				<circle cx="22" cy="22" r="2.4" fill="var(--background)" />
				<path
					d="M11 11.5H18.5"
					stroke="var(--brand-secondary)"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
				<path
					d="M25.5 32.5H33"
					stroke="var(--brand-secondary)"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
			{showText ? (
				<span
					className={cn(
						"font-semibold tracking-[-0.03em] text-[var(--brand-ink)]",
						text,
					)}
				>
					Heimdall
				</span>
			) : null}
		</div>
	);
}
