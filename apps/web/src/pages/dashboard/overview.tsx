import { ArrowRight, CalendarRange, CircleAlert, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardOperationalHeader } from "@/components/app/dashboard";
import { Button } from "@/components/ui/button";
import type {
	DashboardOverviewPriorityItem,
	DashboardOverviewQueueItem,
	DashboardOverviewSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { formatPlatformLabel } from "@/lib/platforms";

function toneClass(tone?: string) {
	switch (tone) {
		case "danger":
			return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-200";
		case "warning":
			return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
		case "success":
			return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
		case "info":
			return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200";
		default:
			return "border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground";
	}
}

function formatPlannedTime(value?: string) {
	if (!value) {
		return "Unscheduled";
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		return "Unscheduled";
	}
	return parsed.toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

function PriorityRow({ item }: { item: DashboardOverviewPriorityItem }) {
	return (
		<div className="flex flex-col gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3.5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex flex-wrap items-center gap-2">
						{item.context ? (
							<span
								className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClass(item.tone)}`}
							>
								{item.context}
							</span>
						) : null}
						<div className="text-sm font-medium">{item.title}</div>
					</div>
					<div className="text-sm text-muted-foreground">{item.detail}</div>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Button size="sm" className="rounded-full" asChild>
					<Link to={item.primaryAction.href}>{item.primaryAction.label}</Link>
				</Button>
				{item.secondaryAction ? (
					<Button size="sm" variant="ghost" className="rounded-full" asChild>
						<Link to={item.secondaryAction.href}>
							{item.secondaryAction.label}
						</Link>
					</Button>
				) : null}
			</div>
		</div>
	);
}

function QueueRow({ item }: { item: DashboardOverviewQueueItem }) {
	return (
		<div className="grid gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3.5 md:grid-cols-[92px_minmax(0,1fr)_auto] md:items-center">
			<div className="flex h-11 items-center justify-center rounded-2xl bg-primary/10 px-3 text-sm font-semibold text-primary">
				{formatPlannedTime(item.plannedAt)}
			</div>
			<div className="min-w-0 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<div className="text-sm font-medium">{item.title}</div>
					<span
						className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${toneClass(item.tone)}`}
					>
						{item.status.replace(/_/g, " ")}
					</span>
				</div>
				<div className="text-sm text-muted-foreground">{item.detail}</div>
			</div>
			<div className="flex flex-wrap items-center gap-2 md:justify-end">
				<Button size="sm" variant="outline" className="rounded-full" asChild>
					<Link to={item.primaryAction.href}>{item.primaryAction.label}</Link>
				</Button>
				{item.secondaryAction ? (
					<Button size="sm" variant="ghost" className="rounded-full" asChild>
						<Link to={item.secondaryAction.href}>
							{item.secondaryAction.label}
						</Link>
					</Button>
				) : null}
			</div>
		</div>
	);
}

export function DashboardOverview() {
	const { customerRequest } = useAuth();
	const [summary, setSummary] = useState<DashboardOverviewSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showSignals, setShowSignals] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function loadSummary() {
			setLoading(true);
			setError(null);
			try {
				const response = await customerRequest<DashboardOverviewSummary>(
					"/dashboard/overview-summary",
				);
				if (!cancelled) {
					setSummary(response);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load the operational summary.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadSummary();
		return () => {
			cancelled = true;
		};
	}, [customerRequest]);

	const providerLabel = useMemo(() => {
		if (!summary?.publishingHealth.connectedProviders.length) {
			return "No live providers connected";
		}
		return summary.publishingHealth.connectedProviders
			.map((provider) => formatPlatformLabel(provider))
			.join(", ");
	}, [summary]);

	return (
		<div className="dashboard-page-stack space-y-5">
			<DashboardOperationalHeader
				title="Today"
				description={
					summary?.stateSentence ??
					"See the next few actions, clear what matters, and move on."
				}
				primaryAction={
					<Button
						className="rounded-full border-0 bg-gradient-brand text-white"
						asChild
					>
						<Link to="/dashboard/posts/new">
							<Plus className="size-4" />
							Create post
						</Link>
					</Button>
				}
				secondaryActions={
					<Button variant="ghost" className="rounded-full" asChild>
						<Link to="/dashboard/calendar">
							<CalendarRange className="size-4" />
							Open calendar
						</Link>
					</Button>
				}
			/>

			{error ? (
				<SurfaceCard className="dashboard-card-sm flex items-start gap-3 border border-destructive/20 bg-destructive/10 text-sm text-destructive">
					<CircleAlert className="mt-0.5 size-4 shrink-0" />
					<div>{error}</div>
				</SurfaceCard>
			) : null}

			{summary ? (
				<>
					<SurfaceCard className="dashboard-card border border-[var(--brand-border-soft)] bg-background/72">
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							{summary.statusItems.map((item) => (
								<div
									key={item.label}
									className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3"
								>
									<div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
										{item.label}
									</div>
									<div className="mt-2 text-2xl font-semibold tracking-tight">
										{item.value}
									</div>
								</div>
							))}
						</div>
					</SurfaceCard>

					<div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]">
						<div className="space-y-5">
							<SurfaceCard className="dashboard-card">
								<div className="mb-4 flex items-center justify-between gap-3">
									<div>
										<div className="text-base font-semibold tracking-tight">
											Needs attention now
										</div>
										<div className="text-sm text-muted-foreground">
											Keep the list short so the next move is obvious.
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="rounded-full"
										asChild
									>
										<Link to="/dashboard/posts">
											View all
											<ArrowRight className="size-4" />
										</Link>
									</Button>
								</div>
								<div className="space-y-3">
									{summary.priorityItems.map((item) => (
										<PriorityRow key={item.id} item={item} />
									))}
								</div>
							</SurfaceCard>

							<SurfaceCard className="dashboard-card">
								<div className="mb-4 flex items-center justify-between gap-3">
									<div>
										<div className="text-base font-semibold tracking-tight">
											Today&apos;s queue
										</div>
										<div className="text-sm text-muted-foreground">
											Stay in the operational lane without opening another page.
										</div>
									</div>
								</div>
								<div className="space-y-3">
									{summary.queueItems.length > 0 ? (
										summary.queueItems.map((item) => (
											<QueueRow key={item.id} item={item} />
										))
									) : (
										<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] bg-background/70 px-4 py-6 text-sm text-muted-foreground">
											No live queue items are lined up yet. Create or schedule
											the next post to make this page useful tomorrow.
										</div>
									)}
								</div>
							</SurfaceCard>
						</div>

						<div className="space-y-5">
							<SurfaceCard className="dashboard-card space-y-4">
								<div className="space-y-1">
									<div className="text-base font-semibold tracking-tight">
										Publishing health
									</div>
									<div className="text-sm text-muted-foreground">
										{summary.publishingHealth.coverageLabel}
									</div>
								</div>
								<div
									className={`rounded-[20px] border px-4 py-3.5 ${toneClass(
										summary.publishingHealth.status === "ready"
											? "success"
											: summary.publishingHealth.status === "warning"
												? "warning"
												: "danger",
									)}`}
								>
									<div className="text-sm font-medium">
										{summary.publishingHealth.title}
									</div>
									<div className="mt-1 text-sm opacity-90">
										{summary.publishingHealth.detail}
									</div>
								</div>
								<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3">
										<div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
											Healthy connections
										</div>
										<div className="mt-2 text-xl font-semibold">
											{summary.publishingHealth.healthyConnections}
										</div>
									</div>
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3">
										<div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
											Selected targets
										</div>
										<div className="mt-2 text-xl font-semibold">
											{summary.publishingHealth.selectedTargets}
										</div>
									</div>
									<div className="rounded-[18px] border border-[var(--brand-border-soft)] bg-background/75 px-4 py-3">
										<div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
											Providers
										</div>
										<div className="mt-2 text-sm font-medium">
											{providerLabel}
										</div>
									</div>
								</div>
							</SurfaceCard>

							<SurfaceCard className="dashboard-card space-y-4">
								<div className="space-y-1">
									<div className="text-base font-semibold tracking-tight">
										{summary.nextMove.title}
									</div>
									<div className="text-sm text-muted-foreground">
										{summary.nextMove.detail}
									</div>
								</div>
								{summary.nextMove.action ? (
									<Button variant="outline" className="rounded-full" asChild>
										<Link to={summary.nextMove.action.href}>
											{summary.nextMove.action.label}
										</Link>
									</Button>
								) : null}
							</SurfaceCard>

							<SurfaceCard className="dashboard-card space-y-4">
								<div className="space-y-1">
									<div className="text-base font-semibold tracking-tight">
										{summary.backlog.title}
									</div>
									<div className="text-sm text-muted-foreground">
										{summary.backlog.detail}
									</div>
								</div>
								{summary.backlog.action ? (
									<Button variant="ghost" className="rounded-full px-0" asChild>
										<Link to={summary.backlog.action.href}>
											{summary.backlog.action.label}
										</Link>
									</Button>
								) : null}
							</SurfaceCard>
						</div>
					</div>

					<SurfaceCard className="dashboard-card">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<div className="text-base font-semibold tracking-tight">
									Signals for later
								</div>
								<div className="text-sm text-muted-foreground">
									Helpful guidance stays collapsed until you actually need it.
								</div>
							</div>
							<Button
								variant="ghost"
								size="sm"
								className="rounded-full"
								onClick={() => setShowSignals((current) => !current)}
							>
								{showSignals ? "Hide" : "Show"}
							</Button>
						</div>
						{showSignals ? (
							<div className="mt-4 grid gap-3 md:grid-cols-2">
								{summary.signals.map((signal) => (
									<div
										key={signal.title}
										className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3.5"
									>
										<div className="text-sm font-medium">{signal.title}</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{signal.detail}
										</div>
										{signal.action ? (
											<Button
												variant="ghost"
												size="sm"
												className="mt-3 rounded-full px-0"
												asChild
											>
												<Link to={signal.action.href}>
													{signal.action.label}
												</Link>
											</Button>
										) : null}
									</div>
								))}
							</div>
						) : null}
					</SurfaceCard>
				</>
			) : loading ? (
				<SurfaceCard className="dashboard-card text-sm text-muted-foreground">
					Loading today&apos;s queue.
				</SurfaceCard>
			) : null}
		</div>
	);
}
