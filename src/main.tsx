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
