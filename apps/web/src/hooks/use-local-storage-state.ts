import { useEffect, useState } from "react";

type InitialValue<T> = T | (() => T);

function resolveInitialValue<T>(initialValue: InitialValue<T>) {
	return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useLocalStorageState<T>(
	key: string | null,
	initialValue: InitialValue<T>,
) {
	const [state, setState] = useState<T>(() => resolveInitialValue(initialValue));
	const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

	useEffect(() => {
		if (!key || typeof window === "undefined") {
			setHasLoadedStorage(true);
			return;
		}
		try {
			const storedValue = window.localStorage.getItem(key);
			if (storedValue !== null) {
				setState(JSON.parse(storedValue) as T);
			}
		} catch {
			// Ignore malformed or unavailable storage.
		} finally {
			setHasLoadedStorage(true);
		}
	}, [key]);

	useEffect(() => {
		if (!key || typeof window === "undefined" || !hasLoadedStorage) {
			return;
		}
		try {
			window.localStorage.setItem(key, JSON.stringify(state));
		} catch {
			// Swallow storage failures so UI state still works in-memory.
		}
	}, [hasLoadedStorage, key, state]);

	return [state, setState] as const;
}
