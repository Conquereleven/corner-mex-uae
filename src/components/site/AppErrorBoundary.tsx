import { Component, type ReactNode } from "react";

type State = { error: Error | null };

/**
 * Catches React render errors anywhere below it so the user sees a
 * readable message instead of a blank screen. In dev, the full message
 * is shown to make debugging fast; in prod a generic message is used.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const isDev = import.meta.env.DEV;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-xl text-center">
          <h1 className="font-display text-2xl tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isDev ? this.state.error.message : "An unexpected error happened. Please try again."}
          </p>
          {isDev && this.state.error.stack && (
            <pre className="mt-4 max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/40 p-3 text-left text-xs">
              {this.state.error.stack}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={this.reset} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
            <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}