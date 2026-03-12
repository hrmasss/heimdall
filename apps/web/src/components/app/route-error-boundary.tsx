import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

import { SurfaceCard } from "@/components/app/brand";
import { Button } from "@/components/ui/button";

type Props = {
	children: ReactNode;
};

type State = {
	hasError: boolean;
};

export class RouteErrorBoundary extends Component<Props, State> {
	override state: State = {
		hasError: false,
	};

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	override componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {}

	override render() {
		if (!this.state.hasError) {
			return this.props.children;
		}

		return (
			<div className="space-y-6">
				<SurfaceCard className="space-y-4 border border-destructive/20 bg-destructive/10 p-6">
					<div className="text-lg font-semibold text-destructive">
						This page could not be rendered.
					</div>
					<div className="text-sm text-destructive/90">
						Reload the page to try again. If the issue persists, the payload may
						be incomplete and needs review.
					</div>
					<div>
						<Button
							variant="outline"
							className="rounded-full"
							onClick={() => window.location.reload()}
						>
							Reload
						</Button>
					</div>
				</SurfaceCard>
			</div>
		);
	}
}
