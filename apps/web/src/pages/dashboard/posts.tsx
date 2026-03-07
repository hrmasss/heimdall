import {
	Archive,
	ArrowUpDown,
	Copy,
	Download,
	Eye,
	FilePlus2,
	MoreHorizontal,
	Send,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";

type PostRecord = {
	id: string;
	campaign: string;
	platform: string;
	status: "Draft" | "Review" | "Scheduled" | "Blocked";
	owner: string;
	scheduledAt: string;
	scheduledSort: number;
	reach: string;
	assetCount: number;
	note: string;
};

const rows: PostRecord[] = [
	{
		id: "post-001",
		campaign: "Spring narrative refresh",
		platform: "LinkedIn",
		status: "Review",
		owner: "Rina Morales",
		scheduledAt: "Mar 10, 09:30",
		scheduledSort: 202603100930,
		reach: "420K",
		assetCount: 4,
		note: "Waiting on legal note for final caption.",
	},
	{
		id: "post-002",
		campaign: "Founder memo thread",
		platform: "X",
		status: "Scheduled",
		owner: "Imran Ali",
		scheduledAt: "Mar 10, 14:00",
		scheduledSort: 202603101400,
		reach: "1.3M",
		assetCount: 1,
		note: "Cross-post to executive accounts enabled.",
	},
	{
		id: "post-003",
		campaign: "Retail teaser reel",
		platform: "Instagram",
		status: "Blocked",
		owner: "Pia Sorensen",
		scheduledAt: "Mar 11, 11:00",
		scheduledSort: 202603111100,
		reach: "640K",
		assetCount: 6,
		note: "Replacement B-roll still pending upload.",
	},
	{
		id: "post-004",
		campaign: "Customer proof carousel",
		platform: "Instagram",
		status: "Draft",
		owner: "Noa Carter",
		scheduledAt: "Mar 12, 09:00",
		scheduledSort: 202603120900,
		reach: "280K",
		assetCount: 8,
		note: "Needs third slide typography cleanup.",
	},
	{
		id: "post-005",
		campaign: "Analyst briefing recap",
		platform: "LinkedIn",
		status: "Scheduled",
		owner: "Jon Osei",
		scheduledAt: "Mar 12, 15:30",
		scheduledSort: 202603121530,
		reach: "320K",
		assetCount: 2,
		note: "Localized variants generated for EMEA.",
	},
	{
		id: "post-006",
		campaign: "Partner launch checklist",
		platform: "Facebook",
		status: "Review",
		owner: "Maya Ross",
		scheduledAt: "Mar 13, 08:45",
		scheduledSort: 202603130845,
		reach: "160K",
		assetCount: 3,
		note: "Waiting on reseller list confirmation.",
	},
	{
		id: "post-007",
		campaign: "Quarterly benchmark report",
		platform: "LinkedIn",
		status: "Draft",
		owner: "Daniel Osei",
		scheduledAt: "Mar 13, 13:15",
		scheduledSort: 202603131315,
		reach: "580K",
		assetCount: 5,
		note: "Draft copy approved, design pass still open.",
	},
	{
		id: "post-008",
		campaign: "Community AMA promo",
		platform: "X",
		status: "Scheduled",
		owner: "Leah Brooks",
		scheduledAt: "Mar 14, 10:00",
		scheduledSort: 202603141000,
		reach: "225K",
		assetCount: 2,
		note: "Pinned tweet automation already attached.",
	},
];

function StatusPill({ status }: { status: PostRecord["status"] }) {
	const className =
		status === "Scheduled"
			? "pill pill-success"
			: status === "Review"
				? "pill pill-warning"
				: status === "Blocked"
					? "pill pill-error"
					: "pill pill-muted";

	return <span className={className}>{status}</span>;
}

const columns: DataTableColumn<PostRecord>[] = [
	{
		id: "campaign",
		label: "Campaign",
		width: 260,
		minWidth: 220,
		accessor: (row) => (
			<div>
				<div className="font-medium">{row.campaign}</div>
				<div className="mt-1 text-xs text-muted-foreground">{row.note}</div>
			</div>
		),
		getSortValue: (row) => row.campaign,
	},
	{
		id: "platform",
		label: "Platform",
		width: 130,
		accessor: (row) => row.platform,
		getSortValue: (row) => row.platform,
	},
	{
		id: "status",
		label: "Status",
		width: 140,
		accessor: (row) => <StatusPill status={row.status} />,
		getSortValue: (row) => row.status,
	},
	{
		id: "owner",
		label: "Owner",
		width: 180,
		accessor: (row) => row.owner,
		getSortValue: (row) => row.owner,
	},
	{
		id: "scheduledAt",
		label: "Scheduled",
		width: 160,
		accessor: (row) => row.scheduledAt,
		getSortValue: (row) => row.scheduledSort,
	},
	{
		id: "reach",
		label: "Projected reach",
		width: 140,
		accessor: (row) => row.reach,
		getSortValue: (row) => Number(row.reach.replace(/[^\d]/g, "")),
	},
	{
		id: "assets",
		label: "Assets",
		width: 110,
		accessor: (row) => `${row.assetCount} files`,
		getSortValue: (row) => row.assetCount,
	},
];

export function DashboardPosts() {
	const [previewState, setPreviewState] = useState<
		"ready" | "loading" | "error"
	>("ready");

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Operations table"
				title="Posts"
				description="A reusable data table for dense social operations work. Resize columns, reorder structure, switch to grid, and paginate from either edge."
				actions={
					<>
						<NativeSelect
							value={previewState}
							onChange={(event) =>
								setPreviewState(event.target.value as typeof previewState)
							}
						>
							<NativeSelectOption value="ready">
								Preview: Ready
							</NativeSelectOption>
							<NativeSelectOption value="loading">
								Preview: Loading
							</NativeSelectOption>
							<NativeSelectOption value="error">
								Preview: Error
							</NativeSelectOption>
						</NativeSelect>
						<Button variant="outline" className="rounded-full">
							<Download className="size-4" />
							Export
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

			<SurfaceCard tone="muted" className="grid gap-4 p-5 md:grid-cols-3">
				{[
					[
						"Rows can be reordered and resized",
						"Built into the header interactions for real operator workflows.",
					],
					[
						"Pagination lives top and bottom",
						"Page sizing stays accessible when the table is long or horizontally scrolled.",
					],
					[
						"List and grid use the same actions",
						"Responsive mode changes do not strip bulk actions or row controls.",
					],
				].map((item) => (
					<div
						key={item[0]}
						className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
					>
						<div className="font-medium">{item[0]}</div>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							{item[1]}
						</p>
					</div>
				))}
			</SurfaceCard>

			<SurfaceCard className="p-5 md:p-6">
				<DataTable
					title="Publishing queue"
					description="Use filters to isolate a launch, sort by risk, or switch to cards for visual review on smaller screens."
					rows={rows}
					columns={columns}
					getRowId={(row) => row.id}
					getSearchText={(row) =>
						[row.campaign, row.platform, row.owner, row.status, row.note].join(
							" ",
						)
					}
					filters={[
						{
							id: "platform",
							label: "Platform",
							options: ["LinkedIn", "X", "Instagram", "Facebook"].map(
								(value) => ({
									label: value,
									value,
								}),
							),
							getValue: (row) => row.platform,
						},
						{
							id: "status",
							label: "Status",
							options: ["Draft", "Review", "Scheduled", "Blocked"].map(
								(value) => ({
									label: value,
									value,
								}),
							),
							getValue: (row) => row.status,
						},
					]}
					globalActions={[
						{ label: "Sort presets", icon: ArrowUpDown, variant: "outline" },
						{ label: "Preview", icon: Eye, variant: "ghost" },
						{ label: "Bulk send", icon: Send, variant: "default" },
					]}
					rowActions={[
						{ label: "Preview post", icon: Eye },
						{ label: "Duplicate", icon: Copy },
						{ label: "Archive", icon: Archive, destructive: true },
					]}
					loading={previewState === "loading"}
					error={
						previewState === "error"
							? "The publishing queue could not be synced. Retry after the upstream content service responds."
							: null
					}
					emptyState={{
						title: "No posts match the current view",
						description:
							"Adjust filters, search terms, or table state to bring rows back into focus.",
						actionLabel: "Clear preview filters",
						onAction: () => setPreviewState("ready"),
					}}
					renderGridCard={(row) => (
						<div className="space-y-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-lg font-medium">{row.campaign}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{row.note}
									</div>
								</div>
								<StatusPill status={row.status} />
							</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Platform
									</div>
									<div className="mt-1">{row.platform}</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Owner
									</div>
									<div className="mt-1">{row.owner}</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Scheduled
									</div>
									<div className="mt-1">{row.scheduledAt}</div>
								</div>
								<div>
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Reach
									</div>
									<div className="mt-1">{row.reach}</div>
								</div>
							</div>
							<div className="flex items-center justify-between rounded-2xl border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm">
								<span>{row.assetCount} assets attached</span>
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
