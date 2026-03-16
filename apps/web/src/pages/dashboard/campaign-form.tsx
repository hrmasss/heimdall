import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
	AdminFormField,
	AdminFormGrid,
	AdminFormPage,
	AdminFormSection,
	adminInputClassName,
	adminSelectTriggerClassName,
	adminTextareaClassName,
} from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	CampaignDetail,
	PostSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const paidChannelOptions = [
	{
		value: "meta_ads",
		label: "Meta Ads",
		description: "Facebook and Instagram campaigns",
	},
	{
		value: "google_ads",
		label: "Google Ads",
		description: "Search, display, and YouTube campaigns",
	},
	{
		value: "linkedin_ads",
		label: "LinkedIn Ads",
		description: "Sponsored posts and B2B campaigns",
	},
	{
		value: "tiktok_ads",
		label: "TikTok Ads",
		description: "Short-form video promotions",
	},
	{
		value: "other",
		label: "Other",
		description: "Any paid channel not listed above",
	},
] as const;

function formatMoneyInput(value?: number) {
	return value === undefined ? "" : (value / 100).toFixed(2);
}

function parseMoneyInput(value: string) {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}
	const parsed = Number(trimmed);
	if (Number.isNaN(parsed) || parsed < 0) {
		throw new Error("Money fields must be valid positive numbers.");
	}
	return Math.round(parsed * 100);
}

function formatPostConflict(post: PostSummary, campaignId: string | null) {
	return post.campaign && post.campaign.id !== campaignId
		? post.campaign.name
		: "";
}

