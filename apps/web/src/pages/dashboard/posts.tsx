import { FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import type { ApiListResponse, PostSummary } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function statusClassName(value: string) {
	switch (value) {
		case "approved":
		case "published":
			return "pill pill-success";
		case "in_review":
		case "scheduled":
		case "publishing":
			return "pill pill-warning";
		case "changes_requested":
		case "failed":
			return "pill pill-error";
		default:
			return "pill pill-muted";
	}
}

const columns: DataTableColumn<PostSummary>[] = [
	{
		id: "title",
		label: "Post",
		width: 280,
		accessor: (row) => (
			<div>
				<div className="font-medium">{row.title}</div>
				<div className="mt-1 text-xs text-muted-foreground">
					{row.contentKind} · {row.variantCount} variant
					{row.variantCount === 1 ? "" : "s"}
				</div>
			</div>
		),
		getSortValue: (row) => row.title,
	},
	{
		id: "approval",
		label: "Approval",
		width: 150,
		accessor: (row) => (
			<span className={statusClassName(row.aggregateApprovalState)}>
				{row.aggregateApprovalState}
			</span>
		),
		getSortValue: (row) => row.aggregateApprovalState,
	},
	{
		id: "publication",
		label: "Publication",
		width: 150,
		accessor: (row) => (
			<span className={statusClassName(row.aggregatePublicationState)}>
				{row.aggregatePublicationState}
			</span>
		),
		getSortValue: (row) => row.aggregatePublicationState,
	},
	{
		id: "planned",
		label: "Latest planned",
		width: 180,
		accessor: (row) =>
			row.latestPlannedAt
				? new Date(row.latestPlannedAt).toLocaleString()
				: "Unscheduled",
		getSortValue: (row) => row.latestPlannedAt ?? "",
	},
	{
		id: "metric",
		label: "Top KPI",
		width: 180,
		accessor: (row) =>
			row.metricSnapshot?.[0]
				? `${row.metricSnapshot[0].label}: ${row.metricSnapshot[0].value.toLocaleString()}`
				: "No metrics",
		getSortValue: (row) => row.metricSnapshot?.[0]?.value ?? 0,
	},
];

export function DashboardPosts() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [posts, setPosts] = useState<PostSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}
		let cancelled = false;
		async function loadPosts() {
			setLoading(true);
			setError(null);
			try {
				const response =
					await customerRequest<ApiListResponse<PostSummary>>("/posts");
				if (!cancelled) {
					setPosts(response.items);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load posts.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadPosts();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest]);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Publishing queue"
				title="Posts"
				description="Track generic posts, platform variants, approval state, and planned publication timing from one queue."
				actions={
					<Button
						className="rounded-full bg-gradient-brand text-white border-0"
						asChild
					>
						<Link to="/dashboard/posts/new">
							<FilePlus2 className="size-4" />
							New post
						</Link>
					</Button>
				}
			/>

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Post queue"
					description="Open any post to inspect its generic source, platform variants, planned slots, and KPI rollups."
					rows={posts}
					columns={columns}
					getRowId={(row) => row.id}
					getSearchText={(row) =>
						[
							row.title,
							row.contentKind,
							row.aggregateApprovalState,
							row.aggregatePublicationState,
						].join(" ")
					}
					filters={[
						{
							id: "approval",
							label: "Approval",
							options: [
								"draft",
								"in_review",
								"approved",
								"changes_requested",
							].map((value) => ({ label: value, value })),
							getValue: (row) => row.aggregateApprovalState,
						},
						{
							id: "publication",
							label: "Publication",
							options: [
								"unscheduled",
								"scheduled",
								"publishing",
								"published",
								"failed",
								"cancelled",
							].map((value) => ({ label: value, value })),
							getValue: (row) => row.aggregatePublicationState,
						},
					]}
					emptyState={{
						title: "No posts yet",
						description:
							"Create a generic post, then add platform variants and asset plans from the editor.",
						actionLabel: "Create post",
						onAction: () => navigate("/dashboard/posts/new"),
					}}
					loading={loading}
					error={error}
					onRowClick={(row) => navigate(`/dashboard/posts/${row.id}`)}
					renderGridCard={(row) => (
						<div className="space-y-4">
							<div>
								<div className="text-lg font-medium">{row.title}</div>
								<div className="mt-1 text-sm text-muted-foreground">
									{row.contentKind} · {row.variantCount} variant
									{row.variantCount === 1 ? "" : "s"}
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<span className={statusClassName(row.aggregateApprovalState)}>
									{row.aggregateApprovalState}
								</span>
								<span
									className={statusClassName(row.aggregatePublicationState)}
								>
									{row.aggregatePublicationState}
								</span>
							</div>
							<div className="text-sm text-muted-foreground">
								{row.latestPlannedAt
									? `Latest slot: ${new Date(row.latestPlannedAt).toLocaleString()}`
									: "No planned slots yet"}
							</div>
						</div>
					)}
				/>
			</SurfaceCard>
		</div>
	);
}
