import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import "./index.css";

// Pages
import { MarketingPage } from "@/pages/marketing";
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
				{/* Marketing/Landing Page */}
				<Route path="/" element={<MarketingPage />} />

				{/* Dashboard Routes */}
				<Route path="/dashboard" element={<DashboardLayout />}>
					<Route index element={<DashboardOverview />} />
					{/* Future routes */}
					{/* <Route path="posts" element={<Posts />} /> */}
					{/* <Route path="calendar" element={<Calendar />} /> */}
					{/* <Route path="analytics" element={<Analytics />} /> */}
					{/* <Route path="settings" element={<Settings />} /> */}
				</Route>
			</Routes>
		</BrowserRouter>
	</StrictMode>,
);
