import { CheckCircle2, Clock3, PlayCircle, WandSparkles } from "lucide-react";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Button } from "@/components/ui/button";

const rules = [
	{
		name: "Approval reminder cadence",
		status: "Healthy",
		description:
			"Nudges reviewers every four hours once a launch enters the review state.",
	},
	{
		name: "Asset naming validation",
		status: "Healthy",
		description:
			"Checks attachments against campaign taxonomy before a post can be scheduled.",
	},
	{
		name: "Blocked post escalation",
		status: "Needs attention",
		description:
			"Escalates to the channel lead if a post remains blocked for more than eight hours.",
	},
];

const runtimeStats = [
	{
		icon: CheckCircle2,
		value: "96%",
		label: "Successful automations this week",
	},
	{ icon: Clock3, value: "4m", label: "Median time to trigger" },
	{ icon: WandSparkles, value: "18", label: "Rules currently active" },
];

export function DashboardAutomations() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Automation"
				title="Automations"
				description="Workflow rules now sit inside the same warm, restrained system as the rest of the dashboard."
				actions={
					<Button className="rounded-full bg-gradient-brand text-white border-0">
						<WandSparkles className="size-4" />
						New rule
					</Button>
				}
			/>

			<DashboardPanel
				title="Rule set"
				description="The current workspace uses a compact, readable card model for automation routines."
			>
				<div className="grid gap-4 lg:grid-cols-3">
					{rules.map((rule) => (
						<SurfaceCard key={rule.name} className="p-5">
							<div className="flex items-start justify-between gap-4">
								<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<PlayCircle className="size-5" />
								</div>
								<span
									className={
										rule.status === "Healthy"
											? "pill pill-success"
											: "pill pill-warning"
									}
								>
									{rule.status}
								</span>
							</div>
							<div className="mt-5 text-lg font-medium">{rule.name}</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{rule.description}
							</p>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Runtime details"
				description="Automation surfaces are simple, but they no longer feel like placeholders."
			>
				<div className="grid gap-4 md:grid-cols-3">
					{runtimeStats.map((item) => (
						<SurfaceCard key={item.label} tone="muted" className="p-5">
							<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<item.icon className="size-4" />
							</div>
							<div className="mt-4 text-3xl font-semibold tracking-tight">
								{item.value}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								{item.label}
							</div>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>
		</div>
	);
}
