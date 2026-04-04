import {
	ArrowRight,
	CalendarRange,
	CheckCircle2,
	Clock3,
	Flag,
	FolderKanban,
	Link2,
	Plus,
	TrendingUp,
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
		title: "Scheduled today",
		value: "6",
		detail: "Posts already lined up",
		delta: "2 need a final check",
		icon: CalendarRange,
	},
	{
		title: "Ideas in backlog",
		value: "14",
		detail: "Drafts waiting for a slot",
		delta: "4 added this week",
		icon: FolderKanban,
		tone: "success" as const,
	},
	{
		title: "Average daily time",
		value: "38 min",
		detail: "For the core owner workflow",
		delta: "Down from 52 min",
		icon: Clock3,
	},
	{
		title: "Momentum",
		value: "+18%",
		detail: "Best-performing content vs last week",
		delta: "LinkedIn is carrying most of the lift",
		icon: TrendingUp,
	},
];

const attentionItems = [
	{
		title: "Finalize the caption for the product tip carousel",
		detail: "Instagram and LinkedIn can still go out today.",
		label: "Needs attention",
	},
	{
		title: "Choose a slot for the founder update",
		detail: "It is still in backlog and fits best on Wednesday morning.",
		label: "Schedule",
	},
	{
		title: "Reconnect one inactive destination",
		detail: "Publishing is healthy overall, but one selected target dropped.",
		label: "Setup",
	},
];

const todaySchedule = [
	{
		time: "09:30",
		title: "Customer story carousel",
		platforms: "Instagram, Facebook",
		state: "Ready",
	},
	{
		time: "13:00",
		title: "Founder thought piece",
		platforms: "LinkedIn",
		state: "Needs review",
	},
	{
		time: "17:15",
		title: "Weekend teaser reel",
		platforms: "Instagram, TikTok",
		state: "Queued",
	},
];

const lookAheadItems = [
	{
		title: "Best posting window tomorrow",
		body: "LinkedIn between 9:00 and 11:00 is trending stronger than the rest of the week.",
		icon: Flag,
	},
	{
		title: "Strongest reusable asset",
		body: "The recent customer quote card is worth adapting into one more post this week.",
		icon: Link2,
	},
	{
		title: "Next low-effort win",
		body: "Turn two backlog ideas into scheduled posts and your next 5 days are covered.",
		icon: CheckCircle2,
	},
];

export function DashboardOverview() {
	const {
		hydrated: socialHydrated,
		loading: loadingConnections,
		summary,
	} = useSocialConnectionSummary();
	const setupNeeded = socialHydrated && !summary.hasHealthySelectedTarget;

	return (
		<div className="dashboard-page-stack space-y-6">
			<DashboardPageHeader
				eyebrow="Daily flow"
				title="Today"
				description="See what needs attention, finish the next post, and keep the week moving without getting buried in ops noise."
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
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/platforms">
								{setupNeeded ? "Connect platforms" : "Manage platforms"}
								<ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/calendar">
								<CalendarRange className="size-4" />
								Open calendar
							</Link>
						</Button>
					</>
				}
			/>

			<SurfaceCard
				className={
					setupNeeded
						? "dashboard-card border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(31,122,114,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.78))]"
						: "dashboard-card border border-[var(--brand-border-soft)] bg-background/72"
				}
			>
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="space-y-2">
						<div className="text-lg font-medium">
							{!socialHydrated
								? "Checking your publishing setup."
								: setupNeeded
									? "Connect platforms before you start scheduling live posts."
									: "Publishing setup is ready for your daily workflow."}
						</div>
						<div className="max-w-3xl text-sm text-muted-foreground">
							{!socialHydrated
								? "Loading connected providers and selected publishing destinations for this workspace."
								: setupNeeded
									? "You can still plan content right away, but connecting real destinations unlocks live scheduling, validation, and one-click publishing."
									: loadingConnections
										? "Refreshing publishing health."
										: summary.connectedProviders.length > 0
											? `Connected providers: ${summary.connectedProviders.map((provider) => formatPlatformLabel(provider)).join(", ")}.`
											: "Connected providers are ready to manage from settings."}
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<span className="pill pill-info">
							{!socialHydrated || loadingConnections
								? "Checking connection health..."
								: `${summary.healthyConnectionCount} healthy connection${summary.healthyConnectionCount === 1 ? "" : "s"}`}
						</span>
						<span className="pill pill-muted">
							{socialHydrated ? summary.selectedTargetCount : "—"} selected
							target
							{socialHydrated && summary.selectedTargetCount === 1 ? "" : "s"}
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
					title="What to clear first"
					description="A compact list of the few things most likely to unblock your week."
					action={
						<Button variant="ghost" className="rounded-full" asChild>
							<Link to="/dashboard/posts/new">
								Resume create flow
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					}
				>
					<div className="space-y-3">
						{attentionItems.map((item) => (
							<div
								key={item.title}
								className="dashboard-card-sm flex items-start justify-between gap-4 border border-[var(--brand-border-soft)] bg-background/70"
							>
								<div className="min-w-0">
									<div className="text-sm font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.detail}
									</div>
								</div>
								<span className="pill pill-info shrink-0">{item.label}</span>
							</div>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Today's schedule"
					description="The posting plan stays visible without forcing a jump into another workflow."
				>
					<div className="space-y-3">
						{todaySchedule.map((item) => (
							<div
								key={`${item.time}-${item.title}`}
								className="dashboard-card-sm flex items-start gap-3 border border-[var(--brand-border-soft)] bg-background/70"
							>
								<div className="flex h-10 min-w-14 items-center justify-center rounded-2xl bg-primary/10 px-3 text-sm font-semibold text-primary">
									{item.time}
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-sm font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.platforms}
									</div>
									<div className="mt-2">
										<span
											className={
												item.state === "Ready"
													? "pill pill-success"
													: item.state === "Queued"
														? "pill pill-info"
														: "pill pill-warning"
											}
										>
											{item.state}
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				</DashboardPanel>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
				<DashboardPanel
					title="Look ahead"
					description="Small signals to help you decide what deserves the next 15 minutes."
				>
					<div className="space-y-3">
						{lookAheadItems.map((item) => (
							<div
								key={item.title}
								className="dashboard-card-sm flex items-start gap-3 border border-[var(--brand-border-soft)] bg-background/70"
							>
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<item.icon className="size-4" />
								</div>
								<div>
									<div className="text-sm font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.body}
									</div>
								</div>
							</div>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Keep the week covered"
					description="A simple rhythm for owners who want results without living in the app."
				>
					<div className="grid gap-4 sm:grid-cols-3">
						{[
							{
								label: "Check today",
								copy: "Clear one blocker, confirm the next live posts, and move on.",
							},
							{
								label: "Create once",
								copy: "Use the shared composer, attach media, then customize only when needed.",
							},
							{
								label: "Review results",
								copy: "Use insights for next moves instead of getting lost in reporting.",
							},
						].map((item) => (
							<SurfaceCard
								key={item.label}
								tone="muted"
								className="dashboard-card"
							>
								<div className="text-sm font-medium">{item.label}</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{item.copy}
								</div>
							</SurfaceCard>
						))}
					</div>
				</DashboardPanel>
			</div>
		</div>
	);
}
