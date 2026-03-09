import { StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import { AppRoutes } from "@/app-routes";

import "./index.css";

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}

const app = (
	<StrictMode>
		<BrowserRouter>
			<AppRoutes />
		</BrowserRouter>
	</StrictMode>
);

if (root.hasChildNodes()) {
	hydrateRoot(root, app);
} else {
	createRoot(root).render(app);
}
