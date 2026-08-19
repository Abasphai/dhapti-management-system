import type { KeyboardEvent, ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";

const drilldownHoverClass =
  "cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-orange-500/40 group";

type DrilldownCardProps = {
  to: string;
  children: ReactNode;
  className?: string;
  /** Hide the hover arrow (e.g. dense table rows). */
  hideArrow?: boolean;
};

export function DrilldownCard({
  to,
  children,
  className,
  hideArrow = false,
}: DrilldownCardProps) {
  const navigate = useNavigate();

  function go() {
    navigate(to);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      className={cn("relative", drilldownHoverClass, className)}
    >
      {!hideArrow && (
        <ArrowUpRight
          className="pointer-events-none absolute right-3 top-3 z-20 h-4 w-4 text-[#ea580c] opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

export { drilldownHoverClass };
