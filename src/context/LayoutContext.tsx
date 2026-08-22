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
  /** Dynamic page/section container classes based on Centered vs Full Width */
  contentContainerClass: string;
  /** Width + horizontal padding only (no vertical padding) */
  contentWidthClass: string;
  /** Shorthand data-layout attribute value: "centered" | "full" */
  contentLayout: "centered" | "full";
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

function isContentWidth(value: unknown): value is ContentWidth {
  return value === "Centered" || value === "Full Width";
}

/** Fluid macOS/Linear-style layout morph (max-width, padding, margin). */
export const LAYOUT_FLUID_TRANSITION =
  "transition-[max-width,padding,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]";

export function getContentLayout(width: ContentWidth): "centered" | "full" {
  return width === "Centered" ? "centered" : "full";
}

/**
 * Centered — elegant document workspace.
 * Full Width — expansive enterprise shell (caps at 1920px).
 */
export function getContentContainerClass(width: ContentWidth): string {
  if (width === "Centered") {
    return cnFluid(
      "w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    );
  }
  return cnFluid(
    "w-full max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-14 py-6"
  );
}

/** Width + horizontal padding only (public heroes / sections with own vertical rhythm). */
export function getContentWidthClass(width: ContentWidth): string {
  if (width === "Centered") {
    return cnFluid(
      "w-full max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    );
  }
  return cnFluid(
    "w-full max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-14"
  );
}

function cnFluid(...parts: string[]) {
  return [...parts, LAYOUT_FLUID_TRANSITION].join(" ");
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
    if (!isContentWidth(merged.contentWidth)) {
      merged.contentWidth = DEFAULT_LAYOUT.contentWidth;
    }
    return merged;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function applyLayoutToDocument(state: LayoutState) {
  const color =
    THEME_PRESET_COLORS[state.themeColor] ?? THEME_PRESET_COLORS.Default;
  document.documentElement.style.setProperty("--portal-accent", color);
  document.documentElement.setAttribute(
    "data-layout",
    getContentLayout(state.contentWidth)
  );
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(() => {
    const initial = readStoredLayout();
    if (typeof document !== "undefined") {
      applyLayoutToDocument(initial);
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    applyLayoutToDocument(state);
  }, [state]);

  const patch = useCallback((partial: Partial<LayoutState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const contentLayout = getContentLayout(state.contentWidth);
  const contentContainerClass = getContentContainerClass(state.contentWidth);
  const contentWidthClass = getContentWidthClass(state.contentWidth);

  const value = useMemo<LayoutContextValue>(
    () => ({
      ...state,
      accentColor:
        THEME_PRESET_COLORS[state.themeColor] ?? THEME_PRESET_COLORS.Default,
      contentLayout,
      contentContainerClass,
      contentWidthClass,
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
    [state, patch, contentLayout, contentContainerClass, contentWidthClass]
  );

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

const SAFE_LAYOUT: LayoutContextValue = {
  ...DEFAULT_LAYOUT,
  accentColor: THEME_PRESET_COLORS.Default,
  contentLayout: "full",
  contentContainerClass: getContentContainerClass(DEFAULT_LAYOUT.contentWidth),
  contentWidthClass: getContentWidthClass(DEFAULT_LAYOUT.contentWidth),
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
