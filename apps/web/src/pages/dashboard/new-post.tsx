import { CalendarRange, FilePlus2, ImageIcon, Sparkles } from "lucide-react";

import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DashboardNewPost() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Compose"
				title="Create post"
				description="A complete compose page so the route is no longer a dead end and stays visually consistent with the marketing experience."
			/>

			<DashboardPanel
				title="Draft details"
				description="Minimal structure, rich enough to feel intentional."
			>
				<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<label className="block space-y-2">
							<span className="text-sm font-medium">Campaign title</span>
							<Input
								className="h-11 rounded-2xl"
								placeholder="Launch thought-leadership series"
							/>
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">Channel</span>
							<Input className="h-11 rounded-2xl" placeholder="LinkedIn" />
						</label>
						<label className="block space-y-2">
							<span className="text-sm font-medium">Copy</span>
							<Textarea
								className="min-h-40 rounded-[24px]"
								placeholder="Draft the caption or thread opener here..."
							/>
						</label>
						<div className="flex flex-wrap gap-2">
							<Button className="rounded-full bg-gradient-brand text-white border-0">
								<FilePlus2 className="size-4" />
								Save draft
							</Button>
							<Button variant="outline" className="rounded-full">
								<Sparkles className="size-4" />
								Generate variants
							</Button>
						</div>
					</SurfaceCard>

					<div className="space-y-4">
						<SurfaceCard tone="muted" className="p-5">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<CalendarRange className="size-4" />
								</div>
								<div>
									<div className="font-medium">Scheduling</div>
									<div className="text-sm text-muted-foreground">
										Mar 12, 10:00 AM · North America
									</div>
								</div>
							</div>
						</SurfaceCard>

						<SurfaceCard tone="muted" className="p-5">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<ImageIcon className="size-4" />
								</div>
								<div>
									<div className="font-medium">Assets</div>
									<div className="text-sm text-muted-foreground">
										4 attached files with brand-safe naming
									</div>
								</div>
							</div>
						</SurfaceCard>
					</div>
				</div>
			</DashboardPanel>
		</div>
	);
}
