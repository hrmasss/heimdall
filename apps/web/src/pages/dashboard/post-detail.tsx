import {
	ArrowLeft,
	CalendarRange,
	CheckCircle2,
	FileText,
	PencilLine,
	Send,
	Trash2,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { SurfaceCard } from "@/components/app/brand";
import { DashboardPageHeader } from "@/components/app/dashboard";
import { ResourceChipList } from "@/components/resources/resource-display";
import { Button } from "@/components/ui/button";
import type { PostDetail, PostVariant, ResourceRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function renderContentPayload(
	contentKind: string,
	payload: Record<string, unknown>,
) {
	if (contentKind === "thread" && Array.isArray(payload.items)) {
		return payload.items
			.map((item, index) =>
				typeof item === "object" &&
				item !== null &&
				"body" in item &&
				typeof item.body === "string"
					? `${index + 1}. ${item.body}`
					: "",
			)
			.filter(Boolean)
			.join("\n");
	}
	if (contentKind === "article") {
		return [payload.title, payload.body].filter(Boolean).join("\n\n");
	}
	return typeof payload.body === "string" ? payload.body : "";
}

function MetricStrip({
	items,
}: { items?: { label: string; value: number; unit: string }[] }) {
	if (!items?.length) {
		return (
			<div className="text-sm text-muted-foreground">
				No KPI observations recorded yet.
			</div>
		);
	}
	return (
		<div className="grid gap-3 md:grid-cols-3">
			{items.map((item) => (
				<div
					key={item.label}
					className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4"
				>
					<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{item.label}
					</div>
					<div className="mt-2 text-2xl font-semibold">
						{item.value.toLocaleString()}{" "}
						<span className="text-sm font-normal text-muted-foreground">
							{item.unit}
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

export function DashboardPostDetailPage() {
	const navigate = useNavigate();
	const { id = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [post, setPost] = useState<PostDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadPost = useCallback(async () => {
		if (!activeWorkspaceId) {
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const response = await customerRequest<PostDetail>(`/posts/${id}`);
			setPost(response);
		} catch (loadError) {
			setError(
				loadError instanceof Error
					? loadError.message
					: "Unable to load this post.",
			);
		} finally {
			setLoading(false);
		}
	}, [activeWorkspaceId, customerRequest, id]);

	useEffect(() => {
		void loadPost();
	}, [loadPost]);

	async function deletePost() {
		setSaving(true);
		setError(null);
		try {
			await customerRequest(`/posts/${id}`, { method: "DELETE" });
			navigate("/dashboard/posts");
		} catch (deleteError) {
			setError(
				deleteError instanceof Error
					? deleteError.message
					: "Unable to delete this post.",
			);
		} finally {
			setSaving(false);
		}
	}

	async function updateReviewState(
		variant: PostVariant,
		action: "submit" | "approved" | "changes_requested",
	) {
		setSaving(true);
		setError(null);
		try {
			if (action === "submit") {
				await customerRequest(`/posts/variants/${variant.id}/reviews/submit`, {
					method: "POST",
					body: { comment: "" },
				});
			} else {
				await customerRequest(
					`/posts/variants/${variant.id}/reviews/decision`,
					{
						method: "POST",
						body: { approvalState: action, comment: "" },
					},
				);
			}
			await loadPost();
		} catch (reviewError) {
			setError(
				reviewError instanceof Error
					? reviewError.message
					: "Unable to update the review state.",
			);
		} finally {
			setSaving(false);
		}
	}

	const aggregateMetrics =
		post?.metricSnapshot?.slice(0, 3).map((item) => ({
			label: item.label,
			value: item.value,
			unit: item.unit,
		})) ?? [];

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Posts"
				title={post?.title ?? "Post detail"}
				description="Review the canonical post, inspect each platform variant, and track publication planning plus KPI rollups from one page."
				actions={
					<>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to="/dashboard/posts">
								<ArrowLeft className="size-4" />
								Back
							</Link>
						</Button>
						<Button variant="outline" className="rounded-full" asChild>
							<Link to={`/dashboard/posts/${id}/edit`}>
								<PencilLine className="size-4" />
								Edit
							</Link>
						</Button>
						<Button
							variant="outline"
							className="rounded-full text-red-600"
							onClick={() => void deletePost()}
							disabled={saving}
						>
							<Trash2 className="size-4" />
							Delete
						</Button>
					</>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
				<div className="space-y-6">
					<SurfaceCard className="space-y-4 p-5 md:p-6">
						<div className="flex items-center gap-2">
							<FileText className="size-4 text-primary" />
							<div className="text-lg font-semibold">Generic post</div>
						</div>
						{loading || !post ? (
							<div className="text-sm text-muted-foreground">
								Loading post...
							</div>
						) : (
							<>
								<div className="rounded-[24px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Content
									</div>
									<pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground font-sans">
										{renderContentPayload(
											post.contentKind,
											post.contentPayload,
										)}
									</pre>
								</div>
								<div>
									<div className="text-sm font-medium">Generic assets</div>
									<div className="mt-3">
										<ResourceChipList
											resources={post.assets as ResourceRecord[]}
										/>
									</div>
								</div>
							</>
						)}
					</SurfaceCard>

					<SurfaceCard className="space-y-4 p-5 md:p-6">
						<div className="text-lg font-semibold">Aggregate performance</div>
						<MetricStrip items={aggregateMetrics} />
					</SurfaceCard>

					<SurfaceCard className="space-y-4 p-5 md:p-6">
						<div className="text-lg font-semibold">Platform variants</div>
						{loading || !post ? (
							<div className="text-sm text-muted-foreground">
								Loading variants...
							</div>
						) : post.variants.length === 0 ? (
							<div className="text-sm text-muted-foreground">
								No variants created yet.
							</div>
						) : (
							<div className="space-y-4">
								{post.variants.map((variant) => (
									<SurfaceCard
										key={variant.id}
										tone="muted"
										className="space-y-4 p-5"
									>
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div>
												<div className="font-semibold">
													{variant.platform} · {variant.surface}
												</div>
												<div className="mt-1 text-sm text-muted-foreground">
													Approval: {variant.approvalState} · Publish:{" "}
													{variant.latestPublication?.publicationState ??
														"unscheduled"}
												</div>
											</div>
											<div className="flex flex-wrap gap-2">
												<Button
													variant="outline"
													size="sm"
													className="rounded-full"
													disabled={saving}
													onClick={() =>
														void updateReviewState(variant, "submit")
													}
												>
													<Send className="size-4" />
													Submit
												</Button>
												<Button
													variant="outline"
													size="sm"
													className="rounded-full"
													disabled={saving}
													onClick={() =>
														void updateReviewState(variant, "approved")
													}
												>
													<CheckCircle2 className="size-4" />
													Approve
												</Button>
												<Button
													variant="outline"
													size="sm"
													className="rounded-full"
													disabled={saving}
													onClick={() =>
														void updateReviewState(variant, "changes_requested")
													}
												>
													<XCircle className="size-4" />
													Request changes
												</Button>
											</div>
										</div>

										{variant.contentMode === "custom" ? (
											<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm">
												<pre className="whitespace-pre-wrap font-sans leading-6">
													{renderContentPayload(
														variant.contentKind ?? post.contentKind,
														variant.contentPayload ?? {},
													)}
												</pre>
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												Inherits the generic post content.
											</div>
										)}

										<div className="grid gap-4 md:grid-cols-2">
											<div>
												<div className="text-sm font-medium">
													Effective assets
												</div>
												<div className="mt-3">
													<ResourceChipList
														resources={
															variant.effectiveAssets as ResourceRecord[]
														}
													/>
												</div>
											</div>
											<div className="space-y-3">
												<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm">
													<div className="font-medium">Publication plan</div>
													<div className="mt-2 text-muted-foreground">
														{variant.latestPublication?.plannedAt
															? new Date(
																	variant.latestPublication.plannedAt,
																).toLocaleString()
															: "No planned time yet"}
													</div>
												</div>
												<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4 text-sm">
													<div className="font-medium">Review timeline</div>
													<div className="mt-2 space-y-2">
														{variant.reviewHistory?.length ? (
															variant.reviewHistory.map((review) => (
																<div
																	key={review.id}
																	className="text-muted-foreground"
																>
																	{review.decision} ·{" "}
																	{new Date(review.createdAt).toLocaleString()}
																</div>
															))
														) : (
															<div className="text-muted-foreground">
																No review events yet.
															</div>
														)}
													</div>
												</div>
											</div>
										</div>

										<MetricStrip
											items={variant.metricSnapshot
												?.slice(0, 3)
												.map((item) => ({
													label: item.label,
													value: item.value,
													unit: item.unit,
												}))}
										/>
									</SurfaceCard>
								))}
							</div>
						)}
					</SurfaceCard>
				</div>

				<div className="space-y-6">
					<SurfaceCard className="space-y-4 p-5">
						<div className="text-lg font-semibold">Overview</div>
						{loading || !post ? (
							<div className="text-sm text-muted-foreground">Loading...</div>
						) : (
							<>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Approval
									</div>
									<div className="mt-2 text-xl font-semibold">
										{post.aggregateApprovalState}
									</div>
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Publication
									</div>
									<div className="mt-2 text-xl font-semibold">
										{post.aggregatePublicationState}
									</div>
								</div>
								<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/55 p-4">
									<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
										Latest planned slot
									</div>
									<div className="mt-2 text-sm">
										{post.latestPlannedAt
											? new Date(post.latestPlannedAt).toLocaleString()
											: "No scheduled variants yet"}
									</div>
								</div>
							</>
						)}
					</SurfaceCard>

					<SurfaceCard className="space-y-4 p-5">
						<div className="flex items-center gap-2">
							<CalendarRange className="size-4 text-primary" />
							<div className="text-lg font-semibold">Internal notes</div>
						</div>
						<div className="text-sm text-muted-foreground">
							{post?.notes || "No internal notes recorded."}
						</div>
					</SurfaceCard>
				</div>
			</div>
		</div>
	);
}
