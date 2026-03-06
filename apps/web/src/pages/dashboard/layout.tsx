import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
	BarChart3,
	Calendar,
	ChevronLeft,
	FileText,
	Home,
	Layers,
	Menu,
	Plus,
	Settings,
	Users,
	Zap,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
	{ name: "Overview", href: "/dashboard", icon: Home },
	{ name: "Posts", href: "/dashboard/posts", icon: FileText },
	{ name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
	{ name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
	{ name: "Automations", href: "/dashboard/automations", icon: Zap },
	{ name: "Library", href: "/dashboard/library", icon: Layers },
	{ name: "Team", href: "/dashboard/team", icon: Users },
];

const secondaryNav = [{ name: "Settings", href: "/dashboard/settings", icon: Settings }];

export function DashboardLayout() {
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const location = useLocation();

	const isActive = (href: string) => {
		if (href === "/dashboard") {
			return location.pathname === "/dashboard";
		}
		return location.pathname.startsWith(href);
	};

	return (
		<div className="min-h-screen bg-[var(--color-bg)]">
			{/* Mobile menu button */}
			<div className="lg:hidden fixed top-4 left-4 z-50">
				<Button
					variant="secondary"
					size="icon"
					onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
				>
					<Menu className="w-5 h-5" />
				</Button>
			</div>

			{/* Mobile menu overlay */}
			{mobileMenuOpen && (
				<div
					className="lg:hidden fixed inset-0 z-40 bg-black/50"
					onClick={() => setMobileMenuOpen(false)}
					onKeyDown={(e) => e.key === "Escape" && setMobileMenuOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] transition-all duration-300",
					sidebarCollapsed ? "w-[72px]" : "w-64",
					mobileMenuOpen
						? "translate-x-0"
						: "-translate-x-full lg:translate-x-0",
				)}
			>
				{/* Logo */}
				<div className="flex h-16 items-center justify-between px-4 border-b border-[var(--color-border-subtle)]">
					<Logo size="sm" showText={!sidebarCollapsed} />
					<Button
						variant="ghost"
						size="icon"
						className="hidden lg:flex"
						onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
					>
						<ChevronLeft
							className={cn(
								"w-4 h-4 transition-transform",
								sidebarCollapsed && "rotate-180",
							)}
						/>
					</Button>
				</div>

				{/* New Post Button */}
				<div className="p-4">
					<Button
						className={cn("w-full", sidebarCollapsed && "px-0")}
						size={sidebarCollapsed ? "icon" : "default"}
					>
						<Plus className="w-4 h-4" />
						{!sidebarCollapsed && <span>New Post</span>}
					</Button>
				</div>

				{/* Navigation */}
				<nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
					{navigation.map((item) => (
						<Link
							key={item.name}
							to={item.href}
							className={cn(
								"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
								isActive(item.href)
									? "bg-[var(--color-bg-muted)] text-[var(--color-text)]"
									: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]",
								sidebarCollapsed && "justify-center px-0",
							)}
							title={sidebarCollapsed ? item.name : undefined}
						>
							<item.icon className="w-5 h-5 flex-shrink-0" />
							{!sidebarCollapsed && <span>{item.name}</span>}
						</Link>
					))}
				</nav>

				{/* Secondary Navigation */}
				<div className="p-3 border-t border-[var(--color-border-subtle)]">
					{secondaryNav.map((item) => (
						<Link
							key={item.name}
							to={item.href}
							className={cn(
								"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
								isActive(item.href)
									? "bg-[var(--color-bg-muted)] text-[var(--color-text)]"
									: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-muted)]",
								sidebarCollapsed && "justify-center px-0",
							)}
							title={sidebarCollapsed ? item.name : undefined}
						>
							<item.icon className="w-5 h-5 flex-shrink-0" />
							{!sidebarCollapsed && <span>{item.name}</span>}
						</Link>
					))}
				</div>

				{/* User Profile */}
				<div className="p-4 border-t border-[var(--color-border-subtle)]">
					<div
						className={cn(
							"flex items-center gap-3",
							sidebarCollapsed && "justify-center",
						)}
					>
						<div className="w-9 h-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
							H
						</div>
						{!sidebarCollapsed && (
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-[var(--color-text)] truncate">
									Heimdall User
								</p>
								<p className="text-xs text-[var(--color-text-subtle)] truncate">
									user@heimdall.dev
								</p>
							</div>
						)}
					</div>
				</div>
			</aside>

			{/* Main content */}
			<main
				className={cn(
					"transition-all duration-300",
					sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64",
				)}
			>
				<div className="p-6 lg:p-8">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
