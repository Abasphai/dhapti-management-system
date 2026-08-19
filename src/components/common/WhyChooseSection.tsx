import {
  Award,
  Globe,
  GraduationCap,
  HeartHandshake,
  Lightbulb,
  Users,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnimatedStat } from "@/components/common/AnimatedStat";
import { useLanguage } from "@/context/LanguageContext";
import {
  FALLBACK_WHY_CHOOSE,
  type WhyChoosePayload,
} from "@/lib/cmsPageContent";

import { SectionHeader } from "./SectionHeader";

const ICON_MAP: Record<string, LucideIcon> = {
  GraduationCap,
  Users,
  Globe,
  Lightbulb,
  Award,
  HeartHandshake,
};

export function WhyChooseSection({
  data,
}: {
  data?: WhyChoosePayload | null;
}) {
  const { translateLabel } = useLanguage();
  const content = data ?? FALLBACK_WHY_CHOOSE;

  return (
    <section className="section-padding bg-muted/30">
      <div className="section-container">
        <SectionHeader
          label={translateLabel(content.sectionLabel)}
          title={translateLabel(content.sectionTitle)}
          description={translateLabel(content.sectionDescription)}
        />

        <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {content.stats.map((stat) => (
            <AnimatedStat
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={translateLabel(stat.label)}
            />
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {content.features.map((feature, i) => {
            const Icon = ICON_MAP[feature.icon] ?? GraduationCap;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group h-full border-transparent bg-card transition-all hover:border-secondary/20 hover:shadow-md">
                  <CardHeader>
                    <div
                      className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[color:var(--portal-accent)]/10 transition-colors"
                      style={{ color: "var(--portal-accent)" }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">
                      {translateLabel(feature.title)}
                    </CardTitle>
                    <CardDescription className="leading-relaxed">
                      {translateLabel(feature.description)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
