import {
	ArrowRight,
	CalendarDays,
	Megaphone,
	Newspaper,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { Link } from "react-router";

import {
	SectionHeading,
	SectionTag,
	SurfaceCard,
} from "@/components/app/brand";
import { Button } from "@/components/ui/button";

const editorialStreams = [
	{
		icon: TrendingUp,
		title: "Growth lessons",
		description:
			"Breakdowns on campaign velocity, distribution patterns, and the operational habits that compound over time.",
	},
	{
		icon: Newspaper,
		title: "Operator playbooks",
		description:
			"Practical guidance for approvals, publishing workflows, reporting cadences, and multi-channel campaign planning.",
	},
	{
		icon: Megaphone,
		title: "Product updates",
		description:
			"Notes from the roadmap on features, release decisions, and why specific workflow improvements shipped.",
	},
];

const posts = [
	{
		slug: "content-ops-scorecard",
		category: "Operations",
		title:
			"The content ops scorecard high-performing marketing teams actually use",
		excerpt:
			"Most teams track output and call it strategy. The better operators monitor handoff speed, approval lag, reuse rate, and launch readiness together.",
		date: "March 6, 2026",
		isoDate: "2026-03-06",
		readingTime: "6 min read",
	},
	{
		slug: "campaign-calendar-discipline",
		category: "Planning",
		title: "Why a campaign calendar fails without owner clarity",
		excerpt:
			"A beautiful calendar is still noise if no one knows who resolves blockers, who signs off, and what moves first when timing shifts.",
		date: "February 25, 2026",
		isoDate: "2026-02-25",
		readingTime: "4 min read",
	},
	{
		slug: "approval-sla",
		category: "Approvals",
		title: "Set an approval SLA before you automate anything",
		excerpt:
			"Automation helps after the team agrees on review expectations. Without that, software only accelerates the confusion already in the room.",
		date: "February 12, 2026",
		isoDate: "2026-02-12",
		readingTime: "5 min read",
	},
	{
		slug: "product-update-launch-room",
		category: "Product update",
		title:
			"Launch room updates: tighter decision trails and faster review loops",
		excerpt:
			"We refined campaign status states, reviewer visibility, and row-level context so teams can move from brief to sign-off with less manual coordination.",
		date: "January 29, 2026",
		isoDate: "2026-01-29",
		readingTime: "3 min read",
	},
	{
		slug: "social-reporting-rhythm",
		category: "Analytics",
		title: "A reporting rhythm that helps teams act before the quarter is over",
		excerpt:
			"Weekly operational signals and monthly narrative reviews beat bloated dashboards that only get opened when leadership asks for them.",
		date: "January 14, 2026",
		isoDate: "2026-01-14",
		readingTime: "5 min read",
	},
	{
		slug: "multi-brand-governance",
		category: "Governance",
		title: "The governance model multi-brand teams need before expansion",
		excerpt:
			"Permissions, templates, and asset reuse rules should scale with the team. Otherwise every new region creates another exception to manage.",
		date: "December 18, 2025",
		isoDate: "2025-12-18",
		readingTime: "7 min read",
	},
];

const featuredPost = posts[0];

function HeroSection() {
	return (
		<section className="pt-32">
			<div className="page-container section-spacing-sm">
				<div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
					<SectionHeading
						badge={
							<SectionTag>
								<Sparkles className="size-3.5" />
								Insights and updates
							</SectionTag>
						}
						title={
							<>
								A blog for teams who want{" "}
								<span className="text-gradient-brand">
									sharper marketing operations
								</span>
								, not recycled advice.
							</>
						}
						description="Heimdall publishes campaign lessons, operator playbooks, and product updates designed to help social teams work with more structure and better judgment."
					/>

					<SurfaceCard tone="strong" className="p-6 md:p-8">
						<div className="grid gap-4 sm:grid-cols-3">
							{[
								["Weekly", "New posts and product notes"],
								["Actionable", "Frameworks built for operators"],
								["Search-ready", "Evergreen topics for modern teams"],
							].map((item) => (
								<div
									key={item[1]}
									className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/72 p-5"
								>
									<div className="text-lg font-semibold tracking-tight">
										{item[0]}
									</div>
									<div className="mt-2 text-sm text-muted-foreground">
										{item[1]}
									</div>
								</div>
							))}
						</div>
					</SurfaceCard>
				</div>
			</div>
		</section>
	);
}

function FeaturedPostSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<SurfaceCard tone="strong" className="overflow-hidden p-6 md:p-8">
					<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
						<div className="pill pill-info">{featuredPost.category}</div>
						<div className="flex items-center gap-2">
							<CalendarDays className="size-4" />
							<time dateTime={featuredPost.isoDate}>{featuredPost.date}</time>
						</div>
						<div>{featuredPost.readingTime}</div>
					</div>

					<h2 className="mt-6 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
						{featuredPost.title}
					</h2>
					<p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
						{featuredPost.excerpt}
					</p>

					<div className="mt-10 grid gap-4 md:grid-cols-3">
						{[
							"Track approval lag, not just output volume.",
							"Measure asset reuse to protect creative capacity.",
							"Review launch readiness before channel scheduling starts.",
						].map((point) => (
							<div
								key={point}
								className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/72 p-4 text-sm text-muted-foreground"
							>
								{point}
							</div>
						))}
					</div>
				</SurfaceCard>

				<SurfaceCard className="p-6 md:p-8">
					<SectionHeading
						badge={<SectionTag>Editorial focus</SectionTag>}
						title="What the blog covers"
						description="The content stays close to the work: campaign planning, reviews, analytics, governance, and the product decisions behind each release."
					/>

					<div className="mt-8 space-y-4">
						{editorialStreams.map((stream) => (
							<div
								key={stream.title}
								className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-5"
							>
								<div className="flex items-center gap-3 text-primary">
									<stream.icon className="size-5" />
									<div className="font-medium text-foreground">
										{stream.title}
									</div>
								</div>
								<p className="mt-3 text-sm leading-6 text-muted-foreground">
									{stream.description}
								</p>
							</div>
						))}
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

function PostGridSection() {
	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={<SectionTag className="mx-auto">Latest posts</SectionTag>}
					title="A searchable archive starts with useful, specific writing."
					description="These entries are written to attract the right readers: operators who need frameworks they can apply immediately."
				/>

				<div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
					{posts.map((post) => (
						<article
							key={post.slug}
							id={post.slug}
							className="surface-panel rounded-[28px] p-6"
						>
							<div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
								<div className="pill pill-muted">{post.category}</div>
								<time dateTime={post.isoDate}>{post.date}</time>
								<div>{post.readingTime}</div>
							</div>
							<h3 className="mt-5 text-xl font-semibold tracking-tight">
								{post.title}
							</h3>
							<p className="mt-4 text-sm leading-7 text-muted-foreground">
								{post.excerpt}
							</p>
						</article>
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
						<SectionTag>Keep reading</SectionTag>
						<h2 className="text-3xl font-semibold tracking-tight">
							Follow the product and the practice, not just the headlines.
						</h2>
						<p className="text-muted-foreground">
							Explore the platform, subscribe for updates, and see how the
							thinking from the blog shows up inside the product surface.
						</p>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row">
						<Button
							size="lg"
							className="rounded-full bg-gradient-brand px-6 text-white border-0"
							asChild
						>
							<Link to="/signup">
								Subscribe and start
								<ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="rounded-full px-6"
							asChild
						>
							<Link to="/features">Explore product features</Link>
						</Button>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

export function BlogPage() {
	return (
		<>
			<HeroSection />
			<FeaturedPostSection />
			<PostGridSection />
			<CTASection />
		</>
	);
}
