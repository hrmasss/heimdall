import {
	CalendarRange,
	ChevronDown,
	ChevronLeft,
	Command,
	FileStack,
	FolderKanban,
	Home,
	LineChart,
	LogOut,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	Users2,
	WandSparkles,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { AlertInbox } from "@/components/app/alert-inbox";
import { getDashboardBreadcrumbs } from "@/components/app/dashboard-context";
import { MiraAssistant } from "@/components/app/mira-assistant";
import { SearchCommand } from "@/components/app/search-command";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Logo } from "@/components/logo";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { setMarketingUserSignedIn } from "@/lib/marketing-auth";
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
const currentUser = {
	name: "Ava Hart",
	email: "ava@northset.co",
	role: "Operations lead",
};

function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
	const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex w-full items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/75 p-3 text-left transition-colors hover:bg-accent/60",
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
			<DropdownMenuContent
				align="start"
				className={cn(
					"rounded-[24px] p-2",
					compact
						? "min-w-56"
						: "w-(--radix-dropdown-menu-trigger-width) min-w-0",
				)}
			>
				{workspaces.map((workspace) => (
					<DropdownMenuItem
						key={workspace}
						onClick={() => setActiveWorkspace(workspace)}
						className="rounded-[18px] px-3 py-2.5"
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
}: {
	collapsed: boolean;
	mobileOpen: boolean;
	onClose: () => void;
}) {
	const location = useLocation();
	const navigate = useNavigate();

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
					"dashboard-sidebar fixed inset-y-0 left-0 z-40 w-[286px] bg-[color-mix(in_srgb,var(--sidebar)_70%,transparent)] px-4 py-4 backdrop-blur-[30px] transition-transform duration-300 lg:static lg:z-0 lg:h-full lg:shrink-0 lg:bg-transparent lg:px-4 lg:py-4 lg:backdrop-blur-none",
					collapsed && "lg:w-[92px]",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
					"lg:translate-x-0",
				)}
			>
				<div className="relative z-10 flex h-full flex-col">
					<div className="flex items-center justify-between gap-3 px-3">
						<Link
							to="/dashboard"
							className={cn(
								"flex min-w-0 items-center py-2",
								collapsed && "lg:w-full lg:justify-center",
							)}
						>
							<Logo size={collapsed ? "md" : "sm"} showText={!collapsed} />
						</Link>
						<Button
							variant="ghost"
							size="icon-sm"
							className="lg:hidden"
							onClick={onClose}
						>
							<X className="size-4" />
						</Button>
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
										"group flex w-full items-center gap-3 rounded-[22px] px-3 py-3 text-sm transition-colors",
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

					<div className="mt-6">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className={cn(
										"flex w-full items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/72 p-3 text-left transition-colors hover:bg-accent/60",
										collapsed && "justify-center px-2.5",
									)}
								>
									<div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-brand text-sm font-semibold text-white">
										{currentUser.name
											.split(" ")
											.map((part) => part[0])
											.join("")
											.slice(0, 2)}
									</div>
									{!collapsed ? (
										<>
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium">
													{currentUser.name}
												</div>
												<div className="text-xs text-muted-foreground">
													{currentUser.role}
												</div>
											</div>
											<ChevronDown className="size-4 text-muted-foreground" />
										</>
									) : null}
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="start"
								side="top"
								className={cn(
									"rounded-[24px] p-2",
									collapsed
										? "min-w-56"
										: "w-(--radix-dropdown-menu-trigger-width) min-w-0",
								)}
							>
								<div className="mb-1 border-b border-border px-3 py-3">
									<div className="text-sm font-medium">{currentUser.name}</div>
									<div className="mt-1 text-xs text-muted-foreground">
										{currentUser.email}
									</div>
								</div>
								<DropdownMenuItem
									asChild
									className="rounded-[18px] px-3 py-2.5"
								>
									<Link to="/dashboard/settings">
										<Settings className="size-4" />
										Account settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem className="rounded-[18px] px-3 py-2.5">
									<Command className="size-4" />
									Command menu
								</DropdownMenuItem>
								<DropdownMenuItem
									className="rounded-[18px] px-3 py-2.5"
									onSelect={() => {
										setMarketingUserSignedIn(false);
										onClose();
										navigate("/");
									}}
								>
									<LogOut className="size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</aside>
		</>
	);
}

