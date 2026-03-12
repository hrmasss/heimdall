import {
	ArrowLeft,
	FolderKanban,
	LoaderCircle,
	PencilLine,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { AdminFormPage, AdminFormSection } from "@/components/admin/form-page";
import { SurfaceCard } from "@/components/app/brand";
import {
	ResourceThumb,
	formatResourceMeta,
} from "@/components/resources/resource-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResourceDetail } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export function DashboardLibraryFormPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [resource, setResource] = useState<ResourceDetail | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!activeWorkspaceId) {
			return;
		}

		let cancelled = false;
		async function loadResource() {
			setLoading(true);
			setError(null);
			try {
				const response = await customerRequest<ResourceDetail>(
					`/resources/${id}`,
				);
				if (cancelled) {
					return;
				}
				setResource(response);
				setDisplayName(response.displayName);
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Unable to load this resource.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void loadResource();
		return () => {
			cancelled = true;
		};
	}, [activeWorkspaceId, customerRequest, id]);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await customerRequest<ResourceDetail>(`/resources/${id}`, {
				method: "PATCH",
				body: { displayName },
			});
			navigate(`/dashboard/library/${id}`);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Unable to save the resource.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<AdminFormPage
			eyebrow="Workspace resources"
			title="Edit resource"
			description="Adjust the shared library label without changing the underlying file or workspace-scoped metadata."
			actions={
				<Button variant="outline" className="rounded-full" asChild>
					<Link to={`/dashboard/library/${id}`}>
						<ArrowLeft className="size-4" />
						Back to detail
					</Link>
				</Button>
			}
			aside={
				<SurfaceCard className="p-5">
					<div className="overflow-hidden rounded-[24px] border border-[var(--brand-border-soft)] bg-muted">
						<div className="aspect-[16/10]">
							{resource ? <ResourceThumb resource={resource} /> : null}
						</div>
					</div>
					<div className="mt-4 space-y-2">
						<div className="text-lg font-semibold">
							{resource?.displayName ?? "Resource"}
						</div>
						<div className="text-sm text-muted-foreground">
							{resource
								? formatResourceMeta(resource)
								: "Loading resource summary..."}
						</div>
					</div>
					<div className="mt-4 rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm text-muted-foreground">
						<div className="font-medium text-foreground">Immutable fields</div>
						<div className="mt-2">
							Original file name, MIME type, checksum, and stored binary are
							fixed after upload. Transform operations should create variants
							instead of editing the original asset in place.
						</div>
					</div>
				</SurfaceCard>
			}
		>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<AdminFormSection
					title="Display settings"
					description="Rename the reusable asset so it reads well in pickers, lists, and future composer flows."
				>
					{loading ? (
						<div className="flex items-center gap-3 text-sm text-muted-foreground">
							<LoaderCircle className="size-4 animate-spin" />
							Loading resource...
						</div>
					) : (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="resource-display-name">Display name</Label>
								<Input
									id="resource-display-name"
									name="displayName"
									value={displayName}
									onChange={(event) => setDisplayName(event.target.value)}
									className="h-11 rounded-2xl"
									placeholder="Launch hero crop"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="resource-original-name">Original file</Label>
								<Input
									id="resource-original-name"
									value={resource?.originalName ?? ""}
									className="h-11 rounded-2xl"
									readOnly
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="resource-source-type">Source type</Label>
								<Input
									id="resource-source-type"
									value={resource?.sourceType ?? ""}
									className="h-11 rounded-2xl"
									readOnly
								/>
							</div>
						</div>
					)}
				</AdminFormSection>

				{error ? (
					<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</SurfaceCard>
				) : null}

				<SurfaceCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<FolderKanban className="size-4" />
						Use variants for crops, aspect-ratio changes, or brand treatments.
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" className="rounded-full" asChild>
							<Link to={`/dashboard/library/${id}`}>Cancel</Link>
						</Button>
						<Button
							type="submit"
							disabled={loading || saving}
							className="rounded-full border-0 bg-gradient-brand text-white"
						>
							{saving ? (
								<>
									<LoaderCircle className="size-4 animate-spin" />
									Saving...
								</>
							) : (
								<>
									<PencilLine className="size-4" />
									Save resource
								</>
							)}
						</Button>
					</div>
				</SurfaceCard>
			</form>
		</AdminFormPage>
	);
}
