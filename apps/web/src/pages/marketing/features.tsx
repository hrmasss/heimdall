import {
	ArrowRight,
	BarChart3,
	CalendarDays,
	MessageCircleMore,
	ShieldCheck,
	Sparkles,
	WandSparkles,
} from "lucide-react";
import { Link } from "react-router";

import {
	SectionHeading,
	SectionTag,
	SurfaceCard,
} from "@/components/app/brand";
import { Button } from "@/components/ui/button";

const workflowHighlights = [
	{
		icon: CalendarDays,
		title: "Plan launches with context",
		description:
			"Map campaigns against dates, owners, dependencies, and channel goals so the whole team sees what needs attention next.",
	},
	{
		icon: ShieldCheck,
		title: "Keep approvals moving",
		description:
			"Route reviews to the right stakeholders, surface blockers early, and maintain a clean record of what is ready to ship.",
	},
	{
		icon: MessageCircleMore,
		title: "Keep feedback attached",
		description:
			"Comments and next steps stay connected to the campaign and assets, so context does not disappear into chat threads.",
	},
	{
		icon: BarChart3,
		title: "Measure what shipped",
		description:
			"See delivery signals and performance in the same workspace where the next round of decisions gets made.",
	},
];

const campaignFlow = [
	{
		label: "Brief",
		title: "Align the narrative early",
		description:
			"Capture the campaign objective, owner, launch window, and dependencies before the work starts to fragment.",
	},
	{
		label: "Review",
		title: "Collect approvals in one place",
		description:
			"Keep legal, brand, and channel feedback visible so nobody is chasing the latest version over email or chat.",
	},
	{
		label: "Publish",
		title: "Launch with fewer handoffs",
		description:
			"Scheduling, asset readiness, and final sign-off stay connected, which reduces last-minute manual coordination.",
	},
	{
		label: "Learn",
		title: "Turn results into the next move",
		description:
			"Use channel and campaign performance to decide what to repeat, revise, or retire in the next cycle.",
	},
];

const systemBlocks = [
	{
		icon: BarChart3,
		title: "Performance that stays contextual",
		copy: "See campaign output, channel health, and delivery trendlines in the same environment where scheduling decisions are made.",
	},
	{
		icon: ShieldCheck,
		title: "Governance that doesn’t slow the room",
		copy: "Approval tiers, workspace roles, and audit trails are integrated into the product surface instead of bolted on after the fact.",
	},
	{
		icon: MessageCircleMore,
		title: "Communication attached to objects",
		copy: "Feedback and next steps stay connected to campaigns, rows, and assets, so there is less off-platform context to reconstruct later.",
	},
	{
		icon: WandSparkles,
		title: "AI where it actually helps",
		copy: "Generate caption variants, summarize comments, and surface patterns without drowning the interface in novelty features.",
	},
];

function HeroSection() {
	return (
		<section className="pt-32">
			<div className="page-container section-spacing">
				<SectionHeading
					align="center"
					badge={
						<SectionTag className="mx-auto">
							<Sparkles className="size-3.5" />
							Product depth
						</SectionTag>
					}
					title={
						<>
							A richer workspace for the teams who need{" "}
							<span className="text-gradient-brand">more than a scheduler</span>
							.
						</>
					}
					description="Heimdall brings planning, approvals, publishing, reporting, and asset operations into one consistent interface designed for modern social teams."
				/>
			</div>
		</section>
	);
}

function WorkflowSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container grid gap-6 lg:grid-cols-[1fr_1.05fr]">
				<SurfaceCard tone="strong" className="p-[var(--density-surface-padding)] md:p-[var(--density-surface-padding-lg)]">
					<SectionHeading
						badge={<SectionTag>Operator flow</SectionTag>}
						title="One place for the full launch cycle."
						description="Heimdall keeps planning, approvals, publishing, and reporting connected so the team can move without handoff drift."
					/>
					<div className="mt-8 grid gap-4">
						{workflowHighlights.map((lane) => (
							<div
								key={lane.title}
							className="rounded-[var(--density-surface-radius-md)] border border-[var(--brand-border-soft)] bg-background/70 p-[var(--density-dashboard-card-padding-sm)]"
							>
								<div className="flex items-center gap-3 text-primary">
									<lane.icon className="size-5" />
									<div className="font-medium text-foreground">
										{lane.title}
									</div>
								</div>
								<p className="mt-3 text-sm leading-6 text-muted-foreground">
									{lane.description}
								</p>
							</div>
						))}
					</div>
				</SurfaceCard>

				<SurfaceCard className="overflow-hidden p-[var(--density-dashboard-card-padding-sm)] md:p-[var(--density-surface-padding)]">
					<div className="rounded-[var(--density-surface-radius)] border border-[var(--brand-border-soft)] bg-background/75 p-[var(--density-surface-padding)] md:p-[var(--density-surface-padding)]">
						<SectionHeading
							badge={<SectionTag>Campaign rhythm</SectionTag>}
							title="From kickoff to reporting, the room stays aligned."
							description="Each stage carries the right context forward, so operators, reviewers, and leads can act without rebuilding the story from scratch."
						/>

						<div className="mt-8 space-y-4">
							{campaignFlow.map((step) => (
								<div
									key={step.label}
									className="rounded-[var(--density-surface-radius-md)] border border-[var(--brand-border-soft)] bg-card/90 p-[var(--density-dashboard-card-padding-sm)]"
								>
									<div className="flex items-center justify-between gap-3">
										<div className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--brand-accent)]">
											{step.label}
										</div>
										<div className="pill pill-muted">Connected</div>
									</div>
									<div className="mt-3 text-lg font-medium tracking-tight">
										{step.title}
									</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{step.description}
									</p>
								</div>
							))}
						</div>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

function SystemSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={
						<SectionTag className="mx-auto">What stays connected</SectionTag>
					}
					title="A workspace built for clarity under pressure."
					description="Whether the team is planning, reviewing, publishing, or learning from results, Heimdall keeps the important signals close to the action."
				/>
				<div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
					{systemBlocks.map((block) => (
						<SurfaceCard key={block.title} className="p-[var(--density-surface-padding)]">
							<div className="marketing-feature-icon flex items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<block.icon className="size-5" />
							</div>
							<div className="mt-5 text-lg font-medium tracking-tight">
								{block.title}
							</div>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								{block.copy}
							</p>
						</SurfaceCard>
					))}
				</div>
			</div>
		</section>
	);
}

function CTASection() {
	return (
		<section className="section-spacing">
			<div className="page-container">
				<SurfaceCard
					tone="strong"
					className="flex flex-col gap-6 p-[var(--density-surface-padding-lg)] md:flex-row md:items-center md:justify-between"
				>
					<div className="max-w-2xl space-y-3">
						<SectionTag>See it live</SectionTag>
						<h2 className="text-3xl font-semibold tracking-tight">
							Open the workspace and follow the team in motion.
						</h2>
						<p className="text-muted-foreground">
							Move from posts to analytics, calendar, library, team, and
							automations in a single product flow built for day-to-day
							marketing operations.
						</p>
					</div>
					<Button
						size="lg"
						className="rounded-full bg-gradient-brand px-6 text-white border-0"
						asChild
					>
						<Link to="/dashboard/posts">
							Open posts workspace
							<ArrowRight className="size-4" />
						</Link>
					</Button>
				</SurfaceCard>
			</div>
		</section>
	);
}

export function FeaturesPage() {
	return (
		<>
			<HeroSection />
			<WorkflowSection />
			<SystemSection />
			<CTASection />
		</>
	);
}