function TopBar({
	collapsed,
	onOpenMobile,
	onToggleSidebar,
	onOpenAssistant,
}: {
	collapsed: boolean;
	onOpenMobile: () => void;
	onToggleSidebar: () => void;
	onOpenAssistant: () => void;
}) {
	const location = useLocation();
	const breadcrumbs = getDashboardBreadcrumbs(location.pathname);
	const previousCrumb = breadcrumbs.at(-2);
	const backTarget = previousCrumb?.href ?? "/dashboard";
	const showHomeBack = backTarget === "/dashboard";
	const atDashboardRoot =
		breadcrumbs.length === 1 && backTarget === "/dashboard";

	return (
		<header className="dashboard-topbar relative z-20 flex-none">
			<div className="relative z-10 flex h-[72px] items-center gap-4 px-3 sm:px-4 lg:pl-0 lg:pr-4">
				<div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
					<Button
						variant="outline"
						size="icon-sm"
						className="lg:hidden"
						onClick={onOpenMobile}
						aria-label="Open sidebar"
					>
						<Menu className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon-sm"
						className="hidden lg:inline-flex"
						onClick={onToggleSidebar}
						aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						{collapsed ? (
							<PanelLeftOpen className="size-4" />
						) : (
							<PanelLeftClose className="size-4" />
						)}
					</Button>
					<Link
						to="/dashboard"
						className="inline-flex shrink-0 lg:hidden"
						aria-label="Heimdall dashboard home"
					>
						<Logo size="sm" showText={false} />
					</Link>
					{atDashboardRoot ? (
						<Button
							variant="ghost"
							size="icon-sm"
							className="rounded-full"
							disabled
							aria-label="Go to dashboard home"
						>
							<Home className="size-4" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon-sm"
							className="rounded-full"
							asChild
							aria-label={showHomeBack ? "Go to dashboard home" : "Go back"}
						>
							<Link to={backTarget}>
								{showHomeBack ? (
									<Home className="size-4" />
								) : (
									<ChevronLeft className="size-4" />
								)}
							</Link>
						</Button>
					)}
					<Breadcrumb className="min-w-0">
						<BreadcrumbList className="flex-nowrap gap-1.5 overflow-hidden whitespace-nowrap">
							{breadcrumbs.map((crumb, index) => {
								const isCurrent = index === breadcrumbs.length - 1;

								return (
									<BreadcrumbItem key={crumb.href} className="shrink-0">
										{index > 0 ? <BreadcrumbSeparator /> : null}
										{isCurrent ? (
											<BreadcrumbPage className="truncate font-medium">
												{crumb.label}
											</BreadcrumbPage>
										) : (
											<BreadcrumbLink asChild className="truncate">
												<Link to={crumb.href}>{crumb.label}</Link>
											</BreadcrumbLink>
										)}
									</BreadcrumbItem>
								);
							})}
						</BreadcrumbList>
					</Breadcrumb>
				</div>

				<div className="ml-auto flex items-center gap-2 sm:gap-3">
					<div className="hidden w-[min(38vw,420px)] md:block">
						<SearchCommand
							onOpenAssistant={onOpenAssistant}
							className="w-full"
						/>
					</div>
					<ThemeToggle compact className="size-10" />
					<AlertInbox />
					<Button
						type="button"
						className="assistant-launch h-10 rounded-full px-4"
						onClick={onOpenAssistant}
					>
						<WandSparkles className="assistant-launch__icon size-4" />
						<span className="assistant-launch__title">Mira</span>
					</Button>
				</div>
			</div>
		</header>
	);
}

export function DashboardLayout() {
	const [collapsed, setCollapsed] = useState(false);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [assistantOpen, setAssistantOpen] = useState(false);
	const location = useLocation();

	useEffect(() => {
		setMarketingUserSignedIn(true);
	}, []);

	useEffect(() => {
		if (location.pathname) {
			setMobileOpen(false);
		}
	}, [location.pathname]);

	return (
		<div className="app-shell dashboard-shell h-[100dvh] overflow-hidden">
			<div className="dashboard-shell-surface relative flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
				<Sidebar
					collapsed={collapsed}
					mobileOpen={mobileOpen}
					onClose={() => setMobileOpen(false)}
				/>
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					<TopBar
						collapsed={collapsed}
						onOpenMobile={() => setMobileOpen(true)}
						onToggleSidebar={() => setCollapsed((value) => !value)}
						onOpenAssistant={() => setAssistantOpen(true)}
					/>
					<main className="dashboard-main flex min-h-0 flex-1 flex-col px-3 pt-0 pb-3 sm:px-4 sm:pt-0 sm:pb-4 lg:pl-0">
						<div className="dashboard-content-frame relative z-10 flex min-h-0 flex-1 flex-col rounded-[30px]">
							<ScrollArea
								type="scroll"
								scrollHideDelay={180}
								className="dashboard-content-scroll min-h-0 flex-1 rounded-[inherit]"
								scrollbarClassName="dashboard-content-scrollbar"
								thumbClassName="dashboard-content-scrollbar-thumb"
							>
								<div className="flex min-h-full flex-col px-4 py-6 sm:px-6 sm:pr-8 lg:px-8 lg:pr-10">
									<Outlet />
								</div>
							</ScrollArea>
						</div>
					</main>
				</div>
			</div>
			<MiraAssistant
				open={assistantOpen}
				onOpenChange={setAssistantOpen}
				workspaceName={workspaces[0]}
				currentUserName={currentUser.name}
			/>
		</div>
	);
}
