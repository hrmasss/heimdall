import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Bot,
	CalendarDays,
	Check,
	ChevronRight,
	Clock,
	Copy,
	Facebook,
	Hash,
	Linkedin,
	List,
	Megaphone,
	MessageSquareText,
	Newspaper,
	Share2,
	Sparkles,
	TrendingUp,
	Twitter,
} from "lucide-react";
import {
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link, useParams } from "react-router";

import { SectionTag, SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { useMarketingScrollViewport } from "./scroll-context";

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

function useActiveSection(sectionIds: string[]) {
	const [activeId, setActiveId] = useState<string>("");

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				}
			},
			{ rootMargin: "-20% 0px -60% 0px", threshold: 0.1 },
		);

		for (const id of sectionIds) {
			const el = document.getElementById(id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	}, [sectionIds]);

	return activeId;
}

function useSpotlight() {
	return useCallback((e: ReactMouseEvent<HTMLElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		e.currentTarget.style.setProperty(
			"--spotlight-x",
			`${e.clientX - rect.left}px`,
		);
		e.currentTarget.style.setProperty(
			"--spotlight-y",
			`${e.clientY - rect.top}px`,
		);
	}, []);
}

/* ================================================================
   DATA — full blog posts including content
   ================================================================ */

interface BlogChapter {
	id: string;
	title: string;
}

interface BlogPost {
	slug: string;
	category: string;
	title: string;
	excerpt: string;
	date: string;
	isoDate: string;
	readingTime: string;
	author: { name: string; initials: string; role: string };
	tldr: string;
	chapters: BlogChapter[];
	content: { id: string; heading: string; body: string[] }[];
}

const thumbThemes: Record<string, { bg: string; accent: string }> = {
	Operations: {
		bg: "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 18%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-accent) 22%, var(--brand-panel)) 100%)",
		accent: "var(--brand-primary)",
	},
	Planning: {
		bg: "linear-gradient(150deg, color-mix(in srgb, var(--brand-secondary) 20%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-info) 16%, var(--brand-panel)) 100%)",
		accent: "var(--brand-info)",
	},
	Approvals: {
		bg: "linear-gradient(125deg, color-mix(in srgb, var(--brand-warning) 16%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-secondary) 18%, var(--brand-panel)) 100%)",
		accent: "var(--brand-warning)",
	},
	"Product update": {
		bg: "linear-gradient(160deg, color-mix(in srgb, var(--brand-success) 14%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-primary) 16%, var(--brand-panel)) 100%)",
		accent: "var(--brand-success)",
	},
	Analytics: {
		bg: "linear-gradient(140deg, color-mix(in srgb, var(--brand-info) 20%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-accent) 14%, var(--brand-panel)) 100%)",
		accent: "var(--brand-info)",
	},
	Governance: {
		bg: "linear-gradient(130deg, color-mix(in srgb, var(--brand-accent) 22%, var(--brand-panel-strong)) 0%, color-mix(in srgb, var(--brand-danger) 12%, var(--brand-panel)) 100%)",
		accent: "var(--brand-accent)",
	},
};

