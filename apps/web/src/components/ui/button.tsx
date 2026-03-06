import { type VariantProps, cva } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
	{
		variants: {
			variant: {
				default:
					"bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-muted)] active:scale-[0.98]",
				secondary:
					"bg-[var(--color-bg-elevated)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-muted)] hover:border-[var(--color-text-subtle)] active:scale-[0.98]",
				ghost:
					"text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]",
				outline:
					"border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-text-subtle)]",
				link: "text-[var(--color-accent)] underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-12 px-6 text-base",
				xl: "h-14 px-8 text-lg",
				icon: "h-10 w-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export function Button({
	className,
	variant,
	size,
	...props
}: ButtonProps) {
	return (
		<button
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}
