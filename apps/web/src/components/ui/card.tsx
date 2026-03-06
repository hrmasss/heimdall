import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	variant?: "default" | "elevated" | "glass";
}

export function Card({
	className,
	variant = "default",
	...props
}: CardProps) {
	return (
		<div
			className={cn(
				"rounded-xl border border-[var(--color-border)] transition-all duration-200",
				{
					"bg-[var(--color-bg-subtle)]": variant === "default",
					"bg-[var(--color-bg-elevated)] shadow-lg": variant === "elevated",
					"glass": variant === "glass",
				},
				className,
			)}
			{...props}
		/>
	);
}

export function CardHeader({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex flex-col space-y-1.5 p-6", className)}
			{...props}
		/>
	);
}

export function CardTitle({
	className,
	...props
}: HTMLAttributes<HTMLHeadingElement>) {
	return (
		<h3
			className={cn(
				"text-lg font-semibold leading-none tracking-tight text-[var(--color-text)]",
				className,
			)}
			{...props}
		/>
	);
}

export function CardDescription({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			className={cn("text-sm text-[var(--color-text-muted)]", className)}
			{...props}
		/>
	);
}

export function CardContent({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex items-center p-6 pt-0", className)}
			{...props}
		/>
	);
}
