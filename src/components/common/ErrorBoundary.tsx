import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  message: string;
  isChunkError: boolean;
};

function isChunkLoadError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "");
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    msg
  );
}

/**
 * Catches render-time crashes so the site never stays a blank white screen.
 * Also detects stale chunk load failures after deploys and offers a hard reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "", isChunkError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "Unexpected application error";
    return {
      hasError: true,
      message,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
    if (isChunkLoadError(error)) {
      try {
        const key = "dhapti-chunk-reload";
        const last = sessionStorage.getItem(key);
        const now = String(Date.now());
        // Auto-reload once per session window to pick up new asset hashes
        if (!last || Date.now() - Number(last) > 30_000) {
          sessionStorage.setItem(key, now);
          window.location.reload();
        }
      } catch {
        /* ignore */
      }
    }
  }

  private handleReload = () => {
    try {
      sessionStorage.removeItem("dhapti-chunk-reload");
    } catch {
      /* ignore */
    }
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
          {this.props.fallbackTitle ??
            (this.state.isChunkError
              ? "Update available"
              : "Something went wrong")}
        </h1>
        <p className="mt-3 max-w-md text-sm text-slate-300">
          {this.state.isChunkError
            ? "A new version of the site was deployed. Please reload to continue."
            : "The page failed to load. Your data is safe — please refresh to continue."}
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
