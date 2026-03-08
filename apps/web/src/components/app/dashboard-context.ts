const dashboardLabels: Record<string, string> = {
	"/dashboard": "Overview",
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
			label:
				dashboardLabels[path] ??
				formatBreadcrumbLabel(
					path.split("/").filter(Boolean).at(-1) ?? "Overview",
				),
		}));
}

export function getDashboardContextLabel(pathname: string) {
	return (
		dashboardLabels[pathname] ??
		formatBreadcrumbLabel(
			pathname.split("/").filter(Boolean).at(-1) ?? "Overview",
		)
	);
}
