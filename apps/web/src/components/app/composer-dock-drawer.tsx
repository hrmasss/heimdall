import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Drawer, DrawerContent } from "@/components/ui/drawer";

type ComposerDockDrawerChromePlacement = "dock" | "drawer";

type ComposerDockDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	chrome: (context: {
		placement: ComposerDockDrawerChromePlacement;
	}) => ReactNode;
	header: ReactNode;
	children: ReactNode;
};

export function ComposerDockDrawer({
	open,
	onOpenChange,
	chrome,
	header,
	children,
}: ComposerDockDrawerProps) {
	const dockRef = useRef<HTMLDivElement | null>(null);
	const [dockMetrics, setDockMetrics] = useState<{
		left: number;
		width: number;
	} | null>(null);

	useEffect(() => {
		const updateDockMetrics = () => {
			const rect = dockRef.current?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			setDockMetrics({
				left: rect.left,
				width: rect.width,
			});
		};

		updateDockMetrics();

		const resizeObserver =
			typeof ResizeObserver !== "undefined" && dockRef.current
				? new ResizeObserver(() => updateDockMetrics())
				: null;

		if (resizeObserver && dockRef.current) {
			resizeObserver.observe(dockRef.current);
		}

		window.addEventListener("resize", updateDockMetrics);

		return () => {
			window.removeEventListener("resize", updateDockMetrics);
			resizeObserver?.disconnect();
		};
	}, []);

	return (
		<>
			<div className="composer-dock-stage sticky bottom-4 z-20">
				<div
					ref={dockRef}
					data-state={open ? "open" : "closed"}
					className="composer-dock-shell mx-auto w-full max-w-[72rem] p-3"
				>
					{chrome({ placement: "dock" })}
				</div>
			</div>

			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent
					className="composer-drawer-shell mx-auto flex w-full flex-col overflow-hidden"
					style={{
						insetInline: "auto",
						left: dockMetrics ? `${dockMetrics.left}px` : "50%",
						right: "auto",
						bottom: "1rem",
						width: dockMetrics
							? `${dockMetrics.width}px`
							: "min(calc(100vw - 1.25rem), 72rem)",
						maxHeight: "min(760px, calc(100dvh - 2rem))",
						transform: dockMetrics ? "none" : "translateX(-50%)",
					}}
				>
					<div className="composer-drawer-header shrink-0 border-b">
						<div className="composer-drawer-command px-3 pt-3">
							{chrome({ placement: "drawer" })}
						</div>
						<div className="composer-drawer-page-heading px-4 py-3 sm:px-6">
							{header}
						</div>
					</div>
					<div className="composer-drawer-body min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-3 sm:px-6">
						{children}
					</div>
				</DrawerContent>
			</Drawer>
		</>
	);
}
