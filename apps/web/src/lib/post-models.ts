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

	return {
		value: {
			...variant,
			removedInheritedResourceIds: removedInheritedResourceIds.value,
			assets: assets.value,
			effectiveAssets: effectiveAssets.value,
			reviewHistory: reviewHistory.value,
			metricSnapshot: metricSnapshot.value,
			contentPayload: contentPayload.value,
		},
		coerced:
			removedInheritedResourceIds.coerced ||
			assets.coerced ||
			effectiveAssets.coerced ||
			reviewHistory.coerced ||
			metricSnapshot.coerced ||
			contentPayload.coerced,
	};
}

export function normalizePostSummary(
	post: PostSummary,
): NormalizedResult<PostSummary> {
	const metricSnapshot = ensureArray(post.metricSnapshot);

	return {
		value: {
			...post,
			metricSnapshot: metricSnapshot.value,
		},
		coerced: metricSnapshot.coerced,
	};
}

export function normalizePostDetail(
	post: PostDetail,
): NormalizedResult<PostDetail> {
	let coerced = false;

	const assets = ensureArray(post.assets);
	const variants = ensureArray(post.variants);
	const metricSnapshot = ensureArray(post.metricSnapshot);
	const contentPayload = ensureRecord(post.contentPayload);

	const normalizedVariants = variants.value.map((variant) => {
		const result = normalizeVariant(variant);
		if (result.coerced) {
			coerced = true;
		}
		return result.value;
	});

	return {
		value: {
			...post,
			assets: assets.value,
			variants: normalizedVariants,
			metricSnapshot: metricSnapshot.value,
			contentPayload: contentPayload.value,
		},
		coerced:
			coerced ||
			assets.coerced ||
			variants.coerced ||
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
