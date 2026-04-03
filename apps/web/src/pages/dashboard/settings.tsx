import {
	ArrowRight,
	Building2,
	CreditCard,
	Settings2,
	ShieldCheck,
	Sparkles,
	Users2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspaceSetupReadiness } from "@/hooks/use-workspace-setup-readiness";
import type { WorkspaceSummary } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { useDisplayDensity } from "@/lib/display-density";

function readinessTone(ready: boolean) {
	return ready
		? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
		: "border-amber-500/20 bg-amber-500/10 text-amber-700";
}

export function DashboardSettings() {
	const { activeWorkspaceId, customerRequest, hasCustomerPermission } =
		useAuth();
	const { density, setDensity } = useDisplayDensity();
	const { loading, error, workspace, context, social, readiness, reload } =
		useWorkspaceSetupReadiness();
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setName(workspace?.name ?? "");
	}, [workspace?.name]);

	const canManageSettings = hasCustomerPermission(
		"workspace.settings.manage",
		workspace?.capabilities,
	);
	const canManageBilling = hasCustomerPermission(
		"workspace.billing.manage",
		workspace?.capabilities,
	);

	const saveProfile = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setSaving(true);
		try {
			await customerRequest<WorkspaceSummary>(`/workspaces/${activeWorkspaceId}`, {
				method: "PATCH",
				body: { name },
			});
			toast.success("Workspace profile updated.");
			await reload();
		} catch (saveError) {
			toast.error(
				saveError instanceof Error
					? saveError.message
					: "Unable to save workspace profile.",
			);
		} finally {
			setSaving(false);
		}
	}, [activeWorkspaceId, customerRequest, name, reload]);

	return (
		<div className="dashboard-page-stack">
			<DashboardPageHeader
				eyebrow="Command center"
				title="Settings"
				description="See whether the workspace is ready to publish, which setup areas still need attention, and where to go next."
			/>

			<SurfaceCard className="overflow-hidden rounded-[32px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(216,163,91,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.78))] p-6 shadow-[0_30px_80px_-48px_rgba(66,32,17,0.45)] md:p-7">
				<div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
					<div className="space-y-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-border-soft)] bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							<Settings2 className="size-3.5 text-primary" />
							Workspace readiness
						</div>
						<div className="space-y-3">
							<h2 className="text-2xl font-semibold tracking-tight">
								{readiness.publishingReady
									? "Yes, this workspace is ready to publish."
									: "Not yet. One more publishing path still needs setup."}
							</h2>
							<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
								{readiness.summary}
							</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline" className={`rounded-full ${readinessTone(readiness.publishingReady)}`}>
								Publishing {readiness.publishingReady ? "ready" : "needs setup"}
							</Badge>
							<Badge variant="outline" className={`rounded-full ${readinessTone(readiness.intelligenceReady)}`}>
								Intelligence {readiness.intelligenceReady ? "ready" : "optional"}
							</Badge>
							<Badge variant="outline" className="rounded-full border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground">
								{readiness.completedStepCount}/{readiness.requiredStepCount} recommended steps complete
							</Badge>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Healthy providers
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{social?.connections.filter((connection) => connection.healthStatus === "healthy").length ?? 0}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Connections that can currently support publishing.
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Selected destinations
							</div>
							<div className="mt-3 text-3xl font-semibold tracking-tight">
								{social?.targets.filter((target) => target.isSelected).length ?? 0}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Default places Heimdall will publish to.
							</div>
						</SurfaceCard>
						<SurfaceCard tone="muted" className="p-5">
							<div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								AI basics
							</div>
							<div className="mt-3 text-lg font-semibold tracking-tight">
								{readiness.intelligenceReady ? "In place" : "Still optional"}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Business context and AI access improve drafts and workflows later.
							</div>
						</SurfaceCard>
					</div>
				</div>

				<div className="mt-5 flex flex-wrap gap-2">
					<Button className="rounded-full border-0 bg-gradient-brand text-white" asChild>
						<Link to="/dashboard/setup">
							Continue setup
							<ArrowRight className="size-4" />
						</Link>
					</Button>
					{readiness.publishingReady ? (
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/posts/new">Create post</Link>
						</Button>
					) : null}
				</div>
			</SurfaceCard>

			<DashboardPanel
				title="Workspace operations"
				description="The core setup areas live here. Each card tells you what is ready now and where to make the next change."
			>
				<div className="grid gap-4 xl:grid-cols-2">
					<SurfaceCard className="dashboard-card space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-lg font-medium">
									<Settings2 className="size-5 text-primary" />
									Publishing layer
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Connect providers, choose destinations, and keep publishing health green.
								</div>
							</div>
							<Badge variant="outline" className={`rounded-full ${readinessTone(readiness.publishingReady)}`}>
								{readiness.publishingReady ? "Ready" : "Needs attention"}
							</Badge>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4 text-sm text-muted-foreground">
								{social?.connections.length ?? 0} provider connection
								{(social?.connections.length ?? 0) === 1 ? "" : "s"} total
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4 text-sm text-muted-foreground">
								{social?.targets.filter((target) => target.isSelected).length ?? 0} selected destination
								{(social?.targets.filter((target) => target.isSelected).length ?? 0) === 1 ? "" : "s"}
							</div>
						</div>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/platforms">
								Open platform setup
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</SurfaceCard>

					<SurfaceCard className="dashboard-card space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-lg font-medium">
									<Sparkles className="size-5 text-primary" />
									Intelligence basics
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Add the shortest set of business facts and access preferences that materially change output.
								</div>
							</div>
							<Badge variant="outline" className={`rounded-full ${readinessTone(readiness.intelligenceReady)}`}>
								{readiness.intelligenceReady ? "Ready" : "Optional"}
							</Badge>
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm">
								<span>Business context</span>
								<span>{context?.readiness.hasBusinessContext ? "Ready" : "Missing"}</span>
							</div>
							<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm">
								<span>AI access</span>
								<span>{context?.readiness.hasAiAccess ? "Ready" : "Needs setup"}</span>
							</div>
							<div className="flex items-center justify-between rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 px-4 py-3 text-sm">
								<span>Brand guidance</span>
								<span>{context?.readiness.hasBrandContext ? "Ready" : "Optional"}</span>
							</div>
						</div>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/settings/intelligence">
								Open intelligence
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</SurfaceCard>

					<SurfaceCard className="dashboard-card space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-lg font-medium">
									<Building2 className="size-5 text-primary" />
									Workspace identity
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Keep the workspace name and slug accurate for sharing, billing, and team coordination.
								</div>
							</div>
							<Badge variant="outline" className="rounded-full border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground">
								{workspace?.slug ?? "Not loaded"}
							</Badge>
						</div>
						<div className="space-y-2">
							<label htmlFor="workspace-name" className="text-sm font-medium">
								Workspace name
							</label>
							<Input
								id="workspace-name"
								className="dashboard-input-height rounded-2xl"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={!canManageSettings}
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="workspace-slug" className="text-sm font-medium">
								Workspace slug
							</label>
							<Input
								id="workspace-slug"
								className="dashboard-input-height rounded-2xl"
								value={workspace?.slug ?? ""}
								readOnly
							/>
						</div>
						<Button
							className="rounded-full border-0 bg-gradient-brand text-white"
							disabled={!canManageSettings || saving}
							onClick={() => void saveProfile()}
						>
							{saving ? "Saving..." : "Save profile"}
						</Button>
					</SurfaceCard>

					<SurfaceCard className="dashboard-card space-y-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="flex items-center gap-2 text-lg font-medium">
									<ShieldCheck className="size-5 text-primary" />
									Team, billing, and governance
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Review who can access the workspace and which finance controls are available in this role bundle.
								</div>
							</div>
							<Badge variant="outline" className="rounded-full border-[var(--brand-border-soft)] bg-background/70 text-muted-foreground">
								{workspace?.capabilities.length ?? 0} capabilities
							</Badge>
						</div>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<Users2 className="size-4 text-primary" />
									Team access
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									Invite and manage workspace members from the Team page.
								</div>
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-4">
								<div className="flex items-center gap-2 text-sm font-medium">
									<CreditCard className="size-4 text-primary" />
									Billing access
								</div>
								<div className="mt-2 text-sm text-muted-foreground">
									{canManageBilling
										? "Your role can manage billing for this workspace."
										: "Your role can view operational setup, but not billing management."}
								</div>
							</div>
						</div>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/team">
								Open team
								<ArrowRight className="size-4" />
							</Link>
						</Button>
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Personal preferences"
				description="These are local display choices for this device. They should stay out of the main workspace setup path."
			>
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
					<SurfaceCard tone="muted" className="dashboard-card space-y-4">
						<div className="space-y-2">
							<div className="text-sm font-medium">Display density</div>
							<div className="text-sm text-muted-foreground">
								Comfortable keeps the roomy command-deck feel. Compact trims shell padding when you want more on screen.
							</div>
						</div>
						<div className="dashboard-density-toggle w-fit" role="tablist" aria-label="Display density">
							<button
								type="button"
								role="tab"
								aria-selected={density === "comfortable"}
								data-active={density === "comfortable"}
								className="dashboard-density-toggle__option"
								onClick={() => setDensity("comfortable")}
							>
								Comfortable
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={density === "compact"}
								data-active={density === "compact"}
								className="dashboard-density-toggle__option"
								onClick={() => setDensity("compact")}
							>
								Compact
							</button>
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="dashboard-card space-y-3">
						<div className="text-sm font-medium">Active mode</div>
						<div className="text-lg font-semibold tracking-tight">
							{density === "compact" ? "Compact" : "Comfortable"}
						</div>
						<div className="text-sm text-muted-foreground">
							This preference is saved locally and applied immediately.
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>

			{loading ? (
				<SurfaceCard className="dashboard-card-sm text-sm text-muted-foreground">
					Loading setup status...
				</SurfaceCard>
			) : null}
			{error ? (
				<SurfaceCard className="dashboard-card-sm border border-destructive/20 bg-destructive/10 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}
		</div>
	);
}
