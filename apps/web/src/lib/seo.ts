export const SITE_NAME = "Heimdall";
export const SITE_URL = "https://heimdall.app";
export const SITE_IMAGE = `${SITE_URL}/branding/heimdall-icon-512.png`;

export type RouteSeo = {
	title: string;
	description: string;
	path: string;
	keywords: string[];
	ogType?: "website" | "article";
	themeColor?: string;
	structuredData?: Record<string, unknown>[];
};

export const marketingPrerenderRoutes = [
	"/",
	"/features",
	"/pricing",
	"/about",
	"/blog",
] as const;

const defaultThemeColor = "#f7f2ed";

const organizationSchema = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: SITE_NAME,
	url: SITE_URL,
	logo: `${SITE_URL}/branding/heimdall-logo-dark.png`,
	description:
		"Heimdall is a social media marketing command center for planning campaigns, approvals, publishing, and analytics.",
};

const softwareSchema = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	name: SITE_NAME,
	applicationCategory: "BusinessApplication",
	operatingSystem: "Web",
	url: SITE_URL,
	description:
		"Heimdall helps marketing teams plan campaigns, manage reviews, automate publishing, and measure performance in one workspace.",
};

const marketingRouteSeo = new Map<string, RouteSeo>([
	[
		"/",
		{
			title: "Heimdall | Marketing Command Center for Social Teams",
			description:
				"Plan campaigns, manage approvals, automate publishing, and measure performance from one SEO-friendly marketing command center.",
			path: "/",
			keywords: [
				"social media management platform",
				"marketing workflow software",
				"campaign planning tool",
				"social media approvals",
				"marketing analytics workspace",
			],
			structuredData: [organizationSchema, softwareSchema],
		},
	],
	[
		"/features",
		{
			title: "Heimdall Features | Planning, Approvals, Publishing, Analytics",
			description:
				"Explore Heimdall features for campaign planning, team approvals, publishing workflows, asset operations, and marketing analytics.",
			path: "/features",
			keywords: [
				"marketing workflow features",
				"social media planning software",
				"campaign approvals",
				"marketing operations platform",
				"content publishing workflow",
			],
			structuredData: [softwareSchema],
		},
	],
	[
		"/pricing",
		{
			title: "Heimdall Pricing | Plans for Marketing Teams and Multi-Brand Ops",
			description:
				"Compare Heimdall pricing for growing marketing teams, multi-brand operators, and enterprise social media programs.",
			path: "/pricing",
			keywords: [
				"social media management pricing",
				"marketing software pricing",
				"enterprise marketing platform",
				"multi-brand social media tool",
				"approval workflow pricing",
			],
			structuredData: [softwareSchema],
		},
	],
	[
		"/about",
		{
			title: "About Heimdall | Built for Modern Marketing Operations",
			description:
				"Learn how Heimdall helps modern marketing teams work with more clarity, stronger governance, and better shared context.",
			path: "/about",
			keywords: [
				"about Heimdall",
				"marketing operations company",
				"social media workflow platform",
				"marketing team software",
				"campaign operations",
			],
			structuredData: [organizationSchema],
		},
	],
	[
		"/blog",
		{
			title:
				"Heimdall Blog | Marketing Insights, Product Updates, and Playbooks",
			description:
				"Read Heimdall marketing insights, campaign playbooks, product updates, and operational lessons for high-performing social teams.",
			path: "/blog",
			keywords: [
				"marketing blog",
				"social media strategy insights",
				"content operations blog",
				"marketing automation updates",
				"campaign planning best practices",
			],
			structuredData: [
				{
					"@context": "https://schema.org",
					"@type": "Blog",
					name: "Heimdall Blog",
					url: `${SITE_URL}/blog`,
					description:
						"Marketing insights, product updates, and workflow playbooks from Heimdall.",
					publisher: {
						"@type": "Organization",
						name: SITE_NAME,
						url: SITE_URL,
					},
				},
			],
		},
	],
]);

