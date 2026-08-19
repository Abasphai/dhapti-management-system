import { useEffect, useRef, useState } from "react";
import { useInView, motion } from "framer-motion";

type AnimatedStatProps = {
  value: number;
  suffix?: string;
  label: string;
  durationMs?: number;
};

export function AnimatedStat({
  value,
  suffix = "",
  label,
  durationMs = 1400,
}: AnimatedStatProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, durationMs]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-[#E5EBF3] bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-3xl font-black text-[#ea580c] md:text-4xl">
        {display.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-2 text-sm font-medium text-[#002147]/70 dark:text-slate-400">
        {label}
      </p>
    </motion.div>
  );
}
