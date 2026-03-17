import {
	ArrowRight,
	BrainCircuit,
	CheckCircle2,
	Clock3,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceContextResponse } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const readinessCards = [
	{
		icon: BrainCircuit,
		title: "Business context",
		description:
			"Compact facts about the business, audience, offers, differentiators, and hard guardrails.",
	},
	{
		icon: Sparkles,
		title: "Brand system",
		description:
			"Design tokens, visual guardrails, and optional reference imagery for future asset generation.",
	},
	{
		icon: Clock3,
		title: "Historical signals",
		description:
			"Generation and workflow telemetry can accumulate quietly now, then power better campaign automation later.",
	},
];

export function DashboardAutomations() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [context, setContext] = useState<WorkspaceContextResponse | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			if (!activeWorkspaceId) {
				return;
			}
			try {
				const response = await customerRequest<WorkspaceContextResponse>(
					`/workspaces/${activeWorkspaceId}/ai/context`,
				);
				if (!cancelled) {
					setContext(response);
				}
			} catch {
				if (!cancelled) {
					setContext(null);
				}
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest]);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Automation"
				title="Automations"
				description="The runtime is staying intentionally light for now. First we make sure AI workflows have the right workspace context, access rules, and future-ready telemetry."
				actions={
					<Button className="rounded-full bg-gradient-brand text-white border-0" asChild>
						<Link to="/dashboard/settings/intelligence">
							<WandSparkles className="size-4" />
							Open intelligence
						</Link>
					</Button>
				}
			/>

			<DashboardPanel
				title="Automation readiness"
				description="Campaign AI, dynamic improvement, image generation, and reel generation will all build on this foundation instead of guessing."
			>
				<div className="grid gap-4 lg:grid-cols-3">
					{readinessCards.map((item) => (
						<SurfaceCard key={item.title} className="p-5">
							<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<item.icon className="size-5" />
							</div>
							<div className="mt-5 text-lg font-medium">{item.title}</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{item.description}
							</p>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Current workspace status"
				description="This page does not pretend there is a full automation runtime yet. It shows whether the workspace is ready for the AI-driven layer we are introducing."
			>
				<div className="grid gap-4 md:grid-cols-3">
					<SurfaceCard tone="muted" className="p-5">
						<div className="flex items-center gap-2 text-sm font-medium">
							<CheckCircle2 className="size-4 text-emerald-600" />
							Business context
						</div>
						<div className="mt-4 text-3xl font-semibold tracking-tight">
							{context?.readiness.hasBusinessContext ? "Ready" : "Missing"}
						</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Automation quality depends heavily on whether Heimdall understands
							what the workspace actually does.
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="p-5">
						<div className="flex items-center gap-2 text-sm font-medium">
							<CheckCircle2 className="size-4 text-emerald-600" />
							AI access
						</div>
						<div className="mt-4 text-3xl font-semibold tracking-tight">
							{context?.readiness.hasAiAccess ? "Ready" : "Missing"}
						</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Native or BYOK access must exist before any AI-backed automation
							can actually run.
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="p-5">
						<div className="flex items-center gap-2 text-sm font-medium">
							<CheckCircle2 className="size-4 text-emerald-600" />
							Brand system
						</div>
						<div className="mt-4 text-3xl font-semibold tracking-tight">
							{context?.readiness.hasBrandContext ? "Ready" : "Optional"}
						</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Especially useful once image and reel generation are live.
						</div>
					</SurfaceCard>
				</div>
				<div className="mt-5 flex flex-wrap gap-2">
					{context?.readiness.missing.map((item) => (
						<Badge key={item} variant="outline" className="rounded-full">
							{item}
						</Badge>
					))}
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/settings/intelligence">
							Review intelligence setup
							<ArrowRight className="size-4" />
						</Link>
					</Button>
				</div>
			</DashboardPanel>
		</div>
	);
}
