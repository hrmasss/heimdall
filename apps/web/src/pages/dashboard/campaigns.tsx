import { Megaphone, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiListResponse, CampaignSummary } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { formatCampaignWindowLabel } from "@/lib/campaigns";

function statusClassName(value: CampaignSummary["status"]) {
	switch (value) {
		case "completed":
			return "pill pill-success";
		case "active":
		case "planned":
			return "pill pill-warning";
		case "archived":
			return "pill pill-muted";
		default:
			return "pill pill-info";
	}
}

function formatDateRange(campaign: CampaignSummary) {
	return formatCampaignWindowLabel(campaign);
}

function formatMetricTarget(campaign: CampaignSummary) {
	if (!campaign.primaryMetricLabel) {
		return "No target";
	}
	if (campaign.primaryMetricTarget === undefined) {
		return campaign.primaryMetricLabel;
	}
	return `${campaign.primaryMetricLabel}: ${campaign.primaryMetricTarget.toLocaleString()}${campaign.primaryMetricUnit ? ` ${campaign.primaryMetricUnit}` : ""}`;
}

function formatPaidSummary(campaign: CampaignSummary) {
	const parts: string[] = [];
	if (campaign.paidChannels.length > 0) {
		parts.push(campaign.paidChannels.join(", "));
	}
	if (campaign.actualSpendAmountCents !== undefined) {
		const amount = campaign.actualSpendAmountCents / 100;
		parts.push(
			new Intl.NumberFormat(undefined, {
				style: campaign.currencyCode ? "currency" : "decimal",
				currency: campaign.currencyCode || undefined,
				maximumFractionDigits: 2,
			}).format(amount),
		);
	}
	return parts.length > 0 ? parts.join(" · ") : "No paid tracking";
}

function formatSetupSummary(campaign: CampaignSummary) {
	const parts = [
		`${campaign.deliveryTargetCount} target${campaign.deliveryTargetCount === 1 ? "" : "s"}`,
		`${campaign.scheduleRuleCount} rule${campaign.scheduleRuleCount === 1 ? "" : "s"}`,
	];
	if (!campaign.automationReadiness.ready && campaign.automationReadiness.issues.length > 0) {
		parts.push("Needs setup");
	}
	return parts.join(" · ");
}

const columns: DataTableColumn<CampaignSummary>[] = [
	{
		id: "campaign",
		label: "Campaign",
		width: 300,
		accessor: (row) => (
			<div>
				<div className="font-medium">{row.name}</div>
				<div className="mt-1 text-xs text-muted-foreground">
					{row.objective?.trim() || "No objective yet"}
				</div>
			</div>
		),
		getSortValue: (row) => row.name,
	},
	{
		id: "status",
		label: "Status",
		width: 140,
		accessor: (row) => (
			<span className={statusClassName(row.status)}>{row.status}</span>
		),
		getSortValue: (row) => row.status,
	},
	{
		id: "window",
		label: "Window",
		width: 220,
		accessor: (row) => formatDateRange(row),
		getSortValue: (row) => row.startDate,
	},
	{
		id: "posts",
		label: "Linked posts",
		width: 140,
		accessor: (row) => row.postCount.toLocaleString(),
		getSortValue: (row) => row.postCount,
	},
	{
		id: "setup",
		label: "Automation setup",
		width: 220,
		accessor: (row) => formatSetupSummary(row),
		getSortValue: (row) => row.scheduleRuleCount,
	},
	{
		id: "metric",
		label: "Primary target",
		width: 220,
		accessor: (row) => formatMetricTarget(row),
		getSortValue: (row) => row.primaryMetricTarget ?? 0,
	},
	{
		id: "paid",
		label: "Paid tracking",
		width: 220,
		accessor: (row) => formatPaidSummary(row),
		getSortValue: (row) => row.actualSpendAmountCents ?? 0,
	},
];

export function DashboardCampaigns() {
	const navigate = useNavigate();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}
		let cancelled = false;
		async function loadCampaigns() {
			setLoading(true);
			setError(null);
			try {
				const response =
					await customerRequest<ApiListResponse<CampaignSummary>>("/campaigns");
				if (!cancelled) {
					setCampaigns(response.items);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load campaigns.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadCampaigns();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest]);

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Campaign planning"
				title="Campaigns"
				description="Plan goal-based windows, keep posts tied back to the campaign they support, and carry lightweight paid tracking without waiting on ad-platform integrations."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/automations">
								<Sparkles className="size-4" />
								Plan campaign
							</Link>
						</Button>
						<Button
							className="rounded-full bg-gradient-brand border-0 text-white"
							asChild
						>
							<Link to="/dashboard/campaigns/new">
								<Plus className="size-4" />
								New campaign
							</Link>
						</Button>
					</>
				}
			/>

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Campaign queue"
					description="Open any campaign to inspect its brief, active window, linked posts, and campaign-level tracking."
					storageKey="dashboard-campaigns-table"
					rows={campaigns}
					columns={columns}
					getRowId={(row) => row.id}
					getSearchText={(row) =>
						[
							row.name,
							row.objective,
							row.targetAudience,
							row.messageTheme,
							row.status,
							row.paidChannels.join(" "),
						]
							.filter(Boolean)
							.join(" ")
					}
					filters={[
						{
							id: "status",
							label: "Status",
							options: [
								"draft",
								"planned",
								"active",
								"completed",
								"archived",
							].map((value) => ({ label: value, value })),
							getValue: (row) => row.status,
						},
						{
							id: "paid",
							label: "Paid channel",
							options: Array.from(
								new Set(campaigns.flatMap((campaign) => campaign.paidChannels)),
							).map((value) => ({ label: value, value })),
							getValue: (row) => row.paidChannels[0] ?? "",
						},
					]}
					emptyState={{
						title: "No campaigns yet",
						description:
							"Create a campaign to define the objective, date window, audience, and linked posts behind a coordinated launch.",
						actionLabel: "Create campaign",
						onAction: () => navigate("/dashboard/campaigns/new"),
					}}
					loading={loading}
					error={error}
					onRowClick={(row) => navigate(`/dashboard/campaigns/${row.id}`)}
					renderGridCard={(row) => (
						<div className="space-y-4">
							<div>
								<div className="text-lg font-medium">{row.name}</div>
								<div className="mt-1 text-sm text-muted-foreground">
									{row.objective?.trim() || "No objective yet"}
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<span className={statusClassName(row.status)}>
									{row.status}
								</span>
								<Badge variant="outline" className="rounded-full">
									{row.postCount} posts
								</Badge>
							</div>
				<div className="text-sm text-muted-foreground">
					{formatDateRange(row)}
				</div>
				<div className="text-sm text-muted-foreground">
					{formatSetupSummary(row)}
				</div>
				<div className="text-sm text-muted-foreground">
					{formatPaidSummary(row)}
				</div>
			</div>
					)}
				/>
			</SurfaceCard>

			<SurfaceCard className="rounded-[28px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(195,123,79,0.14),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.76))] p-5">
				<div className="flex items-start gap-3">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Megaphone className="size-5" />
					</div>
					<div>
						<div className="font-medium">
							Manual paid tracking stays intentionally light.
						</div>
						<div className="mt-2 text-sm text-muted-foreground">
							Campaigns can store budget, spend, paid channels, UTM naming, and
							an external dashboard link, while post KPI rollups continue to
							come from linked organic or published content.
						</div>
					</div>
				</div>
			</SurfaceCard>
		</div>
	);
}
