import {
	AlertTriangle,
	ArrowRight,
	CalendarClock,
	CheckCircle2,
	Clock3,
	Eye,
	FileStack,
	LineChart,
	Plus,
	Users2,
	WandSparkles,
} from "lucide-react";
import { Link } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
	InsightCard,
} from "@/components/app/dashboard";
import { Button } from "@/components/ui/button";
import { useSocialConnectionSummary } from "@/hooks/use-social-connection-summary";
import { formatPlatformLabel } from "@/lib/platforms";

const metrics = [
	{
		title: "Planned launches",
		value: "18",
		detail: "Across 7 active campaigns",
		delta: "+3 this week",
		icon: FileStack,
	},
	{
		title: "Audience reach",
		value: "4.8M",
		detail: "Blended projection for this cycle",
		delta: "+12.4% vs last cycle",
		icon: Eye,
		tone: "success" as const,
	},
	{
		title: "Review throughput",
		value: "7.1h",
		detail: "Median time to approval",
		delta: "-38 min improvement",
		icon: Clock3,
	},
	{
		title: "Team utilization",
		value: "86%",
		detail: "Healthy distribution across pods",
		delta: "2 editors overloaded",
		icon: Users2,
		tone: "warning" as const,
	},
];

const launchBoard = [
	{
		title: "Spring narrative refresh",
		status: "Ready",
		owner: "Rina",
		date: "Mar 10",
	},
	{
		title: "Founder memo thread",
		status: "Review",
		owner: "Imran",
		date: "Mar 11",
	},
	{
		title: "Retail teaser reel",
		status: "Blocked",
		owner: "Pia",
		date: "Mar 12",
	},
];

const automationStats = [
	{ label: "Auto-assign owner", value: "93%" },
	{ label: "Asset verification", value: "71%" },
	{ label: "Approval reminders", value: "96%" },
];

const riskItems = [
	{
		label: "Retail teaser reel missing caption approval",
		icon: AlertTriangle,
		badgeClass: "pill pill-error",
	},
	{
		label: "Founder memo thread waiting on legal review",
		icon: Clock3,
		badgeClass: "pill pill-warning",
	},
	{
		label: "Auto-retry fixed yesterday’s asset sync issue",
		icon: CheckCircle2,
		badgeClass: "pill pill-success",
	},
];

