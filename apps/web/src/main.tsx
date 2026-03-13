import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AppRoutes } from "@/app-routes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";

import "./index.css";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

const app = (
	<StrictMode>
		<AuthProvider>
			<BrowserRouter>
				<AppRoutes />
				<Toaster />
			</BrowserRouter>
		</AuthProvider>
	</StrictMode>
);

if (root.hasChildNodes()) {
	hydrateRoot(root, app);
} else {
	createRoot(root).render(app);
}
