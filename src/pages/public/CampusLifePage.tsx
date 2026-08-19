import { BookOpen, FlaskConical, Home, Users } from "lucide-react";
import { motion } from "framer-motion";

import { FittedImage } from "@/components/common/FittedImage";
import { PublicPageShell } from "@/components/common/PublicPageShell";
import { DHAPTI_IMAGES } from "@/data/publicSite";

const facilities = [
  {
    id: "facilities",
    icon: Home,
    title: "Campus Facilities",
    text: "Lecture theatres, student lounges, sports grounds, prayer spaces, and accessible walkways across the main campus.",
    image: DHAPTI_IMAGES.campus,
  },
  {
    id: "library",
    icon: BookOpen,
    title: "University Library",
    text: "Print collections, digital journals, quiet study zones, and research support for undergraduates and postgraduates.",
    image: DHAPTI_IMAGES.library,
  },
  {
    id: "labs",
    icon: FlaskConical,
    title: "Labs & Workshops",
    text: "Science, computing, and engineering laboratories equipped for practical learning and applied research.",
    image: DHAPTI_IMAGES.lab,
  },
];

const clubs = [
  "Student Union & Leadership Forum",
  "Debate & Public Speaking Society",
  "ICT & Innovation Club",
  "Health Outreach Volunteers",
  "Agriculture Field Club",
  "Arts & Culture Collective",
];

export function CampusLifePage() {
  return (
    <PublicPageShell
      heroTitle="Campus Life"
      heroSubtitle="A vibrant academic community with facilities, clubs, and spaces that support learning beyond the classroom."
      heroImage={DHAPTI_IMAGES.students}
    >
      <section className="px-4 py-14 md:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
          {facilities.map((item, i) => (
            <motion.div
              key={item.id}
              id={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`scroll-mt-28 grid items-center gap-0 overflow-hidden rounded-3xl border border-[#E5EBF3] bg-white dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2 ${
                i % 2 === 1 ? "md:[&>:first-child]:order-2" : ""
              }`}
            >
              <FittedImage
                src={item.image}
                alt={item.title}
                variant="video"
                zoomOnHover={false}
                className="h-full min-h-64 rounded-none md:aspect-auto md:min-h-[280px]"
              />
              <div className="p-6 md:p-10">
                <item.icon className="h-8 w-8 text-[#ea580c]" />
                <h2 className="mt-4 text-2xl font-black text-[#002147] dark:text-slate-100">
                  {item.title}
                </h2>
                <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-[#002147] px-4 py-14 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 text-white">
            <Users className="h-7 w-7 text-[#ea580c]" />
            <h2 className="text-3xl font-black">Student Clubs & Activities</h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club, i) => (
              <motion.div
                key={club}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-white"
              >
                {club}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