const allPosts: BlogPost[] = [
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
		author: {
			name: "Rina Morales",
			initials: "RM",
			role: "Head of Content Ops",
		},
		tldr: "High-performing marketing teams track five operational metrics instead of just output volume: handoff speed, approval turnaround, asset reuse rate, launch readiness score, and campaign velocity. Together these signals reveal whether a team is improving its systems — or just producing more noise. This article walks through how to build a lightweight scorecard that surfaces these numbers weekly without adding another dashboard nobody checks.",
		chapters: [
			{ id: "why-output-metrics-fail", title: "Why output metrics fail" },
			{ id: "the-five-signals", title: "The five signals that matter" },
			{
				id: "handoff-speed",
				title: "Signal 1 — Handoff speed",
			},
			{
				id: "approval-turnaround",
				title: "Signal 2 — Approval turnaround",
			},
			{ id: "asset-reuse-rate", title: "Signal 3 — Asset reuse rate" },
			{
				id: "launch-readiness",
				title: "Signal 4 — Launch readiness",
			},
			{
				id: "campaign-velocity",
				title: "Signal 5 — Campaign velocity",
			},
			{
				id: "building-the-scorecard",
				title: "Building the scorecard",
			},
			{
				id: "closing-thoughts",
				title: "Closing thoughts",
			},
		],
		content: [
			{
				id: "why-output-metrics-fail",
				heading: "Why output metrics fail",
				body: [
					"Most marketing teams measure what's easy to count: posts published, campaigns launched, emails sent. These numbers feel productive because they go up and to the right. But output volume doesn't tell you whether work moved efficiently, whether teams are aligned, or whether the pipeline is sustainable.",
					"The content operations leaders we've spoken with describe a recurring pattern. Quarterly reviews celebrate record output, but the team is burning out and key assets arrive late. Output metrics mask the dysfunction beneath a polished surface.",
					"A more honest picture emerges when you move from counting deliverables to measuring the operational rhythms that produce them. This requires a different kind of scorecard — one built around system health, not just throughput.",
				],
			},
			{
				id: "the-five-signals",
				heading: "The five signals that matter",
				body: [
					"After studying dozens of high-performing content teams, five recurring signals emerged. None of them measure output directly. Instead, each one captures a friction point or coordination pattern that compounds over time.",
					"When tracked together on a weekly cadence, these five numbers give team leads enough signal to intervene early — before missed deadlines and quality dips become visible to stakeholders.",
				],
			},
			{
				id: "handoff-speed",
				heading: "Signal 1 — Handoff speed",
				body: [
					"Handoff speed measures the average time between one stage of work completing and the next stage beginning. It's the gap between 'design is done' and 'copy review starts,' or between 'legal approved' and 'campaign goes live.'",
					"Slow handoffs are the most common source of wasted time in content operations. They rarely appear in retrospectives because no single person owns them. The work just… sits. Tracking handoff speed makes this invisible waste visible.",
					"Teams that reduce average handoff time by even 30% often see campaign cycle times drop by a full week — without anyone working faster or longer hours.",
				],
			},
			{
				id: "approval-turnaround",
				heading: "Signal 2 — Approval turnaround",
				body: [
					"Approval turnaround is the elapsed time from when a piece of content enters a review queue to when a decision is returned — approved, rejected, or revision-requested.",
					"This signal matters because approval bottlenecks are exponential. One slow reviewer doesn't just delay one campaign; they create a queue that delays everything behind it. And the longer content waits, the more likely it is to need updates before it even ships.",
					"The best teams set explicit SLAs for approval turnaround — typically 24 hours for standard reviews and 4 hours for time-sensitive launches. The number itself matters less than the act of making an expectation visible.",
				],
			},
			{
				id: "asset-reuse-rate",
				heading: "Signal 3 — Asset reuse rate",
				body: [
					"Asset reuse rate tracks how often existing creative, copy templates, or approved components are used in new campaigns versus creating everything from scratch.",
					"Low reuse rates indicate either a disorganized asset library, a culture of reinvention, or unclear templating standards. High reuse rates correlate with faster cycle times and more consistent brand expression.",
					"This doesn't mean every campaign should be templated. It means the team should know what's reusable and choose novelty deliberately rather than accidentally recreating what already exists.",
				],
			},
			{
				id: "launch-readiness",
				heading: "Signal 4 — Launch readiness",
				body: [
					"Launch readiness is a composite score that captures whether all required elements of a campaign are complete and aligned before the scheduled launch date. It includes things like asset completion, stakeholder sign-off, channel configuration, and tracking setup.",
					"Teams that track launch readiness as a weekly metric find problems earlier. A campaign that's only 40% ready three days before launch surfaces a different conversation than one where the gaps only become apparent on launch morning.",
					"The scoring model doesn't need to be complex. A simple checklist with weighted items — where blocking dependencies count more heavily — is enough to generate a useful number.",
				],
			},
			{
				id: "campaign-velocity",
				heading: "Signal 5 — Campaign velocity",
				body: [
					"Campaign velocity measures the end-to-end elapsed time from brief approval to live launch. It's a lagging indicator — it reflects the cumulative effect of all the upstream signals — but it's the number most useful for capacity planning.",
					"When velocity trends upward (slower), it's a signal to investigate the other four metrics. When it trends downward (faster), the team has evidence that operational improvements are working.",
					"Tracking velocity per campaign type (e.g., product launch vs. evergreen content vs. paid social) gives more actionable resolution than a blended average across all work.",
				],
			},
			{
				id: "building-the-scorecard",
				heading: "Building the scorecard",
				body: [
					"The scorecard itself should be a lightweight weekly artifact — not another dashboard that competes for attention. A single-page view with five rows, current-week numbers, trailing four-week trend, and a one-line note per metric is enough.",
					"Most teams already have the raw data to populate these metrics. The challenge isn't collection; it's agreeing on definitions, setting a review rhythm, and actually discussing the numbers each week.",
					"We recommend starting with just two of the five signals — typically handoff speed and approval turnaround — and adding the rest over two or three sprints. This keeps the habit buildable and avoids the 'new dashboard nobody opens' trap.",
					"The goal isn't perfection. It's creating a shared language for operational quality that sits alongside the output metrics leadership already cares about.",
				],
			},
			{
				id: "closing-thoughts",
				heading: "Closing thoughts",
				body: [
					"Output will always matter. Campaigns need to ship, content needs to reach audiences, and teams need to demonstrate productivity. But output alone is a noisy signal. It doesn't distinguish between a team that ships efficiently and one that ships despite itself.",
					"A content ops scorecard built around handoff speed, approval turnaround, asset reuse, launch readiness, and campaign velocity gives operators the clarity to improve the system — not just its outputs.",
					"The teams that adopt this approach don't necessarily produce more. They produce with less friction, less rework, and less of the invisible coordination tax that makes scaled content operations feel harder than it should be.",
				],
			},
		],
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
		author: { name: "Daniel Osei", initials: "DO", role: "Strategy Lead" },
		tldr: "Campaign calendars fail not because of tooling but because of ambiguous ownership. Without clear assignment of who resolves blockers, who holds final sign-off authority, and who reprioritizes when timing shifts, even the best-designed calendar becomes a decorative artifact that teams ignore under pressure.",
		chapters: [
			{ id: "the-calendar-illusion", title: "The calendar illusion" },
			{ id: "ownership-not-assignment", title: "Ownership vs. assignment" },
			{ id: "three-roles-that-matter", title: "Three roles that matter" },
			{ id: "making-it-stick", title: "Making it stick" },
		],
		content: [
			{
				id: "the-calendar-illusion",
				heading: "The calendar illusion",
				body: [
					"Every marketing team has a campaign calendar. Most of them are beautiful — color-coded, neatly organized, updated weekly. And most of them fail when things get real.",
					"The failure mode isn't missing data. It's missing clarity about who does what when the plan changes. And plans always change.",
				],
			},
			{
				id: "ownership-not-assignment",
				heading: "Ownership vs. assignment",
				body: [
					"There's a meaningful difference between assigning someone to a task and giving them ownership of an outcome. Assignment says 'do this thing.' Ownership says 'make sure this thing succeeds, and figure out what's in the way.'",
					"Campaign calendars typically handle assignment well. They tell you who's writing the email, who's designing the banner, who's building the landing page. What they rarely capture is who decides what happens when the landing page is delayed and the email needs to adjust.",
				],
			},
			{
				id: "three-roles-that-matter",
				heading: "Three roles that matter",
				body: [
					"Every campaign needs three clear roles: a Blocker Resolver who clears obstacles and makes trade-off decisions, a Sign-off Authority who gives final approval and can't be bypassed, and a Priority Holder who decides what moves first when competing work collides.",
					"These roles might overlap — a single campaign lead might hold all three. But naming them explicitly changes the team's behavior. Instead of waiting for someone to notice a problem, people know exactly who to escalate to.",
				],
			},
			{
				id: "making-it-stick",
				heading: "Making it stick",
				body: [
					"Add these three roles as required fields in your campaign briefs. Review them in weekly standups. And most importantly, hold the named people accountable for the outcomes — not just the tasks.",
					"A calendar with ownership clarity becomes a coordination tool. Without it, it's just a schedule that crumbles under the first surprise.",
				],
			},
		],
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
		author: {
			name: "Priya Chandler",
			initials: "PC",
			role: "Workflow Architect",
		},
		tldr: "Teams that automate approval workflows before establishing clear SLAs end up accelerating dysfunction rather than resolving it. Start with explicit turnaround expectations, escalation paths, and decision criteria, then layer automation on top to enforce and scale those agreements.",
		chapters: [
			{ id: "automation-trap", title: "The automation trap" },
			{ id: "sla-first", title: "SLA-first thinking" },
			{ id: "what-to-define", title: "What to define" },
			{ id: "then-automate", title: "Then automate" },
		],
		content: [
			{
				id: "automation-trap",
				heading: "The automation trap",
				body: [
					"The instinct to automate approval workflows is understandable. Reviews are slow, bottlenecks are painful, and software promises to make it all faster. But faster chaos is still chaos.",
					"Without agreed-upon expectations for turnaround times, escalation paths, and decision criteria, automation just moves confusion through the pipeline more quickly.",
				],
			},
			{
				id: "sla-first",
				heading: "SLA-first thinking",
				body: [
					"An approval SLA is a team agreement: when someone submits work for review, the reviewer commits to responding within a defined window. That's it. No complex tooling required.",
					"The act of defining the SLA forces conversations that should have happened long ago — who can approve what, how long is reasonable, and what happens when someone is unavailable.",
				],
			},
			{
				id: "what-to-define",
				heading: "What to define",
				body: [
					"At minimum, define three things: the expected turnaround time (e.g., 24 hours for standard, 4 hours for urgent), the escalation path when the SLA is missed, and the criteria for what constitutes a valid approval vs. a revision request.",
					"Write these down. Share them. Reference them in review kickoffs. The specificity is the point.",
				],
			},
			{
				id: "then-automate",
				heading: "Then automate",
				body: [
					"Once the SLA is defined and practiced manually for a few cycles, automation becomes powerful. You can build reminders, auto-escalations, and SLA tracking dashboards that are grounded in real expectations rather than arbitrary defaults.",
					"Software can enforce agreements. It can't create them.",
				],
			},
		],
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
		author: { name: "Heimdall Team", initials: "HT", role: "Product Team" },
		tldr: "This product update introduces refined campaign status states with clearer transitions, improved reviewer visibility so everyone knows who's blocking what, and row-level context that reduces the back-and-forth needed to understand campaign progress at a glance.",
		chapters: [
			{ id: "status-states", title: "Refined status states" },
			{ id: "reviewer-visibility", title: "Reviewer visibility" },
			{ id: "row-context", title: "Row-level context" },
		],
		content: [
			{
				id: "status-states",
				heading: "Refined status states",
				body: [
					"Campaign status now supports more granular states: Draft, In Review, Changes Requested, Approved, Scheduled, and Live. Each transition is logged with timestamp and actor, creating a decision trail that's useful for retrospectives.",
					"The previous three-state model was too coarse for teams managing complex approval chains. These six states map more naturally to how campaigns actually move through review.",
				],
			},
			{
				id: "reviewer-visibility",
				heading: "Reviewer visibility",
				body: [
					"Every campaign row now shows assigned reviewers with their current response status. At a glance, team leads can see who has approved, who hasn't responded, and who has requested changes.",
					"This replaces the previous workflow where you had to open each campaign to check review status — a small friction that compounded across large campaign volumes.",
				],
			},
			{
				id: "row-context",
				heading: "Row-level context",
				body: [
					"Each campaign row can now carry a short context note — visible directly in the list view — that explains current blockers, upcoming deadlines, or key decisions needed. No more clicking into six different campaigns to understand the state of the week.",
				],
			},
		],
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
		author: {
			name: "Sophie Nakamura",
			initials: "SN",
			role: "Analytics Lead",
		},
		tldr: "Replace quarterly reporting marathons with a two-layer rhythm: lightweight weekly operational snapshots that flag emerging issues, and monthly narrative reviews that contextualize trends and recommend action. This cadence helps teams course-correct inside the quarter rather than discovering problems after it ends.",
		chapters: [
			{ id: "quarterly-trap", title: "The quarterly trap" },
			{ id: "weekly-pulse", title: "Weekly operational pulse" },
			{ id: "monthly-narrative", title: "Monthly narrative review" },
			{ id: "rhythm-over-dashboards", title: "Rhythm over dashboards" },
		],
		content: [
			{
				id: "quarterly-trap",
				heading: "The quarterly trap",
				body: [
					"Quarterly reports arrive too late to be useful. By the time the data is compiled, contextualized, and presented, the quarter is over. The insights describe what happened, not what to do next.",
					"Most teams know this. They still default to quarterly cadences because the alternative — more frequent reporting — feels like more work.",
				],
			},
			{
				id: "weekly-pulse",
				heading: "Weekly operational pulse",
				body: [
					"A weekly pulse is not a report. It's a five-minute artifact: three to five key numbers with directional indicators (up/down/flat) and one sentence of context per metric.",
					"The goal is pattern recognition, not analysis. If engagement rate dropped 15% week-over-week, the pulse flags it. The investigation happens in the monthly review.",
				],
			},
			{
				id: "monthly-narrative",
				heading: "Monthly narrative review",
				body: [
					"The monthly review is where analysis lives. It synthesizes four weeks of pulse data into a narrative: what changed, why it likely changed, and what the team should consider doing about it.",
					"This is a written document — not a deck. Written narratives force clearer thinking and are easier to reference later when making planning decisions.",
				],
			},
			{
				id: "rhythm-over-dashboards",
				heading: "Rhythm over dashboards",
				body: [
					"Dashboards are useful reference tools. But they don't create action. A reporting rhythm — weekly pulse, monthly narrative — creates a cadence of attention that makes data actionable.",
					"The best analytics teams we've studied don't have better dashboards. They have better habits.",
				],
			},
		],
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
		author: { name: "Max Okoro", initials: "MO", role: "Platform Lead" },
		tldr: "Multi-brand teams need a governance model before they expand — not after. This means codifying permission hierarchies, template inheritance rules, and asset reuse policies into a framework that can absorb new brands and regions without creating ungovernable exceptions.",
		chapters: [
			{ id: "scaling-problem", title: "The scaling problem" },
			{ id: "permission-hierarchy", title: "Permission hierarchies" },
			{ id: "template-inheritance", title: "Template inheritance" },
			{ id: "asset-reuse-policy", title: "Asset reuse policies" },
			{ id: "governance-framework", title: "Building the framework" },
		],
		content: [
			{
				id: "scaling-problem",
				heading: "The scaling problem",
				body: [
					"Every multi-brand team starts the same way: one brand, one set of rules, one team that knows everything. Then a second brand is added. The team copies the playbook, adjusts a few things, and moves on.",
					"By the third or fourth brand, the original rules are unrecognizable. Each brand has its own exceptions, its own approval chains, its own version of the template. Governance has become a collection of workarounds.",
				],
			},
			{
				id: "permission-hierarchy",
				heading: "Permission hierarchies",
				body: [
					"Permissions should follow a clear hierarchy: global rules that apply everywhere, brand-level overrides for specific needs, and regional adjustments for local compliance requirements.",
					"The key principle is inheritance. New brands start with global defaults and only deviate where there's a documented reason. This keeps the exception list short and auditable.",
				],
			},
			{
				id: "template-inheritance",
				heading: "Template inheritance",
				body: [
					"Templates should work like code inheritance. A master template defines structure, required fields, and brand guidelines. Brand-specific templates extend the master, adding or modifying only what's necessary.",
					"This approach prevents template sprawl and makes it possible to push global updates (like a new compliance disclaimer) across all brands simultaneously.",
				],
			},
			{
				id: "asset-reuse-policy",
				heading: "Asset reuse policies",
				body: [
					"Decide upfront which assets are shared across brands and which are brand-exclusive. Define clear tagging and categorization standards so teams can find reusable assets without asking someone.",
					"A good reuse policy reduces duplicate creative work by 30-40% in most multi-brand organizations — but only if it's documented and enforced from the start.",
				],
			},
			{
				id: "governance-framework",
				heading: "Building the framework",
				body: [
					"The governance framework should be a living document — reviewed quarterly, updated as new brands or regions are added, and owned by a specific role (not a committee).",
					"Keep it simple: one page for permissions, one page for templates, one page for asset policies. If it takes longer than 10 minutes to onboard a new team member on the governance model, it's too complex.",
				],
			},
		],
	},
];

