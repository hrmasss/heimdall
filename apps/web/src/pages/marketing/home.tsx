import {
	ArrowRight,
	BarChart3,
	CalendarRange,
	Check,
	Eye,
	Layers3,
	MessageSquareShare,
	ShieldCheck,
	Sparkles,
	Table2,
} from "lucide-react";
import { Link } from "react-router";

import {
	SectionHeading,
	SectionTag,
	StatChip,
	SurfaceCard,
} from "@/components/app/brand";
import { Button } from "@/components/ui/button";

const commandMetrics = [
	{
		label: "Approval time",
		value: "-38%",
		detail: "fewer bottlenecks on publish day",
	},
	{
		label: "Assets reused",
		value: "4.2x",
		detail: "from shared campaign modules",
	},
	{
		label: "Ops visibility",
		value: "24/7",
		detail: "performance and publishing health",
	},
];

const featureCards = [
	{
		icon: CalendarRange,
		title: "Editorial planning with real constraints",
		description:
			"Build campaigns around approvals, market launches, and channel-specific timing instead of flat posting queues.",
	},
	{
		icon: Table2,
		title: "A control table that behaves like software",
		description:
			"Resize, reorder, filter, paginate, and switch into a card grid without losing row actions or bulk workflows.",
	},
	{
		icon: BarChart3,
		title: "Signals that stay close to the work",
		description:
			"Performance, spend, sentiment, and velocity sit next to drafts and assets so decisions happen in context.",
	},
	{
		icon: ShieldCheck,
		title: "Review paths that keep teams aligned",
		description:
			"Approval ladders, role scopes, and audit trails keep campaign quality consistent across brands and regions.",
	},
];

const operatorMoments = [
	{
		title: "Morning standup",
		detail:
			"See slippage, overloaded reviewers, and at-risk launches before the team starts executing.",
	},
	{
		title: "Campaign review",
		detail:
			"Jump from a strategy brief to rows, assets, and channel versions without breaking focus.",
	},
	{
		title: "Weekly reporting",
		detail:
			"Share polished snapshots that explain movement, not just a collection of vanity metrics.",
	},
];

const testimonials = [
	{
		quote:
			"Heimdall replaced three tools and the messy spreadsheet that lived between them. It finally feels like one operating system.",
		author: "Rina Morales",
		role: "VP Marketing, Northset",
	},
	{
		quote:
			"The table alone changed our workflow. We can sort and reshape a launch room in real time without punting to ops.",
		author: "Daniel Osei",
		role: "Social Operations Lead, Cedar Labs",
	},
];

