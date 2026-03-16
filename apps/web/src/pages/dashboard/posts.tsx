import { FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Button } from "@/components/ui/button";
import { useSocialConnectionSummary } from "@/hooks/use-social-connection-summary";
import type { ApiListResponse, PostSummary } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { normalizePostSummaries } from "@/lib/post-models";

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
		id: "campaign",
		label: "Campaign",
		width: 220,
		accessor: (row) =>
			row.campaign ? (
				<Link
					to={`/dashboard/campaigns/${row.campaign.id}`}
					className="text-primary underline-offset-4 hover:underline"
					onClick={(event) => event.stopPropagation()}
				>
					{row.campaign.name}
				</Link>
			) : (
				"None"
			),
		getSortValue: (row) => row.campaign?.name ?? "",
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
	const { summary } = useSocialConnectionSummary();
	const [posts, setPosts] = useState<PostSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const setupNeeded = !summary.hasHealthySelectedTarget;

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
					setPosts(normalizePostSummaries(response.items).value);
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
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/platforms">
								{setupNeeded ? "Connect platforms" : "Manage platforms"}
							</Link>
						</Button>
						<Button
							className="rounded-full bg-gradient-brand text-white border-0"
							asChild
						>
							<Link to="/dashboard/posts/new">
								<FilePlus2 className="size-4" />
								New post
							</Link>
						</Button>
					</>
				}
			/>

			{setupNeeded ? (
				<SurfaceCard className="rounded-[28px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(195,123,79,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.76))] p-5">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
						<div>
							<div className="text-lg font-medium">
								Connect platforms to turn drafts into real scheduled or
								published posts.
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Your team can already write, review, and plan here. Connection
								setup is what lets Heimdall post on behalf of the workspace and
								monitor those destinations more directly.
							</div>
						</div>
						<Button className="rounded-full" asChild>
							<Link to="/dashboard/settings/platforms">Connect now</Link>
						</Button>
					</div>
				</SurfaceCard>
			) : null}

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Post queue"
					description="Open any post to inspect its generic source, platform variants, planned slots, and KPI rollups."
					storageKey="dashboard-posts-table"
					rows={posts}
					columns={columns}
					getRowId={(row) => row.id}
					getSearchText={(row) =>
						[
							row.title,
							row.campaign?.name,
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
							"Create a generic post, then add platform variants and asset plans from the editor. Platform connections are recommended when you want Heimdall to publish or schedule on your behalf.",
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
								{row.campaign ? (
									<div className="mt-2 text-sm text-muted-foreground">
										Campaign: {row.campaign.name}
									</div>
								) : null}
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
