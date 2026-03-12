import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { cn } from "@/lib/utils";

export const adminInputClassName = "h-11 rounded-2xl px-4";
export const adminSelectTriggerClassName =
	"data-[size=default]:h-11 w-full rounded-2xl px-4";
export const adminTextareaClassName = "min-h-36 rounded-[24px] px-4 py-3";

export function AdminFormPage({
	eyebrow,
	title,
	description,
	actions,
	aside,
	children,
}: {
	eyebrow: string;
	title: string;
	description: string;
	actions?: ReactNode;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow={eyebrow}
				title={title}
				description={description}
				actions={actions}
			/>
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className="space-y-6">{children}</div>
				{aside ? <div className="space-y-6">{aside}</div> : null}
			</div>
		</div>
	);
}

export function AdminFormSection({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<SurfaceCard className={cn("p-5 md:p-6", className)}>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
			<div className="mt-5">{children}</div>
		</SurfaceCard>
	);
}

export function AdminFormGrid({
	children,
	className,
	columns = 2,
}: {
	children: ReactNode;
	className?: string;
	columns?: 1 | 2;
}) {
	return (
		<div
			className={cn(
				"grid gap-5",
				columns === 2 ? "md:grid-cols-2" : "grid-cols-1",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function AdminFormField({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <div className={cn("space-y-2.5", className)}>{children}</div>;
}

export function AdminFormSubsection({
	title,
	description,
	children,
	className,
	actions,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
	actions?: ReactNode;
}) {
	return (
		<div
			className={cn(
				"space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 md:p-5",
				className,
			)}
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="space-y-1">
					<div className="font-medium">{title}</div>
					{description ? (
						<div className="text-sm text-muted-foreground">{description}</div>
					) : null}
				</div>
				{actions ? <div className="shrink-0">{actions}</div> : null}
			</div>
			{children}
		</div>
	);
}
