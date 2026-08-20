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

  return (
    <header className="fixed top-0 left-0 w-full z-[1000] font-sans shadow-md">
      {/* 1. TOP BAR (DARK NAVY WITH GREEN ICONS) */}
      <div className="bg-[#00152e] text-white py-2 px-4 md:px-12 flex justify-between items-center text-[10px] md:text-xs font-bold border-b border-white/10 uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <Home size={14} className="text-emerald-400 shrink-0" />
          <span className="truncate">DHAPTI UNIVERSITY</span>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <Link to="/student/login" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <User size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">STUDENT PORTAL</span>
          </Link>
          <Link to="/teacher/login" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <Briefcase size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">TEACHER PORTAL</span>
          </Link>
          <Link to="/admin/login" className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
            <Shield size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">ADMIN PORTAL</span>
          </Link>
          <div className="hidden lg:flex items-center gap-1.5 border-l border-white/20 pl-4">
            <Phone size={14} className="text-emerald-400" />
            <span>+252 61 700 1000</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN NAVBAR (CLEAN WHITE BACKGROUND WITH GREEN ACCENT STRIPE) */}
      <div className="bg-white text-[#002147] py-3 px-4 md:px-12 flex justify-between items-center border-b-[3px] border-[#16a34a] relative">
        {/* LOGO (DHAPTI LOGO) */}
        <Link to="/" className="flex items-center gap-3 shrink-0 mr-4">
          <img
            src="/dhapti-logo.png"
            alt="Dhapti Logo"
            className="h-12 md:h-14 w-auto object-contain"
          />
        </Link>

        {/* DESKTOP NAV LINKS */}
        <nav className="hidden xl:flex items-center gap-6 lg:gap-7 mr-6 font-extrabold text-[13px] tracking-wide text-[#002147]">
          <Link to="/" className="hover:text-[#16a34a] transition-colors">HOME</Link>

          {Object.keys(menuData).map((menuKey) => (
            <div 
              key={menuKey}
              className="relative py-2 cursor-pointer group"
              onMouseEnter={() => setActiveMenu(menuKey)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <div className={`flex items-center gap-1 uppercase transition-colors ${activeMenu === menuKey ? 'text-[#16a34a]' : 'hover:text-[#16a34a]'}`}>
                <span>{menuKey}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${activeMenu === menuKey ? 'rotate-180 text-[#16a34a]' : ''}`} />
              </div>

              {/* DROPDOWN MENU */}
              <AnimatePresence>
                {activeMenu === menuKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-2 w-64 bg-white border-t-[3px] border-[#16a34a] rounded-b-xl shadow-2xl py-2 z-50"
                  >
                    {menuData[menuKey].map((item, idx) => (
                      <Link
                        key={idx}
                        to={item.href}
                        className="block px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-[#16a34a] transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <Link to="/contact" className="hover:text-[#16a34a] transition-colors">CONTACT</Link>
        </nav>

        {/* RIGHT ACTIONS: GEAR, MOON, APPLY NOW */}
        <div className="flex items-center gap-3 md:gap-4 pl-4 border-l border-slate-200/60">
          <LayoutSettingsPopover
            publicSite
            triggerClassName="p-2 rounded-xl text-slate-700 hover:text-[#16a34a] hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
          />

          <button 
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-700 hover:text-[#16a34a] hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-slate-800"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          <Link 
            to="/admissions"
            className="bg-[#16a34a] hover:bg-[#15803d] text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            APPLY NOW
          </Link>

          {/* MOBILE TOGGLE */}
          <button 
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="xl:hidden p-2 text-[#002147] hover:bg-slate-100 rounded-xl"
          >
            {isMobileOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      {isMobileOpen && (
        <div className="xl:hidden bg-[#00152e] text-white p-6 flex flex-col gap-3 font-bold text-sm border-b border-white/10 shadow-2xl">
          <Link to="/" onClick={() => setIsMobileOpen(false)}>HOME</Link>
          <Link to="/about" onClick={() => setIsMobileOpen(false)}>ABOUT</Link>
          <Link to="/faculties" onClick={() => setIsMobileOpen(false)}>FACULTIES & PROGRAMS</Link>
          <Link to="/admissions" onClick={() => setIsMobileOpen(false)}>ADMISSIONS</Link>
          <Link to="/news" onClick={() => setIsMobileOpen(false)}>NEWS & EVENTS</Link>
          <Link to="/contact" onClick={() => setIsMobileOpen(false)}>CONTACT</Link>
        </div>
      )}
    </header>
  );
};