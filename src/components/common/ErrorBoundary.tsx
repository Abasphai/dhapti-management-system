import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Catches render-time crashes so the site never stays a blank white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Unexpected application error";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#00152e] px-6 text-center text-white">
        <img
          src="/dhapti-logo.png"
          alt="Dhapti"
          className="mb-6 h-14 w-auto object-contain brightness-0 invert"
        />
        <h1 className="text-2xl font-black tracking-tight">
          {this.props.fallbackTitle ?? "Something went wrong"}
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-300">
          The page failed to load. Your data is safe — please refresh to continue.
        </p>
        {import.meta.env.DEV && this.state.message ? (
          <p className="mt-4 max-w-lg rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-red-300">
            {this.state.message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-8 rounded-xl bg-[#16a34a] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-[#15803d]"
        >
          Reload Dhapti
        </button>
      </div>
    );
  }
}
