import {
	ArrowUpRight,
	BarChart3,
	Eye,
	Heart,
	TrendingUp,
	Users2,
} from "lucide-react";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
	InsightCard,
} from "@/components/app/dashboard";
import { Button } from "@/components/ui/button";

const metrics = [
	{
		title: "Reach velocity",
		value: "18.2%",
		detail: "Week-over-week acceleration",
		delta: "Healthy trend",
		icon: TrendingUp,
		tone: "success" as const,
	},
	{
		title: "Audience quality",
		value: "72",
		detail: "Weighted engagement score",
		delta: "Above benchmark",
		icon: Users2,
	},
	{
		title: "View-through rate",
		value: "38.4%",
		detail: "Across short-form video assets",
		delta: "Needs asset refresh on two campaigns",
		icon: Eye,
		tone: "warning" as const,
	},
];

export function DashboardAnalytics() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Signal"
				title="Analytics"
				description="Performance is now presented in the same structural language as planning and execution, so the dashboard feels continuous."
				actions={
					<Button variant="outline" className="rounded-full">
						<ArrowUpRight className="size-4" />
						Share snapshot
					</Button>
				}
			/>

			<div className="grid gap-4 md:grid-cols-3">
				{metrics.map((metric) => (
					<InsightCard key={metric.title} {...metric} />
				))}
			</div>

			<DashboardPanel
				title="Engagement curve"
				description="A simple chart block with enough polish to feel intentional rather than placeholder."
			>
				<div className="rounded-[28px] border border-[var(--brand-border-soft)] bg-background/72 p-5">
					<div className="flex h-72 items-end gap-4">
						{[48, 62, 55, 78, 92, 87, 110, 98].map((height) => (
							<div key={height} className="flex flex-1 items-end">
								<div
									className="w-full rounded-t-[18px] bg-gradient-brand"
									style={{ height: `${height * 1.7}px` }}
								/>
							</div>
						))}
					</div>
					<div className="mt-4 flex justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((item) => (
							<span key={item}>{item}</span>
						))}
					</div>
				</div>
			</DashboardPanel>

			<div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
				<DashboardPanel
					title="Channel mix"
					description="Quick breakdown of what is currently contributing."
				>
					<div className="space-y-4">
						{[
							["LinkedIn", 44],
							["Instagram", 28],
							["X", 18],
							["Facebook", 10],
						].map(([label, value]) => (
							<div key={label} className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span>{label}</span>
									<span className="text-muted-foreground">{value}%</span>
								</div>
								<div className="h-2 rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-gradient-brand"
										style={{ width: `${value}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</DashboardPanel>

				<DashboardPanel
					title="What moved"
					description="Short narrative summaries keep reporting closer to decision-making."
				>
					<div className="grid gap-4">
						{[
							{
								icon: BarChart3,
								title:
									"LinkedIn thought-leadership assets drove the largest reach gain.",
								body: "Longer-form posts with structured visuals lifted saves and second-order shares across the week.",
							},
							{
								icon: Heart,
								title: "Instagram engagement softened on retail creative.",
								body: "The drop aligns with two posts that shipped with older cover treatments. Refreshing asset packaging should help.",
							},
						].map((item) => (
							<SurfaceCard key={item.title} tone="muted" className="p-5">
								<div className="flex items-start gap-3">
									<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
										<item.icon className="size-4" />
									</div>
									<div>
										<div className="font-medium">{item.title}</div>
										<p className="mt-2 text-sm leading-6 text-muted-foreground">
											{item.body}
										</p>
									</div>
								</div>
							</SurfaceCard>
						))}
					</div>
				</DashboardPanel>
			</div>
		</div>
	);
}
