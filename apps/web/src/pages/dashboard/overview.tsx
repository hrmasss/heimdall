import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  Eye,
  FileText,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Share2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

// =============================================================================
// KPI DATA
// =============================================================================

const kpis = [
  {
    name: "Total Reach",
    value: "124.5K",
    change: "+12.5%",
    trend: "up" as const,
    icon: Eye,
    color: "text-blue-500 bg-blue-500/10",
  },
  {
    name: "Engagement",
    value: "4.8%",
    change: "+0.8%",
    trend: "up" as const,
    icon: Heart,
    color: "text-pink-500 bg-pink-500/10",
  },
  {
    name: "Comments",
    value: "2,847",
    change: "-3.2%",
    trend: "down" as const,
    icon: MessageCircle,
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    name: "Shares",
    value: "892",
    change: "+18.9%",
    trend: "up" as const,
    icon: Share2,
    color: "text-emerald-500 bg-emerald-500/10",
  },
  {
    name: "Followers",
    value: "32.1K",
    change: "+5.2%",
    trend: "up" as const,
    icon: Users,
    color: "text-violet-500 bg-violet-500/10",
  },
  {
    name: "Posts",
    value: "47",
    change: "+12",
    trend: "up" as const,
    icon: FileText,
    color: "text-cyan-500 bg-cyan-500/10",
  },
];

const scheduledPosts = [
  {
    id: 1,
    platform: "X",
    content: "Excited to announce our new feature launch! 🚀",
    scheduledFor: "Today, 2:00 PM",
    status: "scheduled" as const,
  },
  {
    id: 2,
    platform: "LinkedIn",
    content: "How we scaled our social media strategy by 300%...",
    scheduledFor: "Today, 4:30 PM",
    status: "scheduled" as const,
  },
  {
    id: 3,
    platform: "Instagram",
    content: "Behind the scenes at Heimdall HQ 📸",
    scheduledFor: "Tomorrow, 10:00 AM",
    status: "draft" as const,
  },
  {
    id: 4,
    platform: "Facebook",
    content: "Join us for our live Q&A session this Friday!",
    scheduledFor: "Friday, 3:00 PM",
    status: "scheduled" as const,
  },
];

const recentActivity = [
  { action: "Post published", platform: "X", time: "2h ago", icon: FileText },
  { action: "New milestone reached", platform: "Instagram", time: "4h ago", icon: TrendingUp },
  { action: "Reply received", platform: "LinkedIn", time: "5h ago", icon: MessageCircle },
  { action: "Story viewed 1K+", platform: "Instagram", time: "6h ago", icon: Eye },
  { action: "New follower milestone", platform: "X", time: "8h ago", icon: Users },
];

const quickActions = [
  { label: "New Post", icon: Plus, href: "/dashboard/posts/new" },
  { label: "Schedule", icon: Calendar, href: "/dashboard/calendar" },
  { label: "Analytics", icon: TrendingUp, href: "/dashboard/analytics" },
  { label: "Automate", icon: Zap, href: "/dashboard/automations" },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function KPICard({ kpi }: { kpi: typeof kpis[0] }) {
  return (
    <div className="kpi-card">
      <div className={cn("kpi-icon", kpi.color)}>
        <kpi.icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="kpi-value">{kpi.value}</span>
          <span
            className={cn(
              "pill",
              kpi.trend === "up" ? "pill-success" : "pill-error"
            )}
          >
            {kpi.trend === "up" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {kpi.change}
          </span>
        </div>
        <div className="kpi-label">{kpi.name}</div>
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    X: "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900",
    LinkedIn: "bg-blue-600 text-white",
    Instagram: "bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 text-white",
    Facebook: "bg-blue-500 text-white",
  };

  return (
    <span className={cn("size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0", colors[platform])}>
      {platform[0]}
    </span>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DashboardOverview() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Your social media performance at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Calendar className="size-4" />
            Last 7 days
          </Button>
          <Button size="sm" className="bg-gradient-brand text-white border-0">
            <Plus className="size-4" />
            New Post
          </Button>
        </div>
      </div>

      {/* Quick Actions - Mobile */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.href}
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border text-center hover:bg-muted transition-colors"
          >
            <action.icon className="size-5 text-primary" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <KPICard key={kpi.name} kpi={kpi} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Scheduled Posts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Scheduled Posts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/posts">
                  View all
                  <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduledPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <PlatformBadge platform={post.platform} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{post.platform}</span>
                    <span
                      className={cn(
                        "pill",
                        post.status === "scheduled" ? "pill-info" : "pill-warning"
                      )}
                    >
                      {post.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {post.content}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {post.scheduledFor}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" className="shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <activity.icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.platform} · {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Performance Overview</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Reach
              </Button>
              <Button variant="ghost" size="sm" className="text-primary">
                Engagement
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Followers
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Chart placeholder */}
          <div className="h-64 rounded-lg bg-muted/30 flex items-center justify-center border border-dashed border-border">
            <div className="text-center space-y-2">
              <TrendingUp className="size-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Performance chart</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performing Content */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top Performing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="size-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Post title #{i}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" /> {(1234 * i).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" /> {(123 * i).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className="pill pill-success">#{i}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Audience Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Audience Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { platform: "Instagram", percent: 45, color: "bg-gradient-to-r from-purple-500 to-pink-500" },
                { platform: "X (Twitter)", percent: 30, color: "bg-neutral-800 dark:bg-neutral-200" },
                { platform: "LinkedIn", percent: 18, color: "bg-blue-600" },
                { platform: "Facebook", percent: 7, color: "bg-blue-500" },
              ].map((item) => (
                <div key={item.platform} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{item.platform}</span>
                    <span className="font-medium">{item.percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", item.color)}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
