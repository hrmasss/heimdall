import {
	Ban,
	CheckCircle2,
	Copy,
	Edit2,
	Mail,
	MoreHorizontal,
	ShieldCheck,
	Trash2,
	UserCog,
	UserPlus,
	Users,
	XCircle,
} from "lucide-react";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

type AdminUserRecord = {
	id: string;
	name: string;
	email: string;
	avatar: string;
	role: "admin" | "user";
	status: "active" | "pending" | "suspended";
	plan: "Starter" | "Pro" | "Enterprise";
	createdAt: string;
	createdSort: number;
	lastActive: string;
	lastActiveSort: number;
};

const users: AdminUserRecord[] = [
	{
		id: "1",
		name: "Sarah Chen",
		email: "sarah.chen@company.io",
		avatar: "",
		role: "admin",
		status: "active",
		plan: "Enterprise",
		createdAt: "Mar 2, 2026",
		createdSort: 20260302,
		lastActive: "2 hours ago",
		lastActiveSort: 120,
	},
	{
		id: "2",
		name: "Mike Johnson",
		email: "mike.johnson@startup.co",
		avatar: "",
		role: "user",
		status: "active",
		plan: "Pro",
		createdAt: "Feb 15, 2026",
		createdSort: 20260215,
		lastActive: "5 minutes ago",
		lastActiveSort: 5,
	},
	{
		id: "3",
		name: "Emily Davis",
		email: "emily.davis@agency.com",
		avatar: "",
		role: "user",
		status: "pending",
		plan: "Starter",
		createdAt: "Mar 8, 2026",
		createdSort: 20260308,
		lastActive: "Never",
		lastActiveSort: 999999,
	},
	{
		id: "4",
		name: "Alex Rodriguez",
		email: "alex@freelancer.dev",
		avatar: "",
		role: "user",
		status: "suspended",
		plan: "Pro",
		createdAt: "Jan 20, 2026",
		createdSort: 20260120,
		lastActive: "2 weeks ago",
		lastActiveSort: 20160,
	},
	{
		id: "5",
		name: "Jordan Kim",
		email: "jordan.kim@enterprise.io",
		avatar: "",
		role: "admin",
		status: "active",
		plan: "Enterprise",
		createdAt: "Dec 5, 2025",
		createdSort: 20251205,
		lastActive: "Just now",
		lastActiveSort: 0,
	},
	{
		id: "6",
		name: "Taylor Martinez",
		email: "taylor@design.studio",
		avatar: "",
		role: "user",
		status: "active",
		plan: "Starter",
		createdAt: "Feb 28, 2026",
		createdSort: 20260228,
		lastActive: "1 day ago",
		lastActiveSort: 1440,
	},
];

const statusConfig = {
	active: {
		label: "Active",
		icon: CheckCircle2,
		className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
	},
	pending: {
		label: "Pending",
		icon: Mail,
		className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	},
	suspended: {
		label: "Suspended",
		icon: XCircle,
		className: "bg-red-500/10 text-red-600 border-red-500/20",
	},
} satisfies Record<
	AdminUserRecord["status"],
	{ label: string; icon: typeof CheckCircle2; className: string }
>;

const roleConfig = {
	admin: {
		label: "Admin",
		icon: ShieldCheck,
		className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	},
	user: {
		label: "User",
		icon: Users,
		className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	},
} satisfies Record<
	AdminUserRecord["role"],
	{ label: string; icon: typeof ShieldCheck; className: string }
>;

function UserIdentity({ user }: { user: AdminUserRecord }) {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-9">
				<AvatarImage src={user.avatar} />
				<AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-sm text-white">
					{user.name
						.split(" ")
						.map((part) => part[0])
						.join("")}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<div className="font-medium">{user.name}</div>
				<div className="truncate text-sm text-muted-foreground">{user.email}</div>
			</div>
		</div>
	);
}

function RoleBadge({ role }: { role: AdminUserRecord["role"] }) {
	const config = roleConfig[role];

	return (
		<Badge variant="outline" className={cn("gap-1 rounded-full", config.className)}>
			<config.icon className="size-3" />
			{config.label}
		</Badge>
	);
}

function StatusBadge({ status }: { status: AdminUserRecord["status"] }) {
	const config = statusConfig[status];

	return (
		<Badge variant="outline" className={cn("gap-1 rounded-full", config.className)}>
			<config.icon className="size-3" />
			{config.label}
		</Badge>
	);
}

