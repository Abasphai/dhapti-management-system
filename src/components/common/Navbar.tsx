import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Home, User, Briefcase, Shield, Phone, 
  ChevronDown, Moon, Sun, Menu, X 
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

  const closeMobile = () => {
    setIsMobileOpen(false);
    setMobileExpanded(null);
  };

  return (
    <header className="fixed top-0 left-0 z-[1000] w-full max-w-full overflow-x-hidden font-sans shadow-md">
      {/* 1. TOP BAR (DARK NAVY WITH GREEN ICONS) */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#00152e] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white sm:px-6 md:px-12 md:text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Home size={14} className="shrink-0 text-emerald-400" />
          <span className="truncate">DHAPTI UNIVERSITY</span>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4 md:gap-6">
          <Link to="/student/login" className="flex items-center gap-1.5 transition-colors hover:text-emerald-400">
            <User size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">STUDENT PORTAL</span>
          </Link>
          <Link to="/teacher/login" className="flex items-center gap-1.5 transition-colors hover:text-emerald-400">
            <Briefcase size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">TEACHER PORTAL</span>
          </Link>
          <Link to="/admin/login" className="flex items-center gap-1.5 transition-colors hover:text-emerald-400">
            <Shield size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">ADMIN PORTAL</span>
          </Link>
          <div className="hidden items-center gap-1.5 border-l border-white/20 pl-4 lg:flex">
            <Phone size={14} className="text-emerald-400" />
            <span>+252 61 700 1000</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR */}
      <div className="relative flex items-center justify-between border-b-[3px] border-[#16a34a] bg-white px-4 py-3 text-[#002147] sm:px-6 md:px-12">
        <Link to="/" className="mr-2 flex shrink-0 items-center gap-3 sm:mr-4">
          <img
            src="/dhapti-logo.png"
            alt="Dhapti Logo"
            className="h-12 w-auto object-contain md:h-14"
          />
        </Link>

        {/* DESKTOP NAV LINKS */}
        <nav className="mr-6 hidden items-center gap-6 text-[13px] font-extrabold tracking-wide text-[#002147] xl:flex lg:gap-7">
          <Link to="/" className="transition-colors hover:text-[#16a34a]">HOME</Link>

          {Object.keys(menuData).map((menuKey) => (
            <div 
              key={menuKey}
              className="group relative cursor-pointer py-2"
              onMouseEnter={() => setActiveMenu(menuKey)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <div className={`flex items-center gap-1 uppercase transition-colors ${activeMenu === menuKey ? 'text-[#16a34a]' : 'hover:text-[#16a34a]'}`}>
                <span>{menuKey}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${activeMenu === menuKey ? 'rotate-180 text-[#16a34a]' : ''}`} />
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

          <Link to="/contact" className="transition-colors hover:text-[#16a34a]">CONTACT</Link>
        </nav>

        <div className="flex items-center gap-2 border-l border-slate-200/60 pl-3 sm:gap-3 md:gap-4 md:pl-4">
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
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          <Link 
            to="/admissions"
            className="hidden rounded-xl bg-[#16a34a] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:bg-[#15803d] active:scale-95 sm:inline-flex sm:px-6"
          >
            APPLY NOW
          </Link>

          <button 
            type="button"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="rounded-xl p-2 text-[#002147] hover:bg-slate-100 xl:hidden"
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileOpen}
          >
            {isMobileOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="max-h-[min(70vh,560px)] overflow-y-auto border-b border-white/10 bg-[#00152e] text-white shadow-2xl xl:hidden"
          >
            <nav className="flex flex-col gap-1 p-4 sm:p-6">
              <Link
                to="/"
                onClick={closeMobile}
                className="rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
              >
                Home
              </Link>
              <Link
                to="/admissions"
                onClick={closeMobile}
                className="rounded-xl px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
              >
                Admissions
              </Link>

              {Object.keys(menuData).map((menuKey) => {
                const open = mobileExpanded === menuKey;
                return (
                  <div key={menuKey} className="border-t border-white/10 pt-1">
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
                        className={`shrink-0 transition-transform ${open ? 'rotate-180 text-emerald-400' : ''}`}
                      />
                    </button>
                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pb-2 pl-2"
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
                className="mt-1 rounded-xl border-t border-white/10 px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
              >
                Contact
              </Link>

              <Link
                to="/admissions"
                onClick={closeMobile}
                className="mt-2 flex items-center justify-center rounded-xl bg-[#16a34a] px-4 py-3 text-xs font-black uppercase tracking-wider text-white sm:hidden"
              >
                Apply Now
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
