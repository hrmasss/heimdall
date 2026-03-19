import {
	ArrowRight,
	Bell,
	CreditCard,
	Settings2,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSocialConnectionSummary } from "@/hooks/use-social-connection-summary";
import type { WorkspaceSummary } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { useDisplayDensity } from "@/lib/display-density";
import { formatPlatformLabel, platformIcon } from "@/lib/platforms";

const preferenceCards = [
	{
		icon: Bell,
		title: "Approval notifications",
		description: "Send reminders when posts sit in review over 4 hours.",
	},
	{
		icon: ShieldCheck,
		title: "Governance locks",
		description: "Prevent scheduling when required asset checks are missing.",
	},
	{
		icon: Sparkles,
		title: "AI assistance",
		description:
			"Allow caption and summary suggestions in compose and review surfaces.",
	},
];

export function DashboardSettings() {
	const { activeWorkspaceId, customerRequest, hasCustomerPermission } =
		useAuth();
	const { density, setDensity } = useDisplayDensity();
	const { loading: loadingConnections, summary } = useSocialConnectionSummary();
	const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
	const [name, setName] = useState("");
	const [saving, setSaving] = useState(false);

	const loadWorkspace = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		const response = await customerRequest<WorkspaceSummary>(
			`/workspaces/${activeWorkspaceId}`,
		);
		setWorkspace(response);
		setName(response.name);
	}, [activeWorkspaceId, customerRequest]);

	useEffect(() => {
		void loadWorkspace();
	}, [loadWorkspace]);

	const canManageSettings = hasCustomerPermission(
		"workspace.settings.manage",
		workspace?.capabilities,
	);
	const canManageBilling = hasCustomerPermission(
		"workspace.billing.manage",
		workspace?.capabilities,
	);
	const connectedProviders = useMemo(
		() => summary.connectedProviders.slice(0, 4),
		[summary.connectedProviders],
	);

	async function saveProfile() {
		if (!activeWorkspaceId) {
			return;
		}
		setSaving(true);
		try {
			const updated = await customerRequest<WorkspaceSummary>(
				`/workspaces/${activeWorkspaceId}`,
				{
					method: "PATCH",
					body: { name },
				},
			);
			setWorkspace(updated);
			setName(updated.name);
			toast.success("Workspace profile updated.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Preferences"
				title="Settings"
				description="Manage workspace identity, connection setup, governance controls, and billing visibility from a cleaner hub."
			/>

			<DashboardPanel
				title="Display preferences"
				description="Choose how spacious Heimdall feels across the dashboard, auth, and marketing surfaces on this device."
			>
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="space-y-2">
							<div className="text-sm font-medium">Display density</div>
							<div className="text-sm text-muted-foreground">
								Comfortable keeps the current roomy feel. Compact trims padding,
								radii, and large shell sizing so more fits on smaller screens.
							</div>
						</div>
						<div
							className="dashboard-density-toggle w-fit"
							role="tablist"
							aria-label="Display density"
						>
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

					<SurfaceCard tone="muted" className="space-y-3 p-5">
						<div className="text-sm font-medium">Active mode</div>
						<div className="text-lg font-semibold tracking-tight">
							{density === "compact" ? "Compact" : "Comfortable"}
						</div>
						<div className="text-sm text-muted-foreground">
							This preference is saved locally and applied immediately across
							user-facing Heimdall pages.
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Workspace profile"
				description="Update the workspace name and review the permissions available in the current role bundle."
			>
				<div className="grid gap-4 lg:grid-cols-2">
					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="space-y-2">
							<label htmlFor="workspace-name" className="text-sm font-medium">
								Workspace name
							</label>
							<Input
								id="workspace-name"
								className="h-10 rounded-2xl"
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
								className="h-10 rounded-2xl"
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

					<SurfaceCard tone="muted" className="space-y-4 p-5">
						{preferenceCards.map((item) => (
							<div
								key={item.title}
								className="flex items-start gap-3 rounded-[22px] border border-[var(--brand-border-soft)] bg-background/70 p-4"
							>
								<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
									<item.icon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="font-medium">{item.title}</div>
									<div className="mt-1 text-sm text-muted-foreground">
										{item.description}
									</div>
								</div>
								<div className="pill pill-success">
									{canManageSettings ? "Editable" : "View"}
								</div>
							</div>
						))}
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Workspace intelligence"
				description="Business context, brand identity, and AI access now live in one dedicated setup area so prompts stay concise and decision-relevant."
				action={
					<Button className="rounded-full" asChild>
						<Link to="/dashboard/settings/intelligence">
							Open intelligence
							<ArrowRight className="size-4" />
						</Link>
					</Button>
				}
			>
				<div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
					<SurfaceCard className="rounded-[28px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(216,163,91,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.78))] p-5">
						<div className="flex items-start gap-4">
							<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<Sparkles className="size-5" />
							</div>
							<div className="space-y-3">
								<div className="text-lg font-medium">
									Give AI only what should change the result.
								</div>
								<div className="text-sm text-muted-foreground">
									Instead of generic tone sliders, Heimdall now lets each
									workspace define business context, visual rules, and access
									preferences that can be selectively injected into post, campaign,
									image, and reel workflows.
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="rounded-full">
										Business context
									</Badge>
									<Badge variant="outline" className="rounded-full">
										Brand system
									</Badge>
									<Badge variant="outline" className="rounded-full">
										AI access
									</Badge>
								</div>
							</div>
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="text-sm font-medium">What’s inside</div>
						<div className="space-y-3">
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-3 text-sm text-muted-foreground">
								Describe the business in plain language and edit the extracted
								facts that truly matter.
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-3 text-sm text-muted-foreground">
								Store design tokens, visual guardrails, and an optional reference
								image for future image and reel generation.
							</div>
							<div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-3 text-sm text-muted-foreground">
								Choose platform-native AI or approved GPT/Gemini BYOK access for
								the workspace.
							</div>
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Platform connections"
				description="Publishing, scheduling, target validation, and streamlined social operations live in a dedicated guided setup page now."
				action={
					<Button className="rounded-full" asChild>
						<Link to="/dashboard/settings/platforms">
							Open platform setup
							<ArrowRight className="size-4" />
						</Link>
					</Button>
				}
			>
				<div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
					<SurfaceCard className="rounded-[28px] border border-[var(--brand-border-soft)] bg-[radial-gradient(circle_at_top_left,rgba(195,123,79,0.14),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.76))] p-5">
						<div className="flex items-start gap-4">
							<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
								<Settings2 className="size-5" />
							</div>
							<div className="space-y-3">
								<div>
									<div className="text-lg font-medium">
										{summary.hasHealthySelectedTarget
											? "Your publishing layer is connected."
											: "Connect platforms to unlock direct publishing."}
									</div>
									<div className="mt-2 text-sm text-muted-foreground">
										Heimdall still works for planning and campaign coordination
										without this setup. Connecting platforms is recommended when
										you want to post on behalf of the workspace, schedule into
										real channels, and keep monitoring more operational.
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Badge variant="outline" className="rounded-full">
										{loadingConnections
											? "Checking connection health..."
											: `${summary.providerCount} provider${summary.providerCount === 1 ? "" : "s"} connected`}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{summary.healthyConnectionCount} healthy connection
										{summary.healthyConnectionCount === 1 ? "" : "s"}
									</Badge>
									<Badge variant="outline" className="rounded-full">
										{summary.selectedTargetCount} selected target
										{summary.selectedTargetCount === 1 ? "" : "s"}
									</Badge>
								</div>
							</div>
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="space-y-4 p-5">
						<div className="text-sm font-medium">Connected providers</div>
						{connectedProviders.length > 0 ? (
							<div className="grid gap-3">
								{connectedProviders.map((provider) => (
									<div
										key={provider}
										className="flex items-center gap-3 rounded-[20px] border border-[var(--brand-border-soft)] bg-background/70 p-3"
									>
										<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
											{platformIcon(provider)}
										</div>
										<div>
											<div className="font-medium">
												{formatPlatformLabel(provider)}
											</div>
											<div className="text-xs text-muted-foreground">
												Connected to this workspace
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="rounded-[22px] border border-dashed border-[var(--brand-border-soft)] bg-background/60 px-4 py-5 text-sm text-muted-foreground">
								No platform connections yet. Start with the Heimdall-managed app
								for the fastest setup.
							</div>
						)}
					</SurfaceCard>
				</div>
			</DashboardPanel>

			<DashboardPanel
				title="Billing and governance"
				description="The billing module is exposed separately so finance access can be combined with other roles without a custom role builder."
			>
				<div className="grid gap-4 md:grid-cols-2">
					<SurfaceCard tone="muted" className="p-5">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<CreditCard className="size-4" />
						</div>
						<div className="mt-4 text-lg font-medium">Billing access</div>
						<div className="mt-2 text-sm text-muted-foreground">
							{canManageBilling
								? "You can manage billing for this workspace."
								: "Your current role bundle does not include billing management."}
						</div>
					</SurfaceCard>

					<SurfaceCard tone="muted" className="p-5">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<ShieldCheck className="size-4" />
						</div>
						<div className="mt-4 text-lg font-medium">Granted capabilities</div>
						<div className="mt-2 flex flex-wrap gap-2">
							{workspace?.capabilities.map((permission) => (
								<span key={permission.code} className="pill pill-info">
									{permission.label}
								</span>
							))}
						</div>
					</SurfaceCard>
				</div>
			</DashboardPanel>
		</div>
	);
}
