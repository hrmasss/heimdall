import { Link } from "react-router";
import {
	ArrowRight,
	BarChart3,
	Calendar,
	Globe,
	Layers,
	Sparkles,
	Users,
	Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export function MarketingPage() {
	return (
		<div className="min-h-screen bg-[var(--color-bg)] bg-noise">
			{/* Navigation */}
			<nav className="fixed top-0 left-0 right-0 z-50 glass">
				<div className="mx-auto max-w-7xl px-[var(--spacing-page)]">
					<div className="flex h-16 items-center justify-between">
						<Logo size="md" />
						<div className="hidden md:flex items-center gap-8">
							<a
								href="#features"
								className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
							>
								Features
							</a>
							<a
								href="#platforms"
								className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
							>
								Platforms
							</a>
							<a
								href="#pricing"
								className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
							>
								Pricing
							</a>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm">
								Sign in
							</Button>
							<Link to="/dashboard">
								<Button size="sm">
									Get Started
									<ArrowRight className="w-4 h-4" />
								</Button>
							</Link>
						</div>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative pt-32 pb-24 overflow-hidden">
				{/* Background gradient orbs */}
				<div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-[var(--color-accent)] rounded-full blur-[150px] opacity-10" />
				<div className="absolute bottom-0 -right-40 w-[400px] h-[400px] bg-blue-400 rounded-full blur-[150px] opacity-10" />

				<div className="relative mx-auto max-w-7xl px-[var(--spacing-page)]">
					<div className="stagger-children flex flex-col items-center text-center max-w-4xl mx-auto">
						{/* Badge */}
						<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-subtle)] mb-8">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
								<span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]" />
							</span>
							<span className="text-xs text-[var(--color-text-muted)] font-medium">
								Now in early access
							</span>
						</div>

						{/* Headline */}
						<h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.1] mb-6">
							<span className="text-[var(--color-text)]">Command your</span>
							<br />
							<span className="text-gradient-accent">social presence</span>
						</h1>

						{/* Subheadline */}
						<p className="text-lg md:text-xl text-[var(--color-text-muted)] max-w-2xl mb-10 leading-relaxed">
							Unify all your social platforms into one powerful dashboard.
							Schedule, analyze, and automate your content strategy with
							AI-powered insights.
						</p>

						{/* CTA */}
						<div className="flex flex-col sm:flex-row gap-4">
							<Link to="/dashboard">
								<Button size="xl" className="glow">
									Start for free
									<ArrowRight className="w-5 h-5" />
								</Button>
							</Link>
							<Button variant="secondary" size="xl">
								Watch demo
							</Button>
						</div>

						{/* Social proof */}
						<div className="mt-16 flex flex-col items-center gap-4">
							<div className="flex -space-x-3">
								{[1, 2, 3, 4, 5].map((i) => (
									<div
										key={i}
										className="w-10 h-10 rounded-full bg-[var(--color-bg-elevated)] border-2 border-[var(--color-bg)] flex items-center justify-center"
									>
										<span className="text-xs text-[var(--color-text-subtle)]">
											{String.fromCharCode(64 + i)}
										</span>
									</div>
								))}
							</div>
							<p className="text-sm text-[var(--color-text-subtle)]">
								Trusted by <span className="text-[var(--color-text)]">2,000+</span>{" "}
								marketing teams
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Platform Logos */}
			<section id="platforms" className="py-16 border-y border-[var(--color-border-subtle)]">
				<div className="mx-auto max-w-7xl px-[var(--spacing-page)]">
					<p className="text-center text-sm text-[var(--color-text-subtle)] mb-8 uppercase tracking-wider">
						Connect all your platforms
					</p>
					<div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
						{["X", "Instagram", "LinkedIn", "Facebook", "TikTok", "YouTube"].map(
							(platform) => (
								<div
									key={platform}
									className="flex items-center gap-2 text-[var(--color-text-muted)]"
								>
									<Globe className="w-5 h-5" />
									<span className="text-sm font-medium">{platform}</span>
								</div>
							),
						)}
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-24">
				<div className="mx-auto max-w-7xl px-[var(--spacing-page)]">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
							Everything you need to dominate social
						</h2>
						<p className="text-[var(--color-text-muted)] max-w-2xl mx-auto">
							From content planning to analytics, Heimdall gives you complete
							control over your social media strategy.
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								icon: Calendar,
								title: "Smart Scheduling",
								description:
									"Plan and schedule posts across all platforms with an intuitive calendar view.",
							},
							{
								icon: Sparkles,
								title: "AI Content Generation",
								description:
									"Generate engaging posts, captions, and hashtags with advanced AI assistance.",
							},
							{
								icon: BarChart3,
								title: "Unified Analytics",
								description:
									"Track performance across all channels in one comprehensive dashboard.",
							},
							{
								icon: Users,
								title: "Team Collaboration",
								description:
									"Work together with approval workflows and role-based permissions.",
							},
							{
								icon: Zap,
								title: "Automation Rules",
								description:
									"Set up intelligent automation for posting at optimal times and engagement.",
							},
							{
								icon: Layers,
								title: "Content Library",
								description:
									"Organize and reuse your best performing content with smart tagging.",
							},
						].map((feature) => (
							<Card
								key={feature.title}
								className="group p-6 hover:border-[var(--color-text-subtle)] transition-all duration-300"
							>
								<div className="w-12 h-12 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center mb-4 group-hover:bg-[var(--color-accent)] group-hover:text-white transition-colors">
									<feature.icon className="w-6 h-6" />
								</div>
								<h3 className="text-lg font-medium mb-2">{feature.title}</h3>
								<p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
									{feature.description}
								</p>
							</Card>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24">
				<div className="mx-auto max-w-7xl px-[var(--spacing-page)]">
					<Card
						variant="elevated"
						className="relative overflow-hidden p-12 md:p-16 text-center"
					>
						{/* Background gradient */}
						<div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent" />

						<div className="relative">
							<h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
								Ready to take control?
							</h2>
							<p className="text-[var(--color-text-muted)] max-w-xl mx-auto mb-8">
								Join thousands of marketers who are already saving hours every
								week with Heimdall.
							</p>
							<Link to="/dashboard">
								<Button size="xl" className="glow">
									Get started for free
									<ArrowRight className="w-5 h-5" />
								</Button>
							</Link>
						</div>
					</Card>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 border-t border-[var(--color-border-subtle)]">
				<div className="mx-auto max-w-7xl px-[var(--spacing-page)]">
					<div className="flex flex-col md:flex-row justify-between items-center gap-6">
						<Logo size="sm" />
						<p className="text-sm text-[var(--color-text-subtle)]">
							© {new Date().getFullYear()} Heimdall. All rights reserved.
						</p>
						<div className="flex items-center gap-6">
							<a
								href="#"
								className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
							>
								Privacy
							</a>
							<a
								href="#"
								className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
							>
								Terms
							</a>
							<a
								href="http://localhost:8080/reference"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
							>
								API
							</a>
						</div>
					</div>
				</div>
			</footer>
		</div>
	);
}