const defaultSeo: RouteSeo = {
	title: "Heimdall | Centralized Social Media Management Platform",
	description:
		"Heimdall helps teams plan campaigns, manage approvals, publish content, and review performance in one connected workspace.",
	path: "/",
	keywords: [
		"social media management",
		"marketing platform",
		"campaign operations",
	],
	themeColor: defaultThemeColor,
	ogType: "website",
};

export function normalizeSeoPath(pathname: string) {
	if (!pathname || pathname === "/") {
		return "/";
	}

	const normalized = pathname.split("?")[0]?.split("#")[0] ?? "/";
	return normalized.endsWith("/") ? normalized.slice(0, -1) || "/" : normalized;
}

export function getSeoForPath(pathname: string): RouteSeo {
	const normalizedPath = normalizeSeoPath(pathname);
	const routeSeo = marketingRouteSeo.get(normalizedPath);

	if (!routeSeo) {
		return defaultSeo;
	}

	return {
		...routeSeo,
		ogType: routeSeo.ogType ?? "website",
		themeColor: routeSeo.themeColor ?? defaultThemeColor,
	};
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
	if (typeof document === "undefined") {
		return;
	}

	let element = document.head.querySelector<HTMLMetaElement>(selector);
	if (!element) {
		element = document.createElement("meta");
		document.head.appendChild(element);
	}

	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
}

function upsertLink(selector: string, attributes: Record<string, string>) {
	if (typeof document === "undefined") {
		return;
	}

	let element = document.head.querySelector<HTMLLinkElement>(selector);
	if (!element) {
		element = document.createElement("link");
		document.head.appendChild(element);
	}

	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
}

function upsertStructuredData(structuredData: Record<string, unknown>[]) {
	if (typeof document === "undefined") {
		return;
	}

	const existingNodes = document.head.querySelectorAll(
		'script[data-heimdall-seo="structured-data"]',
	);
	for (const node of existingNodes) {
		node.remove();
	}

	for (const item of structuredData) {
		const script = document.createElement("script");
		script.type = "application/ld+json";
		script.dataset.heimdallSeo = "structured-data";
		script.text = JSON.stringify(item);
		document.head.appendChild(script);
	}
}

export function applyDocumentSeo(seo: RouteSeo) {
	if (typeof document === "undefined") {
		return;
	}

	document.title = seo.title;

	upsertMeta('meta[name="description"]', {
		name: "description",
		content: seo.description,
	});
	upsertMeta('meta[name="keywords"]', {
		name: "keywords",
		content: seo.keywords.join(", "),
	});
	upsertMeta('meta[name="robots"]', {
		name: "robots",
		content: "index, follow",
	});
	upsertMeta('meta[name="theme-color"]', {
		name: "theme-color",
		content: seo.themeColor ?? defaultThemeColor,
	});
	upsertMeta('meta[property="og:title"]', {
		property: "og:title",
		content: seo.title,
	});
	upsertMeta('meta[property="og:description"]', {
		property: "og:description",
		content: seo.description,
	});
	upsertMeta('meta[property="og:type"]', {
		property: "og:type",
		content: seo.ogType ?? "website",
	});
	upsertMeta('meta[property="og:url"]', {
		property: "og:url",
		content: `${SITE_URL}${seo.path}`,
	});
	upsertMeta('meta[property="og:image"]', {
		property: "og:image",
		content: SITE_IMAGE,
	});
	upsertMeta('meta[name="twitter:card"]', {
		name: "twitter:card",
		content: "summary_large_image",
	});
	upsertMeta('meta[name="twitter:title"]', {
		name: "twitter:title",
		content: seo.title,
	});
	upsertMeta('meta[name="twitter:description"]', {
		name: "twitter:description",
		content: seo.description,
	});
	upsertMeta('meta[name="twitter:image"]', {
		name: "twitter:image",
		content: SITE_IMAGE,
	});

	upsertLink('link[rel="canonical"]', {
		rel: "canonical",
		href: `${SITE_URL}${seo.path}`,
	});

	upsertStructuredData(seo.structuredData ?? []);
}
