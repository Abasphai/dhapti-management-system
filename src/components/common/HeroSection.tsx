import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import {
  FALLBACK_HERO_SLIDES,
  resolveSlideImage,
  slideImageOnErrorSrc,
  type HeroSlide,
} from "@/lib/cmsPageContent";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/locales/translations";
const FALLBACK_HERO_KEYS: Array<{
  title: TranslationKey;
  desc: TranslationKey;
  btn: TranslationKey;
}> = [
  {
    title: "hero.slide1.title",
    desc: "hero.slide1.desc",
    btn: "btn.applyNow",
  },
  {
    title: "hero.slide2.title",
    desc: "hero.slide2.desc",
    btn: "btn.registerNow",
  },
  {
    title: "hero.slide3.title",
    desc: "hero.slide3.desc",
    btn: "btn.exploreLabs",
  },
  {
    title: "hero.slide4.title",
    desc: "hero.slide4.desc",
    btn: "btn.meetFaculty",
  },
  {
    title: "hero.slide5.title",
    desc: "hero.slide5.desc",
    btn: "btn.learnMore",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.3, delayChildren: 0.5 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1, ease: "easeOut" as const },
  },
};

function toSlide(s: HeroSlide, index: number) {
  return {
    title: s.title,
    desc: s.description || s.subtitle || "",
    btn: s.buttonText,
    pos: s.imagePos || "object-top",
    to: s.buttonLink,
    index,
  };
}
export const HeroSection = ({
  slides: slidesProp,
}: {
  slides?: HeroSlide[] | null;
}) => {
  const { t, translateLabel, dir } = useLanguage();

  const source =
    slidesProp && slidesProp.length > 0 ? slidesProp : FALLBACK_HERO_SLIDES;
  const usingFallback = !(slidesProp && slidesProp.length > 0);

  const slides = source.map((s, i) => {
    const base = toSlide(s, i);
    if (usingFallback && FALLBACK_HERO_KEYS[i]) {
      const keys = FALLBACK_HERO_KEYS[i];
      return {
        ...base,
        title: t(keys.title),
        desc: t(keys.desc),
        btn: t(keys.btn),
      };
    }
    return {
      ...base,
      title: translateLabel(base.title) || base.title,
      btn: translateLabel(base.btn) || base.btn,
    };
  });

  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0);
  }, [slides.length, slides[0]?.title]);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(
      () => setCurrent((p) => (p + 1) % slides.length),
      3500
    );
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[current] ?? slides[0];
  const heroSlide = source[current] ?? source[0];
  if (!slide || !heroSlide) return null;

  return (
    <div
      className="relative mt-[100px] flex min-h-[calc(100vh-100px)] w-full max-w-full items-center justify-center overflow-hidden bg-black font-sans"
      dir={dir}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg-${current}`}
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 2.5, ease: "linear" }}
          className="absolute inset-0 overflow-hidden"
        >
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/50 via-transparent to-black/60" />
          <img
            src={resolveSlideImage(heroSlide, current)}
            alt={slide.title || "Dhapti Slide"}
            referrerPolicy="no-referrer"
            decoding="async"
            loading={current === 0 ? "eager" : "lazy"}
            className={cn(
              "h-full w-full object-cover transition-transform duration-[2500ms]",
              slide.pos || "object-top"
            )}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              const next = slideImageOnErrorSrc(img.src, current);
              if (img.src !== next) {
                img.src = next;
              }
            }}
          />
        </motion.div>
      </AnimatePresence>

      <div className="container relative z-20 mx-auto flex items-center justify-center px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`box-${current}`}
            initial={{
              x: current % 2 === 0 ? -48 : 48,
              opacity: 0,
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: current % 2 === 0 ? 48 : -48,
              opacity: 0,
            }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-black/30 p-5 text-center shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur-md sm:rounded-[45px] sm:p-8 md:p-14"
          >
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                variants={itemVariants}
                className="mb-4 flex justify-center sm:mb-6"
                style={{ color: "var(--portal-accent)" }}
              >
                <GraduationCap size={36} className="animate-bounce sm:h-10 sm:w-10" />
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="mb-4 text-2xl font-black uppercase leading-tight tracking-tight drop-shadow-2xl sm:mb-6 sm:text-4xl sm:leading-none sm:tracking-tighter md:text-6xl"
                style={{ color: "var(--portal-accent)" }}
              >
                {slide.title}
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="mb-8 text-sm font-bold leading-relaxed text-white opacity-95 sm:mb-10 sm:text-lg md:text-2xl"
              >
                {slide.desc}
              </motion.p>

              <motion.div variants={itemVariants}>
                <Link
                  to={slide.to}
                  className="group mx-auto flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-base font-bold text-white shadow-xl transition-all hover:scale-105 active:scale-95 sm:w-auto sm:px-14 sm:py-4 sm:text-lg"
                  style={{ backgroundColor: "var(--portal-accent)" }}
                >
                  {slide.btn}
                  <ArrowRight
                    size={24}
                    className="transition-transform group-hover:translate-x-2"
                  />
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-12 left-1/2 z-30 flex -translate-x-1/2 items-center gap-6 text-sm font-black tracking-widest text-white">
        <span style={{ color: "var(--portal-accent)" }}>
          0{current + 1}
        </span>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${current === i ? "w-12" : "w-3 bg-white/20"}`}
              style={
                current === i
                  ? { backgroundColor: "var(--portal-accent)" }
                  : undefined
              }
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <span className="opacity-30">0{slides.length}</span>
      </div>
    </div>
  );
};
