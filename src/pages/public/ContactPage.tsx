import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { PublicPageShell } from "@/components/common/PublicPageShell";
import { useLanguage } from "@/context/LanguageContext";
import { useLayout } from "@/context/LayoutContext";
import { DHAPTI_IMAGES } from "@/data/publicSite";
import { cn } from "@/lib/utils";

const directory = [
  {
    title: "Admissions Office",
    phone: "+252 61 6122185",
    email: "admissions@dhapti.edu.so",
  },
  {
    title: "Rector's Office",
    phone: "+252 61 700 1100",
    email: "rector@dhapti.edu.so",
  },
  {
    title: "IT Support",
    phone: "+252 61 700 1199",
    email: "support@dhapti.edu.so",
  },
] as const;

export function ContactPage() {
  const { t, translateLabel } = useLanguage();
  const { contentWidthClass } = useLayout();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    toast.success(t("contact.toastSent"));
    window.setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <PublicPageShell
      heroTitle={t("contact.heroTitle")}
      heroSubtitle={t("contact.heroSubtitle")}
      heroImage={DHAPTI_IMAGES.campus}
    >
      <section className="py-14">
        <div
          className={cn(
            "layout-content-width grid gap-10 lg:grid-cols-2",
            contentWidthClass
          )}
        >
          <motion.form
            onSubmit={onSubmit}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-[#E5EBF3] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8"
          >
            <h2 className="text-2xl font-black text-[#002147] dark:text-slate-100">
              {t("contact.sendMessage")}
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {t("contact.responseTime")}
            </p>

            {submitted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#16a34a]/10 px-4 py-3 text-sm font-semibold text-[#16a34a]"
              >
                <CheckCircle2 className="h-5 w-5" />
                {t("contact.success")}
              </motion.div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#002147] dark:text-slate-200">
                {t("contact.name")}
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#E5EBF3] px-3 py-2.5 font-semibold text-[#002147] outline-none ring-[#ea580c] focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="block text-sm font-semibold text-[#002147] dark:text-slate-200">
                {t("contact.email")}
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#E5EBF3] px-3 py-2.5 font-semibold text-[#002147] outline-none ring-[#ea580c] focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-semibold text-[#002147] dark:text-slate-200">
              {t("contact.subject")}
              <input
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-[#E5EBF3] px-3 py-2.5 font-semibold text-[#002147] outline-none ring-[#ea580c] focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-[#002147] dark:text-slate-200">
              {t("contact.message")}
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E5EBF3] px-3 py-2.5 font-semibold text-[#002147] outline-none ring-[#ea580c] focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <button
              type="submit"
              className="mt-6 w-full rounded-xl bg-[#ea580c] px-5 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#c2410c]"
            >
              {t("contact.submit")}
            </button>
          </motion.form>

          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl bg-[#002147] p-6 text-white md:p-8"
            >
              <h2 className="text-2xl font-black">{t("contact.mainCampus")}</h2>
              <div className="mt-5 space-y-4 text-white/85">
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#ea580c]" />
                  {t("contact.address")}
                </p>
                <p className="flex items-center gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-[#ea580c]" />
                  +252 61 700 1000
                </p>
                <p className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-[#ea580c]" />
                  info@dhapti.edu.so
                </p>
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-1">
              {directory.map((office, i) => (
                <motion.div
                  key={office.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl border border-[#E5EBF3] bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <h3 className="font-bold text-[#002147] dark:text-slate-100">
                    {translateLabel(office.title)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {office.phone}
                  </p>
                  <p className="text-sm text-[#ea580c]">{office.email}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={cn(
            "layout-content-width mt-12 overflow-hidden rounded-3xl border border-[#E5EBF3] dark:border-slate-800",
            contentWidthClass,
            "!px-0"
          )}
        >
          <div className="flex h-72 items-center justify-center bg-[linear-gradient(135deg,#002147_0%,#0a3a6e_50%,#16a34a_100%)] text-center text-white">
            <div>
              <MapPin className="mx-auto h-10 w-10 text-[#ea580c]" />
              <p className="mt-3 text-lg font-bold">{t("contact.mapPlaceholder")}</p>
              <p className="mt-1 text-sm text-white/75">
                {t("contact.mapCaption")}
              </p>
            </div>
          </div>
        </motion.div>
      </section>
    </PublicPageShell>
  );
}
