import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";
import {
  fetchPublicCmsSettings,
  resolveInternalLink,
  type CmsWebsiteSettings,
} from "@/lib/cmsPublic";

const MISSION =
  "Empowering the next generation of leaders, innovators, and professionals across Somalia through world-class education and practical skills.";

const EXPLORE_LINKS = [
  { label: "About Dhapti", to: "/about" },
  { label: "Faculties & Programs", to: "/faculties" },
  { label: "Online Admissions 2026", to: "/admissions" },
  { label: "News & Events", to: "/news" },
  { label: "Campus Downloads", to: "/pages/downloads" },
  { label: "University Research", to: "/pages/research-policy" },
] as const;

const PORTAL_LINKS = [
  { label: "👨‍🎓 Student Portal", to: "/student/login" },
  { label: "👨‍🏫 Teacher Portal", to: "/teacher/login" },
  { label: "👨‍💼 Admin Portal", to: "/admin/login" },
  {
    label: "🔍 Verify Certificate",
    to: "/verify/certificate/BIUVERIFY001A",
  },
  { label: "❓ Help Desk", to: "/contact" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy Policy", to: "/pages/privacy" },
  { label: "Terms of Use", to: "/pages/terms" },
  { label: "Security Compliance", to: "/pages/security-compliance" },
] as const;

const SOCIAL_PLATFORMS = [
  { Icon: Facebook, key: "socialFacebook" as const, label: "Dhapti on Facebook" },
  { Icon: Twitter, key: "socialTwitter" as const, label: "Dhapti on X" },
  { Icon: Linkedin, key: "socialLinkedIn" as const, label: "Dhapti on LinkedIn" },
  { Icon: Youtube, key: "socialYouTube" as const, label: "Dhapti on YouTube" },
  { Icon: Instagram, key: "socialInstagram" as const, label: "Dhapti on Instagram" },
] as const;

const linkHoverClass =
  "block text-xs font-semibold text-slate-300 transition-all hover:translate-x-1.5 hover:text-orange-400";

function FooterNavLink({ to, children }: { to: string; children: ReactNode }) {
  const resolved = resolveInternalLink(to);
  if (resolved.external) {
    return (
      <a
        href={resolved.to}
        className={linkHoverClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }
  return (
    <Link to={resolved.to} className={linkHoverClass}>
      {children}
    </Link>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div
        className="h-1 w-8 rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
        aria-hidden
      />
      <h4 className="text-[11px] font-black uppercase tracking-[0.22em] text-white">
        {children}
      </h4>
    </div>
  );
}

export function Footer() {
  const { dir } = useLanguage();
  const [settings, setSettings] = useState<CmsWebsiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cmsSettings = await fetchPublicCmsSettings();
        if (!cancelled && cmsSettings) setSettings(cmsSettings);
      } catch (err) {
        console.warn("[Footer] CMS settings load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const year = new Date().getFullYear();
  const primaryPhone =
    settings?.contactPhone?.trim() || "+252 61 700 1000";
  const officeHours =
    settings?.officeHours?.trim() || "Sun – Thu: 8:00 AM – 4:00 PM";

  return (
    <footer
      className="relative z-0 bg-gradient-to-b from-[#00152e] via-[#001024] to-[#000a17] text-white"
      dir={dir}
    >
      {/* Top accent border */}
      <div
        className="h-[3px] bg-gradient-to-r from-emerald-500 via-orange-500 to-emerald-500"
        aria-hidden
      />

      {/* Main grid — z-0 keeps fixed help-desk / scroll-top (z-50) unobstructed */}
      <div className="mx-auto max-w-7xl px-6 py-16 md:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Column 1 — Brand */}
          <div className="space-y-5 lg:col-span-4">
            <div className="flex items-center gap-4">
              <img
                src="/dhapti-logo.png"
                alt="Dhapti University"
                className="h-16 w-auto object-contain"
              />
              <div>
                <h2 className="text-xl font-black tracking-tight text-white">
                  Dhapti University
                </h2>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-orange-400">
                  Skills for a Better Future
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">{MISSION}</p>

            <div className="flex flex-wrap gap-2.5">
              {SOCIAL_PLATFORMS.map(({ Icon, key, label }) => {
                const href = settings?.[key]?.trim();
                const className =
                  "rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition-all duration-300 hover:bg-orange-500 hover:text-white";

                if (!href) {
                  return (
                    <span
                      key={key}
                      className={`${className} cursor-default opacity-50`}
                      aria-label={`${label} (not configured)`}
                      title={`${label} (not configured)`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                }

                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Column 2 — Explore & Academics */}
          <div className="space-y-4 lg:col-span-3">
            <SectionTitle>Explore &amp; Academics</SectionTitle>
            <nav className="space-y-2.5 pt-1" aria-label="Explore and academics">
              {EXPLORE_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Column 3 — Portals & Access */}
          <div className="space-y-4 lg:col-span-2">
            <SectionTitle>Portals &amp; Access</SectionTitle>
            <nav className="space-y-2.5 pt-1" aria-label="Portals and access">
              {PORTAL_LINKS.map((link) => (
                <FooterNavLink key={link.to} to={link.to}>
                  {link.label}
                </FooterNavLink>
              ))}
            </nav>
          </div>

          {/* Column 4 — Campus Directory */}
          <div className="space-y-4 lg:col-span-3">
            <SectionTitle>Campus Directory</SectionTitle>
            <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3 text-xs text-slate-300">
              <div className="flex gap-2.5">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                  aria-hidden
                />
                <div>
                  <p className="font-bold text-white">Main Campus</p>
                  <p className="mt-0.5 leading-relaxed">
                    Horseed District, Baidoa, South West State of Somalia
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Phone
                  className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                  aria-hidden
                />
                <div>
                  <p className="font-bold text-white">Inquiries</p>
                  <p className="mt-0.5">
                    <a
                      href={`tel:${primaryPhone.replace(/\s/g, "")}`}
                      className="transition-colors hover:text-orange-400"
                    >
                      {primaryPhone}
                    </a>
                    {" / "}
                    <a
                      href="tel:+252615550100"
                      className="transition-colors hover:text-orange-400"
                    >
                      +252 61 555 0100
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Mail
                  className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                  aria-hidden
                />
                <div>
                  <p className="font-bold text-white">Official Email</p>
                  <p className="mt-0.5">
                    <a
                      href="mailto:info@dhapti.edu.so"
                      className="transition-colors hover:text-orange-400"
                    >
                      info@dhapti.edu.so
                    </a>
                    {" / "}
                    <a
                      href="mailto:admissions@dhapti.edu.so"
                      className="transition-colors hover:text-orange-400"
                    >
                      admissions@dhapti.edu.so
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <Clock
                  className="mt-0.5 h-4 w-4 shrink-0 text-orange-400"
                  aria-hidden
                />
                <div>
                  <p className="font-bold text-white">Office Hours</p>
                  <p className="mt-0.5">{officeHours}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sub-footer */}
      <div className="border-t border-white/5 bg-[#000711] px-6 py-5 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-slate-400 md:flex-row">
          <p className="text-center md:text-left">
            &copy; {year} Dhapti University. All rights reserved. Learn &bull;
            Skill &bull; Grow.
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-4 md:justify-end"
            aria-label="Legal"
          >
            {LEGAL_LINKS.map((link) => {
              const resolved = resolveInternalLink(link.to);
              const legalClass =
                "text-xs text-slate-400 transition-colors hover:text-orange-400";
              return resolved.external ? (
                <a
                  key={link.to}
                  href={resolved.to}
                  className={legalClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.to} to={resolved.to} className={legalClass}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </footer>
  );
}
