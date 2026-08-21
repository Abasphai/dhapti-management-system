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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { LayoutSettingsPopover } from '@/components/common/LayoutSettingsPopover';
import { useTheme } from '@/context/ThemeContext';

export const Navbar = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
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
    FACULTY: [
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

  useEffect(() => {
    if (!isMobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileOpen]);

  return (
    <header className="fixed left-0 top-0 z-[1000] w-full max-w-full overflow-x-hidden font-sans shadow-md">
      {/* 1. TOP BAR */}
      <div className="flex max-w-full items-center justify-between overflow-x-hidden border-b border-white/10 bg-[#00152e] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white sm:px-6 md:px-12 md:text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Home size={14} className="shrink-0 text-emerald-400" />
          <span className="truncate">DHAPTI UNIVERSITY</span>
        </div>

        <div className="hidden shrink-0 items-center gap-4 md:flex md:gap-6">
          {portalLinks.map((portal) => (
            <Link
              key={portal.href}
              to={portal.href}
              className="flex items-center gap-1.5 transition-colors hover:text-emerald-400"
            >
              <portal.icon size={14} className="text-emerald-400" />
              <span className="hidden lg:inline">{portal.label}</span>
            </Link>
          ))}
          <div className="hidden items-center gap-1.5 border-l border-white/20 pl-4 xl:flex">
            <Phone size={14} className="text-emerald-400" />
            <span>+252 61 700 1000</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR — mobile: logo + compact actions only */}
      <div className="relative flex max-w-full items-center justify-between gap-2 overflow-x-hidden border-b-[3px] border-[#16a34a] bg-white px-3 py-3 text-[#002147] sm:px-6 md:px-12">
        <Link to="/" className="flex min-w-0 shrink-0 items-center">
          <img
            src="/dhapti-logo.png"
            alt="Dhapti Logo"
            className="h-10 w-auto max-w-[140px] object-contain sm:h-12 sm:max-w-none md:h-14"
          />
        </Link>

        {/* DESKTOP NAV — strictly hidden below xl */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-5 text-[13px] font-extrabold tracking-wide text-[#002147] xl:flex xl:gap-6 2xl:gap-7"
          aria-label="Primary"
        >
          <Link to="/" className="shrink-0 transition-colors hover:text-[#16a34a]">
            HOME
          </Link>

          {Object.keys(menuData).map((menuKey) => (
            <div
              key={menuKey}
              className="group relative shrink-0 cursor-pointer py-2"
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
                    className="absolute left-0 top-full z-50 mt-2 w-64 rounded-b-xl border-t-[3px] border-[#16a34a] bg-white py-2 shadow-2xl"
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

        {/* RIGHT ACTIONS */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-3">
          <div className="hidden xl:block">
            <LayoutSettingsPopover
              publicSite
              triggerClassName="p-2 rounded-xl text-slate-700 hover:text-[#16a34a] hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
            />
          </div>

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
            className="rounded-xl bg-[#16a34a] px-2.5 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:bg-[#15803d] active:scale-95 sm:px-4 sm:text-xs md:px-6"
          >
            Apply
            <span className="hidden sm:inline"> Now</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="rounded-xl p-2 text-[#002147] hover:bg-slate-100 xl:hidden"
            aria-label="Open menu"
            aria-expanded={isMobileOpen}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER — slide in from right */}
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
              className="fixed inset-0 z-[1001] bg-black/50 xl:hidden"
              onClick={closeMobile}
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 right-0 z-[1002] flex w-[min(100%,320px)] max-w-full flex-col overflow-x-hidden bg-[#00152e] text-white shadow-2xl xl:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <img
                  src="/dhapti-logo.png"
                  alt="Dhapti"
                  className="h-10 w-auto object-contain brightness-0 invert"
                />
                <button
                  type="button"
                  onClick={closeMobile}
                  className="rounded-xl p-2 text-white transition-colors hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 [-webkit-overflow-scrolling:touch]">
                <Link
                  to="/"
                  onClick={closeMobile}
                  className="block rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
                >
                  Home
                </Link>

                {Object.keys(menuData).map((menuKey) => {
                  const open = mobileExpanded === menuKey;
                  return (
                    <div key={menuKey} className="border-t border-white/10">
                      <button
                        type="button"
                        onClick={() =>
                          setMobileExpanded(open ? null : menuKey)
                        }
                        className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
                        aria-expanded={open}
                      >
                        <span>{menuKey}</span>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 transition-transform ${
                            open ? 'rotate-180 text-emerald-400' : ''
                          }`}
                        />
                      </button>
                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden pb-2 pl-1"
                          >
                            {menuData[menuKey].map((item) => (
                              <Link
                                key={item.href + item.label}
                                to={item.href}
                                onClick={closeMobile}
                                className="block rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10 hover:text-emerald-400"
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
                  className="mt-1 block rounded-xl border-t border-white/10 px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
                >
                  Contact
                </Link>

                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    Portals
                  </p>
                  {portalLinks.map((portal) => (
                    <Link
                      key={portal.href}
                      to={portal.href}
                      onClick={closeMobile}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition-colors hover:bg-white/10"
                    >
                      <portal.icon size={16} className="text-emerald-400" />
                      {portal.label}
                    </Link>
                  ))}
                </div>

                <Link
                  to="/admissions"
                  onClick={closeMobile}
                  className="mt-4 flex items-center justify-center rounded-xl bg-[#16a34a] px-4 py-3.5 text-xs font-black uppercase tracking-wider text-white"
                >
                  Apply Now
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};
