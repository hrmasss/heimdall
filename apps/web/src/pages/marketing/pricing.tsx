import { ArrowRight, Check, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import {
	SectionHeading,
	SectionTag,
	SurfaceCard,
} from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
	{
		id: "starter",
		name: "Starter",
		monthly: 0,
		annual: 0,
		description: "For individuals and lightweight brand work.",
		highlights: [
			"3 social accounts",
			"Table basics",
			"7-day analytics window",
			"Single approver",
		],
	},
	{
		id: "growth",
		name: "Growth",
		monthly: 36,
		annual: 29,
		description: "For teams that need review flows and reporting depth.",
		highlights: [
			"15 social accounts",
			"Advanced data table",
			"Approval workflows",
			"Shared asset library",
		],
		featured: true,
	},
	{
		id: "scale",
		name: "Scale",
		monthly: 94,
		annual: 79,
		description: "For multi-brand and regional operations.",
		highlights: [
			"Unlimited posts",
			"Workspace templates",
			"Cross-team analytics",
			"Role-based governance",
		],
	},
	{
		id: "enterprise",
		name: "Enterprise",
		monthly: null,
		annual: null,
		description:
			"For distributed organizations with procurement and security requirements.",
		highlights: [
			"SSO and audit exports",
			"Custom onboarding",
			"Priority support",
			"Dedicated success partner",
		],
	},
];

const faqs = [
	{
		question: "Is the posts table available on every paid plan?",
		answer:
			"Yes. Growth and above include the advanced table with resizing, reordering, filtering, pagination, and list/grid switching.",
	},
	{
		question: "Can we upgrade from one workspace to many later?",
		answer:
			"Yes. Workspace structure, content, and permissions carry forward, so teams can expand without rebuilding the operating model.",
	},
	{
		question: "Do you support annual billing?",
		answer:
			"Yes. Annual billing reduces cost and is the default for teams running planned launch calendars or multi-quarter programs.",
	},
	{
		question: "What happens during onboarding?",
		answer:
			"We help map your publishing workflow, asset taxonomy, and approval model so the product mirrors how your team actually operates.",
	},
];

function HeroSection() {
	return (
		<section className="pt-32">
			<div className="page-container section-spacing-sm">
				<SectionHeading
					align="center"
					badge={<SectionTag className="mx-auto">Pricing</SectionTag>}
					title="Straightforward pricing for teams that need better operations."
					description="Choose a plan based on workflow depth, governance needs, and the scale of your content operation. No vague packaging."
				/>
			</div>
		</section>
	);
}

