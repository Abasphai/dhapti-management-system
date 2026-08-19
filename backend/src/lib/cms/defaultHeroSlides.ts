/** Stock hero backgrounds (Unsplash) — no dependency on /public/images files. */
const HERO_IMAGES = {
  campus:
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop",
  students:
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop",
  lab: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1600&auto=format&fit=crop",
  lecture:
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1600&auto=format&fit=crop",
  graduation:
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop",
} as const;

/**
 * Default homepage hero carousel slides (HERO_SLIDER v1).
 */
export const DEFAULT_HERO_SLIDER_SLIDES = [
  {
    title: "Welcome To Dhapti",
    subtitle: "",
    description:
      "“Aqoontu waa iftiin, akhriskuna waa fure.” Build your future with world-class education.",
    imageUrl: HERO_IMAGES.campus,
    buttonText: "Apply Now",
    buttonLink: "/admissions",
    imagePos: "object-top" as const,
  },
  {
    title: "Admission Open 2026",
    subtitle: "",
    description:
      "“Education is the most powerful weapon which you can use to change the world.” Join us today.",
    imageUrl: HERO_IMAGES.students,
    buttonText: "Register Now",
    buttonLink: "/admissions",
    imagePos: "object-center" as const,
  },
  {
    title: "Modern Tech Labs",
    subtitle: "",
    description:
      "“Innovation distinguishes between a leader and a follower.” Explore our digital campus.",
    imageUrl: HERO_IMAGES.lab,
    buttonText: "Explore Labs",
    buttonLink: "/campus-life#labs",
    imagePos: "object-top" as const,
  },
  {
    title: "Expert Faculty",
    subtitle: "",
    description:
      "“Success is the sum of small efforts, repeated day in and day out.” Learn from the best.",
    imageUrl: HERO_IMAGES.lecture,
    buttonText: "Meet Faculty",
    buttonLink: "/faculties",
    imagePos: "object-center" as const,
  },
  {
    title: "Merit Scholarships",
    subtitle: "",
    description:
      "“The roots of education are bitter, but the fruit is sweet.” Avail up to 50% scholarships.",
    imageUrl: HERO_IMAGES.graduation,
    buttonText: "Learn More",
    buttonLink: "/admissions",
    imagePos: "object-top" as const,
  },
] as const;
