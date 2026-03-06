import {
	ArrowDown,
	ArrowUp,
	Calendar,
	Eye,
	Heart,
	MessageCircle,
	MoreHorizontal,
	Share2,
	TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const stats = [
	{
		name: "Total Reach",
		value: "124.5K",
		change: "+12.5%",
		trend: "up",
		icon: Eye,
	},
	{
		name: "Engagement Rate",
		value: "4.8%",
		change: "+0.8%",
		trend: "up",
		icon: Heart,
	},
	{
		name: "Comments",
		value: "2,847",
		change: "-3.2%",
		trend: "down",
		icon: MessageCircle,
	},
	{
		name: "Shares",
		value: "892",
		change: "+18.9%",
		trend: "up",
		icon: Share2,
	},
];

const scheduledPosts = [
	{
		id: 1,
		platform: "X",
		content: "Excited to announce our new feature launch! 🚀",
		scheduledFor: "Today, 2:00 PM",
		status: "scheduled",
	},
	{
		id: 2,
		platform: "LinkedIn",
		content: "How we scaled our social media strategy by 300%...",
		scheduledFor: "Today, 4:30 PM",
		status: "scheduled",
	},
	{
		id: 3,
		platform: "Instagram",
		content: "Behind the scenes at Heimdall HQ 📸",
		scheduledFor: "Tomorrow, 10:00 AM",
		status: "draft",
	},
];

const recentActivity = [
	{ action: "Post published", platform: "X", time: "2 hours ago" },
	{ action: "New follower milestone", platform: "Instagram", time: "4 hours ago" },
	{ action: "Reply received", platform: "LinkedIn", time: "5 hours ago" },
	{ action: "Story viewed 1K times", platform: "Instagram", time: "6 hours ago" },
];

export function DashboardOverview() {
	return (
		<div className="space-y-8 animate-fade-in">
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
					<p className="text-[var(--color-text-muted)] mt-1">
						Your social media performance at a glance
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Button variant="secondary" size="sm">
						<Calendar className="w-4 h-4" />
						Last 7 days
					</Button>
					<Button size="sm">
						<TrendingUp className="w-4 h-4" />
						View Report
					</Button>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{stats.map((stat) => (
					<Card key={stat.name} className="p-5">
						<div className="flex items-start justify-between">
							<div className="w-10 h-10 rounded-lg bg-[var(--color-bg-muted)] flex items-center justify-center">
								<stat.icon className="w-5 h-5 text-[var(--color-text-muted)]" />
							</div>
							<div
								className={cn(
									"flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
									stat.trend === "up"
										? "bg-green-500/10 text-green-500"
										: "bg-red-500/10 text-red-500",
								)}
							>
								{stat.trend === "up" ? (
									<ArrowUp className="w-3 h-3" />
								) : (
									<ArrowDown className="w-3 h-3" />
								)}
								{stat.change}
							</div>
						</div>
						<div className="mt-4">
							<p className="text-2xl font-semibold">{stat.value}</p>
							<p className="text-sm text-[var(--color-text-muted)] mt-1">
								{stat.name}
							</p>
						</div>
					</Card>
				))}
			</div>

			{/* Content Grid */}
			<div className="grid lg:grid-cols-3 gap-6">
				{/* Scheduled Posts */}
				<Card className="lg:col-span-2">
					<CardHeader className="pb-4">
						<div className="flex items-center justify-between">
							<CardTitle>Scheduled Posts</CardTitle>
							<Button variant="ghost" size="sm">
								View all
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{scheduledPosts.map((post) => (
							<div
								key={post.id}
								className="flex items-start gap-4 p-4 rounded-lg bg-[var(--color-bg-muted)] border border-[var(--color-border-subtle)]"
							>
								<div className="w-10 h-10 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center text-xs font-medium text-[var(--color-text-muted)] flex-shrink-0">
									{post.platform.charAt(0)}
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-sm font-medium">{post.platform}</span>
										<span
											className={cn(
												"text-xs px-2 py-0.5 rounded-full",
												post.status === "scheduled"
													? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
													: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
											)}
										>
											{post.status}
										</span>
									</div>
									<p className="text-sm text-[var(--color-text-muted)] truncate">
										{post.content}
									</p>
									<p className="text-xs text-[var(--color-text-subtle)] mt-1">
										{post.scheduledFor}
									</p>
								</div>
								<Button variant="ghost" size="icon" className="flex-shrink-0">
									<MoreHorizontal className="w-4 h-4" />
								</Button>
							</div>
						))}
					</CardContent>
				</Card>

				{/* Recent Activity */}
				<Card>
					<CardHeader className="pb-4">
						<CardTitle>Recent Activity</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{recentActivity.map((activity, index) => (
								<div key={index} className="flex items-start gap-3">
									<div className="w-2 h-2 rounded-full bg-[var(--color-accent)] mt-2 flex-shrink-0" />
									<div>
										<p className="text-sm">{activity.action}</p>
										<p className="text-xs text-[var(--color-text-subtle)]">
											{activity.platform} · {activity.time}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Quick Actions */}
			<Card>
				<CardHeader>
					<CardTitle>Quick Actions</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{[
							{ label: "Create Post", description: "Draft new content" },
							{ label: "Schedule Queue", description: "Manage your queue" },
							{ label: "View Analytics", description: "Deep dive metrics" },
							{ label: "Connect Account", description: "Add new platform" },
						].map((action) => (
							<button
								key={action.label}
								type="button"
								className="p-4 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-text-subtle)] hover:bg-[var(--color-bg-muted)] transition-all text-left group"
							>
								<p className="font-medium group-hover:text-[var(--color-accent)] transition-colors">
									{action.label}
								</p>
								<p className="text-sm text-[var(--color-text-subtle)] mt-1">
									{action.description}
								</p>
							</button>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
