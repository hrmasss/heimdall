import {
	Bell,
	CalendarRange,
	ChevronDown,
	Command,
	FileStack,
	FolderKanban,
	Home,
	LineChart,
	Menu,
	Settings,
	Sparkles,
	Users2,
	WandSparkles,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const navigation = [
	{ href: "/dashboard", label: "Overview", icon: Home },
	{ href: "/dashboard/posts", label: "Posts", icon: FileStack },
	{ href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
	{ href: "/dashboard/analytics", label: "Analytics", icon: LineChart },
	{ href: "/dashboard/automations", label: "Automations", icon: WandSparkles },
	{ href: "/dashboard/library", label: "Library", icon: FolderKanban },
	{ href: "/dashboard/team", label: "Team", icon: Users2 },
	{ href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const workspaces = ["Northset", "Cedar Labs", "Atlas Studio"];

function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
	const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/75 p-3 text-left transition-colors hover:bg-accent/60",
						compact && "justify-center px-2.5",
					)}
				>
					<div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-brand text-sm font-semibold text-white">
						{activeWorkspace[0]}
					</div>
					{!compact ? (
						<>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium">
									{activeWorkspace}
								</div>
								<div className="text-xs text-muted-foreground">
									Operations workspace
								</div>
							</div>
							<ChevronDown className="size-4 text-muted-foreground" />
						</>
					) : null}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{workspaces.map((workspace) => (
					<DropdownMenuItem
						key={workspace}
						onClick={() => setActiveWorkspace(workspace)}
					>
						{workspace}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function Sidebar({
	collapsed,
	mobileOpen,
	onClose,
	onToggle,
}: {
	collapsed: boolean;
	mobileOpen: boolean;
	onClose: () => void;
	onToggle: () => void;
}) {
	const location = useLocation();

	return (
		<>
			{mobileOpen ? (
				<button
					type="button"
					className="fixed inset-0 z-30 bg-black/30 lg:hidden"
					onClick={onClose}
					aria-label="Close sidebar"
				/>
			) : null}

			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 w-[286px] border-r border-[var(--brand-border-soft)] bg-[color-mix(in_srgb,var(--sidebar)_92%,transparent)] px-4 py-4 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0",
					collapsed && "lg:w-[92px]",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-center justify-between gap-3">
						<Link
							to="/dashboard"
							className={cn(
								"flex items-center",
								collapsed && "lg:justify-center lg:w-full",
							)}
						>
							<Logo size="sm" showText={!collapsed} />
						</Link>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon-sm"
								className="lg:hidden"
								onClick={onClose}
							>
								<X className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								className="hidden lg:inline-flex"
								onClick={onToggle}
							>
								<Menu className="size-4" />
							</Button>
						</div>
					</div>

					<div className="mt-5">
						<WorkspaceSwitcher compact={collapsed} />
					</div>

					<nav className="mt-6 flex-1 space-y-1.5">
						{navigation.map((item) => {
							const active =
								item.href === "/dashboard"
									? location.pathname === item.href
									: location.pathname.startsWith(item.href);

							return (
								<Link
									key={item.href}
									to={item.href}
									onClick={onClose}
									className={cn(
										"group flex items-center gap-3 rounded-[22px] px-3 py-3 text-sm transition-colors",
										active
											? "bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_var(--brand-glow-strong)]"
											: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
										collapsed && "lg:justify-center lg:px-0",
									)}
								>
									<item.icon className="size-5 shrink-0" />
									{!collapsed ? <span>{item.label}</span> : null}
								</Link>
							);
						})}
					</nav>

					<div className="mt-6 rounded-[26px] border border-[var(--brand-border-soft)] bg-background/72 p-4">
						{collapsed ? (
							<div className="flex justify-center">
								<Command className="size-5 text-primary" />
							</div>
						) : (
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-primary">
									<Sparkles className="size-4" />
									<span className="text-sm font-medium">Ops snapshot</span>
								</div>
								<div className="text-sm text-muted-foreground">
									4 approvals at risk, 2 campaigns need asset swaps, and the
									publishing table is synced.
								</div>
							</div>
						)}
					</div>
				</div>
			</aside>
		</>
	);
}

function TopBar({
	collapsed,
	onOpenMobile,
}: {
	collapsed: boolean;
	onOpenMobile: () => void;
}) {
	const location = useLocation();
	const segment =
		location.pathname.split("/").filter(Boolean).pop() ?? "overview";

	return (
		<header
			className={cn(
				"fixed right-0 top-0 z-20 border-b border-[var(--brand-border-soft)] bg-background/70 backdrop-blur-2xl transition-all duration-300",
				collapsed ? "left-0 lg:left-[92px]" : "left-0 lg:left-[286px]",
			)}
		>
			<div className="page-container flex h-18 max-w-none items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
				<Button
					variant="ghost"
					size="icon-sm"
					className="lg:hidden"
					onClick={onOpenMobile}
				>
					<Menu className="size-4" />
				</Button>

				<div className="min-w-0">
					<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
						Workspace
					</div>
					<div className="truncate text-base font-medium capitalize">
						{segment.replace("-", " ")}
					</div>
				</div>

				<div className="ml-auto hidden max-w-md flex-1 md:block">
					<Input
						className="h-10 rounded-full bg-card"
						placeholder="Search campaigns, files, or teammates"
					/>
				</div>

				<Button variant="outline" className="rounded-full">
					<Bell className="size-4" />
					Alerts
				</Button>
				<ThemeToggle compact />
			</div>
		</header>
	);
}

export function DashboardLayout() {
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const location = useLocation();

	useEffect(() => {
		setMobileOpen(false);
	}, [location.pathname]);

	return (
		<div className="app-shell min-h-screen">
			<Sidebar
				collapsed={collapsed}
				mobileOpen={mobileOpen}
				onClose={() => setMobileOpen(false)}
				onToggle={() => setCollapsed((value) => !value)}
			/>
			<TopBar collapsed={collapsed} onOpenMobile={() => setMobileOpen(true)} />
			<main
				className={cn(
					"min-h-screen pt-[72px] transition-all duration-300",
					collapsed ? "lg:pl-[92px]" : "lg:pl-[286px]",
				)}
			>
				<div className="page-container max-w-none px-4 py-6 sm:px-6 lg:px-8">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
