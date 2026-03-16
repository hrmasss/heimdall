import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
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
	CampaignScheduleRule,
	PostSummary,
	SocialConnectionsResponse,
	SocialTargetRecord,
} from "@/lib/api-types";
import {
	campaignWeekdays,
	type CampaignRulePreset,
	detectCampaignRulePreset,
	summarizeCampaignRuleDraft,
} from "@/lib/campaigns";
import { useAuth } from "@/lib/auth-context";
import { formatPlatformLabel, platformIcon } from "@/lib/platforms";

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

type CampaignRuleDraft = Omit<CampaignScheduleRule, "id" | "summary"> & {
	id: string;
	preset: CampaignRulePreset;
};

const cadencePresetOptions: Array<{
	value: CampaignRulePreset;
	label: string;
	description: string;
}> = [
	{
		value: "daily",
		label: "Every day",
		description: "Post once every day in the morning.",
	},
	{
		value: "every_other_day",
		label: "Every other day",
		description: "Post every two days in the morning.",
	},
	{
		value: "weekdays",
		label: "Weekdays",
		description: "Post Monday through Friday in the morning.",
	},
	{
		value: "once_weekly",
		label: "Once weekly",
		description: "Post one day each week in the morning.",
	},
	{
		value: "twice_daily",
		label: "Twice daily",
		description: "Post every day in the morning and evening.",
	},
	{
		value: "custom",
		label: "Custom",
		description: "Set your own cadence, weekdays, and time slots.",
	},
] as const;

function browserTimezone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function applyPresetToDraft(
	rule: CampaignRuleDraft,
	preset: CampaignRulePreset,
): CampaignRuleDraft {
	switch (preset) {
		case "daily":
			return {
				...rule,
				preset,
				cadenceType: "daily_interval",
				interval: 1,
				weekdays: [],
				timesLocal: ["09:00"],
			};
		case "every_other_day":
			return {
				...rule,
				preset,
				cadenceType: "daily_interval",
				interval: 2,
				weekdays: [],
				timesLocal: ["09:00"],
			};
		case "weekdays":
			return {
				...rule,
				preset,
				cadenceType: "weekly",
				interval: 1,
				weekdays: ["mon", "tue", "wed", "thu", "fri"],
				timesLocal: ["09:00"],
			};
		case "once_weekly":
			return {
				...rule,
				preset,
				cadenceType: "weekly",
				interval: 1,
				weekdays: rule.weekdays.length ? [rule.weekdays[0]] : ["mon"],
				timesLocal: ["09:00"],
			};
		case "twice_daily":
			return {
				...rule,
				preset,
				cadenceType: "daily_interval",
				interval: 1,
				weekdays: [],
				timesLocal: ["09:00", "18:00"],
			};
		default:
			return { ...rule, preset };
	}
}

function createRuleDraft(
	socialTargetId: string,
	preset: CampaignRulePreset = "daily",
): CampaignRuleDraft {
	return applyPresetToDraft(
		{
			id: crypto.randomUUID(),
			socialTargetId,
			enabled: true,
			cadenceType: "daily_interval",
			interval: 1,
			weekdays: [],
			timesLocal: ["09:00"],
			startDate: "",
			endDate: "",
			preset,
		},
		preset,
	);
}

function mapRuleToDraft(rule: CampaignScheduleRule): CampaignRuleDraft {
	return {
		id: rule.id,
		socialTargetId: rule.socialTargetId,
		enabled: rule.enabled,
		cadenceType: rule.cadenceType,
		interval: rule.interval,
		weekdays: rule.weekdays,
		timesLocal: rule.timesLocal,
		startDate: rule.startDate ?? "",
		endDate: rule.endDate ?? "",
		preset: detectCampaignRulePreset(rule),
	};
}