/* ================================================================
   CATEGORY ICON HELPER
   ================================================================ */

function CategoryIcon({
	category,
	className,
}: { category: string; className?: string }) {
	switch (category) {
		case "Operations":
			return <TrendingUp className={className} />;
		case "Planning":
			return <CalendarDays className={className} />;
		case "Approvals":
			return <Newspaper className={className} />;
		case "Product update":
			return <Megaphone className={className} />;
		case "Analytics":
			return <TrendingUp className={className} />;
		case "Governance":
			return <Newspaper className={className} />;
		default:
			return <BookOpen className={className} />;
	}
}

/* ================================================================
   AI SUMMARIZE LINKS
   ================================================================ */

const aiTools = [
	{
		name: "ChatGPT",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="size-4"
				aria-hidden="true"
			>
				<path
					d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.985 5.985 0 0 0 .516 4.911 6.046 6.046 0 0 0 6.51 2.9A6.065 6.065 0 0 0 13.209 24a6.046 6.046 0 0 0 5.476-3.346 5.985 5.985 0 0 0 3.998-2.9 6.046 6.046 0 0 0-.743-7.097c.087-.283.137-.57.342-.836Z"
					fill="currentColor"
					opacity="0.15"
				/>
				<path
					d="M12 8v4m0 0v4m0-4h4m-4 0H8"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		),
		prompt: (title: string) =>
			`https://chat.openai.com/?q=${encodeURIComponent(`Summarize this article: "${title}"`)}`,
		color: "var(--brand-success)",
	},
	{
		name: "Claude",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="size-4"
				aria-hidden="true"
			>
				<rect
					x="3"
					y="3"
					width="18"
					height="18"
					rx="4"
					fill="currentColor"
					opacity="0.15"
				/>
				<path
					d="M8 12h8M12 8v8"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		),
		prompt: (title: string) =>
			`https://claude.ai/new?q=${encodeURIComponent(`Summarize this article: "${title}"`)}`,
		color: "var(--brand-warning)",
	},
	{
		name: "Gemini",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				className="size-4"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" />
				<path
					d="M12 7v10M7 12h10"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
				/>
			</svg>
		),
		prompt: (title: string) =>
			`https://gemini.google.com/?q=${encodeURIComponent(`Summarize this article: "${title}"`)}`,
		color: "var(--brand-info)",
	},
];

