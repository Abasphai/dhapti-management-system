import { motion } from "framer-motion";

import { FittedImage } from "@/components/common/FittedImage";
import { PublicPageShell } from "@/components/common/PublicPageShell";
import { DHAPTI_IMAGES, leadership } from "@/data/publicSite";

const board = [
  {
    name: "H.E. Abdullahi Mohamed Sheikh",
    role: "Chair, Board of Trustees",
    focus: "Governance, strategy, and institutional accountability",
  },
  {
    name: "Ms. Halima Abdi Farah",
    role: "Trustee — Academic Quality",
    focus: "Curriculum standards and academic integrity",
  },
  {
    name: "Mr. Ibrahim Yusuf Aden",
    role: "Trustee — Finance & Development",
    focus: "Resource stewardship and campus growth",
  },
  {
    name: "Dr. Sahra Hassan Barre",
    role: "Trustee — Community Partnerships",
    focus: "Industry links and public engagement",
  },
];

const adminUnits = [
  {
    title: "Office of the Rector",
    text: "Sets institutional direction, represents Dhapti nationally, and chairs senior academic councils.",
  },
  {
    title: "Academic Affairs",
    text: "Coordinates faculties, program review, examinations, and faculty development.",
  },
  {
    title: "Student Affairs",
    text: "Supports welfare, clubs, counseling, and campus life services.",
  },
  {
    title: "Finance & Administration",
    text: "Manages budgeting, procurement, facilities, and HR operations.",
  },
];

export function AuthorityPage() {
  return (
    <PublicPageShell
      heroTitle="University Authority"
      heroSubtitle="Board of Trustees and senior administration guiding Dhapti with integrity and vision."
      heroImage={DHAPTI_IMAGES.leadership}
    >
      <section id="board" className="scroll-mt-28 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black text-[#002147] dark:text-slate-100">
            Board of Trustees
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
            The Board provides strategic oversight and ensures Dhapti remains
            accountable to students, faculty, and the wider community.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {board.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-[#E5EBF3] bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-lg font-bold text-[#002147] dark:text-slate-100">
                  {member.name}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#ea580c]">
                  {member.role}
                </p>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                  {member.focus}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="administration"
        className="scroll-mt-28 bg-[#F4F7FB] px-4 py-14 dark:bg-slate-900/40 md:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black text-[#002147] dark:text-slate-100">
            Administration
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {adminUnits.map((unit, i) => (
              <motion.div
                key={unit.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border-l-4 border-[#16a34a] bg-white p-6 dark:bg-slate-950"
              >
                <h3 className="font-bold text-[#002147] dark:text-slate-100">
                  {unit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {unit.text}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {leadership.map((person) => (
              <article
                key={person.name}
                className="overflow-hidden rounded-2xl bg-white shadow-md dark:bg-slate-950"
              >
                <FittedImage
                  src={person.image}
                  alt={person.name}
                  variant="square"
                  className="rounded-none rounded-t-2xl"
                />
                <div className="p-4">
                  <h3 className="font-bold text-[#002147] dark:text-slate-100">
                    {person.name}
                  </h3>
                  <p className="mt-1 text-xs font-bold uppercase text-[#ea580c]">
                    {person.role}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
