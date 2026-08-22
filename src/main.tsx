import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import App from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { LayoutProvider } from "./context/LayoutContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

/** Recover from stale JS chunks after a Vercel deploy (old tab / CDN cache). */
function installChunkLoadRecovery() {
  const reloadOnce = () => {
    try {
      const key = "dhapti-chunk-reload";
      const last = sessionStorage.getItem(key);
      if (last && Date.now() - Number(last) < 30_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const looksLikeChunkError = (reason: unknown) => {
    const msg =
      reason instanceof Error
        ? `${reason.name} ${reason.message}`
        : String(reason ?? "");
    return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
      msg
    );
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (looksLikeChunkError(event.reason)) {
      event.preventDefault();
      reloadOnce();
    }
  });

  window.addEventListener("error", (event) => {
    if (looksLikeChunkError(event.error ?? event.message)) {
      reloadOnce();
    }
  });
}

installChunkLoadRecovery();

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML =
    '<main style="font-family:system-ui;padding:2rem;text-align:center"><h1>Dhapti</h1><p>Unable to mount the application.</p><button onclick="location.reload()">Reload</button></main>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <LayoutProvider>
            <LanguageProvider>
              <AuthProvider>
                <App />
                <Toaster
                  position="top-right"
                  richColors
                  closeButton
                  theme="system"
                  toastOptions={{
                    classNames: {
                      toast: "border border-[#E5EBF3] shadow-lg font-sans",
                      success: "bg-[#002147] text-white border-[#16a34a]",
                    },
                  }}
                />
              </AuthProvider>
            </LanguageProvider>
          </LayoutProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}
