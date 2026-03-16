import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";

import { AppRoutes } from "@/app-routes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { SITE_URL, getSeoForPath, marketingPrerenderRoutes } from "@/lib/seo";

export { marketingPrerenderRoutes, SITE_URL };

export function render(url: string) {
	const seo = getSeoForPath(url);
	const appHtml = renderToString(
		<TooltipProvider>
			<AuthProvider>
				<StaticRouter location={url}>
					<AppRoutes />
				</StaticRouter>
			</AuthProvider>
		</TooltipProvider>,
	);

	return {
		appHtml,
		seo,
	};
}
