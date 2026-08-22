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

function isThemePreset(value: unknown): value is ThemePreset {
  return (
    value === "Default" ||
    value === "Brutalist" ||
    value === "Soft Pop" ||
    value === "Tangerine"
  );
}

function readStoredLayout(): LayoutState {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_LAYOUT;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<LayoutState>;
    const merged = { ...DEFAULT_LAYOUT, ...parsed };
    if (!isThemePreset(merged.themeColor)) {
      merged.themeColor = DEFAULT_LAYOUT.themeColor;
    }
    return merged;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(() => readStoredLayout());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }

    const color =
      THEME_PRESET_COLORS[state.themeColor] ?? THEME_PRESET_COLORS.Default;
    document.documentElement.style.setProperty("--portal-accent", color);
  }, [state]);

  const patch = useCallback((partial: Partial<LayoutState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo<LayoutContextValue>(
    () => ({
      ...state,
      accentColor:
        THEME_PRESET_COLORS[state.themeColor] ?? THEME_PRESET_COLORS.Default,
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

const SAFE_LAYOUT: LayoutContextValue = {
  ...DEFAULT_LAYOUT,
  accentColor: THEME_PRESET_COLORS.Default,
  setThemeColor: () => undefined,
  setSidebarVariant: () => undefined,
  setNavbarStyle: () => undefined,
  setSidebarCollapsible: () => undefined,
  setSidebarCollapsed: () => undefined,
  toggleSidebarCollapsed: () => undefined,
  setContentWidth: () => undefined,
};

export function useLayout() {
  return useContext(LayoutContext) ?? SAFE_LAYOUT;
}
