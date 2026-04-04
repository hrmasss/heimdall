import {
	ArrowUpRight,
	CalendarClock,
	CopyCheck,
	TrendingUp,
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

const metrics = [
	{
		title: "Best channel this week",
		value: "LinkedIn",
		detail: "Highest saves and clickthroughs",
		delta: "Thoughtful how-to posts are leading",
		icon: TrendingUp,
		tone: "success" as const,
	},
	{
		title: "Best time window",
		value: "9-11 AM",
		detail: "Across the strongest recent posts",
		delta: "Mid-week is outperforming weekends",
		icon: CalendarClock,
	},
	{
		title: "Strongest repeatable angle",
		value: "Quick tips",
		detail: "Simple educational posts keep winning",
		delta: "Repurpose into two more formats",
		icon: CopyCheck,
		tone: "warning" as const,
	},
];

export function DashboardAnalytics() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Decision support"
				title="Insights"
				description="Use a few clear signals to decide what to post next, when to publish, and where to spend your limited time."
				primaryAction={
					<Button
						className="rounded-full border-0 bg-gradient-brand text-white"
						asChild
					>
						<Link to="/dashboard/posts/new">
							<WandSparkles className="size-4" />
							Create from insight
						</Link>
					</Button>
				}
				secondaryActions={
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/calendar">
							<CalendarClock className="size-4" />
							Plan next slots
						</Link>
					</Button>
				}
				overflowActions={[
					{
						label: "Share snapshot",
						action: (
							<span className="inline-flex items-center gap-2">
								<ArrowUpRight className="size-4" />
								Share snapshot
							</span>
						),
					},
				]}
			/>

			<div className="grid gap-4 md:grid-cols-3">
				{metrics.map((metric) => (
					<InsightCard key={metric.title} {...metric} />
				))}
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
				<DashboardPanel
					title="What is working"
					description="Keep the explanation plain enough that you can act on it immediately."
				>
					<div className="space-y-3">
						{[
							{
								title:
									"Educational posts are outperforming announcement posts.",
								body: "The strongest performers are practical, skimmable, and easy to save. Posts that teach a quick lesson are doing more work than polished launch copy.",
							},
							{
								title:
									"Carousels with one clear promise are beating busy multi-message graphics.",
								body: "The most successful assets have a single idea on the first slide and keep the rest of the story compact.",
							},
							{
								title:
									"Wednesday and Thursday mornings are the safest default slots.",
								body: "If you only have time to schedule a few pieces, these windows are giving the best repeatability right now.",
							},
						].map((item) => (
							<SurfaceCard
								key={item.title}
								tone="muted"
								className="dashboard-card"
							>
								<div className="font-medium">{item.title}</div>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{item.body}
								</p>
							</SurfaceCard>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Recommended next moves"
					description="Three small actions that compound better than another hour of reporting."
				>
					<div className="space-y-3">
						{[
							"Turn one strong LinkedIn post into a shorter Instagram caption and a simple visual.",
							"Fill two mid-week slots from backlog so the calendar stays comfortably ahead.",
							"Refresh underperforming cover art before rewriting the entire message.",
						].map((item, index) => (
							<div
								key={item}
								className="dashboard-card-sm flex items-start gap-3 border border-[var(--brand-border-soft)] bg-background/70"
							>
								<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
									{index + 1}
								</div>
								<div className="text-sm text-foreground">{item}</div>
							</div>
						))}
					</div>
				</DashboardPanel>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
				<DashboardPanel
					title="Best windows this week"
					description="A lightweight view of where your next few posts are most likely to land well."
				>
					<div className="space-y-4">
						{[
							["Wed", "9:00-11:00", 92],
							["Thu", "10:00-12:00", 86],
							["Tue", "13:00-15:00", 71],
							["Fri", "9:00-10:30", 64],
						].map(([day, window, score]) => (
							<div key={`${day}-${window}`} className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium text-foreground">
										{day} · {window}
									</span>
									<span className="text-muted-foreground">score {score}</span>
								</div>
								<div className="h-2 rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-gradient-brand"
										style={{ width: `${score}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="Content angles to reuse"
					description="Use patterns that already work instead of starting from zero every time."
				>
					<div className="grid gap-4">
						{[
							{
								title: "Behind-the-scenes build notes",
								body: "Short founder or team observations with one takeaway.",
							},
							{
								title: "Customer questions turned into tips",
								body: "Take the questions you answer manually and turn them into educational posts.",
							},
							{
								title: "Simple before/after proof",
								body: "Show a small improvement or win without overproducing the creative.",
							},
						].map((item) => (
							<SurfaceCard
								key={item.title}
								tone="muted"
								className="dashboard-card"
							>
								<div className="font-medium">{item.title}</div>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{item.body}
								</p>
							</SurfaceCard>
						))}
					</div>
				</DashboardPanel>
			</div>
		</div>
	);
}
