import { Layers3, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
	ResourceCompatibilityBadge,
	ResourceKindIcon,
	ResourceThumb,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ResourceRecord } from "@/lib/api-types";
import { cn } from "@/lib/utils";

export function ResourcePicker({
	resources,
	value,
	onChange,
	triggerLabel = "Select resources",
	emptyMessage = "Upload resources in the library first.",
}: {
	resources: ResourceRecord[];
	value: string[];
	onChange: (resourceIds: string[]) => void;
	triggerLabel?: string;
	emptyMessage?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [draftValue, setDraftValue] = useState<string[]>(value);

	const filteredResources = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) {
			return resources;
		}
		return resources.filter((resource) =>
			[
				resource.displayName,
				resource.originalName,
				resource.mediaKind,
				resource.mimeType,
			]
				.join(" ")
				.toLowerCase()
				.includes(needle),
		);
	}, [resources, query]);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (nextOpen) {
					setDraftValue(value);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" className="rounded-full">
					<Layers3 className="size-4" />
					{triggerLabel}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>Resource picker</DialogTitle>
					<DialogDescription>
						Attach reusable media from the workspace library.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="rounded-full pl-10"
							placeholder="Search resources"
						/>
					</div>
					{filteredResources.length === 0 ? (
						<div className="rounded-[24px] border border-dashed border-[var(--brand-border-soft)] px-4 py-8 text-center text-sm text-muted-foreground">
							{emptyMessage}
						</div>
					) : (
						<div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
							{filteredResources.map((resource) => {
								const selected = draftValue.includes(resource.id);
								return (
									<button
										key={resource.id}
										type="button"
										onClick={() =>
											setDraftValue((current) =>
												current.includes(resource.id)
													? current.filter((item) => item !== resource.id)
													: [...current, resource.id],
											)
										}
										className={cn(
											"overflow-hidden rounded-[24px] border text-left transition-colors",
											selected
												? "border-primary bg-primary/5"
												: "border-[var(--brand-border-soft)] bg-background/70 hover:bg-accent/40",
										)}
									>
										<div className="aspect-[16/10] overflow-hidden">
											<ResourceThumb resource={resource} />
										</div>
										<div className="space-y-3 p-4">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="truncate font-medium">
														{resource.displayName}
													</div>
													<div className="mt-1 text-xs text-muted-foreground">
														{formatResourceMeta(resource)}
													</div>
												</div>
												<ResourceCompatibilityBadge resource={resource} />
											</div>
											<div className="flex items-center justify-between text-xs text-muted-foreground">
												<span className="inline-flex items-center gap-1.5 capitalize">
													<ResourceKindIcon mediaKind={resource.mediaKind} />
													{resource.mediaKind}
												</span>
												<span>{resource.usageCount} uses</span>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					)}
					<div className="flex items-center justify-between border-t border-border pt-4">
						<div className="text-sm text-muted-foreground">
							{draftValue.length} selected
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								className="rounded-full"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								className="rounded-full bg-gradient-brand text-white border-0"
								onClick={() => {
									onChange(draftValue);
									setOpen(false);
								}}
							>
								Apply selection
							</Button>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
