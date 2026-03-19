import {
	ArrowLeft,
	CheckCircle2,
	Clock3,
	FileSearch,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { SurfaceCard } from "@/components/app/brand";
import {
	DashboardPageHeader,
	DashboardPanel,
} from "@/components/app/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
	ApiListResponse,
	AutomationDefinition,
	AutomationRun,
	WorkflowDefinition,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
	formatAutomationWhen,
	summarizeRunArtifacts,
} from "@/lib/automation-builder";

export function DashboardAutomationRunDetailPage() {
	const { runId = "" } = useParams();
	const { activeWorkspaceId, customerRequest } = useAuth();
	const [run, setRun] = useState<AutomationRun | null>(null);
	const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
	const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
	const [reviewComment, setReviewComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadPage = useCallback(async () => {
		if (!activeWorkspaceId || !runId) {
			return;
		}
		setError(null);
		try {
			const [runResponse, automationResponse, workflowResponse] =
				await Promise.all([
					customerRequest<AutomationRun>(
						`/workspaces/${activeWorkspaceId}/runs/${runId}`,
					),
					customerRequest<ApiListResponse<AutomationDefinition>>(
						`/workspaces/${activeWorkspaceId}/automations`,
					),
					customerRequest<ApiListResponse<WorkflowDefinition>>(
						`/workspaces/${activeWorkspaceId}/workflows`,
					),
				]);
			setRun(runResponse);
			setAutomations(automationResponse.items);
			setWorkflows(workflowResponse.items);
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : "Unable to load run.",
			);
		}
	}, [activeWorkspaceId, customerRequest, runId]);

	useEffect(() => {
		void loadPage();
	}, [loadPage]);

	const sourceLabel = useMemo(() => {
		if (!run) {
			return "Run";
		}
		if (run.workflowId) {
			return (
				workflows.find((workflow) => workflow.id === run.workflowId)?.name ??
				"Workflow run"
			);
		}
		if (run.automationId) {
			return (
				automations.find((automation) => automation.id === run.automationId)
					?.name ?? "Automation run"
			);
		}
		return "Run";
	}, [automations, run, workflows]);

	async function submitReview(decision: "approved" | "changes_requested") {
		if (!activeWorkspaceId || !run) {
			return;
		}
		setSubmitting(true);
		try {
			await customerRequest(
				`/workspaces/${activeWorkspaceId}/runs/${run.id}/reviews`,
				{
					method: "POST",
					body: {
						decision,
						comment:
							reviewComment.trim() ||
							(decision === "approved"
								? "Approved from the run detail page."
								: "Changes requested from the run detail page."),
						findings: [],
					},
				},
			);
			toast.success(
				decision === "approved" ? "Run approved." : "Changes requested.",
			);
			setReviewComment("");
			await loadPage();
		} catch (reviewError) {
			toast.error(
				reviewError instanceof Error
					? reviewError.message
					: "Unable to submit the review.",
			);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				eyebrow="Run detail"
				title={run ? summarizeRunArtifacts(run) : "Automation run"}
				description="Inspect the full step timeline, artifact output, evidence payloads, and review history for this automation or workflow execution."
				actions={
					<Button variant="outline" className="rounded-full" asChild>
						<Link to="/dashboard/automations">
							<ArrowLeft className="size-4" />
							Back to Automations
						</Link>
					</Button>
				}
			/>

			{error ? (
				<SurfaceCard className="border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</SurfaceCard>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-6">
					<DashboardPanel
						title="Execution summary"
						description="Top-level state, source, timestamps, and runtime context."
					>
						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
							<SurfaceCard className="p-5">
								<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
									Source
								</div>
								<div className="mt-3 font-medium">{sourceLabel}</div>
							</SurfaceCard>
							<SurfaceCard className="p-5">
								<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
									Status
								</div>
								<div className="mt-3">
									<Badge variant="outline" className="rounded-full capitalize">
										{run?.status ?? "loading"}
									</Badge>
								</div>
							</SurfaceCard>
							<SurfaceCard className="p-5">
								<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
									Created
								</div>
								<div className="mt-3 font-medium">
									{run ? formatAutomationWhen(run.createdAt) : "Loading..."}
								</div>
							</SurfaceCard>
							<SurfaceCard className="p-5">
								<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
									Context fingerprint
								</div>
								<div className="mt-3 font-mono text-sm">
									{run?.contextFingerprint ?? "Loading..."}
								</div>
							</SurfaceCard>
						</div>
						{run?.lastError ? (
							<div className="mt-4 rounded-[22px] border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
								{run.lastError}
							</div>
						) : null}
					</DashboardPanel>

					<DashboardPanel
						title="Step timeline"
						description="Every step in order, including waiting review checkpoints and evidence payloads."
					>
						<div className="grid gap-4">
							{run?.steps.map((step) => (
								<SurfaceCard key={step.id} className="p-5">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
												Step {step.position}
											</div>
											<div className="mt-2 font-medium">{step.name}</div>
											<div className="mt-2 text-sm text-muted-foreground">
												{step.actionType}
											</div>
										</div>
										<Badge
											variant="outline"
											className="rounded-full capitalize"
										>
											{step.state}
										</Badge>
									</div>
									<div className="mt-4 grid gap-4 lg:grid-cols-2">
										<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
											<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
												Input
											</div>
											<pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
												{JSON.stringify(step.inputPayload, null, 2)}
											</pre>
										</div>
										<div className="rounded-[22px] border border-[var(--brand-border-soft)] bg-background/60 p-4">
											<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
												Output
											</div>
											<pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
												{JSON.stringify(step.outputPayload, null, 2)}
											</pre>
										</div>
									</div>
								</SurfaceCard>
							))}
						</div>
					</DashboardPanel>
				</div>

				<div className="space-y-6">
					<DashboardPanel
						title="Artifacts"
						description="Final output bundle saved by the run."
					>
						<div className="grid gap-4">
							{run ? (
								(
									((run.outputPayload.artifacts as unknown[]) ?? []) as Array<{
										label?: string;
										type?: string;
										data?: Record<string, unknown>;
									}>
								).length > 0 ? (
									(
										((run.outputPayload.artifacts as unknown[]) ??
											[]) as Array<{
											label?: string;
											type?: string;
											data?: Record<string, unknown>;
										}>
									).map((artifact, index) => (
										<SurfaceCard
											key={`${artifact.type}-${index}`}
											className="p-5"
										>
											<div className="font-medium">
												{artifact.label ?? artifact.type ?? "Artifact"}
											</div>
											<div className="mt-2 text-sm text-muted-foreground">
												{artifact.type}
											</div>
											<pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
												{JSON.stringify(artifact.data ?? {}, null, 2)}
											</pre>
										</SurfaceCard>
									))
								) : (
									<SurfaceCard className="p-5 text-sm text-muted-foreground">
										No final artifacts saved on this run.
									</SurfaceCard>
								)
							) : (
								<SurfaceCard className="p-5 text-sm text-muted-foreground">
									Loading artifacts...
								</SurfaceCard>
							)}
						</div>
					</DashboardPanel>

					<DashboardPanel
						title="Reviews"
						description="Approval history and any pending human decision."
					>
						<div className="grid gap-4">
							{run?.status === "waiting_review" ? (
								<SurfaceCard className="space-y-4 p-5">
									<div className="flex items-center gap-2 text-sm font-medium">
										<Clock3 className="size-4 text-primary" />
										Waiting for human review
									</div>
									<Textarea
										value={reviewComment}
										onChange={(event) => setReviewComment(event.target.value)}
										className="min-h-24 rounded-[24px]"
										placeholder="Add review context or leave blank to use the default message."
									/>
									<div className="flex flex-wrap gap-2">
										<Button
											className="rounded-full"
											onClick={() => void submitReview("approved")}
											disabled={submitting}
										>
											<CheckCircle2 className="size-4" />
											Approve
										</Button>
										<Button
											variant="outline"
											className="rounded-full"
											onClick={() => void submitReview("changes_requested")}
											disabled={submitting}
										>
											<XCircle className="size-4" />
											Request changes
										</Button>
									</div>
								</SurfaceCard>
							) : null}

							{run?.reviews.length ? (
								run.reviews.map((review) => (
									<SurfaceCard key={review.id} className="p-5">
										<div className="flex items-start justify-between gap-3">
											<div>
												<div className="font-medium capitalize">
													{review.decision.replaceAll("_", " ")}
												</div>
												<div className="mt-2 text-sm text-muted-foreground">
													{review.reviewerType} reviewer •{" "}
													{formatAutomationWhen(review.createdAt)}
												</div>
											</div>
											<Badge
												variant="outline"
												className="rounded-full capitalize"
											>
												{review.status}
											</Badge>
										</div>
										{review.comment ? (
											<div className="mt-4 text-sm text-muted-foreground">
												{review.comment}
											</div>
										) : null}
									</SurfaceCard>
								))
							) : (
								<SurfaceCard className="p-5 text-sm text-muted-foreground">
									No review records on this run yet.
								</SurfaceCard>
							)}
						</div>
					</DashboardPanel>

					<DashboardPanel
						title="Evidence payload"
						description="Raw execution evidence for debugging and audit."
					>
						<SurfaceCard className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium">
								<FileSearch className="size-4 text-primary" />
								Run evidence
							</div>
							<pre className="mt-4 whitespace-pre-wrap text-xs text-muted-foreground">
								{JSON.stringify(run?.evidencePayload ?? {}, null, 2)}
							</pre>
						</SurfaceCard>
					</DashboardPanel>
				</div>
			</div>
		</div>
	);
}