/* ================================================================
   SIDEBAR COMPONENTS
   ================================================================ */

function SidebarTLDR({ tldr }: { tldr: string }) {
	const { ref, visible } = useInView(0.1);
	return (
		<div
			ref={ref}
			className={cn(
				"blog-detail-sidebar-card surface-panel rounded-[22px] p-5 transition-all duration-500",
				visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
			)}
		>
			<div className="flex items-center gap-2.5 mb-4">
				<div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<MessageSquareText className="size-4" />
				</div>
				<h3 className="text-sm font-semibold tracking-tight">TL;DR</h3>
			</div>
			<p className="text-[0.82rem] leading-6 text-muted-foreground">{tldr}</p>
		</div>
	);
}

function SidebarChapters({
	chapters,
	activeId,
}: { chapters: BlogChapter[]; activeId: string }) {
	const { ref, visible } = useInView(0.1);
	return (
		<div
			ref={ref}
			className={cn(
				"blog-detail-sidebar-card surface-panel rounded-[22px] p-5 transition-all duration-500 delay-75",
				visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
			)}
		>
			<div className="flex items-center gap-2.5 mb-4">
				<div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<List className="size-4" />
				</div>
				<h3 className="text-sm font-semibold tracking-tight">Chapters</h3>
			</div>
			<div className="blog-detail-chapters-scroll">
				<nav className="space-y-0.5" aria-label="Table of contents">
					{chapters.map((ch, i) => (
						<a
							key={ch.id}
							href={`#${ch.id}`}
							className={cn(
								"blog-detail-toc-link group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[0.78rem] transition-all duration-200",
								activeId === ch.id
									? "bg-primary/10 text-primary font-medium"
									: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
							)}
						>
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-semibold transition-colors",
									activeId === ch.id
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
								)}
							>
								{i + 1}
							</span>
							<span className="truncate">{ch.title}</span>
						</a>
					))}
				</nav>
			</div>
		</div>
	);
}

