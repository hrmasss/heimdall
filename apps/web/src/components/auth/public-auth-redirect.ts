import { useEffect } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/lib/auth-context";

type PublicAuthPortal = "customer" | "platform";

export function usePublicAuthRedirect(portal: PublicAuthPortal) {
	const navigate = useNavigate();
	const { bootstrapping, customerSession, platformSession } = useAuth();

	const destination = bootstrapping
		? null
		: portal === "customer"
			? customerSession
				? "/dashboard"
				: platformSession
					? "/admin"
					: null
			: platformSession
				? "/admin"
				: customerSession
					? "/dashboard"
					: null;

	useEffect(() => {
		if (!destination) {
			return;
		}
		navigate(destination, { replace: true });
	}, [destination, navigate]);

	return {
		bootstrapping,
		redirecting: Boolean(destination),
	};
}
