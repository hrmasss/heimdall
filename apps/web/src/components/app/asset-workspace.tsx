import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AssetCommandBar({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return <SurfaceCard className={cn("asset-command-surface p-4", className)}>{children}</SurfaceCard>;
}

export function AssetWorkspaceShell({
	className,
	mainClassName,
	railClassName,
	commandBar,
	rail,
	railTitle = "Workspace context",
	railDescription = "Open the supporting tools without compressing the main work surface.",
	railTriggerLabel = "Open context",
	children,
}: {
	className?: string;
	mainClassName?: string;
	railClassName?: string;
	commandBar?: ReactNode;
	rail?: ReactNode;
	railTitle?: string;
	railDescription?: string;
	railTriggerLabel?: string;
	children: ReactNode;
}) {
	const [railOpen, setRailOpen] = useState(false);

	return (
		<div className={cn("space-y-4", className)}>
			{commandBar}
			{rail ? (
				<div className="flex justify-end 2xl:hidden">
					<Button
						variant="outline"
						size="sm"
						className="rounded-full"
						onClick={() => setRailOpen(true)}
					>
						<SlidersHorizontal className="size-4" />
						{railTriggerLabel}
					</Button>
				</div>
			) : null}

			<div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
				<div className={cn("min-w-0 space-y-5", mainClassName)}>{children}</div>
				{rail ? (
					<aside className={cn("hidden 2xl:block", railClassName)}>
						<div className="space-y-5 2xl:sticky 2xl:top-[var(--density-dashboard-sticky-top)] 2xl:self-start">
							{rail}
						</div>
					</aside>
				) : null}
			</div>

			{rail ? (
				<Sheet open={railOpen} onOpenChange={setRailOpen}>
					<SheetContent className="asset-rail-sheet w-full overflow-y-auto sm:max-w-[30rem]">
						<SheetHeader className="border-b border-[var(--brand-border-soft)] px-5 py-5">
							<SheetTitle>{railTitle}</SheetTitle>
							<SheetDescription>{railDescription}</SheetDescription>
						</SheetHeader>
						<div className="space-y-5 px-5 py-5">{rail}</div>
					</SheetContent>
				</Sheet>
			) : null}
		</div>
	);
}
