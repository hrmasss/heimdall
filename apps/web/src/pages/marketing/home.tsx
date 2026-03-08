import {
	ArrowRight,
	BarChart3,
	Bot,
	CalendarRange,
	Check,
	ChevronDown,
	Globe,
	Layers3,
	LayoutDashboard,
	MessageSquareShare,
	ShieldCheck,
	Sparkles,
	Star,
	Workflow,
	Zap,
} from "lucide-react";
import {
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Link } from "react-router";

import {
	SectionHeading,
	SectionTag,
	SurfaceCard,
} from "@/components/app/brand";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ================================================================
   HOOKS
   ================================================================ */

function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ threshold },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [threshold]);

	return { ref, visible };
}

function useSpotlight() {
	const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		e.currentTarget.style.setProperty("--spotlight-x", `${x}px`);
		e.currentTarget.style.setProperty("--spotlight-y", `${y}px`);
	}, []);
	return handleMouseMove;
}

/* ================================================================
   ANIMATED COUNTER
   ================================================================ */

function AnimatedCounter({
	value,
	suffix = "",
	prefix = "",
	duration = 1800,
}: {
	value: number;
	suffix?: string;
	prefix?: string;
	duration?: number;
}) {
	const [display, setDisplay] = useState(0);
	const { ref, visible } = useInView(0.3);

	useEffect(() => {
		if (!visible) return;
		let raf: number;
		const startTime = performance.now();
		const step = (now: number) => {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - (1 - progress) ** 3;
			const current = Math.round(eased * value);
			setDisplay(current);
			if (progress < 1) {
				raf = requestAnimationFrame(step);
			}
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [visible, value, duration]);

	return (
		<span ref={ref}>
			{visible
				? `${prefix}${display.toLocaleString()}${suffix}`
				: `${prefix}0${suffix}`}
		</span>
	);
}

/* ================================================================
   DATA
   ================================================================ */

const logoCompanies = [
	"Stripe",
	"Vercel",
	"Linear",
	"Notion",
	"Figma",
	"Shopify",
	"Webflow",
	"Loom",
	"Pitch",
	"Arc",
	"Framer",
	"Raycast",
];

const features = [
	{
		icon: CalendarRange,
		title: "Campaign Calendar",
		description:
			"Map multi-channel campaigns against real deadlines, team capacity, and market windows. Visual timelines keep everyone aligned from brief to launch.",
		wide: true,
	},
	{
		icon: MessageSquareShare,
		title: "Approval Inbox",
		description:
			"Keep briefs, feedback, and sign-off in one review flow so campaigns move faster without losing the trail of decisions.",
		wide: false,
	},
	{
		icon: BarChart3,
		title: "Analytics Dashboard",
		description:
			"Performance metrics sit next to your drafts. Track reach, engagement, and ROI where scheduling decisions happen.",
		wide: false,
	},
	{
		icon: ShieldCheck,
		title: "Approval Workflows",
		description:
			"Multi-tier approval ladders with role-based permissions and audit trails. Keep quality consistent across brands and regions.",
		wide: false,
	},
	{
		icon: Bot,
		title: "AI Content Assistant",
		description:
			"Generate caption variants, repurpose long-form content, and get smart suggestions. AI that accelerates your workflow without replacing your voice.",
		wide: false,
	},
	{
		icon: Layers3,
		title: "Multi-Brand Workspaces",
		description:
			"Manage multiple brands from a single command center. Shared asset libraries, workspace-level permissions, and regional campaign variants keep everything organized.",
		wide: true,
	},
];

const howItWorks = [
	{
		step: "01",
		title: "Connect your channels",
		description:
			"Link all your social accounts in under 2 minutes. We support every major platform plus emerging channels.",
		icon: Globe,
	},
	{
		step: "02",
		title: "Plan your campaigns",
		description:
			"Use the visual calendar, approval flows, and campaign views to orchestrate content across channels, teams, and timezones.",
		icon: Workflow,
	},
	{
		step: "03",
		title: "Launch & measure",
		description:
			"Publish with confidence through approval workflows, then track performance with contextual analytics dashboards.",
		icon: LayoutDashboard,
	},
];

const bigMetrics = [
	{ value: 38, suffix: "%", label: "Faster approval cycles" },
	{ value: 12, suffix: "M+", label: "Posts published monthly" },
	{ value: 4, suffix: ".2x", label: "More assets reused" },
	{ value: 99, suffix: ".9%", label: "Platform uptime" },
];

const testimonials = [
	{
		quote:
			"Heimdall replaced three tools and the messy spreadsheet that lived between them. It finally feels like one operating system for our entire content operation.",
		author: "Rina Morales",
		role: "VP Marketing",
		company: "Northset",
		rating: 5,
	},
	{
		quote:
			"The launch room changed our workflow. Everyone sees owners, blockers, and next steps in real time without punting work into side docs.",
		author: "Daniel Osei",
		role: "Social Ops Lead",
		company: "Cedar Labs",
		rating: 5,
	},
	{
		quote:
			"We went from 3 approval bottlenecks per week to zero. The review system actually respects how teams work across timezones.",
		author: "Priya Chandler",
		role: "Content Director",
		company: "Meridian Health",
		rating: 5,
	},
	{
		quote:
			"Our team saves over 10 hours a week. The AI assistant drafts captions that genuinely sound like our brand voice.",
		author: "Luca Brennan",
		role: "Brand Manager",
		company: "Forma Studio",
		rating: 5,
	},
	{
		quote:
			"The multi-brand workspace is a game changer. We manage 6 brands from one panel without mixing up anything.",
		author: "Sophie Nakamura",
		role: "Head of Digital",
		company: "Axle Group",
		rating: 5,
	},
	{
		quote:
			"Analytics right next to drafts means we actually act on data instead of ignoring another dashboard nobody checks.",
		author: "Max Okoro",
		role: "Growth Lead",
		company: "Velvet Commerce",
		rating: 5,
	},
];

const integrations = [
	{ name: "Instagram", color: "#E1306C" },
	{ name: "X / Twitter", color: "#1DA1F2" },
	{ name: "LinkedIn", color: "#0A66C2" },
	{ name: "TikTok", color: "#ff0050" },
	{ name: "YouTube", color: "#FF0000" },
	{ name: "Facebook", color: "#1877F2" },
	{ name: "Pinterest", color: "#E60023" },
	{ name: "Threads", color: "#888" },
	{ name: "Slack", color: "#4A154B" },
	{ name: "Notion", color: "#787774" },
	{ name: "Google Analytics", color: "#E37400" },
	{ name: "HubSpot", color: "#FF7A59" },
];

const faqs = [
	{
		question: "How long does onboarding take?",
		answer:
			"Most teams are fully operational within 48 hours. We provide a guided setup process, migration assistance from your current tools, and a dedicated success partner for Scale and Enterprise plans.",
	},
	{
		question: "Can I migrate from Buffer, Hootsuite, or Sprout Social?",
		answer:
			"Yes. We provide automated migration tools that bring over your connected accounts, scheduled posts, and historical analytics. Your team won't lose a beat.",
	},
	{
		question: "Can I organize work by brand, region, or campaign?",
		answer:
			"Yes. Workspaces can be structured around brands, regional teams, or campaign groups. Permissions, shared assets, and reporting stay scoped correctly so teams can move without cross-contaminating work.",
	},
	{
		question: "Do you offer a free trial?",
		answer:
			"Every plan starts with a 14-day free trial. No credit card required. You get full access to all features in your chosen tier so you can evaluate without restrictions.",
	},
	{
		question: "How does team collaboration work?",
		answer:
			"Every workspace supports unlimited team members with role-based permissions. Content goes through configurable approval workflows, and all feedback stays attached to the specific campaign or asset.",
	},
	{
		question: "What kind of support do you offer?",
		answer:
			"All plans include email support. Growth adds priority chat, Scale adds Slack Connect, and Enterprise includes a dedicated success partner plus 99.9% SLA guarantee.",
	},
];

/* ================================================================
   SPOTLIGHT CARD WRAPPER
   ================================================================ */

function SpotlightCard({
	children,
	className,
	wide,
}: {
	children: ReactNode;
	className?: string;
	wide?: boolean;
}) {
	const handleMouseMove = useSpotlight();
	return (
		<div
			onMouseMove={handleMouseMove}
			className={cn(
				"spotlight-card surface-panel rounded-[28px] p-6 md:p-8",
				wide && "bento-wide",
				className,
			)}
		>
			<div className="relative z-10">{children}</div>
		</div>
	);
}

/* ================================================================
   FAQ ITEM
   ================================================================ */

function FAQItem({ question, answer }: { question: string; answer: string }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/60 backdrop-blur-sm overflow-hidden transition-all">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
			>
				<span className="font-medium text-[0.95rem]">{question}</span>
				<ChevronDown
					className={cn(
						"size-5 shrink-0 text-muted-foreground transition-transform duration-300",
						open && "rotate-180",
					)}
				/>
			</button>
			<div
				className={cn(
					"grid transition-all duration-300 ease-in-out",
					open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
				)}
			>
				<div className="overflow-hidden">
					<p className="px-6 pb-5 text-sm leading-7 text-muted-foreground">
						{answer}
					</p>
				</div>
			</div>
		</div>
	);
}

/* ================================================================
   SECTION: HERO
   ================================================================ */

function HeroSection() {
	return (
		<section className="relative overflow-hidden pt-28 md:pt-36">
			{/* Decorative orbs */}
			<div className="hero-gradient-orb -top-40 left-1/4 h-[500px] w-[500px] bg-[var(--brand-glow-strong)] opacity-60" />
			<div className="hero-gradient-orb -top-20 right-0 h-[400px] w-[400px] bg-[var(--brand-glow)] opacity-40" />
			<div className="hero-noise absolute inset-0 pointer-events-none" />

			<div className="page-container relative z-10">
				<div className="mx-auto max-w-5xl text-center stagger-children">
					{/* Trust badge */}
					<div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border-strong)] bg-background/60 px-4 py-2 text-sm backdrop-blur-sm">
						<div className="flex -space-x-1.5">
							{[0, 1, 2, 3].map((i) => (
								<div
									key={i}
									className="size-6 rounded-full border-2 border-background bg-gradient-brand"
									style={{ opacity: 1 - i * 0.15 }}
								/>
							))}
						</div>
						<span className="text-muted-foreground">
							Trusted by{" "}
							<span className="font-semibold text-foreground">2,000+</span>{" "}
							marketing teams
						</span>
					</div>

					{/* Headline */}
					<h1 className="mx-auto mt-8 max-w-[11.5ch] text-balance text-[2.75rem] font-semibold leading-[1] tracking-[-0.04em] sm:max-w-[13.5ch] sm:text-6xl md:max-w-none lg:text-[4.5rem]">
						The marketing{" "}
						<span className="text-gradient-brand">command center</span>
						<br className="hidden md:block" /> your team deserves
					</h1>

					{/* Subheading */}
					<p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
						Plan campaigns, automate publishing, manage approvals, and measure
						performance — all from one beautifully designed workspace that keeps
						your team in sync.
					</p>

					{/* CTA buttons */}
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Button
							size="lg"
							className="relative rounded-full bg-gradient-brand px-8 text-white border-0 pulse-ring"
							asChild
						>
							<Link to="/dashboard">
								Start free trial
								<ArrowRight className="ml-1 size-4" />
							</Link>
						</Button>
						<Button
							size="lg"
							variant="outline"
							className="rounded-full px-8"
							asChild
						>
							<Link to="/features">See how it works</Link>
						</Button>
					</div>

					<p className="mt-4 text-sm text-muted-foreground">
						14-day free trial · No credit card required · Cancel anytime
					</p>
				</div>

				{/* Hero Dashboard Preview */}
				<div className="relative mt-16 md:mt-20">
					{/* Floating badges */}
					<div className="absolute -left-4 top-12 z-20 float-badge hidden lg:block">
						<div className="glass rounded-2xl px-4 py-3 shadow-lg">
							<div className="flex items-center gap-2">
								<div className="flex size-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand-success)_14%,transparent)]">
									<Zap className="size-4 text-[var(--brand-success)]" />
								</div>
								<div>
									<div className="text-xs text-muted-foreground">
										Campaign sent
									</div>
									<div className="text-sm font-semibold">+2.4K reach</div>
								</div>
							</div>
						</div>
					</div>

					<div className="absolute -right-4 top-24 z-20 float-badge-delay hidden lg:block">
						<div className="glass rounded-2xl px-4 py-3 shadow-lg">
							<div className="flex items-center gap-2">
								<div className="flex size-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand-primary)_14%,transparent)]">
									<Check className="size-4 text-primary" />
								</div>
								<div>
									<div className="text-xs text-muted-foreground">Approval</div>
									<div className="text-sm font-semibold">3 posts approved</div>
								</div>
							</div>
						</div>
					</div>

					{/* Main dashboard mockup */}
					<SurfaceCard
						tone="strong"
						className="relative overflow-hidden p-3 md:p-5 cta-glow"
					>
						<div className="brand-grid absolute inset-0 opacity-15" />
						<div className="relative space-y-4">
							{/* Top bar */}
							<div className="flex items-center justify-between rounded-2xl border border-[var(--brand-border-soft)] bg-background/80 px-5 py-3.5 backdrop-blur-sm">
								<div className="flex items-center gap-4">
									<Logo size="sm" showText={false} />
									<div className="hidden h-4 w-px bg-border sm:block" />
									<div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
										Campaign Hub
									</div>
									<div className="hidden h-4 w-px bg-border sm:block" />
									<div className="hidden text-sm font-medium sm:block">
										Q2 Product Launch
									</div>
								</div>
								<div className="flex items-center gap-3">
									<div className="pill pill-success">18 items ready</div>
									<div className="pill pill-warning hidden sm:flex">
										4 in review
									</div>
								</div>
							</div>

							{/* Stats row */}
							<div className="grid gap-3 sm:grid-cols-4">
								{[
									{ label: "Total Reach", val: "2.4M", change: "+12%" },
									{ label: "Engagement", val: "8.3%", change: "+1.2%" },
									{ label: "Approval SLA", val: "< 4h", change: "-38%" },
									{
										label: "Active Channels",
										val: "12",
										change: "+3",
									},
								].map((stat) => (
									<div
										key={stat.label}
										className="rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 p-4"
									>
										<div className="text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
											{stat.label}
										</div>
										<div className="mt-2 flex items-baseline gap-2">
											<span className="text-2xl font-semibold tracking-tight">
												{stat.val}
											</span>
											<span className="text-xs font-medium text-[var(--brand-success)]">
												{stat.change}
											</span>
										</div>
									</div>
								))}
							</div>

							{/* Table mockup */}
							<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/75 p-4 backdrop-blur-sm">
								<div className="mb-4 flex items-center justify-between">
									<div>
										<div className="text-sm font-medium">Publishing Queue</div>
										<div className="text-xs text-muted-foreground">
											Manage, approve, and schedule content across all channels
										</div>
									</div>
									<div className="flex gap-2">
										<div className="pill pill-info">Live queue</div>
									</div>
								</div>
								<div className="space-y-2">
									<div className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr] gap-3 px-3 text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
										<span>Campaign</span>
										<span>Channel</span>
										<span>Status</span>
										<span>Owner</span>
									</div>
									{[
										[
											"Spring narrative refresh",
											"LinkedIn",
											"Scheduled",
											"Rina",
										],
										["Founder memo series", "X", "Approved", "Imran"],
										["Product launch teaser", "Instagram", "In review", "Noa"],
										["Customer story #14", "YouTube", "Draft", "Luca"],
									].map((row) => {
										const statusColors: Record<string, string> = {
											Scheduled: "pill-success",
											Approved: "pill-success",
											"In review": "pill-warning",
											Draft: "pill-muted",
										};
										return (
											<div
												key={row[0]}
												className="grid grid-cols-[1.2fr_0.7fr_0.6fr_0.6fr] gap-3 rounded-2xl border border-[var(--brand-border-soft)] bg-card/80 px-3 py-3 text-sm"
											>
												<div className="font-medium truncate">{row[0]}</div>
												<div className="text-muted-foreground">{row[1]}</div>
												<div>
													<span
														className={cn(
															"pill text-xs",
															statusColors[row[2] as string] || "pill-muted",
														)}
													>
														{row[2]}
													</span>
												</div>
												<div className="text-muted-foreground">{row[3]}</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					</SurfaceCard>
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: LOGO CLOUD (MARQUEE)
   ================================================================ */

function LogoCloudSection() {
	const logos = [
		...logoCompanies.map((name) => ({ id: `${name}-primary`, name })),
		...logoCompanies.map((name) => ({ id: `${name}-secondary`, name })),
	];
	return (
		<section className="section-spacing-sm overflow-hidden">
			<div className="page-container">
				<p className="mb-8 text-center text-sm uppercase tracking-[0.22em] text-muted-foreground">
					Trusted by forward-thinking marketing teams
				</p>
			</div>
			<div className="relative">
				{/* Fade masks */}
				<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
				<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />

				<div className="marquee-track">
					{logos.map((logo) => (
						<div
							key={logo.id}
							className="mx-8 flex items-center gap-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground/80"
						>
							<div className="size-6 rounded-lg bg-muted/50" />
							<span className="whitespace-nowrap text-lg font-medium tracking-tight">
								{logo.name}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: FEATURES BENTO GRID
   ================================================================ */

function FeaturesSection() {
	const { ref, visible } = useInView(0.1);

	return (
		<section className="section-spacing">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={
						<SectionTag className="mx-auto">
							<Sparkles className="size-3.5" />
							Everything you need
						</SectionTag>
					}
					title={
						<>
							One platform to{" "}
							<span className="text-gradient-brand">
								plan, publish, and grow
							</span>
						</>
					}
					description="Stop juggling disconnected tools. Heimdall unifies your entire marketing workflow into a single, elegant workspace."
				/>

				<div
					ref={ref}
					className={cn(
						"mt-14 bento-grid stagger-reveal",
						visible && "is-visible",
					)}
				>
					{features.map((feature) => (
						<SpotlightCard key={feature.title} wide={feature.wide}>
							<div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
								<feature.icon className="size-5" />
							</div>
							<h3 className="text-xl font-semibold tracking-tight">
								{feature.title}
							</h3>
							<p className="mt-3 text-sm leading-7 text-muted-foreground">
								{feature.description}
							</p>
						</SpotlightCard>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: HOW IT WORKS
   ================================================================ */

function HowItWorksSection() {
	const { ref, visible } = useInView(0.15);

	return (
		<section className="section-spacing">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={<SectionTag className="mx-auto">Simple to start</SectionTag>}
					title="Up and running in minutes, not weeks"
					description="Heimdall is designed so your team can move fast from day one."
				/>

				<div
					ref={ref}
					className={cn(
						"mt-14 grid gap-6 md:grid-cols-3 stagger-reveal",
						visible && "is-visible",
					)}
				>
					{howItWorks.map((step, i) => (
						<div key={step.step} className="relative">
							<SurfaceCard className="h-full p-6 md:p-8">
								<div className="flex items-center gap-4 mb-6">
									<div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-brand text-white font-semibold text-sm">
										{step.step}
									</div>
									<step.icon className="size-6 text-primary" />
								</div>
								<h3 className="text-lg font-semibold tracking-tight">
									{step.title}
								</h3>
								<p className="mt-3 text-sm leading-7 text-muted-foreground">
									{step.description}
								</p>
							</SurfaceCard>

							{/* Connector arrow (not on last) */}
							{i < howItWorks.length - 1 && (
								<div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
									<ArrowRight className="size-5 text-[var(--brand-primary)]" />
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: METRICS
   ================================================================ */

function MetricsSection() {
	const { ref, visible } = useInView(0.2);

	return (
		<section className="section-spacing">
			<div className="page-container">
				<SurfaceCard
					tone="strong"
					className="relative overflow-hidden px-6 py-12 md:px-12 md:py-16"
				>
					<div className="brand-grid absolute inset-0 opacity-15" />
					<div className="relative z-10">
						<SectionHeading
							align="center"
							badge={
								<SectionTag className="mx-auto">Proven results</SectionTag>
							}
							title="Numbers that speak for themselves"
							description="Marketing teams using Heimdall see measurable improvements from day one."
						/>

						<div
							ref={ref}
							className={cn(
								"mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 stagger-reveal",
								visible && "is-visible",
							)}
						>
							{bigMetrics.map((m) => (
								<div
									key={m.label}
									className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/65 p-6 text-center backdrop-blur-sm"
								>
									<div className="text-4xl font-semibold tracking-tight md:text-5xl">
										<AnimatedCounter value={m.value} suffix={m.suffix} />
									</div>
									<div className="mt-3 text-sm text-muted-foreground">
										{m.label}
									</div>
								</div>
							))}
						</div>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: TESTIMONIALS
   ================================================================ */

function TestimonialsSection() {
	const { ref, visible } = useInView(0.1);

	return (
		<section className="section-spacing">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={
						<SectionTag className="mx-auto">
							<Star className="size-3.5" />
							Customer love
						</SectionTag>
					}
					title="Trusted by teams who take marketing seriously"
					description="Don't just take our word for it. Here's what marketing leaders say about Heimdall."
				/>

				<div
					ref={ref}
					className={cn(
						"mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3 stagger-reveal",
						visible && "is-visible",
					)}
				>
					{testimonials.map((t) => (
						<div
							key={t.author}
							className="testimonial-card surface-panel rounded-[24px] p-6"
						>
							{/* Stars */}
							<div className="flex gap-1 text-[var(--brand-primary)]">
								{Array.from({ length: t.rating }).map((_, i) => (
									<Star
										key={`${t.author}-star-${i}`}
										className="size-4 fill-current"
									/>
								))}
							</div>

							{/* Quote */}
							<p className="mt-5 text-[0.925rem] leading-7">"{t.quote}"</p>

							{/* Author */}
							<div className="mt-6 flex items-center gap-3 border-t border-[var(--brand-border-soft)] pt-5">
								<div className="flex size-10 items-center justify-center rounded-full bg-gradient-brand text-xs font-semibold text-white">
									{t.author
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</div>
								<div>
									<div className="text-sm font-medium">{t.author}</div>
									<div className="text-xs text-muted-foreground">
										{t.role}, {t.company}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: INTEGRATIONS
   ================================================================ */

function IntegrationsSection() {
	const { ref, visible } = useInView(0.1);

	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={
						<SectionTag className="mx-auto">
							<Globe className="size-3.5" />
							Integrations
						</SectionTag>
					}
					title="Connects with every tool in your stack"
					description="Publish to every major channel, sync with your analytics, and pipe data to the tools your team already uses."
				/>

				<div
					ref={ref}
					className={cn(
						"mt-12 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6 stagger-reveal",
						visible && "is-visible",
					)}
				>
					{integrations.map((item) => (
						<div
							key={item.name}
							className="integration-icon flex flex-col items-center gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/60 p-5 backdrop-blur-sm text-center"
						>
							<div
								className="flex size-10 items-center justify-center rounded-xl"
								style={{
									background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
								}}
							>
								<div
									className="size-4 rounded-sm"
									style={{ background: item.color }}
								/>
							</div>
							<span className="text-xs font-medium text-muted-foreground">
								{item.name}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: FAQ
   ================================================================ */

function FAQSection() {
	const { ref, visible } = useInView(0.1);

	return (
		<section className="section-spacing">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={<SectionTag className="mx-auto">Questions</SectionTag>}
					title="Frequently asked questions"
					description="Everything you need to know about getting started with Heimdall."
				/>

				<div
					ref={ref}
					className={cn(
						"mx-auto mt-12 max-w-3xl space-y-3 stagger-reveal",
						visible && "is-visible",
					)}
				>
					{faqs.map((faq) => (
						<FAQItem
							key={faq.question}
							question={faq.question}
							answer={faq.answer}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   SECTION: FINAL CTA
   ================================================================ */

function FinalCTASection() {
	return (
		<section className="section-spacing">
			<div className="page-container">
				<SurfaceCard
					tone="strong"
					className="relative overflow-hidden px-6 py-14 md:px-16 md:py-20"
				>
					<div className="brand-grid absolute inset-0 opacity-12" />
					{/* Glow orbs */}
					<div className="hero-gradient-orb -top-32 left-1/3 h-[300px] w-[300px] bg-[var(--brand-glow-strong)] opacity-40" />
					<div className="hero-gradient-orb -bottom-32 right-1/4 h-[250px] w-[250px] bg-[var(--brand-glow)] opacity-30" />

					<div className="relative z-10 mx-auto max-w-2xl text-center">
						<SectionTag className="mx-auto">
							<Sparkles className="size-3.5" />
							Ready to level up?
						</SectionTag>

						<h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
							Start building{" "}
							<span className="text-gradient-brand">smarter campaigns</span>{" "}
							today
						</h2>

						<p className="mt-5 text-muted-foreground md:text-lg">
							Join thousands of marketing teams who've replaced their chaotic
							tool stack with one calm, connected workspace.
						</p>

						<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
							<Button
								size="lg"
								className="rounded-full bg-gradient-brand px-8 text-white border-0"
								asChild
							>
								<Link to="/dashboard">
									Start your free trial
									<ArrowRight className="ml-1 size-4" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="rounded-full px-8"
								asChild
							>
								<Link to="/pricing">Compare plans</Link>
							</Button>
						</div>

						<p className="mt-5 text-sm text-muted-foreground">
							Free 14-day trial · No credit card · Setup in 2 minutes
						</p>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

/* ================================================================
   PAGE EXPORT
   ================================================================ */

export function HomePage() {
	return (
		<>
			<HeroSection />
			<LogoCloudSection />
			<div className="section-divider page-container" />
			<FeaturesSection />
			<HowItWorksSection />
			<MetricsSection />
			<TestimonialsSection />
			<IntegrationsSection />
			<FAQSection />
			<FinalCTASection />
		</>
	);
}
