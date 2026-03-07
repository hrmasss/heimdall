import { CheckCircle2, MessageSquare, Users2 } from "lucide-react";

import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { SurfaceCard } from "@/components/app/brand";

const members = [
	{ name: "Rina Morales", role: "VP Marketing", load: 72, status: "Balanced" },
	{ name: "Imran Ali", role: "Content Lead", load: 88, status: "High load" },
	{
		name: "Pia Sorensen",
		role: "Creative Producer",
		load: 64,
		status: "Balanced",
	},
	{
		name: "Jon Osei",
		role: "Channel Strategist",
		load: 54,
		status: "Available",
	},
];

const teamSignals = [
	{ icon: Users2, value: "12", label: "Reviewers assigned" },
	{ icon: CheckCircle2, value: "94%", label: "Approvals completed on time" },
	{
		icon: MessageSquare,
		value: "28",
		label: "Open comments across active campaigns",
	},
];

export function DashboardTeam() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Team"
				title="Team"
				description="The team view is no longer a placeholder and now matches the same structure as campaign, analytics, and asset surfaces."
			/>

			<DashboardPanel
				title="Current workload"
				description="A readable summary of ownership and review load across the pod."
			>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{members.map((member) => (
						<SurfaceCard key={member.name} className="p-5">
							<div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-base font-semibold text-white">
								{member.name
									.split(" ")
									.map((part) => part[0])
									.join("")}
							</div>
							<div className="mt-4 text-lg font-medium">{member.name}</div>
							<div className="text-sm text-muted-foreground">{member.role}</div>
							<div className="mt-5 space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span>Load</span>
									<span className="text-muted-foreground">{member.load}%</span>
								</div>
								<div className="h-2 rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-gradient-brand"
										style={{ width: `${member.load}%` }}
									/>
								</div>
								<span
									className={
										member.load > 80 ? "pill pill-warning" : "pill pill-success"
									}
								>
									{member.status}
								</span>
							</div>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Team signals"
				description="A small secondary view to make the route feel complete rather than decorative."
			>
				<div className="grid gap-4 md:grid-cols-3">
					{teamSignals.map((item) => (
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
