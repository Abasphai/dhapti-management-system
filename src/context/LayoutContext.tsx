import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreset = "Default" | "Brutalist" | "Soft Pop" | "Tangerine";
export type SidebarVariant = "Inset" | "Sidebar" | "Floating";
export type NavbarStyle = "Sticky" | "Scroll";
export type SidebarCollapsible = "Icon" | "OffCanvas";
export type ContentWidth = "Centered" | "Full Width";

export const THEME_PRESET_COLORS: Record<ThemePreset, string> = {
  Default: "#16a34a",
  Brutalist: "#ef4444",
  "Soft Pop": "#a855f7",
  Tangerine: "#F68F3A",
};

interface LayoutState {
  themeColor: ThemePreset;
  sidebarVariant: SidebarVariant;
  navbarStyle: NavbarStyle;
  sidebarCollapsible: SidebarCollapsible;
  isSidebarCollapsed: boolean;
  contentWidth: ContentWidth;
}

interface LayoutContextValue extends LayoutState {
  accentColor: string;
  setThemeColor: (value: ThemePreset) => void;
  setSidebarVariant: (value: SidebarVariant) => void;
  setNavbarStyle: (value: NavbarStyle) => void;
  setSidebarCollapsible: (value: SidebarCollapsible) => void;
  setSidebarCollapsed: (value: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setContentWidth: (value: ContentWidth) => void;
}

const STORAGE_KEY = "dhapti-layout-settings";

const DEFAULT_LAYOUT: LayoutState = {
  themeColor: "Default",
  sidebarVariant: "Sidebar",
  navbarStyle: "Sticky",
  sidebarCollapsible: "Icon",
  isSidebarCollapsed: false,
  contentWidth: "Full Width",
};

const LayoutContext = createContext<LayoutContextValue | null>(null);

function readStoredLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(() => {
    if (typeof window === "undefined") return DEFAULT_LAYOUT;
    return readStoredLayout();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }

    document.documentElement.style.setProperty(
      "--portal-accent",
      THEME_PRESET_COLORS[state.themeColor]
    );
  }, [state]);

  const patch = useCallback((partial: Partial<LayoutState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      ...state,
      accentColor: THEME_PRESET_COLORS[state.themeColor],
      setThemeColor: (themeColor) => patch({ themeColor }),
      setSidebarVariant: (sidebarVariant) => patch({ sidebarVariant }),
      setNavbarStyle: (navbarStyle) => patch({ navbarStyle }),
      setSidebarCollapsible: (sidebarCollapsible) =>
        patch({ sidebarCollapsible }),
      setSidebarCollapsed: (isSidebarCollapsed) =>
        patch({ isSidebarCollapsed }),
      toggleSidebarCollapsed: () =>
        setState((prev) => ({
          ...prev,
          isSidebarCollapsed: !prev.isSidebarCollapsed,
        })),
      setContentWidth: (contentWidth) => patch({ contentWidth }),
    }),
    [state, patch]
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
