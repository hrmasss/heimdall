import {
	ArrowRight,
	Building2,
	LoaderCircle,
	LogOut,
	Shield,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AdminFormPage, AdminFormSection } from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

function defaultWorkspaceName(fullName: string) {
	const trimmedName = fullName.trim();
	if (!trimmedName) {
		return "My Workspace";
	}
	return trimmedName.toLowerCase().endsWith("s")
		? `${trimmedName}' Workspace`
		: `${trimmedName}'s Workspace`;
}

export function DashboardOnboardingPage() {
	const navigate = useNavigate();
	const {
		customerSession,
		customerRequest,
		reloadCustomerSession,
		logoutCustomer,
	} = useAuth();
	const [workspaceName, setWorkspaceName] = useState("");
	const [workspaceNameTouched, setWorkspaceNameTouched] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const suggestedWorkspaceName = defaultWorkspaceName(
		customerSession?.user.fullName ?? "",
	);

	useEffect(() => {
		if (workspaceNameTouched) {
			return;
		}
		setWorkspaceName(suggestedWorkspaceName);
	}, [suggestedWorkspaceName, workspaceNameTouched]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await customerRequest("/workspaces", {
				method: "POST",
				body: {
					name: workspaceName.trim() || suggestedWorkspaceName,
				},
				workspaceId: null,
			});
			await reloadCustomerSession();
			navigate("/dashboard/settings/intelligence?onboarding=1", {
				replace: true,
			});
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to create the first workspace.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminFormPage
			eyebrow="Workspace onboarding"
			title="Create your first workspace"
			description="Every account signs into the customer dashboard first. If this user does not belong to a workspace yet, finish the initial workspace setup here."
			actions={
				<Button
					variant="outline"
					className="rounded-full"
					onClick={() => {
						void logoutCustomer();
						navigate("/login", { replace: true });
					}}
				>
					<LogOut className="size-4" />
					Sign out
				</Button>
			}
			aside={
				<SurfaceCard className="p-5">
					<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Building2 className="size-5" />
					</div>
					<div className="mt-4 space-y-2">
						<div className="text-lg font-semibold">Account routing</div>
						<p className="text-sm text-muted-foreground">
							Platform roles such as support or super admin stay attached to the
							user account. Workspace access is separate, so the first tenant
							still needs to be created or joined here.
						</p>
					</div>
					<div className="mt-4 space-y-3 text-sm text-muted-foreground">
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
							<div className="flex items-center gap-2 font-medium text-foreground">
								<Sparkles className="size-4 text-primary" />
								What happens next
							</div>
							<div className="mt-2">
								You become the first workspace owner and the dashboard will
								switch into the normal workspace-scoped experience.
							</div>
						</div>
						<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
							<div className="font-medium text-foreground">User account</div>
							<div className="mt-2">
								{customerSession?.user.fullName ?? "User"} ·{" "}
								{customerSession?.user.email ?? "No email loaded"}
							</div>
						</div>
					</div>
				</SurfaceCard>
			}
		>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<AdminFormSection
					title="Workspace identity"
					description="Start with a clear customer-facing name. This becomes the tenant label shown in the dashboard, sharing flows, and future billing records."
				>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="grid gap-2 md:col-span-2">
							<Label htmlFor="workspace-onboarding-name">Workspace name</Label>
							<Input
								id="workspace-onboarding-name"
								name="workspaceName"
								value={workspaceName}
								onChange={(event) => {
									setWorkspaceNameTouched(true);
									setWorkspaceName(event.target.value);
								}}
								className="h-11 rounded-2xl"
								placeholder={suggestedWorkspaceName}
							/>
							<div className="text-xs text-muted-foreground">
								Leave it blank and Heimdall will use {suggestedWorkspaceName}.
							</div>
						</div>
					</div>
				</AdminFormSection>

				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}

				<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Shield className="size-4" />
						Workspace memberships and platform roles remain intentionally
						separate.
					</div>
					<Button
						type="submit"
						disabled={saving}
						className="rounded-full border-0 bg-gradient-brand text-white"
					>
						{saving ? (
							<>
								<LoaderCircle className="size-4 animate-spin" />
								Creating workspace...
							</>
						) : (
							<>
								Create workspace
								<ArrowRight className="size-4" />
							</>
						)}
					</Button>
				</SurfaceCard>
			</form>
		</AdminFormPage>
	);
}
