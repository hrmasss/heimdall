import { Bell, ShieldCheck, Sparkles } from "lucide-react";

import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const preferenceCards = [
	{
		icon: Bell,
		title: "Approval notifications",
		description: "Send reminders when posts sit in review over 4 hours.",
	},
	{
		icon: ShieldCheck,
		title: "Governance locks",
		description: "Prevent scheduling when required asset checks are missing.",
	},
	{
		icon: Sparkles,
		title: "AI assistance",
		description:
			"Allow caption and summary suggestions in compose and review surfaces.",
	},
];

export function DashboardSettings() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Preferences"
				title="Settings"
				description="Workspace defaults, notification rules, and governance preferences live in the same design system as the rest of the product."
			/>

			<DashboardPanel
				title="Workspace profile"
				description="A simple but complete settings view instead of a blank route."
			>
				<div className="grid gap-4 lg:grid-cols-2">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<label className="block space-y-2">
							<span className="text-sm font-medium">Workspace name</span>
							<Input className="h-10 rounded-2xl" defaultValue="Northset" />
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">Default region</span>
							<Input className="h-10 rounded-2xl" defaultValue="Global / EN" />
						</label>
						<Button className="rounded-full bg-gradient-brand text-white border-0">
							Save profile
						</Button>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="space-y-4 p-5">
						{preferenceCards.map((item) => (
							<div
								key={item.title}
								className="flex items-start gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
							>
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<item.icon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.description}
									</div>
								</div>
								<div className="pill pill-success">On</div>
							</div>
						))}
					</SurfaceCard>
				</div>
			</DashboardPanel>
		</div>
	);
}
