import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { Link } from "react-router";

import { BrandBackdrop, SectionTag, SurfaceCard } from "@/components/app/brand";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginPage() {
	return (
		<div className="app-shell relative min-h-screen overflow-hidden">
			<BrandBackdrop />
			<div className="page-container relative z-10 py-6">
				<div className="flex items-center justify-between">
					<Link to="/">
						<Logo size="sm" showText />
					</Link>
					<ThemeToggle compact />
				</div>

				<div className="flex min-h-[calc(100vh-120px)] items-center justify-center py-12">
					<SurfaceCard tone="strong" className="w-full max-w-md p-6 md:p-8">
						<SectionTag>Sign in</SectionTag>
						<h1 className="mt-4 text-3xl font-semibold tracking-tight">
							Welcome back
						</h1>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							This lightweight auth view exists so the marketing shell no longer
							points to a missing route.
						</p>

						<div className="mt-6 space-y-4">
							<label className="block space-y-2">
								<span className="text-sm font-medium">Work email</span>
								<div className="relative">
									<Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										className="h-11 rounded-2xl pl-10"
										placeholder="you@company.com"
									/>
								</div>
							</label>
							<label className="block space-y-2">
								<span className="text-sm font-medium">Password</span>
								<div className="relative">
									<LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										className="h-11 rounded-2xl pl-10"
										type="password"
										placeholder="••••••••"
									/>
								</div>
							</label>
						</div>

						<Button
							className="mt-6 w-full rounded-full bg-gradient-brand text-white border-0"
							asChild
						>
							<Link to="/dashboard">
								Continue to dashboard
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
