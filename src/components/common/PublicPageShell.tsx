import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { AdmissionHelpDesk } from "@/components/common/AdmissionHelpDesk";
import { Footer } from "@/components/common/Footer";
import { Navbar } from "@/components/common/Navbar";
import { ScrollToTopButton } from "@/components/common/ScrollToTopButton";
import { useLayout } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";

type PublicPageShellProps = {
  children: ReactNode;
  heroTitle: string;
  heroSubtitle?: string;
  heroImage: string;
  narrow?: boolean;
};

export function PublicPageShell({
  children,
  heroTitle,
  heroSubtitle,
  heroImage,
  narrow = false,
}: PublicPageShellProps) {
  const { accentColor } = useLayout();

  return (
    <div
      className="site-shell min-h-screen w-full max-w-full overflow-x-hidden bg-white transition-colors dark:bg-slate-950"
      style={{ ["--portal-accent" as string]: accentColor }}
    >
      <Navbar />

      <section className="relative flex min-h-[42vh] items-end overflow-hidden pt-28 md:min-h-[48vh]">
        <img
          src={heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#002147] via-[#002147]/75 to-black/35" />
        <div className="relative z-10 w-full px-4 pb-12 md:px-8 md:pb-16">
          <div className={cn("mx-auto", narrow ? "max-w-3xl" : "max-w-6xl")}>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#ea580c]"
            >
              Dhapti University
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl"
            >
              {heroTitle}
            </motion.h1>
            {heroSubtitle && (
              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="mt-4 max-w-2xl text-base text-white/85 md:text-lg"
              >
                {heroSubtitle}
              </motion.p>
            )}
          </div>
        </div>
      </section>

      <main className="pb-20">{children}</main>

      <Footer />
      <ScrollToTopButton />
      <AdmissionHelpDesk />
    </div>
  );
}
