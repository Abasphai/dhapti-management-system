import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  User,
  Briefcase,
  Shield,
  Phone,
  ChevronDown,
  Moon,
  Sun,
  Menu,
  X,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { LayoutSettingsPopover } from '@/components/common/LayoutSettingsPopover';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import type { Lang } from '@/locales/translations';
import { cn } from '@/lib/utils';

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'so', label: 'SO' },
  { code: 'ar', label: 'AR' },
];

const mobileLinkClass =
  'block border-b border-white/5 py-3 text-sm font-extrabold uppercase tracking-wider !text-white transition-colors hover:!text-orange-400';

const mobileSubLinkClass =
  'block py-2 pl-4 text-xs font-semibold !text-slate-300 transition-colors hover:!text-orange-400';

export const Navbar = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const isDark = theme === 'dark';

  const menuData: Record<string, { label: string; href: string }[]> = {
    ABOUT: [
      { label: 'About University', href: '/about' },
      { label: 'Mission & Vision', href: '/about#mission' },
      { label: 'History & Heritage', href: '/about#history' },
      { label: 'Leadership', href: '/about#leadership' },
    ],
    AUTHORITY: [
      { label: 'Board of Trustees', href: '/authority#trustees' },
      { label: 'University Council', href: '/authority#council' },
      { label: 'Office of the Rector', href: '/authority#rector' },
      { label: 'Deans Committee', href: '/authority#deans' },
    ],
    PROGRAMS: [
      { label: 'Undergraduate Programs', href: '/programs' },
      { label: 'Postgraduate Studies', href: '/programs#postgraduate' },
      { label: 'Diploma & Certificates', href: '/programs#diploma' },
      { label: 'Academic Calendar', href: '/pages/downloads' },
    ],
    FACULTIES: [
      { label: 'Faculty of Computing & IT', href: '/faculties#computing' },
      { label: 'Faculty of Medicine & Health', href: '/faculties#medicine' },
      { label: 'Faculty of Business & Economics', href: '/faculties#business' },
      { label: 'Faculty of Engineering', href: '/faculties#engineering' },
      { label: 'Faculty of Law & Sharia', href: '/faculties#law' },
      { label: 'Faculty of Agriculture', href: '/faculties#agriculture' },
    ],
    'NEWS & EVENTS': [
      { label: 'Latest Campus News', href: '/news' },
      { label: 'Upcoming Events', href: '/news#events' },
      { label: 'Research Symposium', href: '/news' },
      { label: 'Photo Gallery', href: '/news' },
    ],
  };

  const portalLinks = [
    { label: 'Student Portal', href: '/student/login', icon: User },
    { label: 'Teacher Portal', href: '/teacher/login', icon: Briefcase },
    { label: 'Admin Portal', href: '/admin/login', icon: Shield },
  ];

  const closeMobile = () => {
    setIsMobileOpen(false);
    setMobileExpanded(null);
  };

  const openMobileSettings = () => {
    closeMobile();
    // Allow drawer exit animation to start before modal mounts
    window.setTimeout(() => setSettingsOpen(true), 180);
  };

  useEffect(() => {
    if (!isMobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  return (
    <header className="fixed left-0 top-0 z-[9999] w-full max-w-full font-sans shadow-md">
      {/* 1. TOP BAR — portals only on desktop */}
      <div className="flex max-w-full items-center justify-between border-b border-white/10 bg-[#00152e] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white sm:px-6 md:px-12 md:text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Home size={14} className="shrink-0 text-emerald-400" />
          <span className="truncate">DHAPTI UNIVERSITY</span>
        </div>

        <div className="hidden shrink-0 items-center gap-4 xl:flex xl:gap-6">
          {portalLinks.map((portal) => (
            <Link
              key={portal.href}
              to={portal.href}
              className="flex items-center gap-1.5 transition-colors hover:text-emerald-400"
            >
              <portal.icon size={14} className="text-emerald-400" />
              <span>{portal.label}</span>
            </Link>
          ))}
          <div className="flex items-center gap-1.5 border-l border-white/20 pl-4">
            <Phone size={14} className="text-emerald-400" />
            <span>+252 61 700 1000</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR */}
      <div className="relative z-[9999] flex max-w-full items-center justify-between gap-3 overflow-visible border-b-[3px] border-[#16a34a] bg-white px-4 py-3 text-[#002147] sm:px-6 md:px-12">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src="/dhapti-logo.png"
            alt="Dhapti Logo"
            className="h-11 w-auto object-contain md:h-12 xl:h-14"
          />
        </Link>

        {/* Desktop nav — hidden below xl */}
        <nav
          className="relative z-[9999] mr-6 hidden items-center gap-6 overflow-visible text-[13px] font-extrabold tracking-wide text-[#002147] xl:flex"
          aria-label="Primary"
        >
          <Link to="/" className="shrink-0 transition-colors hover:text-[#16a34a]">
            HOME
          </Link>

          {Object.keys(menuData).map((menuKey) => (
            <div
              key={menuKey}
              className="group relative z-[9999] shrink-0 cursor-pointer overflow-visible py-2"
              onMouseEnter={() => setActiveMenu(menuKey)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <div
                className={`flex items-center gap-1 uppercase transition-colors ${
                  activeMenu === menuKey ? 'text-[#16a34a]' : 'hover:text-[#16a34a]'
                }`}
              >
                <span className="whitespace-nowrap">{menuKey}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    activeMenu === menuKey ? 'rotate-180 text-[#16a34a]' : ''
                  }`}
                />
              </div>

              <AnimatePresence>
                {activeMenu === menuKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full z-[9999] mt-2 w-64 rounded-b-xl border-t-[3px] border-[#16a34a] bg-white py-2 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
                  >
                    {menuData[menuKey].map((item, idx) => (
                      <Link
                        key={idx}
                        to={item.href}
                        className="block px-5 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#16a34a]"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <Link
            to="/contact"
            className="shrink-0 transition-colors hover:text-[#16a34a]"
          >
            CONTACT
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Desktop-only controls */}
          <div className="hidden items-center gap-1 border-l border-slate-200/60 pl-4 xl:flex">
            <LayoutSettingsPopover
              publicSite
              triggerClassName="p-2 rounded-xl text-slate-700 hover:text-[#16a34a] hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
            />
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 hover:text-[#16a34a] dark:text-slate-200 dark:hover:bg-slate-800"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              to="/admissions"
              className="rounded-xl bg-[#16a34a] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:bg-[#15803d] active:scale-95"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile/tablet: Apply Now + Hamburger ONLY — no settings/theme/lang */}
          <div className="flex items-center gap-2 xl:hidden">
            <Link
              to="/admissions"
              className="rounded-xl bg-[#16a34a] px-3.5 py-1.5 text-xs font-black uppercase text-white shadow-md transition-all hover:bg-[#15803d]"
            >
              Apply Now
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="rounded-xl p-2 text-[#002147] hover:bg-slate-100"
              aria-label="Open menu"
              aria-expanded={isMobileOpen}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm xl:hidden"
              onClick={closeMobile}
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[10001] flex w-[85%] max-w-xs flex-col overflow-y-auto bg-[#00152e] p-6 text-white shadow-2xl [-webkit-overflow-scrolling:touch] xl:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              style={{ color: '#ffffff' }}
            >
              {/* Top: Logo + title + close */}
              <div className="mb-6 flex items-start justify-between gap-3 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <img
                    src="/dhapti-logo.png"
                    alt="Dhapti University"
                    className="h-10 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/dhapti-logo.jpg";
                    }}
                  />
                  <div>
                    <span className="block text-base font-black tracking-tight text-white">
                      DHAPTI
                    </span>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-orange-400">
                      UNIVERSITY
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="shrink-0 rounded-xl p-2 !text-white transition-colors hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <X size={24} className="!text-white" />
                </button>
              </div>

              {/* Middle: high-contrast nav links */}
              <nav className="mb-6 flex-1" aria-label="Mobile">
                <Link to="/" onClick={closeMobile} className={mobileLinkClass}>
                  Home
                </Link>

                {Object.keys(menuData).map((menuKey) => {
                  const open = mobileExpanded === menuKey;
                  return (
                    <div key={menuKey}>
                      <button
                        type="button"
                        onClick={() =>
                          setMobileExpanded(open ? null : menuKey)
                        }
                        className={cn(
                          mobileLinkClass,
                          'flex w-full items-center justify-between text-left'
                        )}
                        aria-expanded={open}
                      >
                        <span className="!text-white">{menuKey}</span>
                        <ChevronDown
                          size={16}
                          className={cn(
                            'shrink-0 !text-white/80 transition-transform',
                            open && 'rotate-180 !text-orange-400'
                          )}
                        />
                      </button>
                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-white/5 pb-2"
                          >
                            {menuData[menuKey].map((item) => (
                              <Link
                                key={item.href + item.label}
                                to={item.href}
                                onClick={closeMobile}
                                className={mobileSubLinkClass}
                              >
                                {item.label}
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <Link
                  to="/contact"
                  onClick={closeMobile}
                  className={mobileLinkClass}
                >
                  Contact
                </Link>
              </nav>

              {/* Bottom: controls + portals card */}
              <div className="mt-auto space-y-4 rounded-2xl border border-white/10 bg-[#001024] p-4 shadow-inner">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] !text-slate-400">
                    Language
                  </p>
                  <div
                    className="flex overflow-hidden rounded-xl border border-white/20"
                    role="group"
                    aria-label="Language"
                  >
                    {LANG_OPTIONS.map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setLang(opt.code)}
                        className={cn(
                          'flex-1 px-3 py-2.5 text-xs font-black tracking-wide transition-colors',
                          lang === opt.code
                            ? 'bg-[#16a34a] !text-white'
                            : 'bg-transparent !text-slate-300 hover:bg-white/10 hover:!text-white'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 !text-white transition-colors hover:bg-white/10"
                    aria-label={
                      isDark ? 'Switch to light mode' : 'Switch to dark mode'
                    }
                  >
                    {isDark ? (
                      <Sun size={18} className="!text-orange-400" />
                    ) : (
                      <Moon size={18} className="!text-white" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wide !text-white">
                      {isDark ? 'Light' : 'Dark'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={openMobileSettings}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/5 !text-white transition-colors hover:bg-white/10"
                    aria-label="Layout settings"
                    title="Layout Settings"
                  >
                    <Settings className="h-5 w-5 !text-white" />
                  </button>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] !text-slate-400">
                    Portals
                  </p>
                  <div className="space-y-1">
                    {portalLinks.map((portal) => (
                      <Link
                        key={portal.href}
                        to={portal.href}
                        onClick={closeMobile}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold !text-white transition-colors hover:bg-white/10 hover:!text-orange-400"
                      >
                        <portal.icon
                          size={16}
                          className="shrink-0 !text-emerald-400"
                        />
                        {portal.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <Link
                  to="/admissions"
                  onClick={closeMobile}
                  className="flex w-full items-center justify-center rounded-xl bg-[#16a34a] px-4 py-3 text-xs font-black uppercase tracking-wider !text-white shadow-md transition hover:bg-[#15803d]"
                >
                  Apply Now
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile layout settings — centered modal, not trapped in drawer */}
      <LayoutSettingsPopover
        publicSite
        presentation="modal"
        hideTrigger
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </header>
  );
};
