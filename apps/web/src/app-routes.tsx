import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";

import { applyDocumentSeo, getSeoForPath } from "@/lib/seo";
import { AboutPage } from "@/pages/marketing/about";
import { BlogPage } from "@/pages/marketing/blog";
import { BlogDetailPage } from "@/pages/marketing/blog-detail";
import { FeaturesPage } from "@/pages/marketing/features";
import { HomePage } from "@/pages/marketing/home";
import { MarketingLayout } from "@/pages/marketing/layout";
import { PricingPage } from "@/pages/marketing/pricing";

const LoginPage = lazy(async () =>
	import("@/pages/auth/login").then((module) => ({
		default: module.LoginPage,
	})),
);
const SignupPage = lazy(async () =>
	import("@/pages/auth/signup").then((module) => ({
		default: module.SignupPage,
	})),
);
const DashboardLayout = lazy(async () =>
	import("@/pages/dashboard/layout").then((module) => ({
		default: module.DashboardLayout,
	})),
);
const DashboardOverview = lazy(async () =>
	import("@/pages/dashboard/overview").then((module) => ({
		default: module.DashboardOverview,
	})),
);
const DashboardPosts = lazy(async () =>
	import("@/pages/dashboard/posts").then((module) => ({
		default: module.DashboardPosts,
	})),
);
const DashboardNewPost = lazy(async () =>
	import("@/pages/dashboard/new-post").then((module) => ({
		default: module.DashboardNewPost,
	})),
);
const DashboardCalendar = lazy(async () =>
	import("@/pages/dashboard/calendar").then((module) => ({
		default: module.DashboardCalendar,
	})),
);
const DashboardAnalytics = lazy(async () =>
	import("@/pages/dashboard/analytics").then((module) => ({
		default: module.DashboardAnalytics,
	})),
);
const DashboardAutomations = lazy(async () =>
	import("@/pages/dashboard/automations").then((module) => ({
		default: module.DashboardAutomations,
	})),
);
const DashboardLibrary = lazy(async () =>
	import("@/pages/dashboard/library").then((module) => ({
		default: module.DashboardLibrary,
	})),
);
const DashboardTeam = lazy(async () =>
	import("@/pages/dashboard/team").then((module) => ({
		default: module.DashboardTeam,
	})),
);
const DashboardSettings = lazy(async () =>
	import("@/pages/dashboard/settings").then((module) => ({
		default: module.DashboardSettings,
	})),
);
const NotFoundPage = lazy(async () =>
	import("@/pages/not-found").then((module) => ({
		default: module.NotFoundPage,
	})),
);

function RouteSeoSync() {
	const location = useLocation();

	useEffect(() => {
		applyDocumentSeo(getSeoForPath(location.pathname));
	}, [location.pathname]);

	return null;
}

function RouteFallback() {
	return <div className="min-h-screen bg-background" />;
}

export function AppRoutes() {
	return (
		<>
			<RouteSeoSync />
			<Suspense fallback={<RouteFallback />}>
				<Routes>
					<Route element={<MarketingLayout />}>
						<Route path="/" element={<HomePage />} />
						<Route path="/features" element={<FeaturesPage />} />
						<Route path="/pricing" element={<PricingPage />} />
						<Route path="/about" element={<AboutPage />} />
						<Route path="/blog" element={<BlogPage />} />
						<Route path="/blog/:slug" element={<BlogDetailPage />} />
					</Route>

					<Route path="/login" element={<LoginPage />} />
					<Route path="/signup" element={<SignupPage />} />

					<Route path="/dashboard" element={<DashboardLayout />}>
						<Route index element={<DashboardOverview />} />
						<Route path="posts" element={<DashboardPosts />} />
						<Route path="posts/new" element={<DashboardNewPost />} />
						<Route path="calendar" element={<DashboardCalendar />} />
						<Route path="analytics" element={<DashboardAnalytics />} />
						<Route path="automations" element={<DashboardAutomations />} />
						<Route path="library" element={<DashboardLibrary />} />
						<Route path="team" element={<DashboardTeam />} />
						<Route path="settings" element={<DashboardSettings />} />
					</Route>

					<Route path="*" element={<NotFoundPage />} />
				</Routes>
			</Suspense>
		</>
	);
}
