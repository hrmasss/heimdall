import { FolderKanban, ImageIcon, Search, Video } from "lucide-react";

import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { SurfaceCard } from "@/components/app/brand";
import { Input } from "@/components/ui/input";

const assets = [
	{
		name: "Launch hero crop",
		type: "Image",
		size: "1800 x 1200",
		tag: "Campaign",
	},
	{
		name: "Founder quote reel",
		type: "Video",
		size: "00:24",
		tag: "Executive",
	},
	{
		name: "Regional logo pack",
		type: "Image",
		size: "12 variants",
		tag: "Brand",
	},
	{ name: "Analyst chart loop", type: "Video", size: "00:12", tag: "Insight" },
];

export function DashboardLibrary() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Assets"
				title="Library"
				description="A calmer, richer asset surface that stays visually aligned with the rest of the product."
			/>

			<DashboardPanel
				title="Browse assets"
				description="The asset view uses the same border radius, panel treatment, and typography cadence as the marketing site."
				action={
					<div className="relative w-full sm:w-72">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="h-10 rounded-full pl-10"
							placeholder="Search library"
						/>
					</div>
				}
			>
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{assets.map((asset) => (
						<SurfaceCard key={asset.name} className="overflow-hidden">
							<div className="flex aspect-[4/3] items-center justify-center bg-[linear-gradient(145deg,var(--brand-highlight),transparent)]">
								{asset.type === "Image" ? (
									<ImageIcon className="size-10 text-primary" />
								) : (
									<Video className="size-10 text-primary" />
								)}
							</div>
							<div className="p-5">
								<div className="text-lg font-medium">{asset.name}</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{asset.size}
								</div>
								<div className="mt-4 flex items-center justify-between">
									<span className="pill pill-muted">{asset.tag}</span>
									<span className="text-sm text-muted-foreground">
										{asset.type}
									</span>
								</div>
							</div>
						</SurfaceCard>
					))}
				</div>
			</DashboardPanel>

			<SurfaceCard tone="muted" className="p-5">
				<div className="flex items-start gap-3">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<FolderKanban className="size-5" />
					</div>
					<div>
						<div className="font-medium">Shared library rules</div>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Assets inherit naming, expiry, and workspace permission rules.
							This keeps the library useful for real teams instead of becoming a
							file graveyard.
						</p>
					</div>
				</div>
			</SurfaceCard>
		</div>
	);
}
