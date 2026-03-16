const dashboardLabels: Record<string, string> = {
	"/dashboard": "Overview",
	"/dashboard/onboarding": "Create workspace",
	"/dashboard/campaigns": "Campaigns",
	"/dashboard/campaigns/new": "Create campaign",
	"/dashboard/posts": "Posts",
	"/dashboard/posts/new": "Create post",
	"/dashboard/calendar": "Calendar",
	"/dashboard/analytics": "Analytics",
	"/dashboard/automations": "Automations",
	"/dashboard/library": "Library",
	"/dashboard/team": "Team",
	"/dashboard/settings": "Settings",
};

export function formatBreadcrumbLabel(segment: string) {
	return segment
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function getDashboardBreadcrumbs(pathname: string) {
	const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

	return segments
		.map((_, index) => `/${segments.slice(0, index + 1).join("/")}`)
		.filter((path) => path.startsWith("/dashboard"))
		.map((path) => ({
			href: path,
			label: resolveDashboardLabel(path),
		}));
}

export function getDashboardContextLabel(pathname: string) {
	return resolveDashboardLabel(pathname);
}

function resolveDashboardLabel(pathname: string) {
	if (/^\/dashboard\/library\/sets\/new$/.test(pathname)) {
		return "Create asset set";
	}
	if (/^\/dashboard\/campaigns\/[^/]+\/edit$/.test(pathname)) {
		return "Edit campaign";
	}
	if (/^\/dashboard\/campaigns\/[^/]+$/.test(pathname)) {
		return "Campaign detail";
	}
	if (/^\/dashboard\/library\/sets\/[^/]+\/edit$/.test(pathname)) {
		return "Edit asset set";
	}
	if (/^\/dashboard\/library\/sets\/[^/]+$/.test(pathname)) {
		return "Asset set detail";
	}
	if (/^\/dashboard\/library\/[^/]+\/edit$/.test(pathname)) {
		return "Edit resource";
	}
	if (/^\/dashboard\/library\/[^/]+$/.test(pathname)) {
		return "Resource detail";
	}
	return (
		dashboardLabels[pathname] ??
		formatBreadcrumbLabel(
			pathname.split("/").filter(Boolean).at(-1) ?? "Overview",
		)
	);
}