function SidebarShare({ title, slug }: { title: string; slug: string }) {
	const { ref, visible } = useInView(0.1);
	const [copied, setCopied] = useState(false);
	const url =
		typeof window !== "undefined"
			? `${window.location.origin}/blog/${slug}`
			: `/blog/${slug}`;

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(url).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [url]);

	const shareLinks = [
		{
			name: "Twitter",
			icon: <Twitter className="size-3.5" />,
			href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
		},
		{
			name: "LinkedIn",
			icon: <Linkedin className="size-3.5" />,
			href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
		},
		{
			name: "Facebook",
			icon: <Facebook className="size-3.5" />,
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
		},
	];

	return (
		<div
			ref={ref}
			className={cn(
				"blog-detail-sidebar-card surface-panel rounded-[22px] p-5 transition-all duration-500 delay-150",
				visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
			)}
		>
			<div className="flex items-center gap-2.5 mb-4">
				<div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
					<Share2 className="size-4" />
				</div>
				<h3 className="text-sm font-semibold tracking-tight">Share</h3>
			</div>
			<div className="grid grid-cols-4 gap-2">
				{shareLinks.map((link) => (
					<a
						key={link.name}
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
						className="blog-detail-share-btn flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[var(--brand-border-soft)] bg-background/60 px-2 py-2.5 text-[0.68rem] font-medium leading-none text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:text-foreground hover:border-[var(--brand-border-strong)] hover:bg-background/80"
					>
						{link.icon}
						<span className="truncate">
							{link.name === "Twitter" ? "X" : link.name}
						</span>
					</a>
				))}
				<button
					type="button"
					onClick={handleCopy}
					className={cn(
						"blog-detail-share-btn flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-[0.68rem] font-medium leading-none backdrop-blur-sm transition-all duration-200",
						copied
							? "border-[var(--brand-success)] bg-[color-mix(in_srgb,var(--brand-success)_8%,transparent)] text-[var(--brand-success)]"
							: "border-[var(--brand-border-soft)] bg-background/60 text-muted-foreground hover:text-foreground hover:border-[var(--brand-border-strong)] hover:bg-background/80",
					)}
				>
					{copied ? (
						<Check className="size-3.5" />
					) : (
						<Copy className="size-3.5" />
					)}
					<span className="truncate">{copied ? "Copied" : "Copy"}</span>
				</button>
			</div>
		</div>
	);
}

