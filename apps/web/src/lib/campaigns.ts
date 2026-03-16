import type {
	CampaignLink,
	CampaignScheduleRule,
	CampaignSummary,
} from "@/lib/api-types";

export const campaignWeekdays = [
	{ value: "mon", label: "Mon" },
	{ value: "tue", label: "Tue" },
	{ value: "wed", label: "Wed" },
	{ value: "thu", label: "Thu" },
	{ value: "fri", label: "Fri" },
	{ value: "sat", label: "Sat" },
	{ value: "sun", label: "Sun" },
] as const;

export type CampaignWindowLike = Pick<CampaignSummary, "startDate" | "endDate">;

export type CampaignRulePreset =
	| "daily"
	| "every_other_day"
	| "weekdays"
	| "once_weekly"
	| "twice_daily"
	| "custom";

export function formatCampaignWindowLabel(campaign: CampaignWindowLike) {
	return campaign.endDate
		? `${campaign.startDate} to ${campaign.endDate}`
		: `Starts ${campaign.startDate}`;
}

export function formatCampaignLinkWindowLabel(campaign: CampaignLink) {
	return formatCampaignWindowLabel(campaign);
}

export function detectCampaignRulePreset(
	rule: Pick<CampaignScheduleRule, "cadenceType" | "interval" | "weekdays" | "timesLocal">,
): CampaignRulePreset {
	const weekdays = [...rule.weekdays].sort().join(",");
	const times = [...rule.timesLocal].sort().join(",");
	if (rule.cadenceType === "daily_interval" && rule.interval === 1 && times === "09:00") {
		return "daily";
	}
	if (rule.cadenceType === "daily_interval" && rule.interval === 2 && times === "09:00") {
		return "every_other_day";
	}
	if (
		rule.cadenceType === "weekly" &&
		rule.interval === 1 &&
		weekdays === "fri,mon,thu,tue,wed" &&
		times === "09:00"
	) {
		return "weekdays";
	}
	if (rule.cadenceType === "weekly" && rule.interval === 1 && rule.weekdays.length === 1 && times === "09:00") {
		return "once_weekly";
	}
	if (rule.cadenceType === "daily_interval" && rule.interval === 1 && times === "09:00,18:00") {
		return "twice_daily";
	}
	return "custom";
}

export function summarizeCampaignRuleDraft(
	rule: Pick<CampaignScheduleRule, "cadenceType" | "interval" | "weekdays" | "timesLocal">,
) {
	const times = rule.timesLocal.join(", ");
	if (rule.cadenceType === "weekly") {
		const weekdayLabels = rule.weekdays
			.map((weekday) => campaignWeekdays.find((option) => option.value === weekday)?.label ?? weekday)
			.join(", ");
		return rule.interval === 1
			? `Every week on ${weekdayLabels} at ${times}`
			: `Every ${rule.interval} weeks on ${weekdayLabels} at ${times}`;
	}
	return rule.interval === 1
		? `Every day at ${times}`
		: `Every ${rule.interval} days at ${times}`;
}
