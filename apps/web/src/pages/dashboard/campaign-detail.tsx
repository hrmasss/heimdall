import {
	AlertTriangle,
	ArrowLeft,
	BadgeDollarSign,
	CalendarRange,
	Clock3,
	Link2,
	Megaphone,
	PencilLine,
	Target,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CampaignDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { formatCampaignWindowLabel } from "@/lib/campaigns";
import { formatPlatformLabel, platformIcon } from "@/lib/platforms";

function formatCurrency(campaign: CampaignDetail, cents?: number) {
	if (cents === undefined) {
		return "Not set";
	}
	const amount = cents / 100;
	if (!campaign.currencyCode) {
		return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
	}
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: campaign.currencyCode,
		maximumFractionDigits: 2,
	}).format(amount);
}

function statusClassName(value: CampaignDetail["status"]) {
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

function formatMetricTarget(campaign: CampaignDetail) {
	if (!campaign.primaryMetricLabel) {
		return "Not set";
	}
	const pieces = [campaign.primaryMetricLabel];
	if (campaign.primaryMetricTarget !== undefined) {
		pieces.push(campaign.primaryMetricTarget.toLocaleString());
	}
	if (campaign.primaryMetricUnit) {
		pieces.push(campaign.primaryMetricUnit);
	}
	return pieces.join(" · ");
}

function formatRuleWindow(rule: Pick<CampaignDetail["scheduleRules"][number], "startDate" | "endDate">) {
	if (rule.startDate && rule.endDate) {
		return `${rule.startDate} to ${rule.endDate}`;
	}
	if (rule.startDate) {
		return `Starts ${rule.startDate}`;
	}
	if (rule.endDate) {
		return `Until ${rule.endDate}`;
	}
	return "Uses campaign window";
}

function SummaryCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: typeof Megaphone;
}) {
	return (
		<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
			<div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
				<Icon className="size-3.5" />
				{label}
			</div>
			<div className="mt-2 text-base font-medium">{value}</div>
		</div>
	);
}

