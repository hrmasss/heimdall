import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { BrandBackdrop } from "@/components/app/brand";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
	{ href: "/features", label: "Product" },
	{ href: "/pricing", label: "Pricing" },
	{ href: "/about", label: "Company" },
];

function Navbar() {
	const [menuOpen, setMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const location = useLocation();

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 10);
		onScroll();
		window.addEventListener("scroll", onScroll);
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		setMenuOpen(false);
	}, [location.pathname]);

	return (
		<header className="fixed inset-x-0 top-0 z-50">
			<div className="page-container pt-4">
				<div
					className={cn(
						"glass rounded-full px-4 transition-all duration-300 md:px-5",
						scrolled
							? "shadow-[0_20px_50px_-30px_rgba(32,16,11,0.55)]"
							: "shadow-none",
					)}
				>
					<div className="flex h-16 items-center justify-between gap-4">
						<Link to="/" className="flex items-center">
							<Logo size="sm" showText />
						</Link>

						<nav className="hidden items-center gap-1 md:flex">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									to={link.href}
									className={cn(
										"rounded-full px-4 py-2 text-sm transition-colors",
										location.pathname === link.href
											? "bg-primary text-primary-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{link.label}
								</Link>
							))}
						</nav>

						<div className="hidden items-center gap-2 md:flex">
							<ThemeToggle compact />
							<Button variant="ghost" size="sm" asChild>
								<Link to="/login">Sign in</Link>
							</Button>
							<Button
								size="sm"
								className="rounded-full px-4 bg-gradient-brand text-white border-0"
								asChild
							>
								<Link to="/dashboard">
									Open app
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</div>

						<div className="flex items-center gap-2 md:hidden">
							<ThemeToggle compact />
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setMenuOpen((value) => !value)}
							>
								{menuOpen ? (
									<X className="size-4" />
								) : (
									<Menu className="size-4" />
								)}
							</Button>
						</div>
					</div>
				</div>

				{menuOpen ? (
					<div className="glass mt-3 rounded-[28px] p-4 md:hidden">
						<div className="space-y-2">
							{navLinks.map((link) => (
								<Link
									key={link.href}
									to={link.href}
									className="block rounded-2xl px-4 py-3 text-sm text-foreground transition-colors hover:bg-accent"
								>
									{link.label}
								</Link>
							))}
						</div>
						<div className="mt-4 flex flex-col gap-2">
							<Button
								variant="outline"
								className="justify-center rounded-full"
								asChild
							>
								<Link to="/login">Sign in</Link>
							</Button>
							<Button
								className="justify-center rounded-full bg-gradient-brand text-white border-0"
								asChild
							>
								<Link to="/dashboard">
									Open app
									<ArrowRight className="size-4" />
								</Link>
							</Button>
						</div>
					</div>
				) : null}
			</div>
		</header>
	);
}

function Footer() {
	return (
		<footer className="border-t border-[var(--brand-border-soft)] py-10">
			<div className="page-container">
				<div className="surface-panel rounded-[32px] px-6 py-8 md:px-8">
					<div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
						<div className="space-y-4">
							<Logo size="sm" showText />
							<p className="max-w-sm text-sm text-muted-foreground">
								Calm infrastructure for social operations. Plan campaigns,
								review creative, and track growth in one rust-toned control
								room.
							</p>
						</div>

						<div className="space-y-3">
							<div className="text-sm font-medium">Product</div>
							<div className="space-y-2 text-sm text-muted-foreground">
								<Link
									to="/features"
									className="block transition-colors hover:text-foreground"
								>
									Features
								</Link>
								<Link
									to="/pricing"
									className="block transition-colors hover:text-foreground"
								>
									Pricing
								</Link>
								<Link
									to="/dashboard/posts"
									className="block transition-colors hover:text-foreground"
								>
									Posts table
								</Link>
							</div>
						</div>

						<div className="space-y-3">
							<div className="text-sm font-medium">Company</div>
							<div className="space-y-2 text-sm text-muted-foreground">
								<Link
									to="/about"
									className="block transition-colors hover:text-foreground"
								>
									About
								</Link>
								<a
									href="mailto:team@heimdall.app"
									className="block transition-colors hover:text-foreground"
								>
									Contact
								</a>
								<Link
									to="/login"
									className="block transition-colors hover:text-foreground"
								>
									Sign in
								</Link>
							</div>
						</div>

						<div className="space-y-3">
							<div className="text-sm font-medium">Status</div>
							<div className="space-y-2 text-sm text-muted-foreground">
								<div>99.98% delivery uptime</div>
								<div>18 regions monitored</div>
								<div>24/7 human support</div>
							</div>
						</div>
					</div>

					<div className="mt-8 flex flex-col gap-3 border-t border-[var(--brand-border-soft)] pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
						<div>
							© {new Date().getFullYear()} Heimdall. Built for deliberate teams.
						</div>
						<div className="flex items-center gap-4">
							<a
								href="https://github.com"
								className="transition-colors hover:text-foreground"
							>
								GitHub
							</a>
							<a
								href="https://linkedin.com"
								className="transition-colors hover:text-foreground"
							>
								LinkedIn
							</a>
							<a
								href="https://x.com"
								className="transition-colors hover:text-foreground"
							>
								X
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}

export function MarketingLayout() {
	return (
		<div className="app-shell min-h-screen">
			<BrandBackdrop />
			<Navbar />
			<main className="relative z-10">
				<Outlet />
			</main>
			<Footer />
		</div>
	);
}
