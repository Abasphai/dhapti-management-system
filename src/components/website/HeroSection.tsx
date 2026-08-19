import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function HeroSection({
  title,
  subtitle,
  ctaLabel = "Learn More",
  ctaHref = "/about",
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-secondary/20 via-transparent to-transparent" />
      <div className="section-container relative py-20 md:py-28 lg:py-32">
        <div className="max-w-3xl">
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mb-8 text-lg text-primary-foreground/80 md:text-xl">
            {subtitle}
          </p>
          <div className="flex flex-wrap gap-4">
            <Button variant="secondary" size="lg" asChild>
              <Link to={ctaHref}>
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link to="/admissions">Apply for Admission</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        {icon && <div className="mb-2 text-secondary">{icon}</div>}
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="link" className="h-auto p-0 text-secondary" asChild>
          <Link to="/about">
            Read more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
