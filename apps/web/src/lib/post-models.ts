import type { PostDetail, PostSummary, PostVariant } from "@/lib/api-types";

type NormalizedResult<T> = {
	value: T;
	coerced: boolean;
};

function ensureArray<T>(value: T[] | null | undefined) {
	if (Array.isArray(value)) {
		return { value, coerced: false };
	}
	return { value: [] as T[], coerced: true };
}

function ensureRecord(
	value: Record<string, unknown> | null | undefined,
): NormalizedResult<Record<string, unknown>> {
	if (value && typeof value === "object") {
		return { value, coerced: false };
	}
	return { value: {}, coerced: true };
}

function normalizeVariant(variant: PostVariant): NormalizedResult<PostVariant> {
	const removedInheritedResourceIds = ensureArray(
		variant.removedInheritedResourceIds,
	);
	const assets = ensureArray(variant.assets);
	const effectiveAssets = ensureArray(variant.effectiveAssets);
	const reviewHistory = ensureArray(variant.reviewHistory);
	const metricSnapshot = ensureArray(variant.metricSnapshot);
	const contentPayload = ensureRecord(variant.contentPayload);
	const readiness = variant.readiness ?? {
		draftIssues: [],
		scheduleBlockers: [],
		publishBlockers: [],
	};
	const draftIssues = ensureArray(readiness.draftIssues);
	const scheduleBlockers = ensureArray(readiness.scheduleBlockers);
	const publishBlockers = ensureArray(readiness.publishBlockers);

	return {
		value: {
			...variant,
			inheritSource: variant.inheritSource || "shared",
			removedInheritedResourceIds: removedInheritedResourceIds.value,
			assets: assets.value,
			effectiveAssets: effectiveAssets.value,
			reviewHistory: reviewHistory.value,
			readiness: {
				draftIssues: draftIssues.value,
				scheduleBlockers: scheduleBlockers.value,
				publishBlockers: publishBlockers.value,
			},
			metricSnapshot: metricSnapshot.value,
			contentPayload: contentPayload.value,
		},
		coerced:
			removedInheritedResourceIds.coerced ||
			assets.coerced ||
			effectiveAssets.coerced ||
			reviewHistory.coerced ||
			draftIssues.coerced ||
			scheduleBlockers.coerced ||
			publishBlockers.coerced ||
			metricSnapshot.coerced ||
			contentPayload.coerced ||
			!variant.inheritSource,
	};
}

export function normalizePostSummary(
	post: PostSummary,
): NormalizedResult<PostSummary> {
	const metricSnapshot = ensureArray(post.metricSnapshot);

	return {
		value: {
			...post,
			requiresApproval: Boolean(post.requiresApproval),
			metricSnapshot: metricSnapshot.value,
		},
		coerced: metricSnapshot.coerced || post.requiresApproval === undefined,
	};
}

export function normalizePostDetail(
	post: PostDetail,
): NormalizedResult<PostDetail> {
	let coerced = false;

	const assets = ensureArray(post.assets);
	const variants = ensureArray(post.variants);
	const legacyVariants = ensureArray(post.legacyVariants);
	const metricSnapshot = ensureArray(post.metricSnapshot);
	const contentPayload = ensureRecord(post.contentPayload);

	const normalizedVariants = variants.value.map((variant) => {
		const result = normalizeVariant(variant);
		if (result.coerced) {
			coerced = true;
		}
		return result.value;
	});
	const normalizedLegacyVariants = legacyVariants.value.map((variant) => {
		const result = normalizeVariant(variant);
		if (result.coerced) {
			coerced = true;
		}
		return result.value;
	});

	return {
		value: {
			...post,
			requiresApproval: Boolean(post.requiresApproval),
			assets: assets.value,
			variants: normalizedVariants,
			legacyVariants: normalizedLegacyVariants,
			metricSnapshot: metricSnapshot.value,
			contentPayload: contentPayload.value,
		},
		coerced:
			coerced ||
			assets.coerced ||
			variants.coerced ||
			legacyVariants.coerced ||
			metricSnapshot.coerced ||
			contentPayload.coerced,
	};
}

export function normalizePostSummaries(
	posts: PostSummary[],
): NormalizedResult<PostSummary[]> {
	let coerced = false;

	const value = posts.map((post) => {
		const result = normalizePostSummary(post);
		if (result.coerced) {
			coerced = true;
		}
		return result.value;
	});

	return { value, coerced };
}