export function DashboardCampaignFormPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const isEditMode = Boolean(id);
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [posts, setPosts] = useState<PostSummary[]>([]);
	const [name, setName] = useState("");
	const [status, setStatus] = useState<CampaignDetail["status"]>("draft");
	const [objective, setObjective] = useState("");
	const [targetAudience, setTargetAudience] = useState("");
	const [messageTheme, setMessageTheme] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [notes, setNotes] = useState("");
	const [primaryMetricLabel, setPrimaryMetricLabel] = useState("");
	const [primaryMetricTarget, setPrimaryMetricTarget] = useState("");
	const [primaryMetricUnit, setPrimaryMetricUnit] = useState("");
	const [paidChannels, setPaidChannels] = useState<string[]>([]);
	const [budgetAmount, setBudgetAmount] = useState("");
	const [actualSpendAmount, setActualSpendAmount] = useState("");
	const [currencyCode, setCurrencyCode] = useState("USD");
	const [utmCampaign, setUtmCampaign] = useState("");
	const [externalDashboardUrl, setExternalDashboardUrl] = useState("");
	const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedPosts = useMemo(
		() => posts.filter((post) => selectedPostIds.includes(post.id)),
		[posts, selectedPostIds],
	);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadForm() {
			setLoading(true);
			setError(null);
			try {
				const [postResponse, campaignResponse] = await Promise.all([
					customerRequest<ApiListResponse<PostSummary>>("/posts"),
					isEditMode && id
						? customerRequest<CampaignDetail>(`/campaigns/${id}`)
						: Promise.resolve(null),
				]);
				if (cancelled) {
					return;
				}
				setPosts(postResponse.items);
				if (campaignResponse) {
					setName(campaignResponse.name);
					setStatus(campaignResponse.status);
					setObjective(campaignResponse.objective ?? "");
					setTargetAudience(campaignResponse.targetAudience ?? "");
					setMessageTheme(campaignResponse.messageTheme ?? "");
					setStartDate(campaignResponse.startDate);
					setEndDate(campaignResponse.endDate);
					setNotes(campaignResponse.notes ?? "");
					setPrimaryMetricLabel(campaignResponse.primaryMetricLabel ?? "");
					setPrimaryMetricTarget(
						campaignResponse.primaryMetricTarget?.toString() ?? "",
					);
					setPrimaryMetricUnit(campaignResponse.primaryMetricUnit ?? "");
					setPaidChannels(campaignResponse.paidChannels ?? []);
					setBudgetAmount(formatMoneyInput(campaignResponse.budgetAmountCents));
					setActualSpendAmount(
						formatMoneyInput(campaignResponse.actualSpendAmountCents),
					);
					setCurrencyCode(campaignResponse.currencyCode || "USD");
					setUtmCampaign(campaignResponse.utmCampaign ?? "");
					setExternalDashboardUrl(campaignResponse.externalDashboardUrl ?? "");
					setSelectedPostIds(
						campaignResponse.linkedPosts.map((post) => post.id),
					);
				} else {
					const today = new Date().toISOString().slice(0, 10);
					setStartDate(today);
					setEndDate(today);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load the campaign editor.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadForm();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest, id, isEditMode]);

	function togglePaidChannel(channel: string, checked: boolean) {
		setPaidChannels((current) =>
			checked
				? [...current, channel].sort()
				: current.filter((item) => item !== channel),
		);
	}

	function togglePost(postId: string, checked: boolean) {
		setSelectedPostIds((current) =>
			checked
				? [...current, postId]
				: current.filter((existing) => existing !== postId),
		);
	}

	async function saveCampaign() {
		setSaving(true);
		setError(null);
		try {
			const body = {
				name,
				status,
				objective,
				targetAudience,
				messageTheme,
				startDate,
				endDate,
				notes,
				primaryMetricLabel,
				primaryMetricTarget: primaryMetricTarget.trim()
					? Number(primaryMetricTarget)
					: undefined,
				primaryMetricUnit,
				paidChannels,
				budgetAmountCents: parseMoneyInput(budgetAmount),
				actualSpendAmountCents: parseMoneyInput(actualSpendAmount),
				currencyCode,
				utmCampaign,
				externalDashboardUrl,
				postIds: selectedPostIds,
			};
			const response =
				isEditMode && id
					? await customerRequest<CampaignDetail>(`/campaigns/${id}`, {
							method: "PATCH",
							body,
						})
					: await customerRequest<CampaignDetail>("/campaigns", {
							method: "POST",
							body,
						});
			navigate(`/dashboard/campaigns/${response.id}`);
		} catch (saveError) {
			setError(
				saveError instanceof Error
					? saveError.message
					: "Unable to save this campaign.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminFormPage
			eyebrow="Campaign planning"
			title={isEditMode ? "Edit campaign" : "Create campaign"}
			description="Capture the brief, timing, measurement, and linked-post context behind a campaign so it stays visible across posts and calendar views."
			actions={
				<>
					<Button variant="outline" className="rounded-full" asChild>
						<Link
							to={
								isEditMode && id
									? `/dashboard/campaigns/${id}`
									: "/dashboard/campaigns"
							}
						>
							<ArrowLeft className="size-4" />
							Back
						</Link>
					</Button>
					<Button
						className="rounded-full bg-gradient-brand border-0 text-white"
						onClick={() => void saveCampaign()}
						disabled={loading || saving}
					>
						{saving ? (
							<LoaderCircle className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
						Save campaign
					</Button>
				</>
			}
			aside={
				<div className="space-y-6 xl:sticky xl:top-24">
					<SurfaceCard className="space-y-4 p-5">
						<div className="text-lg font-semibold">
							{name.trim() || "Untitled campaign"}
						</div>
						<div className="text-sm text-muted-foreground">
							{objective.trim() ||
								"Add an objective to give this campaign a clear purpose."}
						</div>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
							{selectedPosts.length} linked post
							{selectedPosts.length === 1 ? "" : "s"} selected
						</div>
					</SurfaceCard>
				</div>
			}
		>
			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<AdminFormSection
				title="Campaign brief"
				description="Keep the goal, audience, and message direction visible wherever this campaign appears."
			>
				<AdminFormGrid>
					<AdminFormField className="md:col-span-2">
						<Label htmlFor="campaign-name">Campaign name</Label>
						<Input
							id="campaign-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							className={adminInputClassName}
							placeholder="Q3 launch runway"
						/>
					</AdminFormField>
					<AdminFormField className="md:col-span-2">
						<Label htmlFor="campaign-objective">Objective</Label>
						<Textarea
							id="campaign-objective"
							value={objective}
							onChange={(event) => setObjective(event.target.value)}
							className={adminTextareaClassName}
							placeholder="Drive signups for the new feature release across social and paid distribution."
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="campaign-audience">Target audience</Label>
						<Input
							id="campaign-audience"
							value={targetAudience}
							onChange={(event) => setTargetAudience(event.target.value)}
							className={adminInputClassName}
							placeholder="Mid-market SaaS operators"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="campaign-theme">Message/theme</Label>
						<Input
							id="campaign-theme"
							value={messageTheme}
							onChange={(event) => setMessageTheme(event.target.value)}
							className={adminInputClassName}
							placeholder="Clearer systems, faster launches"
						/>
					</AdminFormField>
					<AdminFormField className="md:col-span-2">
						<Label htmlFor="campaign-notes">Campaign notes</Label>
						<Textarea
							id="campaign-notes"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							className={adminTextareaClassName}
							placeholder="Any cross-functional context, reminders, or caveats."
						/>
					</AdminFormField>
				</AdminFormGrid>
			</AdminFormSection>

			<AdminFormSection
				title="Timing and measurement"
				description="Campaigns use inclusive date windows while linked posts keep their own exact publish times."
			>
				<AdminFormGrid>
					<AdminFormField>
						<Label>Status</Label>
						<Select
							value={status}
							onValueChange={(value) =>
								setStatus(value as CampaignDetail["status"])
							}
						>
							<SelectTrigger className={adminSelectTriggerClassName}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="draft">Draft</SelectItem>
								<SelectItem value="planned">Planned</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="completed">Completed</SelectItem>
								<SelectItem value="archived">Archived</SelectItem>
							</SelectContent>
						</Select>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="campaign-start">Start date</Label>
						<Input
							id="campaign-start"
							type="date"
							value={startDate}
							onChange={(event) => setStartDate(event.target.value)}
							className={adminInputClassName}
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="campaign-end">End date</Label>
						<Input
							id="campaign-end"
							type="date"
							value={endDate}
							onChange={(event) => setEndDate(event.target.value)}
							className={adminInputClassName}
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="primary-metric-label">Primary metric label</Label>
						<Input
							id="primary-metric-label"
							value={primaryMetricLabel}
							onChange={(event) => setPrimaryMetricLabel(event.target.value)}
							className={adminInputClassName}
							placeholder="Signups"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="primary-metric-target">Primary metric target</Label>
						<Input
							id="primary-metric-target"
							type="number"
							value={primaryMetricTarget}
							onChange={(event) => setPrimaryMetricTarget(event.target.value)}
							className={adminInputClassName}
							placeholder="1200"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="primary-metric-unit">Metric unit</Label>
						<Input
							id="primary-metric-unit"
							value={primaryMetricUnit}
							onChange={(event) => setPrimaryMetricUnit(event.target.value)}
							className={adminInputClassName}
							placeholder="count"
						/>
					</AdminFormField>
				</AdminFormGrid>
			</AdminFormSection>

			<AdminFormSection
				title="Paid tracking"
				description="Keep the ad context lightweight until platform integrations arrive."
			>
				<AdminFormGrid>
					<AdminFormField className="md:col-span-2">
						<Label>Paid channels</Label>
						<div className="grid gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 md:grid-cols-2">
							{paidChannelOptions.map((channel) => (
								<div key={channel.value} className="flex items-start gap-3">
									<Checkbox
										checked={paidChannels.includes(channel.value)}
										onCheckedChange={(checked) =>
											togglePaidChannel(channel.value, Boolean(checked))
										}
										className="mt-0.5"
									/>
									<div className="space-y-1">
										<div className="text-sm font-medium">{channel.label}</div>
										<div className="text-xs text-muted-foreground">
											{channel.description}
										</div>
									</div>
								</div>
							))}
						</div>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="budget-amount">Budget</Label>
						<Input
							id="budget-amount"
							type="number"
							step="0.01"
							value={budgetAmount}
							onChange={(event) => setBudgetAmount(event.target.value)}
							className={adminInputClassName}
							placeholder="0.00"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="actual-spend">Actual spend</Label>
						<Input
							id="actual-spend"
							type="number"
							step="0.01"
							value={actualSpendAmount}
							onChange={(event) => setActualSpendAmount(event.target.value)}
							className={adminInputClassName}
							placeholder="0.00"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="currency-code">Currency code</Label>
						<Input
							id="currency-code"
							value={currencyCode}
							onChange={(event) =>
								setCurrencyCode(event.target.value.toUpperCase())
							}
							className={adminInputClassName}
							placeholder="USD"
						/>
					</AdminFormField>
					<AdminFormField>
						<Label htmlFor="utm-campaign">UTM campaign</Label>
						<Input
							id="utm-campaign"
							value={utmCampaign}
							onChange={(event) => setUtmCampaign(event.target.value)}
							className={adminInputClassName}
							placeholder="q3-launch-runway"
						/>
					</AdminFormField>
					<AdminFormField className="md:col-span-2">
						<Label htmlFor="external-dashboard-url">
							External dashboard URL
						</Label>
						<Input
							id="external-dashboard-url"
							value={externalDashboardUrl}
							onChange={(event) => setExternalDashboardUrl(event.target.value)}
							className={adminInputClassName}
							placeholder="https://ads.example.com/report/123"
						/>
					</AdminFormField>
				</AdminFormGrid>
			</AdminFormSection>

			<AdminFormSection
				title="Linked posts"
				description="Posts linked here will show backlinks in tables, detail pages, and calendar cards."
			>
				<div className="space-y-3">
					{loading ? (
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
							Loading posts...
						</div>
					) : posts.length === 0 ? (
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
							No posts available yet.
						</div>
					) : (
						posts.map((post) => {
							const conflictCampaign = formatPostConflict(post, id ?? null);
							const checked = selectedPostIds.includes(post.id);
							return (
								<div
									key={post.id}
									className="flex items-start gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
								>
									<Checkbox
										checked={checked}
										disabled={Boolean(conflictCampaign)}
										onCheckedChange={(nextChecked) =>
											togglePost(post.id, Boolean(nextChecked))
										}
										aria-label={post.title}
									/>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<div className="font-medium">{post.title}</div>
											<Badge variant="outline" className="rounded-full">
												{post.contentKind}
											</Badge>
											{post.campaign ? (
												<Badge variant="outline" className="rounded-full">
													{post.campaign.name}
												</Badge>
											) : null}
										</div>
										<div className="mt-1 text-sm text-muted-foreground">
											{post.variantCount} variants ·{" "}
											{post.aggregatePublicationState}
										</div>
										{conflictCampaign ? (
											<div className="mt-2 text-sm text-amber-700">
												Already linked to {conflictCampaign}. Remove it there or
												from the post editor first.
											</div>
										) : null}
									</div>
								</div>
							);
						})
					)}
				</div>
			</AdminFormSection>
		</AdminFormPage>
	);
}
