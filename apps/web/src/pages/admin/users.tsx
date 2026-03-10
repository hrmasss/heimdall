import {
	Copy,
	Ellipsis,
	Eye,
	PencilLine,
	ShieldCheck,
	ToggleLeft,
	ToggleRight,
	UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";
import type { ApiListResponse, PlatformUserRecord } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, string> = {
	active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
	pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	suspended: "bg-red-500/10 text-red-600 border-red-500/20",
};

function UserIdentity({ user }: { user: PlatformUserRecord["user"] }) {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-9">
				<AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-sm text-white">
					{user.fullName
						.split(" ")
						.map((part) => part[0])
						.join("")}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0">
				<div className="font-medium">{user.fullName}</div>
				<div className="truncate text-sm text-muted-foreground">{user.email}</div>
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	return (
		<Badge
			variant="outline"
			className={cn(
				"rounded-full capitalize",
				statusConfig[status] ?? "bg-muted text-foreground",
			)}
		>
			{status}
		</Badge>
	);
}

function RoleBadges({ roles }: { roles: PlatformUserRecord["platformRoles"] }) {
	return (
		<div className="flex flex-wrap gap-2">
			{roles.length ? (
				roles.map((role) => (
					<Badge
						key={role.id}
						variant="outline"
						className="rounded-full bg-amber-500/10 text-amber-600 border-amber-500/20"
					>
						<ShieldCheck className="mr-1 size-3" />
						{role.label}
					</Badge>
				))
			) : (
				<Badge variant="outline" className="rounded-full">
					No platform role
				</Badge>
			)}
		</div>
	);
}

export function AdminUsers() {
	const navigate = useNavigate();
	const { platformRequest, hasPlatformPermission, platformSession } = useAuth();
	const [users, setUsers] = useState<PlatformUserRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyUserId, setBusyUserId] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	async function loadUsers() {
		setLoading(true);
		setError(null);
		setNotice(null);
		try {
			const response =
				await platformRequest<ApiListResponse<PlatformUserRecord>>(
					"/platform/users",
				);
			setUsers(response.items);
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadUsers();
	}, []);

	async function updateUserStatus(record: PlatformUserRecord) {
		setBusyUserId(record.user.id);
		setError(null);
		setNotice(null);
		const nextStatus = record.user.status === "active" ? "suspended" : "active";
		try {
			const updated = await platformRequest<PlatformUserRecord>(
				`/platform/users/${record.user.id}`,
				{
					method: "PATCH",
					body: {
						fullName: record.user.fullName,
						status: nextStatus,
						roleCodes: record.platformRoles.map((role) => role.code),
					},
				},
			);
			setUsers((current) =>
				current.map((item) =>
					item.user.id === updated.user.id ? updated : item,
				),
			);
			setNotice(
				nextStatus === "active"
					? "User activated."
					: "User suspended.",
			);
		} catch (updateError) {
			setError(
				updateError instanceof Error
					? updateError.message
					: "Unable to update the user state.",
			);
		} finally {
			setBusyUserId(null);
		}
	}

	async function copyValue(value: string, message: string) {
		if (!navigator.clipboard) {
			return;
		}
		await navigator.clipboard.writeText(value);
		setNotice(message);
		window.setTimeout(() => {
			setNotice((current) => (current === message ? null : current));
		}, 1800);
	}

	const columns: DataTableColumn<PlatformUserRecord>[] = [
		{
			id: "user",
			label: "User",
			width: 280,
			accessor: (record) => <UserIdentity user={record.user} />,
			getSortValue: (record) => record.user.fullName,
		},
		{
			id: "roles",
			label: "Platform roles",
			width: 240,
			accessor: (record) => <RoleBadges roles={record.platformRoles} />,
			getSortValue: (record) => record.platformRoles.map((role) => role.label).join(", "),
		},
		{
			id: "status",
			label: "Status",
			width: 140,
			accessor: (record) => <StatusBadge status={record.user.status} />,
			getSortValue: (record) => record.user.status,
		},
		{
			id: "workspaces",
			label: "Workspaces",
			width: 120,
			accessor: (record) => String(record.workspaceCount),
			getSortValue: (record) => record.workspaceCount,
		},
		{
			id: "actions",
			label: "Manage",
			width: 280,
			accessor: (record) => (
				<div
					className="flex items-center justify-end gap-2"
					onClick={(event) => event.stopPropagation()}
				>
					<Button
						variant="outline"
						size="sm"
						className="rounded-full"
						onClick={() => navigate(`/admin/users/${record.user.id}`)}
					>
						<Eye className="size-4" />
						View
					</Button>
					{hasPlatformPermission("platform.users.manage") ? (
						<>
							<Button
								variant="outline"
								size="sm"
								className="rounded-full"
								onClick={() => navigate(`/admin/users/${record.user.id}/edit`)}
							>
								<PencilLine className="size-4" />
								Edit user
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="rounded-full"
								onClick={() => void updateUserStatus(record)}
								disabled={
									busyUserId === record.user.id ||
									record.user.id === platformSession?.user.id
								}
								title={
									record.user.id === platformSession?.user.id
										? "You cannot suspend your own platform account."
										: undefined
								}
							>
								{record.user.status === "active" ? (
									<ToggleLeft className="size-4" />
								) : (
									<ToggleRight className="size-4" />
								)}
								{record.user.status === "active" ? "Suspend" : "Activate"}
							</Button>
						</>
					) : null}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" className="rounded-full">
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="rounded-[20px] p-2">
							<DropdownMenuItem
								className="rounded-[14px] px-3 py-2"
								onClick={() => navigate(`/admin/users/${record.user.id}`)}
							>
								<Eye className="size-4" />
								Open detail
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="rounded-[14px] px-3 py-2"
								onClick={() =>
									void copyValue(record.user.email, "Copied user email.")
								}
							>
								<Copy className="size-4" />
								Copy email
							</DropdownMenuItem>
							<DropdownMenuItem
								className="rounded-[14px] px-3 py-2"
								onClick={() => void copyValue(record.user.id, "Copied user ID.")}
							>
								<Copy className="size-4" />
								Copy user ID
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			),
			className: "text-right",
			headerClassName: "text-right",
		},
	];

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Platform Access"
				title="Users"
				description="Manage global admin, ops, and support access across the Heimdall platform."
				actions={
					hasPlatformPermission("platform.users.manage") ? (
						<Button
							className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
							asChild
						>
							<Link to="/admin/users/new">
								<UserPlus className="size-4" />
								New platform user
							</Link>
						</Button>
					) : null
				}
			/>

			<SurfaceCard className="p-5 md:p-6">
				{notice ? (
					<div className="mb-4 rounded-[22px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
						{notice}
					</div>
				) : null}
				<DataTable
					title="Platform directory"
					description="Review global access, workspace footprint, and account state from one directory."
					rows={users}
					columns={columns}
					getRowId={(record) => record.user.id}
					getSearchText={(record) =>
						[
							record.user.fullName,
							record.user.email,
							record.user.status,
							record.platformRoles.map((role) => role.label).join(" "),
						].join(" ")
					}
					searchPlaceholder="Search users or platform roles..."
					loading={loading}
					error={error}
					emptyState={{
						title: "No platform users found",
						description: "Bootstrap a platform admin to begin managing users.",
					}}
					onRowClick={(record) => navigate(`/admin/users/${record.user.id}`)}
					renderGridCard={(record) => (
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<UserIdentity user={record.user} />
								<StatusBadge status={record.user.status} />
							</div>
							<RoleBadges roles={record.platformRoles} />
							<div className="text-sm text-muted-foreground">
								{record.workspaceCount} workspace assignments
							</div>
							<div
								className="flex flex-wrap gap-2 border-t border-[var(--brand-border-soft)] pt-4"
								onClick={(event) => event.stopPropagation()}
							>
								<Button
									variant="outline"
									size="sm"
									className="rounded-full"
									onClick={() => navigate(`/admin/users/${record.user.id}`)}
								>
									<Eye className="size-4" />
									View
								</Button>
								{hasPlatformPermission("platform.users.manage") ? (
									<>
										<Button
											variant="outline"
											size="sm"
											className="rounded-full"
											onClick={() => navigate(`/admin/users/${record.user.id}/edit`)}
										>
											<PencilLine className="size-4" />
											Edit user
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="rounded-full"
											onClick={() => void updateUserStatus(record)}
											disabled={
												busyUserId === record.user.id ||
												record.user.id === platformSession?.user.id
											}
											title={
												record.user.id === platformSession?.user.id
													? "You cannot suspend your own platform account."
													: undefined
											}
										>
											{record.user.status === "active" ? (
												<ToggleLeft className="size-4" />
											) : (
												<ToggleRight className="size-4" />
											)}
											{record.user.status === "active" ? "Suspend" : "Activate"}
										</Button>
									</>
								) : null}
							</div>
						</div>
					)}
				/>
			</SurfaceCard>
		</div>
	);
}
