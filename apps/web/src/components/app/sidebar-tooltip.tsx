import type { ReactNode } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarTooltip({
	disabled,
	label,
	children,
}: {
	disabled?: boolean;
	label: ReactNode;
	children: ReactNode;
}) {
	if (disabled) {
		return <>{children}</>;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side="right" align="center" sideOffset={12}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
