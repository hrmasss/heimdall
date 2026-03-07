import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";

// Marketing Pages
import {
	MarketingLayout,
	HomePage,
	FeaturesPage,
	PricingPage,
	AboutPage,
} from "@/pages/marketing";

// Dashboard Pages
import { DashboardLayout } from "@/pages/dashboard/layout";
import { DashboardOverview } from "@/pages/dashboard/overview";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

createRoot(root).render(
	<StrictMode>
		<BrowserRouter>
			<Routes>
				{/* Marketing Routes */}
				<Route element={<MarketingLayout />}>
					<Route path="/" element={<HomePage />} />
					<Route path="/features" element={<FeaturesPage />} />
					<Route path="/pricing" element={<PricingPage />} />
					<Route path="/about" element={<AboutPage />} />
				</Route>

				{/* Dashboard Routes */}
				<Route path="/dashboard" element={<DashboardLayout />}>
					<Route index element={<DashboardOverview />} />
					{/* Placeholder routes for other dashboard pages */}
					<Route path="posts" element={<PlaceholderPage title="Posts" />} />
					<Route path="posts/new" element={<PlaceholderPage title="Create Post" />} />
					<Route path="calendar" element={<PlaceholderPage title="Calendar" />} />
					<Route path="analytics" element={<PlaceholderPage title="Analytics" />} />
					<Route path="automations" element={<PlaceholderPage title="Automations" />} />
					<Route path="library" element={<PlaceholderPage title="Library" />} />
					<Route path="team" element={<PlaceholderPage title="Team" />} />
					<Route path="settings" element={<PlaceholderPage title="Settings" />} />
				</Route>
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);

// Placeholder component for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
			<div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
				<svg
					className="size-8 text-muted-foreground"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={1.5}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M12 6v6m0 0v6m0-6h6m-6 0H6"
					/>
				</svg>
			</div>
			<h2 className="text-2xl font-semibold mb-2">{title}</h2>
			<p className="text-muted-foreground max-w-md">
				This page is coming soon. We're working hard to bring you this feature.
			</p>
		</div>
	);
}