export function DashboardCampaignFormPage() {
	const navigate = useNavigate();
	const { id } = useParams();
	const isEditMode = Boolean(id);
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [posts, setPosts] = useState<PostSummary[]>([]);
	const [socialTargets, setSocialTargets] = useState<SocialTargetRecord[]>([]);
	const [name, setName] = useState("");
	const [status, setStatus] = useState<CampaignDetail["status"]>("draft");
	const [objective, setObjective] = useState("");
	const [targetAudience, setTargetAudience] = useState("");
	const [messageTheme, setMessageTheme] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [defaultTimezone, setDefaultTimezone] = useState(browserTimezone());
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
	const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
	const [ruleDrafts, setRuleDrafts] = useState<CampaignRuleDraft[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const selectedPosts = useMemo(
		() => posts.filter((post) => selectedPostIds.includes(post.id)),
		[posts, selectedPostIds],
	);
	const selectedTargets = useMemo(
		() => socialTargets.filter((target) => selectedTargetIds.includes(target.id)),
		[socialTargets, selectedTargetIds],
	);
	const targetsByProvider = useMemo(() => {
		const groups = new Map<string, SocialTargetRecord[]>();
		for (const target of socialTargets) {
			const list = groups.get(target.provider) ?? [];
			list.push(target);
			groups.set(target.provider, list);
		}
		return Array.from(groups.entries()).sort(([left], [right]) =>
			left.localeCompare(right),
		);
	}, [socialTargets]);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadForm() {
			setLoading(true);
			setError(null);
			try {
				const [postResponse, socialResponse, campaignResponse] = await Promise.all([
					customerRequest<ApiListResponse<PostSummary>>("/posts"),
					customerRequest<SocialConnectionsResponse>("/social/connections"),
					isEditMode && id
						? customerRequest<CampaignDetail>(`/campaigns/${id}`)
						: Promise.resolve(null),
				]);
				if (cancelled) {
					return;
				}
				setPosts(postResponse.items);
				setSocialTargets(socialResponse.targets);
				if (campaignResponse) {
					setName(campaignResponse.name);
					setStatus(campaignResponse.status);
					setObjective(campaignResponse.objective ?? "");
					setTargetAudience(campaignResponse.targetAudience ?? "");
					setMessageTheme(campaignResponse.messageTheme ?? "");
					setStartDate(campaignResponse.startDate);
					setEndDate(campaignResponse.endDate ?? "");
					setDefaultTimezone(campaignResponse.defaultTimezone);
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
					setSelectedTargetIds(
						campaignResponse.deliveryTargets.map((target) => target.socialTargetId),
					);
					setRuleDrafts(campaignResponse.scheduleRules.map(mapRuleToDraft));
				} else {
					const today = new Date().toISOString().slice(0, 10);
					setStartDate(today);
					setEndDate("");
					setDefaultTimezone(browserTimezone());
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

	function toggleTarget(targetId: string, checked: boolean) {
		setSelectedTargetIds((current) =>
			checked
				? [...current, targetId].sort()
				: current.filter((existing) => existing !== targetId),
		);
		if (!checked) {
			setRuleDrafts((current) =>
				current.filter((rule) => rule.socialTargetId !== targetId),
			);
		}
	}

	function addRule(targetId: string, preset: CampaignRulePreset = "daily") {
		setRuleDrafts((current) => [...current, createRuleDraft(targetId, preset)]);
	}

	function updateRule(
		ruleId: string,
		updater: (rule: CampaignRuleDraft) => CampaignRuleDraft,
	) {
		setRuleDrafts((current) =>
			current.map((rule) => (rule.id === ruleId ? updater(rule) : rule)),
		);
	}

	function removeRule(ruleId: string) {
		setRuleDrafts((current) => current.filter((rule) => rule.id !== ruleId));
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
				endDate: endDate || undefined,
				defaultTimezone,
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
				deliveryTargets: selectedTargetIds.map((socialTargetId) => ({
					socialTargetId,
				})),
				scheduleRules: ruleDrafts.map((rule) => ({
					socialTargetId: rule.socialTargetId,
					enabled: rule.enabled,
					cadenceType: rule.cadenceType,
					interval: rule.interval,
					weekdays: rule.weekdays,
					timesLocal: rule.timesLocal.filter(Boolean),
					startDate: rule.startDate || undefined,
					endDate: rule.endDate || undefined,
				})),
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
			description="Capture the brief, automation-ready delivery setup, cadence rules, and optional manual post links behind this campaign."
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
						<div className="grid gap-3 text-sm text-muted-foreground">
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-3">
								{selectedPosts.length} linked post
								{selectedPosts.length === 1 ? "" : "s"}
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-3">
								{selectedTargetIds.length} delivery target
								{selectedTargetIds.length === 1 ? "" : "s"}
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-3">
								{ruleDrafts.length} cadence rule
								{ruleDrafts.length === 1 ? "" : "s"}
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/55 p-3">
								Timezone: {defaultTimezone || "UTC"}
							</div>
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
				description="Open-ended campaigns are supported now, and one campaign timezone keeps recurring cadences deterministic."
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
						<Label htmlFor="campaign-end">End date (optional)</Label>
						<Input
							id="campaign-end"
							type="date"
							value={endDate}
							onChange={(event) => setEndDate(event.target.value)}
							className={adminInputClassName}
						/>
					</AdminFormField>
					<AdminFormField className="md:col-span-2">
						<Label htmlFor="campaign-timezone">Campaign timezone</Label>
						<Input
							id="campaign-timezone"
							value={defaultTimezone}
							onChange={(event) => setDefaultTimezone(event.target.value)}
							className={adminInputClassName}
							placeholder="Asia/Dhaka"
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
				title="Delivery targets"
				description="Attach the exact connected pages, channels, or accounts this campaign should eventually automate against."
			>
				{socialTargets.length === 0 ? (
					<SurfaceCard className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] bg-background/55 p-5 text-sm text-muted-foreground">
						No connected targets yet. Connect a platform first so this campaign can be prepared for automation.
						<div className="mt-3">
							<Button variant="outline" className="rounded-full" asChild>
								<Link to="/dashboard/settings/platforms">
									Open platform connections
								</Link>
							</Button>
						</div>
					</SurfaceCard>
				) : (
					<div className="space-y-4">
						{targetsByProvider.map(([provider, targets]) => (
							<div key={provider} className="space-y-3">
								<div className="flex items-center gap-2 text-sm font-semibold">
									{platformIcon(provider)}
									{formatPlatformLabel(provider)}
								</div>
								<div className="grid gap-3 md:grid-cols-2">
									{targets.map((target) => (
										<div
											key={target.id}
											className="flex items-start gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
										>
											<Checkbox
												checked={selectedTargetIds.includes(target.id)}
												onCheckedChange={(checked) =>
													toggleTarget(target.id, Boolean(checked))
												}
												className="mt-0.5"
											/>
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<div className="font-medium">{target.displayName}</div>
													<Badge variant="outline" className="rounded-full">
														{target.targetType.replaceAll("_", " ")}
													</Badge>
													<Badge variant="outline" className="rounded-full">
														{target.status}
													</Badge>
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													{target.username ? `@${target.username} · ` : ""}
													{target.isSelected
														? "Currently selected in platform settings"
														: "Attached here, but not selected in platform settings"}
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</AdminFormSection>

			<AdminFormSection
				title="Posting cadence"
				description="Set reusable schedule intent for each attached target. These rules prepare the campaign for future automation without changing current post-level scheduling."
			>
				{selectedTargets.length === 0 ? (
					<SurfaceCard className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-5 text-sm text-muted-foreground">
						Choose one or more delivery targets above to start adding cadence rules.
					</SurfaceCard>
				) : (
					<div className="space-y-5">
						{selectedTargets.map((target) => {
							const targetRules = ruleDrafts.filter(
								(rule) => rule.socialTargetId === target.id,
							);
							return (
								<SurfaceCard key={target.id} className="space-y-4 p-5">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<div className="flex items-center gap-2 text-base font-semibold">
												{platformIcon(target.provider)}
												{target.displayName}
											</div>
											<div className="mt-1 text-sm text-muted-foreground">
												{target.username ? `@${target.username} · ` : ""}
												{target.targetType.replaceAll("_", " ")}
											</div>
										</div>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={() => addRule(target.id)}
										>
											<Plus className="size-4" />
											Add cadence
										</Button>
									</div>
									{targetRules.length === 0 ? (
										<div className="rounded-[20px] border border-dashed border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
											No cadence rules yet for this target.
										</div>
									) : (
										targetRules.map((rule) => (
											<div
												key={rule.id}
												className="space-y-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
											>
												<div className="flex flex-wrap items-center justify-between gap-3">
													<div className="text-sm text-muted-foreground">
														{summarizeCampaignRuleDraft(rule)}
													</div>
													<Button
														variant="ghost"
														size="sm"
														className="rounded-full text-destructive"
														onClick={() => removeRule(rule.id)}
													>
														<Trash2 className="size-4" />
														Remove
													</Button>
												</div>
												<AdminFormGrid>
													<AdminFormField>
														<Label>Preset</Label>
														<Select
															value={rule.preset}
															onValueChange={(value) =>
																updateRule(rule.id, (current) =>
																	applyPresetToDraft(
																		current,
																		value as CampaignRulePreset,
																	),
																)
															}
														>
															<SelectTrigger className={adminSelectTriggerClassName}>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																{cadencePresetOptions.map((preset) => (
																	<SelectItem key={preset.value} value={preset.value}>
																		{preset.label}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
														<div className="mt-1 text-xs text-muted-foreground">
															{
																cadencePresetOptions.find(
																	(option) => option.value === rule.preset,
																)?.description
															}
														</div>
													</AdminFormField>
													<AdminFormField>
														<Label>Enabled</Label>
														<div className="flex h-11 items-center gap-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 px-4">
															<Checkbox
																checked={rule.enabled}
																onCheckedChange={(checked) =>
																	updateRule(rule.id, (current) => ({
																		...current,
																		enabled: Boolean(checked),
																	}))
																}
															/>
															<span className="text-sm text-muted-foreground">
																Include this cadence when automation arrives
															</span>
														</div>
													</AdminFormField>
													<AdminFormField>
														<Label>Cadence type</Label>
														<Select
															value={rule.cadenceType}
															onValueChange={(value) =>
																updateRule(rule.id, (current) => ({
																	...current,
																	preset: "custom",
																	cadenceType:
																		value as CampaignRuleDraft["cadenceType"],
																	weekdays:
																		value === "weekly" ? current.weekdays : [],
																}))
															}
														>
															<SelectTrigger className={adminSelectTriggerClassName}>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="daily_interval">
																	Daily interval
																</SelectItem>
																<SelectItem value="weekly">Weekly</SelectItem>
															</SelectContent>
														</Select>
													</AdminFormField>
													<AdminFormField>
														<Label>Interval</Label>
														<Input
															type="number"
															min="1"
															value={rule.interval}
															onChange={(event) =>
																updateRule(rule.id, (current) => ({
																	...current,
																	preset: "custom",
																	interval: Math.max(1, Number(event.target.value) || 1),
																}))
															}
															className={adminInputClassName}
														/>
													</AdminFormField>
													{rule.cadenceType === "weekly" ? (
														<AdminFormField className="md:col-span-2">
															<Label>Weekdays</Label>
															<div className="grid gap-2 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 sm:grid-cols-4 lg:grid-cols-7">
																{campaignWeekdays.map((weekday) => (
																	<label
																		key={weekday.value}
																		className="flex items-center gap-2 text-sm"
																	>
																		<Checkbox
																			checked={rule.weekdays.includes(weekday.value)}
																			onCheckedChange={(checked) =>
																				updateRule(rule.id, (current) => ({
																					...current,
																					preset: "custom",
																					weekdays: Boolean(checked)
																						? [...current.weekdays, weekday.value].sort()
																						: current.weekdays.filter(
																								(item) => item !== weekday.value,
																						  ),
																				}))
																			}
																		/>
																		{weekday.label}
																	</label>
																))}
															</div>
														</AdminFormField>
													) : null}
													<AdminFormField className="md:col-span-2">
														<Label>Local times</Label>
														<div className="space-y-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
															<div className="flex flex-wrap gap-2">
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="rounded-full"
																	onClick={() =>
																		updateRule(rule.id, (current) => ({
																			...current,
																			preset: "custom",
																			timesLocal: ["09:00"],
																		}))
																	}
																>
																	Morning
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="rounded-full"
																	onClick={() =>
																		updateRule(rule.id, (current) => ({
																			...current,
																			preset: "custom",
																			timesLocal: ["18:00"],
																		}))
																	}
																>
																	Evening
																</Button>
																<Button
																	type="button"
																	variant="outline"
																	size="sm"
																	className="rounded-full"
																	onClick={() =>
																		updateRule(rule.id, (current) => ({
																			...current,
																			preset: "custom",
																			timesLocal: ["09:00", "18:00"],
																		}))
																	}
																>
																	Morning + evening
																</Button>
															</div>
															{rule.timesLocal.map((timeValue, index) => (
																<div key={`${rule.id}-${index}`} className="flex items-center gap-3">
																	<Input
																		type="time"
																		value={timeValue}
																		onChange={(event) =>
																			updateRule(rule.id, (current) => ({
																				...current,
																				preset: "custom",
																				timesLocal: current.timesLocal.map((item, itemIndex) =>
																					itemIndex === index ? event.target.value : item,
																				),
																			}))
																		}
																		className={adminInputClassName}
																	/>
																	<Button
																		type="button"
																		variant="ghost"
																		size="sm"
																		className="rounded-full"
																		onClick={() =>
																			updateRule(rule.id, (current) => ({
																				...current,
																				preset: "custom",
																				timesLocal: current.timesLocal.filter(
																					(_, itemIndex) => itemIndex !== index,
																				),
																			}))
																		}
																		disabled={rule.timesLocal.length === 1}
																	>
																		Remove
																	</Button>
																</div>
															))}
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="rounded-full"
																onClick={() =>
																	updateRule(rule.id, (current) => ({
																		...current,
																		preset: "custom",
																		timesLocal: [...current.timesLocal, "12:00"],
																	}))
																}
															>
																<Plus className="size-4" />
																Add time
															</Button>
														</div>
													</AdminFormField>
													<AdminFormField>
														<Label>Rule start date (optional)</Label>
														<Input
															type="date"
															value={rule.startDate}
															onChange={(event) =>
																updateRule(rule.id, (current) => ({
																	...current,
																	startDate: event.target.value,
																}))
															}
															className={adminInputClassName}
														/>
													</AdminFormField>
													<AdminFormField>
														<Label>Rule end date (optional)</Label>
														<Input
															type="date"
															value={rule.endDate}
															onChange={(event) =>
																updateRule(rule.id, (current) => ({
																	...current,
																	endDate: event.target.value,
																}))
															}
															className={adminInputClassName}
														/>
													</AdminFormField>
												</AdminFormGrid>
											</div>
										))
									)}
								</SurfaceCard>
							);
						})}
					</div>
				)}
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
				description="Optional manual posts already associated with this campaign. Future automation can coexist with these without changing current post scheduling."
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