export function DashboardOverview() {
	const { loading: loadingConnections, summary } = useSocialConnectionSummary();
	const setupNeeded = !summary.hasHealthySelectedTarget;

	return (
		<div className="dashboard-page-stack space-y-6">
			<DashboardPageHeader
				eyebrow="Control room"
				title="Overview"
				description="A high-level view of campaign health, pending approvals, and the work most likely to slip this week."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/platforms">
								{setupNeeded ? "Connect platforms" : "Manage platforms"}
								<ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/analytics">
								<LineChart className="size-4" />
								View analytics
							</Link>
						</Button>
						<Button
							className="rounded-full bg-gradient-brand text-white border-0"
							asChild
						>
							<Link to="/dashboard/posts/new">
								<Plus className="size-4" />
								New post
							</Link>
						</Button>
					</>
				}
			/>

			<SurfaceCard
				className={
					setupNeeded
						? "dashboard-card border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(195,123,79,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))]"
						: "dashboard-card border border-[var(--brand-border-soft)] bg-background/72"
				}
			>
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="space-y-2">
						<div className="text-lg font-medium">
							{setupNeeded
								? "Connect platforms before your team starts scheduling and publishing."
								: "Platform connections are ready for day-to-day publishing."}
						</div>
						<div className="max-w-3xl text-sm text-muted-foreground">
							{setupNeeded
								? "Planning and approvals already work without this, but connecting platforms unlocks posting on behalf of the workspace, scheduling into real channels, validation, and smoother operational follow-through."
								: loadingConnections
									? "Refreshing workspace publishing health."
									: summary.connectedProviders.length > 0
										? `Connected providers: ${summary.connectedProviders.map((provider) => formatPlatformLabel(provider)).join(", ")}.`
										: "Connected providers are ready to manage from settings."}
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<span className="pill pill-info">
							{loadingConnections
								? "Checking connection health..."
								: `${summary.healthyConnectionCount} healthy connection${summary.healthyConnectionCount === 1 ? "" : "s"}`}
						</span>
						<span className="pill pill-muted">
							{summary.selectedTargetCount} selected target
							{summary.selectedTargetCount === 1 ? "" : "s"}
						</span>
					</div>
				</div>
			</SurfaceCard>

			<div className="dashboard-grid-gap grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric) => (
					<InsightCard key={metric.title} {...metric} />
				))}
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
				<DashboardPanel
					title="Launch board"
					description="Today’s critical launches and the approvals that still need intervention."
					action={
						<Button variant="ghost" className="rounded-full" asChild>
							<Link to="/dashboard/posts">
								Open posts
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					}
				>
					<div className="dashboard-grid-gap grid gap-4 lg:grid-cols-3">
						{launchBoard.map((item) => (
							<SurfaceCard key={item.title} tone="muted" className="dashboard-card">
								<div className="flex items-start justify-between gap-4">
									<div>
										<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
											{item.date}
										</div>
										<div className="mt-2 text-lg font-medium">{item.title}</div>
									</div>
									<div
										className={
											item.status === "Ready"
												? "pill pill-success"
												: item.status === "Review"
													? "pill pill-warning"
													: "pill pill-error"
										}
									>
										{item.status}
									</div>
								</div>
								<div className="mt-6 text-sm text-muted-foreground">
									Owner: {item.owner}
								</div>
							</SurfaceCard>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Risks to clear"
					description="Signals worth attention in the next 24 hours."
				>
					<div className="space-y-3">
						{riskItems.map((item) => (
							<div
								key={item.label}
								className="dashboard-card-sm flex items-start gap-3 border border-[var(--brand-border-soft)] bg-background/70"
							>
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<item.icon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium">{item.label}</div>
									<div className="mt-2">
										<span className={item.badgeClass}>Needs review</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</DashboardPanel>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
				<DashboardPanel
					title="Delivery curve"
					description="A lightweight performance snapshot for this week."
				>
					<div className="dashboard-card border border-[var(--brand-border-soft)] bg-background/70">
						<div className="flex h-60 items-end gap-3">
							{[34, 42, 30, 68, 74, 58, 82].map((height, index) => (
								<div
									key={height}
									className="flex flex-1 flex-col items-center gap-3"
								>
									<div
										className="w-full rounded-t-[16px] bg-gradient-brand"
										style={{ height: `${height * 2}px` }}
									/>
									<div className="text-xs text-muted-foreground">
										{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}
									</div>
								</div>
							))}
						</div>
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Automation health"
					description="Core routines now share the same visual language as the rest of the dashboard."
					action={
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/automations">
								<WandSparkles className="size-4" />
								Manage rules
							</Link>
						</Button>
					}
				>
					<div className="dashboard-grid-gap grid gap-4 sm:grid-cols-3">
						{automationStats.map((item) => (
							<SurfaceCard
								key={item.label}
								tone="muted"
								className="dashboard-card text-center"
							>
								<div className="text-3xl font-semibold tracking-tight">
									{item.value}
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{item.label}
								</div>
							</SurfaceCard>
						))}
					</div>
					<div className="dashboard-card-sm mt-4 border border-[var(--brand-border-soft)] bg-background/70 text-sm text-muted-foreground">
						Daily summaries, reviewer nudges, and file checks all run in the
						same command pattern. That consistency reduces cognitive load across
						the workspace.
					</div>
				</DashboardPanel>
			</div>

			<DashboardPanel
				title="This week’s cadence"
				description="The product now includes real supporting pages beyond Overview, so navigation is no longer a dead end."
			>
				<div className="dashboard-grid-gap grid gap-4 md:grid-cols-3">
					{[
						{
							icon: CalendarClock,
							title: "Calendar",
							description:
								"Review sequencing across launch windows and approval checkpoints.",
							href: "/dashboard/calendar",
						},
						{
							icon: FileStack,
							title: "Posts table",
							description:
								"Use the advanced table for dense operations work and responsive review.",
							href: "/dashboard/posts",
						},
						{
							icon: Users2,
							title: "Team",
							description:
								"Check load, ownership, and workload distribution across the pod.",
							href: "/dashboard/team",
						},
					].map((item) => (
						<Link
							key={item.title}
							to={item.href}
							className="dashboard-card border border-[var(--brand-border-soft)] bg-background/70 transition-transform hover:-translate-y-0.5"
						>
							<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<item.icon className="size-5" />
							</div>
							<div className="mt-4 text-lg font-medium">{item.title}</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{item.description}
							</p>
						</Link>
					))}
				</div>
			</DashboardPanel>
		</div>
	);
}