const columns: DataTableColumn<AdminUserRecord>[] = [
	{
		id: "user",
		label: "User",
		width: 280,
		minWidth: 240,
		accessor: (user) => <UserIdentity user={user} />,
		getSortValue: (user) => user.name,
		cardValue: (user) => <UserIdentity user={user} />,
	},
	{
		id: "role",
		label: "Role",
		width: 140,
		accessor: (user) => <RoleBadge role={user.role} />,
		getSortValue: (user) => user.role,
	},
	{
		id: "status",
		label: "Status",
		width: 150,
		accessor: (user) => <StatusBadge status={user.status} />,
		getSortValue: (user) => user.status,
	},
	{
		id: "plan",
		label: "Plan",
		width: 140,
		accessor: (user) => user.plan,
		getSortValue: (user) => user.plan,
	},
	{
		id: "createdAt",
		label: "Joined",
		width: 150,
		accessor: (user) => user.createdAt,
		getSortValue: (user) => user.createdSort,
	},
	{
		id: "lastActive",
		label: "Last active",
		width: 150,
		accessor: (user) => user.lastActive,
		getSortValue: (user) => user.lastActiveSort,
	},
];

export function AdminUsers() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="User Management"
				title="Users"
				description="Manage user accounts, roles, access states, and plan mix from a single control surface."
				actions={
					<Dialog>
						<DialogTrigger asChild>
							<Button className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
								<UserPlus className="size-4" />
								Add user
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-[425px]">
							<DialogHeader>
								<DialogTitle>Add New User</DialogTitle>
								<DialogDescription>
									Create a new user account. They will receive an email invitation.
								</DialogDescription>
							</DialogHeader>
							<div className="grid gap-4 py-4">
								<div className="grid gap-2">
									<Label htmlFor="name">Full name</Label>
									<Input id="name" placeholder="John Doe" className="rounded-xl" />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										placeholder="john@example.com"
										className="rounded-xl"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="role">Role</Label>
									<NativeSelect defaultValue="user" className="rounded-xl">
										<NativeSelectOption value="user">User</NativeSelectOption>
										<NativeSelectOption value="admin">Admin</NativeSelectOption>
									</NativeSelect>
								</div>
							</div>
							<DialogFooter>
								<Button variant="outline" className="rounded-full">
									Cancel
								</Button>
								<Button className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
									Send invitation
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				}
			/>

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Account directory"
					description="Search people, segment by role or account state, and switch between compact list and ops-friendly card views."
					rows={users}
					columns={columns}
					getRowId={(user) => user.id}
					getSearchText={(user) =>
						[
							user.name,
							user.email,
							user.role,
							user.status,
							user.plan,
							user.lastActive,
						].join(" ")
					}
					searchPlaceholder="Search users, emails, or plans..."
					filters={[
						{
							id: "status",
							label: "Status",
							options: Object.entries(statusConfig).map(([value, config]) => ({
								label: config.label,
								value,
							})),
							getValue: (user) => user.status,
						},
						{
							id: "role",
							label: "Role",
							options: Object.entries(roleConfig).map(([value, config]) => ({
								label: config.label,
								value,
							})),
							getValue: (user) => user.role,
						},
						{
							id: "plan",
							label: "Plan",
							options: ["Starter", "Pro", "Enterprise"].map((value) => ({
								label: value,
								value,
							})),
							getValue: (user) => user.plan,
						},
					]}
					globalActions={[
						{ label: "Invite batch", icon: UserPlus, variant: "outline" },
						{ label: "Roles", icon: UserCog, variant: "ghost" },
					]}
					rowActions={[
						{ label: "Edit user", icon: Edit2 },
						{ label: "Change role", icon: UserCog },
						{ label: "Copy email", icon: Copy },
						{ label: "Suspend access", icon: Ban, destructive: true },
						{ label: "Delete user", icon: Trash2, destructive: true },
					]}
					emptyState={{
						title: "No users match the current view",
						description:
							"Adjust the search query or filters to bring the right accounts back into focus.",
					}}
					renderGridCard={(user) => (
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<UserIdentity user={user} />
								<StatusBadge status={user.status} />
							</div>
							<div className="flex flex-wrap gap-2">
								<RoleBadge role={user.role} />
								<Badge variant="outline" className="rounded-full">
									{user.plan}
								</Badge>
							</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Joined
									</div>
									<div className="mt-1">{user.createdAt}</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Last active
									</div>
									<div className="mt-1">{user.lastActive}</div>
								</div>
							</div>
							<div className="flex items-center justify-between rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm">
								<span>{user.email}</span>
								<Button variant="ghost" size="icon-sm">
									<MoreHorizontal className="size-4" />
								</Button>
							</div>
						</div>
					)}
				/>
			</SurfaceCard>
		</div>
	);
}
