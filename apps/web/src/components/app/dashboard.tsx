import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({
	eyebrow,
	title,
	description,
	actions,
	primaryAction,
	secondaryActions,
	overflowActions,
}: {
	eyebrow?: string;
	title: string;
	description: string;
	actions?: ReactNode;
	primaryAction?: ReactNode;
	secondaryActions?: ReactNode;
	overflowActions?: { label: string; action: ReactNode }[];
}) {
	const resolvedActions =
		primaryAction || secondaryActions || overflowActions?.length ? (
			<div className="flex flex-wrap items-center gap-1.5">
				{secondaryActions}
				{overflowActions?.length ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon-sm"
								className="rounded-full"
								aria-label="More actions"
							>
								<MoreHorizontal className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="min-w-44 rounded-2xl p-1.5"
						>
							{overflowActions.map((item) => (
								<DropdownMenuItem
									key={item.label}
									className="rounded-xl px-3 py-2.5"
								>
									{item.action}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
				{primaryAction}
			</div>
		) : (
			actions
		);

	return (
		<div className="dashboard-page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div className="space-y-2.5">
				{eyebrow ? (
					<div className="text-xs font-medium uppercase tracking-[0.24em] text-[var(--brand-accent)]">
						{eyebrow}
					</div>
				) : null}
				<div className="space-y-1.5">
					<h1 className="dashboard-page-title text-3xl font-semibold tracking-tight md:text-4xl">
						{title}
					</h1>
					<p className="dashboard-page-copy max-w-xl text-sm text-muted-foreground md:text-base">
						{description}
					</p>
				</div>
			</div>
			{resolvedActions ? (
				<div className="flex flex-wrap items-center gap-1.5">
					{resolvedActions}
				</div>
			) : null}
		</div>
	);
}

export function InsightCard({
	title,
	value,
	detail,
	delta,
	icon: Icon,
	tone = "default",
}: {
	title: string;
	value: string;
	detail: string;
	delta?: string;
	icon: LucideIcon;
	tone?: "default" | "success" | "warning";
}) {
	return (
		<SurfaceCard className="kpi-card">
			<div className="flex items-start justify-between gap-4">
				<div className="space-y-3">
					<div className="kpi-label">{title}</div>
					<div className="space-y-1">
						<div className="kpi-value">{value}</div>
						<div className="text-sm text-muted-foreground">{detail}</div>
					</div>
				</div>
				<div
					className={cn(
						"kpi-icon shrink-0",
						tone === "default" && "text-[var(--brand-primary)]",
						tone === "success" &&
							"text-[var(--brand-success)] bg-[color-mix(in_srgb,var(--brand-success)_12%,transparent)]",
						tone === "warning" &&
							"text-[var(--brand-warning)] bg-[color-mix(in_srgb,var(--brand-warning)_14%,transparent)]",
					)}
				>
					<Icon className="size-5" />
				</div>
			</div>
			{delta ? <div className="mt-4 pill pill-info w-fit">{delta}</div> : null}
		</SurfaceCard>
	);
}

export function DashboardPanel({
	title,
	description,
	action,
	className,
	children,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
	children: ReactNode;
}) {
	return (
		<SurfaceCard className={cn("dashboard-section", className)}>
			<div className="dashboard-panel-head mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<h2 className="dashboard-panel-title text-lg font-semibold tracking-tight">
						{title}
					</h2>
					{description ? (
						<p className="dashboard-panel-copy text-sm text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</SurfaceCard>
	);
}
