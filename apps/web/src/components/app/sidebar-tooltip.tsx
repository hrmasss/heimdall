import type { ComponentProps, ReactNode } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

export function SidebarTooltip({
	disabled,
	label,
	side = "right",
	align = "center",
	sideOffset = 12,
	children,
}: {
	disabled?: boolean;
	label: ReactNode;
	side?: ComponentProps<typeof TooltipContent>["side"];
	align?: ComponentProps<typeof TooltipContent>["align"];
	sideOffset?: number;
	children: ReactNode;
}) {
	if (disabled) {
		return <>{children}</>;
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} align={align} sideOffset={sideOffset}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