function HeroSection() {
	return (
		<section className="relative overflow-hidden pt-32">
			<div className="page-container section-spacing">
				<div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
					<div className="stagger-children max-w-2xl space-y-6">
						<SectionTag>
							<Sparkles className="size-3.5" />
							Rust-toned social command center
						</SectionTag>
						<h1 className="text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
							Social operations with{" "}
							<span className="text-gradient-brand">
								clarity, structure, and taste
							</span>
							.
						</h1>
						<p className="max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">
							Heimdall brings strategy, approvals, publishing, and measurement
							into one calm system so marketing teams can move faster without
							losing rigor.
						</p>
						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								size="lg"
								className="rounded-full bg-gradient-brand px-6 text-white border-0"
								asChild
							>
								<Link to="/dashboard/posts">
									Explore the workspace
									<ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="rounded-full px-6"
								asChild
							>
								<Link to="/pricing">See pricing</Link>
							</Button>
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							{commandMetrics.map((metric) => (
								<StatChip
									key={metric.label}
									label={metric.label}
									value={metric.value}
									detail={metric.detail}
								/>
							))}
						</div>
					</div>

					<SurfaceCard
						tone="strong"
						className="relative overflow-hidden p-4 md:p-6"
					>
						<div className="brand-grid absolute inset-0 opacity-25" />
						<div className="relative space-y-4">
							<div className="flex items-center justify-between rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3">
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Campaign room
									</div>
									<div className="mt-1 text-sm font-medium">
										Q2 Product Launch
									</div>
								</div>
								<div className="pill pill-success">18 items ready</div>
							</div>

							<div className="grid gap-4 lg:grid-cols-[220px_1fr]">
								<div className="space-y-3">
									{[
										"Strategy brief",
										"Approval queue",
										"Launch calendar",
										"Asset vault",
									].map((item, index) => (
										<div
											key={item}
											className="rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 p-4"
										>
											<div className="text-sm font-medium">{item}</div>
											<div className="mt-2 h-2 rounded-full bg-muted">
												<div
													className="h-full rounded-full bg-gradient-brand"
													style={{ width: `${70 - index * 10}%` }}
												/>
											</div>
										</div>
									))}
								</div>

								<div className="space-y-4">
									<div className="grid gap-3 sm:grid-cols-3">
										{[
											{ label: "Reach", value: "2.4M" },
											{ label: "Approval SLA", value: "7h" },
											{ label: "Channels", value: "12" },
										].map((item) => (
											<div
												key={item.label}
												className="rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 p-4"
											>
												<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
													{item.label}
												</div>
												<div className="mt-2 text-2xl font-semibold tracking-tight">
													{item.value}
												</div>
											</div>
										))}
									</div>

									<div className="rounded-[26px] border border-[var(--brand-border-soft)] bg-background/78 p-4">
										<div className="mb-4 flex items-center justify-between">
											<div>
												<div className="text-sm font-medium">
													Publishing table
												</div>
												<div className="text-xs text-muted-foreground">
													Reorder columns, sort, and take row action inline
												</div>
											</div>
											<div className="pill pill-info">Table + grid</div>
										</div>
										<div className="space-y-3">
											<div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr] gap-3 px-2 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
												<span>Campaign</span>
												<span>Channel</span>
												<span>Status</span>
												<span>Owner</span>
											</div>
											{[
												[
													"Spring narrative refresh",
													"LinkedIn",
													"Review",
													"Rina",
												],
												["Founder memo", "X", "Scheduled", "Imran"],
												["Launch teaser reel", "Instagram", "Draft", "Noa"],
											].map((row) => (
												<div
													key={row[0]}
													className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr] gap-3 rounded-2xl border border-[var(--brand-border-soft)] bg-card px-3 py-3 text-sm"
												>
													<span className="font-medium">{row[0]}</span>
													<span className="text-muted-foreground">
														{row[1]}
													</span>
													<span className="text-muted-foreground">
														{row[2]}
													</span>
													<span className="text-muted-foreground">
														{row[3]}
													</span>
												</div>
											))}
										</div>
									</div>
								</div>
							</div>
						</div>
					</SurfaceCard>
				</div>
			</div>
		</section>
	);
}

function ProofSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SurfaceCard className="overflow-hidden p-6 md:p-8">
					<div className="grid gap-6 md:grid-cols-[0.85fr_1.15fr] md:items-center">
						<SectionHeading
							badge={<SectionTag>Why teams switch</SectionTag>}
							title="The tooling gets quieter, so the work gets better."
							description="Heimdall is designed to feel intentional rather than crowded. Fewer scattered views, fewer loose ends, more connected decisions."
						/>
						<div className="grid gap-4 sm:grid-cols-2">
							{featureCards.map((feature) => (
								<div
									key={feature.title}
									className="rounded-[26px] border border-[var(--brand-border-soft)] bg-background/72 p-5"
								>
									<div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
										<feature.icon className="size-5" />
									</div>
									<div className="text-lg font-medium tracking-tight">
										{feature.title}
									</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{feature.description}
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

function OperatorSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
				<SurfaceCard tone="muted" className="p-6 md:p-8">
					<SectionHeading
						badge={<SectionTag>Operating rhythm</SectionTag>}
						title="Made for the moments where social work actually gets messy."
						description="A shared workspace only matters if it survives approvals, launch week, and the week after."
					/>
					<div className="mt-8 space-y-4">
						{operatorMoments.map((moment, index) => (
							<div
								key={moment.title}
								className="flex gap-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-4"
							>
								<div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									0{index + 1}
								</div>
								<div>
									<div className="font-medium">{moment.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{moment.detail}
									</div>
								</div>
							</div>
						))}
					</div>
				</SurfaceCard>

				<SurfaceCard tone="strong" className="p-6 md:p-8">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="rounded-[26px] border border-[var(--brand-border-soft)] bg-background/70 p-5">
							<div className="flex items-center gap-3 text-primary">
								<Eye className="size-5" />
								<span className="font-medium">Cross-team visibility</span>
							</div>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								Brand, demand, and community teams can work from the same source
								of truth without forcing one workflow on everyone.
							</p>
						</div>
						<div className="rounded-[26px] border border-[var(--brand-border-soft)] bg-background/70 p-5">
							<div className="flex items-center gap-3 text-primary">
								<MessageSquareShare className="size-5" />
								<span className="font-medium">Inline discussion</span>
							</div>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								Feedback stays attached to the row, asset, or campaign it
								affects, which reduces hidden context and duplicate review
								cycles.
							</p>
						</div>
						<div className="rounded-[26px] border border-[var(--brand-border-soft)] bg-background/70 p-5 md:col-span-2">
							<div className="flex items-center gap-3 text-primary">
								<Layers3 className="size-5" />
								<span className="font-medium">
									A model that scales from one brand to many
								</span>
							</div>
							<div className="mt-4 grid gap-4 sm:grid-cols-3">
								{[
									"Shared asset kits",
									"Workspace-level permissions",
									"Regional campaign variants",
								].map((item) => (
									<div
										key={item}
										className="rounded-2xl border border-[var(--brand-border-soft)] bg-card/85 px-4 py-4 text-sm"
									>
										{item}
									</div>
								))}
							</div>
						</div>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

function SocialProofSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={<SectionTag>Customer signal</SectionTag>}
					title="Trusted by teams that care about design and process."
					description="Not just a place to schedule posts. A place to run the system around them."
				/>
				<div className="mt-10 grid gap-6 lg:grid-cols-2">
					{testimonials.map((testimonial) => (
						<SurfaceCard key={testimonial.author} className="p-6 md:p-7">
							<div className="flex gap-1 text-primary">
								{Array.from({ length: 5 }).map((_, index) => (
									<Check
										key={`${testimonial.author}-${index}`}
										className="size-4"
									/>
								))}
							</div>
							<p className="mt-5 text-lg leading-8">{testimonial.quote}</p>
							<div className="mt-6 border-t border-[var(--brand-border-soft)] pt-5">
								<div className="font-medium">{testimonial.author}</div>
								<div className="text-sm text-muted-foreground">
									{testimonial.role}
								</div>
							</div>
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
					className="overflow-hidden px-6 py-8 md:px-10 md:py-10"
				>
					<div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
						<SectionHeading
							badge={<SectionTag>Start here</SectionTag>}
							title="See the same system across the marketing site and the app."
							description="The product now carries the same visual language end to end, from the first landing view through the working dashboard."
						/>
						<div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
							<Button
								size="lg"
								className="rounded-full bg-gradient-brand px-6 text-white border-0"
								asChild
							>
								<Link to="/dashboard">
									Enter dashboard
									<ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="rounded-full px-6"
								asChild
							>
								<Link to="/features">Explore feature detail</Link>
							</Button>
						</div>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

export function HomePage() {
	return (
		<>
			<HeroSection />
			<ProofSection />
			<OperatorSection />
			<SocialProofSection />
			<CTASection />
		</>
	);
}
