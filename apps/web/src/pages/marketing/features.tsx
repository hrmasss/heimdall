import {
	ArrowRight,
	BarChart3,
	CalendarDays,
	Filter,
	GripVertical,
	LayoutGrid,
	MessageCircleMore,
	MoveHorizontal,
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

const productLanes = [
	{
		icon: CalendarDays,
		title: "Plan and sequence",
		description:
			"Map launches against dates, owners, dependencies, and campaign narratives. The calendar and list views stay in sync so no one is forced into one mode.",
	},
	{
		icon: MoveHorizontal,
		title: "Shape the table around the work",
		description:
			"Resize, reorder, and sort columns so each workspace reflects the way your team thinks about operations instead of the way a vendor guessed.",
	},
	{
		icon: Filter,
		title: "Filter with intent",
		description:
			"Quick filters, global search, and per-status views make it easy to isolate launches, bottlenecks, or underperforming segments without creating new spreadsheets.",
	},
	{
		icon: LayoutGrid,
		title: "Switch from rows to cards",
		description:
			"Move from a dense operator table to a visual grid for review meetings, asset QA, or mobile triage without losing actions or pagination.",
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
				<SurfaceCard tone="strong" className="p-6 md:p-8">
					<SectionHeading
						badge={<SectionTag>Workflow surface</SectionTag>}
						title="The table is now a first-class interface."
						description="It behaves like a real operations surface: reconfigurable, dense when needed, and still readable when the team is moving quickly."
					/>
					<div className="mt-8 grid gap-4">
						{productLanes.map((lane) => (
							<div
								key={lane.title}
								className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
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

				<SurfaceCard className="overflow-hidden p-4 md:p-6">
					<div className="rounded-[28px] border border-[var(--brand-border-soft)] bg-background/75 p-4">
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--brand-border-soft)] pb-4">
							<div>
								<div className="text-sm font-medium">
									Launch operations table
								</div>
								<div className="text-xs text-muted-foreground">
									Drag columns, resize widths, and filter on the fly
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="pill pill-muted">
									<GripVertical className="size-3.5" />
									Reorder columns
								</div>
								<div className="pill pill-info">List / grid</div>
							</div>
						</div>

						<div className="mt-4 space-y-3">
							<div className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.3fr] gap-3 rounded-2xl bg-muted/50 px-3 py-3 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
								{["Campaign", "Channel", "Status", "Owner", ""].map((label) => (
									<div
										key={label || "action"}
										className="flex items-center gap-2"
									>
										{label}
										{label ? <MoveHorizontal className="size-3" /> : null}
									</div>
								))}
							</div>
							{[
								["Narrative launch", "LinkedIn", "Scheduled", "Maya"],
								["Analyst thread", "X", "Review", "Jon"],
								["Influencer kit", "Instagram", "Draft", "Pia"],
								["Quarterly recap", "YouTube", "Blocked", "Leo"],
							].map((row, index) => (
								<div
									key={row[0]}
									className="grid grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.3fr] gap-3 rounded-2xl border border-[var(--brand-border-soft)] bg-card px-3 py-3 text-sm"
								>
									<div className="font-medium">{row[0]}</div>
									<div className="text-muted-foreground">{row[1]}</div>
									<div
										className={
											index === 1
												? "text-[var(--brand-warning)]"
												: "text-muted-foreground"
										}
									>
										{row[2]}
									</div>
									<div className="text-muted-foreground">{row[3]}</div>
									<div className="text-right text-muted-foreground">•••</div>
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
					badge={<SectionTag className="mx-auto">System design</SectionTag>}
					title="One design language across every critical surface."
					description="Marketing and product now share the same warm palette, panel structure, typography rhythm, and interaction model, so the experience feels like one product from the first visit."
				/>
				<div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
					{systemBlocks.map((block) => (
						<SurfaceCard key={block.title} className="p-6">
							<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
					className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10"
				>
					<div className="max-w-2xl space-y-3">
						<SectionTag>See it live</SectionTag>
						<h2 className="text-3xl font-semibold tracking-tight">
							Open the dashboard and inspect the new table directly.
						</h2>
						<p className="text-muted-foreground">
							The dashboard routes are no longer placeholders. Posts, analytics,
							calendar, library, team, automations, and settings all now follow
							the same product language.
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