function PricingSection() {
	const [annual, setAnnual] = useState(true);

	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<div className="mb-10 flex items-center justify-center gap-3">
					<span
						className={cn(
							"text-sm",
							!annual ? "text-foreground" : "text-muted-foreground",
						)}
					>
						Monthly
					</span>
					<button
						type="button"
						onClick={() => setAnnual((value) => !value)}
						className={cn(
							"relative h-7 w-14 rounded-full border transition-colors",
							annual ? "border-primary bg-primary" : "border-border bg-muted",
						)}
						aria-label="Toggle annual billing"
					>
						<span
							className={cn(
								"absolute top-1 size-5 rounded-full bg-white transition-transform",
								annual ? "translate-x-8" : "translate-x-1",
							)}
						/>
					</button>
					<span
						className={cn(
							"text-sm",
							annual ? "text-foreground" : "text-muted-foreground",
						)}
					>
						Annual
					</span>
					<div className="pill pill-success">Save ~20%</div>
				</div>

				<div className="grid gap-6 lg:grid-cols-4">
					{plans.map((plan) => (
						<SurfaceCard
							key={plan.id}
							tone={plan.featured ? "strong" : "default"}
							className={cn(
								"flex h-full flex-col p-6",
								plan.featured && "ring-1 ring-primary/20",
							)}
						>
							<div className="mb-6 space-y-3">
								{plan.featured ? <SectionTag>Recommended</SectionTag> : null}
								<div>
									<div className="text-xl font-semibold tracking-tight">
										{plan.name}
									</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{plan.description}
									</p>
								</div>
								<div className="flex items-end gap-2">
									{plan.monthly === null ? (
										<div className="text-4xl font-semibold tracking-tight">
											Custom
										</div>
									) : (
										<>
											<div className="text-4xl font-semibold tracking-tight">
												${annual ? plan.annual : plan.monthly}
											</div>
											<div className="pb-1 text-sm text-muted-foreground">
												per seat / month
											</div>
										</>
									)}
								</div>
							</div>

							<div className="flex-1 space-y-3">
								{plan.highlights.map((item) => (
									<div key={item} className="flex items-start gap-3 text-sm">
										<div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
											<Check className="size-3.5" />
										</div>
										<span>{item}</span>
									</div>
								))}
							</div>

							<Button
								size="lg"
								variant={plan.featured ? "default" : "outline"}
								className={cn(
									"mt-8 rounded-full",
									plan.featured && "bg-gradient-brand text-white border-0",
								)}
								asChild
							>
								<Link to={plan.id === "enterprise" ? "/about" : "/dashboard"}>
									{plan.id === "enterprise"
										? "Talk to sales"
										: "Start with Heimdall"}
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</SurfaceCard>
					))}
				</div>
			</div>
		</section>
	);
}

function IncludedSection() {
	const rows = [
		["Resizable and reorderable data table", "Growth", "Scale", "Enterprise"],
		["Custom dashboard layouts", "Growth", "Scale", "Enterprise"],
		["Multi-brand workspace management", null, "Scale", "Enterprise"],
		["SSO, SCIM, and advanced audit trail", null, null, "Enterprise"],
	];

	return (
		<section className="section-spacing-sm">
			<div className="page-container">
				<SurfaceCard className="overflow-hidden p-6 md:p-8">
					<SectionHeading
						badge={<SectionTag>What unlocks when</SectionTag>}
						title="Built for progression, not feature confusion."
						description="Each tier expands the operating model in a way that makes sense for how teams grow."
					/>
					<div className="mt-8 overflow-x-auto">
						<div className="min-w-[720px] space-y-3">
							<div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground">
								<div>Capability</div>
								<div>Growth</div>
								<div>Scale</div>
								<div>Enterprise</div>
							</div>
							{rows.map((row) => (
								<div
									key={row[0]}
									className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-3 rounded-2xl border border-[var(--brand-border-soft)] bg-background/75 px-4 py-4 text-sm"
								>
									<div className="font-medium">{row[0]}</div>
									{row.slice(1).map((cell, index) => (
										<div
											key={`${row[0]}-${index}`}
											className="text-muted-foreground"
										>
											{cell ?? "—"}
										</div>
									))}
								</div>
							))}
						</div>
					</div>
				</SurfaceCard>
			</div>
		</section>
	);
}

function FAQSection() {
	return (
		<section className="section-spacing">
			<div className="page-container">
				<SectionHeading
					align="center"
					badge={<SectionTag className="mx-auto">Questions</SectionTag>}
					title="What teams usually ask before switching."
					description="If you need procurement, security, or onboarding detail, the enterprise team can walk through the full setup."
				/>
				<div className="mt-10 grid gap-6 md:grid-cols-2">
					{faqs.map((faq) => (
						<SurfaceCard key={faq.question} className="p-6">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<HelpCircle className="size-5" />
								</div>
								<div>
									<div className="font-medium">{faq.question}</div>
									<p className="mt-2 text-sm leading-6 text-muted-foreground">
										{faq.answer}
									</p>
								</div>
							</div>
						</SurfaceCard>
					))}
				</div>
			</div>
		</section>
	);
}

export function PricingPage() {
	return (
		<>
			<HeroSection />
			<PricingSection />
			<IncludedSection />
			<FAQSection />
		</>
	);
}
