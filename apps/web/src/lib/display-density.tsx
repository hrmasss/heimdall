import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type DisplayDensity = "comfortable" | "compact";

const STORAGE_KEY = "heimdall-density";

type DisplayDensityContextValue = {
	density: DisplayDensity;
	setDensity: (density: DisplayDensity) => void;
	toggleDensity: () => void;
};

const DisplayDensityContext = createContext<
	DisplayDensityContextValue | undefined
>(undefined);

function resolveInitialDensity(): DisplayDensity {
	if (typeof window === "undefined") {
		return "comfortable";
	}

	const stored = window.localStorage.getItem(STORAGE_KEY);
	return stored === "compact" ? "compact" : "comfortable";
}

function applyDensity(density: DisplayDensity) {
	if (typeof document === "undefined") {
		return;
	}

	document.documentElement.dataset.density = density;
}

export function DisplayDensityProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [density, setDensity] = useState<DisplayDensity>(resolveInitialDensity);

	useEffect(() => {
		applyDensity(density);
		try {
			window.localStorage.setItem(STORAGE_KEY, density);
		} catch {
			// Ignore storage failures so the preference still works in-memory.
		}
	}, [density]);

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== STORAGE_KEY) {
				return;
			}

			setDensity(event.newValue === "compact" ? "compact" : "comfortable");
		};

		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const value = useMemo<DisplayDensityContextValue>(
		() => ({
			density,
			setDensity,
			toggleDensity: () =>
				setDensity((current) =>
					current === "comfortable" ? "compact" : "comfortable",
				),
		}),
		[density],
	);

	return (
		<DisplayDensityContext.Provider value={value}>
			{children}
		</DisplayDensityContext.Provider>
	);
}

export function useDisplayDensity() {
	const context = useContext(DisplayDensityContext);
	if (!context) {
		throw new Error(
			"useDisplayDensity must be used within a DisplayDensityProvider",
		);
	}

	return context;
}