function SidebarAISummarize({ title }: { title: string }) {
	const { ref, visible } = useInView(0.1);
	return (
		<div
			ref={ref}
			className={cn(
				"blog-detail-sidebar-card surface-panel-strong rounded-[22px] p-5 transition-all duration-500 delay-200",
				visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
			)}
		>
			<div className="flex items-center gap-2.5 mb-1">
				<div className="flex size-8 items-center justify-center rounded-xl bg-gradient-brand text-white">
					<Bot className="size-4" />
				</div>
				<div>
					<h3 className="text-sm font-semibold tracking-tight">
						Summarize with AI
					</h3>
				</div>
			</div>
			<div className="mt-4 grid grid-cols-3 gap-2">
				{aiTools.map((tool) => (
					<a
						key={tool.name}
						href={tool.prompt(title)}
						target="_blank"
						rel="noopener noreferrer"
						className="blog-detail-ai-btn group flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-border-soft)] bg-background/50 px-2 py-2.5 text-center transition-all duration-200 hover:border-[var(--brand-border-strong)] hover:bg-background/80"
					>
						<div
							className="flex size-7 items-center justify-center rounded-lg transition-colors"
							style={{
								background: `color-mix(in srgb, ${tool.color} 14%, transparent)`,
								color: tool.color,
							}}
						>
							{tool.icon}
						</div>
						<span className="truncate text-[0.72rem] font-medium">
							{tool.name}
						</span>
					</a>
				))}
			</div>
		</div>
	);
}

/* ================================================================
   HERO THUMBNAIL (reusing blog page pattern)
   ================================================================ */

function DetailHeroThumbnail({
	category,
	title,
}: { category: string; title: string }) {
	const theme = thumbThemes[category] || thumbThemes.Operations;
	return (
		<div
			className="blog-detail-hero-thumb"
			style={{ background: theme.bg } as CSSProperties}
		>
			<div className="blog-detail-hero-thumb-inner">
				<div className="blog-thumb-pattern" style={{ color: theme.accent }} />
				<svg
					className="absolute inset-0 size-full"
					viewBox="0 0 800 300"
					fill="none"
					preserveAspectRatio="xMidYMid slice"
					aria-hidden="true"
				>
					<circle
						cx="680"
						cy="240"
						r="180"
						fill={theme.accent}
						opacity="0.06"
					/>
					<circle cx="120" cy="80" r="60" fill={theme.accent} opacity="0.09" />
					<circle
						cx="400"
						cy="150"
						r="100"
						fill={theme.accent}
						opacity="0.04"
					/>
					<line
						x1="60"
						y1="260"
						x2="340"
						y2="260"
						stroke={theme.accent}
						strokeWidth="1.5"
						opacity="0.12"
					/>
					<line
						x1="60"
						y1="272"
						x2="260"
						y2="272"
						stroke={theme.accent}
						strokeWidth="1"
						opacity="0.08"
					/>
				</svg>

				<div
					className="absolute right-8 bottom-8 flex size-16 items-center justify-center rounded-3xl opacity-15"
					style={{ color: theme.accent }}
				>
					<CategoryIcon category={category} className="size-10" />
				</div>

				<div className="absolute inset-x-8 bottom-8 z-10 hidden lg:block">
					<div
						className="max-w-md text-xl font-semibold leading-snug tracking-tight opacity-[0.08]"
						style={{ color: theme.accent }}
					>
						{title}
					</div>
				</div>
			</div>
			<div className="blog-thumb-overlay" />
		</div>
	);
}

