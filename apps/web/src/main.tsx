import { Suspense, StrictMode, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";

import "./index.css";

const MarketingLayout = lazy(async () =>
	import("@/pages/marketing/layout").then((module) => ({
		default: module.MarketingLayout,
	})),
);
const HomePage = lazy(async () =>
	import("@/pages/marketing/home").then((module) => ({
		default: module.HomePage,
	})),
);
const FeaturesPage = lazy(async () =>
	import("@/pages/marketing/features").then((module) => ({
		default: module.FeaturesPage,
	})),
);
const PricingPage = lazy(async () =>
	import("@/pages/marketing/pricing").then((module) => ({
		default: module.PricingPage,
	})),
);
const AboutPage = lazy(async () =>
	import("@/pages/marketing/about").then((module) => ({
		default: module.AboutPage,
	})),
);
const LoginPage = lazy(async () =>
	import("@/pages/auth/login").then((module) => ({
		default: module.LoginPage,
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

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

createRoot(root).render(
	<StrictMode>
		<BrowserRouter>
			<Suspense fallback={<RouteFallback />}>
				<Routes>
					<Route element={<MarketingLayout />}>
						<Route path="/" element={<HomePage />} />
						<Route path="/features" element={<FeaturesPage />} />
						<Route path="/pricing" element={<PricingPage />} />
						<Route path="/about" element={<AboutPage />} />
					</Route>

					<Route path="/login" element={<LoginPage />} />

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
		</BrowserRouter>
	</StrictMode>,
);

function RouteFallback() {
	return <div className="min-h-screen bg-background" />;
}
