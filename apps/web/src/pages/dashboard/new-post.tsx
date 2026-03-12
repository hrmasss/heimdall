import { CalendarRange, FilePlus2, Layers3, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { ResourceChipList } from "@/components/resources/resource-display";
import { ResourcePicker } from "@/components/resources/resource-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	ResourceRecord,
	ResourceSetDetail,
	ResourceSetSummary,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export function DashboardNewPost() {
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resources, setResources] = useState<ResourceRecord[]>([]);
	const [resourceSets, setResourceSets] = useState<ResourceSetSummary[]>([]);
	const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}
		void Promise.all([
			customerRequest<ApiListResponse<ResourceRecord>>("/resources"),
			customerRequest<ApiListResponse<ResourceSetSummary>>("/resource-sets"),
		]).then(([resourceResponse, setResponse]) => {
			setResources(resourceResponse.items);
			setResourceSets(setResponse.items);
		});
	}, [activeWorkspaceId, customerRequest]);

	const selectedResources = useMemo(
		() =>
			selectedResourceIds
				.map((resourceId) =>
					resources.find((resource) => resource.id === resourceId),
				)
				.filter((resource): resource is ResourceRecord => Boolean(resource)),
		[selectedResourceIds, resources],
	);

	async function resolveResourceSetIds(resourceSetId: string) {
		const response = await customerRequest<ResourceSetDetail>(
			`/resource-sets/${resourceSetId}`,
		);
		return response.items.map((item) => item.resourceId);
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Compose"
				title="Create post"
				description="The composer now attaches reusable workspace resources instead of creating one-off asset silos."
			/>

			<DashboardPanel
				title="Draft details"
				description="This route still stays UI-only, but the resource attachment flow is now real and reusable."
			>
				<div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="space-y-2">
							<span className="text-sm font-medium">Campaign title</span>
							<Input
								id="post-campaign-title"
								className="h-11 rounded-2xl"
								placeholder="Launch thought-leadership series"
							/>
						</div>
						<div className="space-y-2">
							<span className="text-sm font-medium">Channel</span>
							<Input
								id="post-channel"
								className="h-11 rounded-2xl"
								placeholder="LinkedIn"
							/>
						</div>
						<div className="space-y-2">
							<span className="text-sm font-medium">Copy</span>
							<Textarea
								id="post-copy"
								className="min-h-40 rounded-[24px]"
								placeholder="Draft the caption or thread opener here..."
							/>
						</div>
						<div className="space-y-3 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<div className="font-medium">Attached resources</div>
									<div className="text-sm text-muted-foreground">
										Select from the shared workspace library so the same media
										can be reused across platform-specific posts later.
									</div>
								</div>
								<ResourcePicker
									resources={resources}
									resourceSets={resourceSets}
									resolveResourceSetIds={resolveResourceSetIds}
									value={selectedResourceIds}
									onChange={setSelectedResourceIds}
									triggerLabel="Attach from library"
								/>
							</div>
							<ResourceChipList
								resources={selectedResources}
								onRemove={(resourceId: string) =>
									setSelectedResourceIds((current) =>
										current.filter((item) => item !== resourceId),
									)
								}
							/>
						</div>
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

						<SurfaceCard tone="muted" className="space-y-3 p-5">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<Layers3 className="size-4" />
								</div>
								<div>
									<div className="font-medium">Reusable media</div>
									<div className="text-sm text-muted-foreground">
										{selectedResources.length} shared resource
										{selectedResources.length === 1 ? "" : "s"} attached in this
										UI-only compose flow.
									</div>
								</div>
							</div>
							<ResourceChipList resources={selectedResources.slice(0, 2)} />
						</SurfaceCard>
					</div>
				</div>
			</DashboardPanel>
		</div>
	);
}
