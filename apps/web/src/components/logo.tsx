import { cn } from "@/lib/utils";

interface LogoProps {
	className?: string;
	showText?: boolean;
	size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
	const sizes = {
		sm: { icon: 24, text: "text-lg" },
		md: { icon: 32, text: "text-xl" },
		lg: { icon: 40, text: "text-2xl" },
	};

	const { icon, text } = sizes[size];

	return (
		<div className={cn("flex items-center gap-2", className)}>
			{/* Heimdall Eye Icon - Abstract all-seeing eye */}
			<svg
				width={icon}
				height={icon}
				viewBox="0 0 40 40"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="flex-shrink-0"
			>
				{/* Outer ring */}
				<circle
					cx="20"
					cy="20"
					r="18"
					stroke="currentColor"
					strokeWidth="1.5"
					className="text-[var(--color-border)]"
				/>
				{/* Eye shape */}
				<path
					d="M6 20C6 20 12 10 20 10C28 10 34 20 34 20C34 20 28 30 20 30C12 30 6 20 6 20Z"
					stroke="currentColor"
					strokeWidth="1.5"
					fill="none"
					className="text-[var(--color-text)]"
				/>
				{/* Iris */}
				<circle
					cx="20"
					cy="20"
					r="6"
					fill="currentColor"
					className="text-[var(--color-accent)]"
				/>
				{/* Pupil */}
				<circle cx="20" cy="20" r="2.5" fill="currentColor" className="text-[var(--color-bg)]" />
				{/* Highlight */}
				<circle cx="22" cy="18" r="1.5" fill="currentColor" className="text-white opacity-60" />
			</svg>
			{showText && (
				<span
					className={cn(
						"font-semibold tracking-tight text-[var(--color-text)]",
						text,
					)}
				>
					Heimdall
				</span>
			)}
		</div>
	);
}
