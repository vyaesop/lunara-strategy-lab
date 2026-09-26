import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";

interface State {
  error: Error | null;
}

/** Catches render errors so one broken screen never blanks the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Content-free client log; a monitoring hook can be attached here.
    console.error("render error", error.message, info.componentStack?.split("\n")[1]?.trim());
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Something went wrong</div>
        <h1 className="mt-2 text-2xl">This screen hit an error.</h1>
        <p className="mt-2 text-sm text-text-muted">Your data is saved on the server. Reload the screen, or go back to the Command Center.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-surface-muted p-3 text-left text-xs text-text-muted">{this.state.error.message}</pre>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/app")}>Command Center</Button>
        </div>
      </div>
    );
  }
}
