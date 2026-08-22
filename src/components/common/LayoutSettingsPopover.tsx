import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";

import {
  THEME_PRESET_COLORS,
  useLayout,
  type ContentWidth,
  type NavbarStyle,
  type SidebarCollapsible,
  type SidebarVariant,
  type ThemePreset,
} from "@/context/LayoutContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const themePresets = (
  Object.entries(THEME_PRESET_COLORS) as [ThemePreset, string][]
).map(([id, color]) => ({ id, color }));

function SettingLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
      {children}
    </p>
  );
}

function OptionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
        active
          ? "border-[#F68F3A] bg-[#F68F3A]/15 text-[#F68F3A] shadow-sm"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

interface LayoutSettingsPopoverProps {
  triggerClassName?: string;
  /** Hide portal-only sidebar controls on the public website */
  publicSite?: boolean;
  /**
   * `popover` — absolute panel (desktop).
   * `modal` — centered fullscreen overlay (mobile drawer).
   */
  presentation?: "popover" | "modal";
  /** Controlled open state (used with presentation="modal") */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the gear trigger when opening programmatically */
  hideTrigger?: boolean;
}

export function LayoutSettingsPopover({
  triggerClassName,
  publicSite = false,
  presentation = "popover",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: LayoutSettingsPopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { theme, setTheme } = useTheme();
  const {
    themeColor,
    setThemeColor,
    sidebarVariant,
    setSidebarVariant,
    navbarStyle,
    setNavbarStyle,
    sidebarCollapsible,
    setSidebarCollapsible,
    contentWidth,
    setContentWidth,
    accentColor,
  } = useLayout();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
    if (!next) setPresetOpen(false);
  };

  const activePreset =
    themePresets.find((p) => p.id === themeColor) ?? themePresets[0]!;

  useEffect(() => {
    if (!open || presentation !== "popover") return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, presentation]);

  useEffect(() => {
    if (!open || presentation !== "modal") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, presentation]);

  const panelBody = (
    <>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="text-base font-bold text-white">
              Layout Settings
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Customize your theme and layout preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close layout settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(60vh,480px)] space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <SettingLabel>Preset</SettingLabel>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPresetOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full ring-2 ring-white/10"
                  style={{ backgroundColor: activePreset.color }}
                />
                {themeColor}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-zinc-400 transition-transform",
                  presetOpen && "rotate-180"
                )}
              />
            </button>

            <AnimatePresence>
              {presetOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-10 overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] shadow-xl"
                >
                  {themePresets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setThemeColor(item.id);
                        setPresetOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-white/5",
                        themeColor === item.id
                          ? "bg-white/[0.04] text-[#F68F3A]"
                          : "text-zinc-200"
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.id}
                      </span>
                      {themeColor === item.id && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <SettingLabel>Mode</SettingLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                theme === "light"
                  ? "border-[#16a34a] bg-[#16a34a]/15 text-[#86efac]"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/5"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all",
                theme === "dark"
                  ? "border-[#F68F3A] bg-[#F68F3A]/15 text-[#F68F3A]"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/5"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </section>

        {!publicSite && (
          <>
            <section>
              <SettingLabel>Sidebar Variant</SettingLabel>
              <div className="grid grid-cols-3 gap-2">
                {(["Inset", "Sidebar", "Floating"] as SidebarVariant[]).map(
                  (option) => (
                    <OptionChip
                      key={option}
                      label={option}
                      active={sidebarVariant === option}
                      onClick={() => setSidebarVariant(option)}
                    />
                  )
                )}
              </div>
            </section>

            <section>
              <SettingLabel>Navbar Style</SettingLabel>
              <div className="grid grid-cols-2 gap-2">
                {(["Sticky", "Scroll"] as NavbarStyle[]).map((option) => (
                  <OptionChip
                    key={option}
                    label={option}
                    active={navbarStyle === option}
                    onClick={() => setNavbarStyle(option)}
                  />
                ))}
              </div>
            </section>

            <section>
              <SettingLabel>Sidebar Collapsible</SettingLabel>
              <div className="grid grid-cols-2 gap-2">
                {(["Icon", "OffCanvas"] as SidebarCollapsible[]).map(
                  (option) => (
                    <OptionChip
                      key={option}
                      label={option}
                      active={sidebarCollapsible === option}
                      onClick={() => setSidebarCollapsible(option)}
                    />
                  )
                )}
              </div>
            </section>
          </>
        )}

        <section>
          <SettingLabel>Content Layout</SettingLabel>
          <div className="grid grid-cols-2 gap-2">
            {(["Centered", "Full Width"] as ContentWidth[]).map((option) => (
              <OptionChip
                key={option}
                label={option}
                active={contentWidth === option}
                onClick={() => setContentWidth(option)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-[11px] text-zinc-500">
          Settings apply instantly and persist after refresh.
        </p>
      </div>
    </>
  );

  const trigger = !hideTrigger ? (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "rounded-xl p-2.5 text-[#002147] transition-colors hover:bg-[#F4F7FB] dark:text-slate-100 dark:hover:bg-slate-800",
        open && presentation === "popover" && "bg-[#F4F7FB] dark:bg-slate-800",
        triggerClassName
      )}
      style={
        open && presentation === "popover" ? { color: accentColor } : undefined
      }
      aria-label="Layout settings"
      aria-expanded={open}
      aria-haspopup="dialog"
      title="Layout Settings"
    >
      <Settings className="h-5 w-5" />
    </button>
  ) : null;

  if (presentation === "modal") {
    return (
      <>
        {trigger}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  key="layout-settings-modal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
                  onClick={() => setOpen(false)}
                  role="presentation"
                >
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#121212] text-white shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {panelBody}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Layout Settings"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute right-0 top-[calc(100%+0.65rem)] z-[1100] w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-[#18181b] text-white shadow-2xl"
          >
            {panelBody}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
