import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  Quote,
  Briefcase,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

const quotes = [
  {
    text: "Teaching is the profession that creates all other professions. Your impact at Dhapti is everlasting.",
    author: "Academic Motto",
  },
  {
    text: "The art of teaching is the art of assisting discovery. Guide your students toward greatness.",
    author: "Mark Van Doren",
  },
  {
    text: "Knowledge is power, but sharing it is the ultimate leadership.",
    author: "Dhapti Faculty Creed",
  },
];

const ACCENT = "#16a34a";

export const TeacherLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [current, setCurrent] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((p) => (p + 1) % quotes.length),
      8000
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#050505] font-sans text-white md:flex-row">
      {/* LEFT: Inspiration */}
      <div className="relative hidden flex-[1.2] flex-col justify-center overflow-hidden border-r border-white/5 bg-gradient-to-br from-black via-[#00152e]/60 to-black px-16 md:flex lg:px-24">
        <button
          onClick={() => navigate("/")}
          className="group absolute left-10 top-10 z-50 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 transition-all hover:text-orange-500"
        >
          <div className="rounded-full border border-white/10 p-2 transition-all group-hover:border-orange-500/50">
            <ArrowLeft size={14} />
          </div>
          Back Home
        </button>

        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="mb-4 text-xs font-black uppercase tracking-[0.3em] text-[#16a34a]">
              Faculty Excellence
            </p>
            <h1 className="mb-10 text-4xl font-black leading-[1.1] tracking-tight text-white lg:text-6xl">
              Shaping Minds, <br />
              <span className="bg-gradient-to-r from-white to-gray-500 bg-clip-text font-serif italic text-transparent">
                Building Futures
              </span>
            </h1>
          </motion.div>
          <div className="relative h-32 text-white">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Quote className="mb-4 text-orange-500/20" size={32} />
                <p className="border-l-2 border-orange-500/30 pl-6 text-lg font-medium italic leading-relaxed text-gray-400 lg:text-xl">
                  “{quotes[current].text}”
                </p>
                <p className="ml-7 mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  — {quotes[current].author}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RIGHT: Login */}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-black px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full max-w-[400px] flex-col items-center gap-y-6 overflow-visible rounded-[32px] border border-white/5 bg-[#0f0f0f] px-8 py-8 shadow-2xl"
        >
          {/* Header */}
          <div className="flex w-full flex-col items-center gap-y-4 text-center">
            <img
              src="/dhapti-logo.png"
              alt="Dhapti University"
              className="mx-auto h-12 w-auto shrink-0 object-contain md:h-14"
            />
            <div className="space-y-1">
              <h2 className="text-xl font-black tracking-tight text-white">
                Dhapti University
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-500">
                Faculty Portal
              </p>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                borderColor: `${ACCENT}33`,
                backgroundColor: `${ACCENT}1A`,
              }}
            >
              <Briefcase size={12} style={{ color: ACCENT }} />
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: ACCENT }}
              >
                Authorized Staff
              </span>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setSubmitting(true);
              try {
                await login(email, password, "TEACHER");
                navigate("/teacher/dashboard");
              } catch (err) {
                setError(
                  err instanceof ApiError
                    ? err.message
                    : "Unable to sign in. Is the API running?"
                );
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex w-full flex-col gap-y-5"
          >
            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-y-1.5">
              <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-gray-500">
                Faculty Access ID
              </label>
              <div className="group relative">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 group-focus-within:text-[#16a34a]"
                  size={16}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/60 py-3.5 pl-12 pr-4 text-sm font-bold text-white transition-all placeholder:text-slate-300 focus:border-[#16a34a]/50 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/10"
                  placeholder="faculty@dhapti.edu.so"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-1.5">
              <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-gray-500">
                Secure Password
              </label>
              <div className="group relative">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-white/10 bg-black/60 py-3.5 pl-12 pr-12 text-sm font-bold text-white transition-all placeholder:text-slate-300 focus:border-[#16a34a]/50 focus:outline-none focus:ring-2 focus:ring-[#16a34a]/10"
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/10 bg-transparent accent-[#16a34a]"
                />
                <span className="text-[10px] font-bold text-gray-500">
                  Keep Login
                </span>
              </label>
              <button
                type="button"
                className="text-[10px] font-black uppercase text-orange-500 hover:underline"
              >
                Forgot?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mb-4 flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#16a34a] text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all hover:bg-[#1bbd5c] disabled:opacity-60"
            >
              {submitting ? "Signing In…" : "Faculty Sign In"}{" "}
              <ShieldCheck size={18} />
            </button>
          </form>

          <div className="w-full border-t border-white/5 pt-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Faculty credentials required
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
