import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { LayoutProvider } from "./context/LayoutContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
                  toast:
                    "border border-[#E5EBF3] shadow-lg font-sans",
                  success: "bg-[#002147] text-white border-[#16a34a]",
                },
              }}
            />
          </AuthProvider>
        </LanguageProvider>
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>
);
