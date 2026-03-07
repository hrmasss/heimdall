import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Home,
  Layers,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
  Users,
  X,
  Zap,
  Check,
} from "lucide-react";

// =============================================================================
// NAVIGATION CONFIG
// =============================================================================

const navigation = [
  { name: "Overview", href: "/dashboard", icon: Home },
  { name: "Posts", href: "/dashboard/posts", icon: FileText },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Automations", href: "/dashboard/automations", icon: Zap },
  { name: "Library", href: "/dashboard/library", icon: Layers },
  { name: "Team", href: "/dashboard/team", icon: Users },
];

const secondaryNav = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const workspaces = [
  { id: "1", name: "Acme Inc", icon: "A" },
  { id: "2", name: "Personal", icon: "P" },
  { id: "3", name: "Freelance", icon: "F" },
];

// =============================================================================
// THEME TOGGLE
// =============================================================================

function ThemeToggle({ size = "default" }: { size?: "default" | "sm" }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("heimdall-theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored || (systemPrefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    localStorage.setItem("heimdall-theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "rounded-lg flex items-center justify-center transition-colors hover:bg-muted text-muted-foreground hover:text-foreground",
        size === "sm" ? "size-8" : "size-9"
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

// =============================================================================
// WORKSPACE SWITCHER
// =============================================================================

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const [currentWorkspace, setCurrentWorkspace] = useState(workspaces[0]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left",
            collapsed && "justify-center"
          )}
        >
          <div className="size-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {currentWorkspace.icon}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{currentWorkspace.name}</div>
                <div className="text-xs text-muted-foreground">Free Plan</div>
              </div>
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setCurrentWorkspace(workspace)}
            className="flex items-center gap-2"
          >
            <div className="size-6 rounded bg-muted flex items-center justify-center text-xs font-medium">
              {workspace.icon}
            </div>
            <span className="flex-1">{workspace.name}</span>
            {workspace.id === currentWorkspace.id && (
              <Check className="size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="size-4 mr-2" />
          Create Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// USER BUTTON
// =============================================================================

function UserButton({ collapsed }: { collapsed: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left",
            collapsed && "justify-center"
          )}
        >
          <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User className="size-4 text-muted-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">John Doe</div>
              <div className="text-xs text-muted-foreground truncate">john@example.com</div>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/dashboard/settings/profile">
            <User className="size-4 mr-2" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/settings">
            <Settings className="size-4 mr-2" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <LogOut className="size-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// SIDEBAR
// =============================================================================

function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose()}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300",
          collapsed ? "w-[68px]" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header: Logo + Collapse */}
        <div className="flex h-14 items-center justify-between px-3 border-b border-border">
          <Link to="/dashboard" className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
            <Logo size="sm" showText={!collapsed} />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("hidden lg:flex shrink-0", collapsed && "absolute right-0 translate-x-1/2 bg-card border")}
            onClick={onToggle}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onMobileClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-border">
          <WorkspaceSwitcher collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* Secondary Navigation */}
        <div className="px-3 py-3 border-t border-border">
          {secondaryNav.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="size-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </div>

        {/* User Button */}
        <div className="p-3 border-t border-border">
          <UserButton collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}

// =============================================================================
// TOP NAV
// =============================================================================

function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = "/" + pathSegments.slice(0, index + 1).join("/");
    const label = segment.charAt(0).toUpperCase() + segment.slice(1);
    return { href, label };
  });

  return (
    <nav className="flex items-center gap-1 text-sm">
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground">/</span>}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium">{crumb.label}</span>
          ) : (
            <Link to={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function TopNav({
  sidebarCollapsed,
  onMobileMenuOpen,
}: {
  sidebarCollapsed: boolean;
  onMobileMenuOpen: () => void;
}) {
  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur-sm transition-all duration-300",
        sidebarCollapsed ? "left-0 lg:left-[68px]" : "left-0 lg:left-64"
      )}
    >
      <div className="flex h-full items-center justify-between px-4 gap-4">
        {/* Left: Mobile menu + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onMobileMenuOpen}
          >
            <Menu className="size-5" />
          </Button>
          <Breadcrumbs />
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-auto hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-9 h-9 bg-muted/50 border-transparent focus:border-border"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Search button for mobile */}
          <Button variant="ghost" size="icon-sm" className="md:hidden">
            <Search className="size-4" />
          </Button>

          {/* Notifications */}
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle size="sm" />

          {/* Intellicent AI Button */}
          <Button
            size="sm"
            className="intellicent-btn text-white border-0 gap-1.5 hidden sm:flex"
          >
            <Sparkles className="size-3.5" />
            <span className="font-medium">Intellicent</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

// =============================================================================
// DASHBOARD LAYOUT
// =============================================================================

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  const location = useLocation();
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onMobileMenuOpen={() => setMobileMenuOpen(true)}
      />

      {/* Main Content */}
      <main
        className={cn(
          "pt-14 min-h-screen transition-all duration-300",
          sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64"
        )}
      >
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
