import { Edit2, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
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
	const { platformRequest } = useAuth();
	const [users, setUsers] = useState<PlatformUserRecord[]>([]);
	const [availableRoles, setAvailableRoles] = useState<string[]>([
		"super_admin",
		"ops_admin",
		"support_agent",
	]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editTarget, setEditTarget] = useState<PlatformUserRecord | null>(null);
	const [editStatus, setEditStatus] = useState("active");
	const [editRoleCode, setEditRoleCode] = useState("support_agent");

	async function loadUsers() {
		setLoading(true);
		setError(null);
		try {
			const response =
				await platformRequest<ApiListResponse<PlatformUserRecord>>(
					"/platform/users",
				);
			setUsers(response.items);
			const uniqueRoles = new Set<string>();
			for (const user of response.items) {
				for (const role of user.platformRoles) {
					uniqueRoles.add(role.code);
				}
			}
			if (uniqueRoles.size) {
				setAvailableRoles([...uniqueRoles]);
			}
		} catch (loadError) {
			setError(loadError instanceof Error ? loadError.message : "Unable to load users.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadUsers();
	}, []);

	async function updateUser() {
		if (!editTarget) {
			return;
		}
		await platformRequest<PlatformUserRecord>(`/platform/users/${editTarget.user.id}`, {
			method: "PATCH",
			body: {
				status: editStatus,
				roleCodes: editRoleCode ? [editRoleCode] : [],
			},
		});
		setEditTarget(null);
		await loadUsers();
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
	];

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Platform Access"
				title="Users"
				description="Manage global admin, ops, and support access across the Heimdall platform."
			/>

			<SurfaceCard className="p-5 md:p-6">
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
					rowActions={[
						{
							label: "Edit access",
							icon: UserCog,
							onClick: (record) => {
								setEditTarget(record);
								setEditStatus(record.user.status);
								setEditRoleCode(record.platformRoles[0]?.code ?? "support_agent");
							},
						},
					]}
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
						</div>
					)}
				/>
			</SurfaceCard>

			<Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit platform access</DialogTitle>
						<DialogDescription>
							Update platform role assignment and account status for this user.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-2">
						<div className="rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 p-4">
							<div className="font-medium">{editTarget?.user.fullName}</div>
							<div className="text-sm text-muted-foreground">{editTarget?.user.email}</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="platform-role">Role</Label>
							<NativeSelect
								id="platform-role"
								value={editRoleCode}
								onChange={(event) => setEditRoleCode(event.target.value)}
								className="rounded-xl"
							>
								{availableRoles.map((roleCode) => (
									<NativeSelectOption key={roleCode} value={roleCode}>
										{roleCode}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="platform-status">Status</Label>
							<NativeSelect
								id="platform-status"
								value={editStatus}
								onChange={(event) => setEditStatus(event.target.value)}
								className="rounded-xl"
							>
								<NativeSelectOption value="active">Active</NativeSelectOption>
								<NativeSelectOption value="suspended">Suspended</NativeSelectOption>
							</NativeSelect>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" className="rounded-full">
							Cancel
						</Button>
						<Button
							className="rounded-full border-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white"
							onClick={() => void updateUser()}
						>
							<Edit2 className="size-4" />
							Save changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