export function DashboardCampaignDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const metricSummary = useMemo(() => {
		if (!campaign || campaign.metricSnapshot.length === 0) {
			return [];
		}
		return campaign.metricSnapshot.slice(0, 4);
	}, [campaign]);

	const loadCampaign = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const response = await customerRequest<CampaignDetail>(`/campaigns/${id}`);
			setCampaign(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this campaign.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest, id]);

	useEffect(() => {
		void loadCampaign();
	}, [loadCampaign]);

	async function deleteCampaign() {
		if (!campaign) {
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await customerRequest(`/campaigns/${campaign.id}`, { method: "DELETE" });
			navigate("/dashboard/campaigns");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this campaign.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Campaign planning"
				title={campaign?.name ?? "Campaign detail"}
				description="Inspect the brief, delivery setup, cadence intent, linked post work, and paid-tracking context in one place."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/campaigns">
								<ArrowLeft className="size-4" />
								Back
							</Link>
						</Button>
						{campaign ? (
							<Button variant="outline" className="rounded-full" asChild>
								<Link to={`/dashboard/campaigns/${campaign.id}/edit`}>
									<PencilLine className="size-4" />
									Edit
								</Link>
							</Button>
						) : null}
						{campaign ? (
							<Button
								variant="outline"
								className="rounded-full text-red-600"
								onClick={() => void deleteCampaign()}
								disabled={saving}
							>
								<Trash2 className="size-4" />
								Delete
							</Button>
						) : null}
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			{loading || !campaign ? (
				<SurfaceCard className="p-5 text-sm text-muted-foreground">
					Loading campaign details...
				</SurfaceCard>
			) : (
				<>
					<SurfaceCard className="space-y-5 p-5 md:p-6">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div className="space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className={statusClassName(campaign.status)}>
										{campaign.status}
									</span>
									<Badge variant="outline" className="rounded-full">
										{campaign.postCount} linked posts
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{campaign.deliveryTargetCount} delivery target
										{campaign.deliveryTargetCount === 1 ? "" : "s"}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{campaign.scheduleRuleCount} cadence rule
										{campaign.scheduleRuleCount === 1 ? "" : "s"}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{formatCampaignWindowLabel(campaign)}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{campaign.automationReadiness.ready
											? "Automation ready"
											: "Automation needs setup"}
									</Badge>
								</div>
								<div className="max-w-3xl text-sm text-muted-foreground">
									{campaign.objective?.trim()
										? campaign.objective
										: "No objective recorded yet."}
								</div>
							</div>
							{campaign.externalDashboardUrl ? (
								<Button variant="outline" className="rounded-full" asChild>
									<a
										href={campaign.externalDashboardUrl}
										target="_blank"
										rel="noreferrer"
									>
										<Link2 className="size-4" />
										Open external dashboard
									</a>
								</Button>
							) : null}
						</div>

						<div className="grid gap-3 md:grid-cols-4">
							<SummaryCard
								label="Audience"
								value={campaign.targetAudience || "Not set"}
								icon={Target}
							/>
							<SummaryCard
								label="Message theme"
								value={campaign.messageTheme || "Not set"}
								icon={Megaphone}
							/>
							<SummaryCard
								label="Budget"
								value={formatCurrency(campaign, campaign.budgetAmountCents)}
								icon={BadgeDollarSign}
							/>
							<SummaryCard
								label="Actual spend"
								value={formatCurrency(
									campaign,
									campaign.actualSpendAmountCents,
								)}
								icon={BadgeDollarSign}
							/>
						</div>
					</SurfaceCard>

					<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
						<div className="space-y-6">
							<SurfaceCard className="p-5 md:p-6">
								<div className="space-y-1">
									<h2 className="text-lg font-semibold tracking-tight">
										Delivery targets
									</h2>
									<p className="text-sm text-muted-foreground">
										These exact connected targets are attached to the campaign
										for future workflow-based automation.
									</p>
								</div>
								<div className="mt-5 space-y-3">
									{campaign.deliveryTargets.length === 0 ? (
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No delivery targets configured yet.
										</div>
									) : (
										campaign.deliveryTargets.map((target) => (
											<div
												key={target.id}
												className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
											>
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div className="flex min-w-0 items-center gap-3">
														{platformIcon(target.provider)}
														<div className="min-w-0">
															<div className="font-medium">
																{target.displayName}
															</div>
															<div className="mt-1 text-sm text-muted-foreground">
																{formatPlatformLabel(target.provider)} ·{" "}
																{target.targetType.replaceAll("_", " ")}
																{target.username ? ` · @${target.username}` : ""}
															</div>
														</div>
													</div>
													<div className="flex flex-wrap gap-2">
														<Badge variant="outline" className="rounded-full">
															{target.status}
														</Badge>
														<Badge variant="outline" className="rounded-full">
															{target.isSelected
																? "Active target"
																: "Not selected"}
														</Badge>
													</div>
												</div>
											</div>
										))
									)}
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5 md:p-6">
								<div className="space-y-1">
									<h2 className="text-lg font-semibold tracking-tight">
										Posting cadence
									</h2>
									<p className="text-sm text-muted-foreground">
										Structured campaign-level schedule intent that future
										automation can consume without changing current post-level
										scheduling.
									</p>
								</div>
								<div className="mt-5 space-y-3">
									{campaign.scheduleRules.length === 0 ? (
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No cadence rules configured yet.
										</div>
									) : (
										campaign.scheduleRules.map((rule) => {
											const target = campaign.deliveryTargets.find(
												(item) => item.socialTargetId === rule.socialTargetId,
											);
											return (
												<div
													key={rule.id}
													className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
												>
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div>
															<div className="font-medium">
																{target?.displayName ?? "Attached target"}
															</div>
															<div className="mt-1 text-sm text-muted-foreground">
																{rule.summary}
															</div>
														</div>
														<div className="flex flex-wrap gap-2">
															<Badge variant="outline" className="rounded-full">
																{rule.enabled ? "Enabled" : "Disabled"}
															</Badge>
															<Badge variant="outline" className="rounded-full">
																{formatRuleWindow(rule)}
															</Badge>
														</div>
													</div>
												</div>
											);
										})
									)}
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5 md:p-6">
								<div className="space-y-1">
									<h2 className="text-lg font-semibold tracking-tight">
										Linked posts
									</h2>
									<p className="text-sm text-muted-foreground">
										Optional manual posts already associated with this campaign.
										Their existing scheduling behavior remains unchanged.
									</p>
								</div>
								<div className="mt-5 space-y-3">
									{campaign.linkedPosts.length === 0 ? (
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No posts linked yet.
										</div>
									) : (
										campaign.linkedPosts.map((post) => (
											<Link
												key={post.id}
												to={`/dashboard/posts/${post.id}`}
												className="block rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 transition-colors hover:bg-accent/35"
											>
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div>
														<div className="font-medium">{post.title}</div>
														<div className="mt-1 text-sm text-muted-foreground">
															{post.contentKind} · {post.variantCount} variants
														</div>
													</div>
													<div className="flex flex-wrap gap-2">
														<Badge variant="outline" className="rounded-full">
															{post.aggregateApprovalState}
														</Badge>
														<Badge variant="outline" className="rounded-full">
															{post.aggregatePublicationState}
														</Badge>
													</div>
												</div>
											</Link>
										))
									)}
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5 md:p-6">
								<div className="space-y-1">
									<h2 className="text-lg font-semibold tracking-tight">
										Campaign notes
									</h2>
									<p className="text-sm text-muted-foreground">
										Working context for the campaign outside the post-level
										notes.
									</p>
								</div>
								<div className="mt-5 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
									{campaign.notes?.trim()
										? campaign.notes
										: "No campaign notes yet."}
								</div>
							</SurfaceCard>
						</div>

						<div className="space-y-6">
							<SurfaceCard className="p-5">
								<div className="flex items-center gap-2">
									<CalendarRange className="size-4 text-primary" />
									<div className="text-lg font-semibold">Timing and setup</div>
								</div>
								<div className="mt-4 space-y-3">
									<SummaryCard
										label="Window"
										value={formatCampaignWindowLabel(campaign)}
										icon={CalendarRange}
									/>
									<SummaryCard
										label="Campaign timezone"
										value={campaign.defaultTimezone}
										icon={Clock3}
									/>
									<SummaryCard
										label="Primary metric"
										value={formatMetricTarget(campaign)}
										icon={Target}
									/>
									<SummaryCard
										label="UTM campaign"
										value={campaign.utmCampaign || "Not set"}
										icon={Link2}
									/>
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5">
								<div className="flex items-center gap-2">
									<AlertTriangle className="size-4 text-primary" />
									<div className="text-lg font-semibold">
										Automation readiness
									</div>
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									This checks whether the campaign has the core target and
									cadence setup future workflows will expect.
								</div>
								<div className="mt-4 space-y-3">
									<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm">
										<span className={statusClassName(campaign.status)}>
											{campaign.automationReadiness.ready
												? "Ready"
												: "Needs setup"}
										</span>
									</div>
									{campaign.automationReadiness.issues.length === 0 ? (
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No blocking issues detected.
										</div>
									) : (
										campaign.automationReadiness.issues.map((issue) => (
											<div
												key={issue}
												className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900"
											>
												{issue}
											</div>
										))
									)}
									{campaign.automationReadiness.warnings.map((warning) => (
										<div
											key={warning}
											className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground"
										>
											{warning}
										</div>
									))}
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5">
								<div className="text-lg font-semibold">Derived KPI rollups</div>
								<div className="mt-2 text-sm text-muted-foreground">
									These are aggregated from linked post metric snapshots already
									stored in Heimdall.
								</div>
								<div className="mt-4 space-y-3">
									{metricSummary.length === 0 ? (
										<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No linked post metrics yet.
										</div>
									) : (
										metricSummary.map((metric) => (
											<div
												key={metric.code}
												className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
											>
												<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
													{metric.label}
												</div>
												<div className="mt-2 text-lg font-semibold">
													{metric.value.toLocaleString()}
													{metric.unit ? ` ${metric.unit}` : ""}
												</div>
											</div>
										))
									)}
								</div>
							</SurfaceCard>

							<SurfaceCard className="p-5">
								<div className="text-lg font-semibold">Paid tracking</div>
								<div className="mt-4 flex flex-wrap gap-2">
									{campaign.paidChannels.length > 0 ? (
										campaign.paidChannels.map((channel) => (
											<Badge
												key={channel}
												variant="outline"
												className="rounded-full"
											>
												{channel}
											</Badge>
										))
									) : (
										<Badge variant="outline" className="rounded-full">
											No paid channels
										</Badge>
									)}
								</div>
							</SurfaceCard>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
