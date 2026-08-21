import { useState, type FormEvent } from "react";
import {
  HelpCircle,
  Mail,
  Phone,
  Clock,
  Send,
  X,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";

/** Light, high-contrast fields — force readable text even when site dark mode is on. */
const helpDeskFieldClass =
  "rounded-xl border border-slate-200 bg-slate-50 font-bold text-[#002147] placeholder:font-medium placeholder:text-slate-400 focus-visible:border-orange-500 focus-visible:ring-orange-500/30 dark:border-slate-200 dark:bg-slate-50 dark:text-[#002147] dark:placeholder:text-slate-400";

export function AdmissionHelpDesk() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const close = () => {
    setOpen(false);
    window.setTimeout(() => setSent(false), 200);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", phone: "", message: "" });
    toast.success("Help desk request received — admissions will follow up.");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Admission Help Desk"
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex items-center gap-2 rounded-full bg-[#16a34a] px-5 py-3",
          "font-bold text-white shadow-2xl",
          "transition-all hover:bg-[#15803d] hover:scale-[1.02] active:scale-95",
          "cursor-pointer"
        )}
      >
        <HelpCircle className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} />
        <span className="text-sm md:text-base">{t("btn.helpDesk")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[110] flex min-h-screen items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-desk-title"
          >
            <motion.button
              type="button"
              aria-label="Close help desk overlay"
              className="absolute inset-0 bg-[#002147]/55 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative z-10 flex max-h-[90vh] w-[95%] max-w-xl flex-col overflow-hidden rounded-2xl border border-[#E5EBF3] bg-white p-0 shadow-2xl sm:w-full"
            >
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden bg-[#002147] px-6 py-5 text-white md:px-8">
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#ea580c]/25 blur-2xl" />
                <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-[#16a34a]/20 blur-2xl" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ea580c] shadow-lg shadow-[#ea580c]/30">
                      <HelpCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h2
                        id="help-desk-title"
                        className="text-lg font-bold tracking-tight md:text-xl"
                      >
                        Dhapti Admission Help Desk
                      </h2>
                      <p className="mt-0.5 text-xs text-white/70">
                        Talk to Admissions — we reply within 24 hours
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={close}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:border-[#ea580c] hover:bg-[#ea580c]"
                    aria-label="Close Help Desk"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
                {sent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="flex flex-col items-center px-2 py-8 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 16,
                        delay: 0.05,
                      }}
                      className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#16a34a]/10"
                    >
                      <CheckCircle2 className="h-9 w-9 text-[#16a34a]" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-[#002147]">
                      Message Sent Successfully!
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                      We will respond to your email within 24 hours. Check your
                      inbox for a reply from Admissions.
                    </p>
                    <Button
                      type="button"
                      className="mt-6 rounded-xl bg-[#002147] px-8 hover:bg-[#003366]"
                      onClick={close}
                    >
                      Back to page
                    </Button>
                  </motion.div>
                ) : (
                  <div className="space-y-5">
                    {/* Quick contact cards */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <a
                        href="tel:+25261XXXXXXX"
                        className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3 transition-colors hover:border-[#ea580c]/40 hover:bg-[#ea580c]/5"
                      >
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#002147]/10">
                          <Phone className="h-4 w-4 text-[#002147]" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Admissions Phone
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-[#002147]">
                          +252 61 XXX XXXX
                        </p>
                      </a>
                      <a
                        href="mailto:admissions@dhapti.edu.so"
                        className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3 transition-colors hover:border-[#ea580c]/40 hover:bg-[#ea580c]/5"
                      >
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#ea580c]/10">
                          <Mail className="h-4 w-4 text-[#ea580c]" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Email
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-[#002147]">
                          admissions@dhapti.edu.so
                        </p>
                      </a>
                      <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#16a34a]/10">
                          <Clock className="h-4 w-4 text-[#16a34a]" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Office Hours
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-[#002147]">
                          Sun – Thu: 8:00 AM – 4:00 PM
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#E5EBF3] bg-[#F4F7FB] p-3">
                        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#16a34a]/10">
                          <Activity className="h-4 w-4 text-[#16a34a]" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Live System Status
                        </p>
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-xs font-bold text-[#15803d]">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16a34a] opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16a34a]" />
                          </span>
                          Online
                        </span>
                      </div>
                    </div>

                    {/* Form */}
                    <form className="space-y-3" onSubmit={onSubmit}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#002147]">
                          Quick Contact Form
                        </p>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#ea580c]">
                          Required fields *
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="help-name"
                            className="font-bold text-[#002147]"
                          >
                            Name *
                          </Label>
                          <Input
                            id="help-name"
                            required
                            value={form.name}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, name: e.target.value }))
                            }
                            placeholder="Your full name"
                            className={helpDeskFieldClass}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="help-email"
                            className="font-bold text-[#002147]"
                          >
                            Email *
                          </Label>
                          <Input
                            id="help-email"
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, email: e.target.value }))
                            }
                            placeholder="you@example.com"
                            className={helpDeskFieldClass}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="help-phone"
                          className="font-bold text-[#002147]"
                        >
                          Phone *
                        </Label>
                        <Input
                          id="help-phone"
                          required
                          value={form.phone}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, phone: e.target.value }))
                          }
                          placeholder="+252 61 …"
                          className={helpDeskFieldClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="help-message"
                          className="font-bold text-[#002147]"
                        >
                          Question / Message *
                        </Label>
                        <Textarea
                          id="help-message"
                          required
                          rows={3}
                          value={form.message}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, message: e.target.value }))
                          }
                          placeholder="How can we help with your admission?"
                          className={helpDeskFieldClass}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 font-bold text-[#002147] transition-all hover:bg-slate-200 hover:text-[#002147]"
                          onClick={close}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1 gap-2 rounded-xl bg-orange-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-orange-700 active:scale-95"
                        >
                          <Send className="h-4 w-4" />
                          Send Message
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