/* ================================================================
   ARTICLE BODY
   ================================================================ */

function ArticleBody({
	content,
}: { content: { id: string; heading: string; body: string[] }[] }) {
	return (
		<div className="blog-detail-article-body">
			{content.map((section) => (
				<section key={section.id} id={section.id} className="scroll-mt-28">
					<h2 className="blog-detail-heading">{section.heading}</h2>
					{section.body.map((paragraph, i) => (
						<p key={`${section.id}-${i}`} className="blog-detail-paragraph">
							{paragraph}
						</p>
					))}
				</section>
			))}
		</div>
	);
}

/* ================================================================
   RELATED POSTS
   ================================================================ */

function RelatedPosts({ currentSlug }: { currentSlug: string }) {
	const { ref, visible } = useInView(0.08);
	const handleMouse = useSpotlight();
	const related = allPosts.filter((p) => p.slug !== currentSlug).slice(0, 3);

	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<div className="mx-auto max-w-4xl">
					<h2 className="text-2xl font-semibold tracking-tight mb-8">
						Continue reading
					</h2>
					<div
						ref={ref}
						className={cn(
							"grid gap-5 md:grid-cols-3 stagger-reveal",
							visible && "is-visible",
						)}
					>
						{related.map((post) => (
							<Link
								key={post.slug}
								to={`/blog/${post.slug}`}
								onMouseMove={handleMouse}
								className="blog-card surface-panel rounded-[22px] p-3.5 group block"
							>
								<div
									className="blog-thumb"
									style={
										{
											background: (
												thumbThemes[post.category] || thumbThemes.Operations
											).bg,
										} as CSSProperties
									}
								>
									<div className="blog-thumb-inner">
										<div
											className="blog-thumb-pattern"
											style={{
												color: (
													thumbThemes[post.category] || thumbThemes.Operations
												).accent,
											}}
										/>
									</div>
									<div className="blog-thumb-overlay" />
								</div>
								<div className="relative z-10 mt-4 px-1">
									<div className="pill pill-muted text-[0.68rem]">
										{post.category}
									</div>
									<h3 className="mt-3 text-sm font-semibold leading-snug tracking-tight line-clamp-2">
										{post.title}
									</h3>
									<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
										<time dateTime={post.isoDate}>{post.date}</time>
										<span>·</span>
										<span>{post.readingTime}</span>
									</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export function BlogDetailPage() {
	const { slug } = useParams<{ slug: string }>();
	const post = allPosts.find((p) => p.slug === slug);
	const scrollViewportRef = useMarketingScrollViewport();

	const sectionIds = useMemo(
		() => (post ? post.chapters.map((ch) => ch.id) : []),
		[post],
	);
	const activeId = useActiveSection(sectionIds);

	const [readProgress, setReadProgress] = useState(0);

	useEffect(() => {
		const viewport = scrollViewportRef?.current;
		const handleScroll = () => {
			const scrollTop = viewport?.scrollTop ?? window.scrollY;
			const docHeight = viewport
				? viewport.scrollHeight - viewport.clientHeight
				: document.documentElement.scrollHeight - window.innerHeight;
			setReadProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
		};

		handleScroll();
		if (viewport) {
			viewport.addEventListener("scroll", handleScroll, { passive: true });
			return () => viewport.removeEventListener("scroll", handleScroll);
		}

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [scrollViewportRef]);

	if (!post) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="text-center">
					<h1 className="text-3xl font-semibold tracking-tight mb-4">
						Post not found
					</h1>
					<p className="text-muted-foreground mb-8">
						The article you're looking for doesn't exist.
					</p>
					<Button asChild variant="outline" className="rounded-full px-6">
						<Link to="/blog">
							<ArrowLeft className="size-4 mr-2" />
							Back to blog
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	// Find next/prev posts
	const currentIndex = allPosts.findIndex((p) => p.slug === slug);
	const prevPost =
		currentIndex > 0
			? allPosts[currentIndex - 1]
			: allPosts[allPosts.length - 1] || null;
	const nextPost =
		currentIndex < allPosts.length - 1
			? allPosts[currentIndex + 1]
			: allPosts[0] || null;

	return (
		<>
			{/* Reading progress bar */}
			<div className="blog-detail-progress-track">
				<div
					className="blog-detail-progress-bar"
					style={{ transform: `scaleX(${readProgress})` }}
				/>
			</div>

			{/* Hero Section */}
			<section className="relative overflow-hidden pt-28 pb-4 md:pt-36 md:pb-8">
				<div className="hero-gradient-orb -top-40 left-1/4 h-[500px] w-[500px] bg-[var(--brand-glow-strong)] opacity-50" />
				<div className="hero-gradient-orb -top-20 right-0 h-[400px] w-[400px] bg-[var(--brand-glow)] opacity-35" />
				<div className="hero-noise absolute inset-0 pointer-events-none" />

				<div className="page-container relative z-10">
					<div className="mx-auto max-w-6xl stagger-children">
						{/* Breadcrumb */}
						<nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8">
							<Link
								to="/blog"
								className="hover:text-foreground transition-colors"
							>
								Blog
							</Link>
							<ChevronRight className="size-3.5" />
							<span className="text-foreground/70 truncate max-w-[240px]">
								{post.title}
							</span>
						</nav>

						{/* Category + reading time */}
						<div className="flex flex-wrap items-center gap-3">
							<div className="pill pill-info">{post.category}</div>
							<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
								<Clock className="size-3.5" />
								{post.readingTime}
							</div>
						</div>

						{/* Title */}
						<h1 className="mt-6 text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[2.75rem] md:text-[3.25rem]">
							{post.title}
						</h1>

						{/* Excerpt */}
						<p className="mt-5 max-w-2xl text-lg leading-7 text-muted-foreground">
							{post.excerpt}
						</p>

						{/* Author + date */}
						<div className="mt-8 flex items-center gap-4">
							<div className="blog-author-ring flex size-11 items-center justify-center rounded-full bg-gradient-brand text-sm font-semibold text-white">
								{post.author.initials}
							</div>
							<div>
								<div className="text-sm font-medium">{post.author.name}</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{post.author.role}</span>
									<span>·</span>
									<time dateTime={post.isoDate}>{post.date}</time>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Hero Thumbnail */}
			<section className="pb-2">
				<div className="page-container">
					<div className="mx-auto max-w-6xl">
						<DetailHeroThumbnail category={post.category} title={post.title} />
					</div>
				</div>
			</section>

			<section className="pb-2">
				<div className="page-container">
					<div className="mx-auto max-w-6xl">
						<SidebarTLDR tldr={post.tldr} />
					</div>
				</div>
			</section>

			{/* Main content + sidebar */}
			<section className="section-spacing-sm">
				<div className="page-container">
					<div className="mx-auto max-w-6xl blog-detail-layout">
						{/* Article column */}
						<article className="blog-detail-content min-w-0">
							<ArticleBody content={post.content} />

							{/* Article footer */}
							<Separator className="my-10 bg-[var(--brand-border-soft)]" />

							{/* Tags */}
							<div className="flex flex-wrap gap-2.5 mb-10">
								{[post.category, "Marketing ops", "Strategy", "Workflow"].map(
									(tag) => (
										<span
											key={tag}
											className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-border-soft)] bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground"
										>
											<Hash className="size-3" />
											{tag}
										</span>
									),
								)}
							</div>

							{/* Prev / Next navigation */}
							<div className="grid gap-4 sm:grid-cols-2">
								{prevPost ? (
									<Link
										to={`/blog/${prevPost.slug}`}
										className="blog-detail-nav-card surface-panel rounded-[20px] p-5 group"
									>
										<div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
											<ArrowLeft className="size-3" />
											Previous article
										</div>
										<h4 className="text-sm font-semibold leading-snug tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
											{prevPost.title}
										</h4>
									</Link>
								) : (
									<div />
								)}
								{nextPost ? (
									<Link
										to={`/blog/${nextPost.slug}`}
										className="blog-detail-nav-card surface-panel rounded-[20px] p-5 group text-right"
									>
										<div className="text-xs text-muted-foreground mb-2 flex items-center justify-end gap-1.5">
											Next article
											<ArrowRight className="size-3" />
										</div>
										<h4 className="text-sm font-semibold leading-snug tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
											{nextPost.title}
										</h4>
									</Link>
								) : (
									<div />
								)}
							</div>
						</article>

						{/* Sidebar */}
						<aside className="blog-detail-sidebar">
							<div className="blog-detail-sidebar-sticky">
								<SidebarShare title={post.title} slug={post.slug} />
								<SidebarAISummarize title={post.title} />
								<SidebarChapters chapters={post.chapters} activeId={activeId} />
							</div>
						</aside>
					</div>
				</div>
			</section>

			{/* Related posts */}
			<RelatedPosts currentSlug={post.slug} />

			{/* Back to blog CTA */}
			<section className="pb-20">
				<div className="page-container">
					<div className="mx-auto max-w-4xl text-center">
						<SurfaceCard
							tone="strong"
							className="relative overflow-hidden px-6 py-12 md:px-14 md:py-16"
						>
							<div className="brand-grid absolute inset-0 opacity-10" />
							<div className="hero-gradient-orb -top-24 left-1/3 h-[250px] w-[250px] bg-[var(--brand-glow-strong)] opacity-40" />

							<div className="relative z-10">
								<SectionTag className="mx-auto">
									<Sparkles className="size-3.5" />
									Keep exploring
								</SectionTag>
								<h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
									More insights from the{" "}
									<span className="text-gradient-brand">Heimdall blog.</span>
								</h2>
								<p className="mt-3 text-sm text-muted-foreground md:text-base">
									Operator frameworks, product updates, and campaign lessons for
									teams that want better systems.
								</p>
								<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
									<Button
										size="lg"
										className="rounded-full bg-gradient-brand px-8 text-white border-0"
										asChild
									>
										<Link to="/blog">
											Browse all posts
											<ArrowRight className="ml-1 size-4" />
										</Link>
									</Button>
								</div>
							</div>
						</SurfaceCard>
					</div>
				</div>
			</section>
		</>
	);
}
