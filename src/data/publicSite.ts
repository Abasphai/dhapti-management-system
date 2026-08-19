export const DHAPTI_IMAGES = {
  campus:
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1600&auto=format&fit=crop",
  lecture:
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1600&auto=format&fit=crop",
  library:
    "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?q=80&w=1600&auto=format&fit=crop",
  graduation:
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=1600&auto=format&fit=crop",
  lab: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1600&auto=format&fit=crop",
  leadership:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=800&auto=format&fit=crop",
  students:
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1600&auto=format&fit=crop",
  medicine:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop",
  engineering:
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop",
  business:
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&auto=format&fit=crop",
  law: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1200&auto=format&fit=crop",
  agriculture:
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1200&auto=format&fit=crop",
  science:
    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=1200&auto=format&fit=crop",
};

export const leadership = [
  {
    name: "Prof. Dr. Ahmed Hassan Nur",
    role: "University Rector",
    bio: "Leading Dhapti's vision for academic excellence, community service, and regional innovation.",
    image: DHAPTI_IMAGES.leadership,
  },
  {
    name: "Dr. Fatima Mohamed Ali",
    role: "Vice-Rector (Academic Affairs)",
    bio: "Overseeing curriculum quality, faculty development, and student academic success.",
    image:
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop",
  },
  {
    name: "Dr. Omar Abdi Warsame",
    role: "Vice-Rector (Administration)",
    bio: "Ensuring operational excellence across campus services, finance, and facilities.",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=800&auto=format&fit=crop",
  },
  {
    name: "Dr. Amina Yusuf Geedi",
    role: "Dean of Medicine",
    bio: "Advancing healthcare education and clinical partnerships across South West State.",
    image:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=800&auto=format&fit=crop",
  },
];

export type FacultyDetail = {
  id: string;
  name: string;
  shortName: string;
  image: string;
  description: string;
  departments: string[];
  degrees: string[];
  duration: string;
  credits: string;
  entryRequirements: string[];
};

export const facultyDetails: FacultyDetail[] = [
  {
    id: "medicine",
    name: "Faculty of Medicine & Health Sciences",
    shortName: "Medicine",
    image: DHAPTI_IMAGES.medicine,
    description:
      "Training compassionate clinicians and public health professionals for Somalia and the region.",
    departments: ["General Medicine", "Nursing", "Public Health", "Pharmacy"],
    degrees: ["MBBS", "B.Sc. Nursing", "B.Sc. Public Health", "Diploma in Clinical Medicine"],
    duration: "4–6 Years",
    credits: "120–180 Credit Hours",
    entryRequirements: [
      "Secondary school certificate with strong science subjects",
      "Minimum 70% aggregate (or equivalent)",
      "Entrance interview / aptitude assessment",
    ],
  },
  {
    id: "engineering",
    name: "Faculty of Engineering & Technology",
    shortName: "Engineering",
    image: DHAPTI_IMAGES.engineering,
    description:
      "Preparing engineers who design resilient infrastructure and digital systems for national development.",
    departments: ["Civil Engineering", "Electrical Engineering", "Computer Engineering"],
    degrees: [
      "B.Sc. Civil Engineering",
      "B.Sc. Electrical Engineering",
      "B.Sc. Computer Engineering",
      "Diploma in ICT",
    ],
    duration: "4 Years",
    credits: "140 Credit Hours",
    entryRequirements: [
      "Mathematics and Physics at secondary level",
      "Minimum 65% aggregate (or equivalent)",
      "Placement assessment for foundation modules",
    ],
  },
  {
    id: "business",
    name: "Faculty of Business & Economics",
    shortName: "Business",
    image: DHAPTI_IMAGES.business,
    description:
      "Developing ethical entrepreneurs, accountants, and managers for Somalia's growing economy.",
    departments: ["Business Administration", "Accounting & Finance", "Economics"],
    degrees: ["BBA", "B.Sc. Accounting & Finance", "Diploma in Business Management"],
    duration: "4 Years",
    credits: "128 Credit Hours",
    entryRequirements: [
      "Secondary school certificate in any stream",
      "Minimum 60% aggregate (or equivalent)",
      "Basic English proficiency",
    ],
  },
  {
    id: "science",
    name: "Faculty of Science & Computing",
    shortName: "Science",
    image: DHAPTI_IMAGES.science,
    description:
      "Advancing scientific inquiry and computing skills through labs, research, and industry projects.",
    departments: ["Computer Science", "Information Technology", "Software Engineering"],
    degrees: [
      "B.Sc. Computer Science",
      "B.Sc. Information Technology",
      "B.Sc. Software Engineering",
    ],
    duration: "4 Years",
    credits: "132 Credit Hours",
    entryRequirements: [
      "Mathematics at secondary level preferred",
      "Minimum 60% aggregate (or equivalent)",
      "Interest in problem-solving and digital skills",
    ],
  },
  {
    id: "law",
    name: "Faculty of Law & Sharia",
    shortName: "Law",
    image: DHAPTI_IMAGES.law,
    description:
      "Forming legal professionals grounded in justice, ethics, and Islamic jurisprudence.",
    departments: ["Law", "Sharia Studies"],
    degrees: ["Bachelor of Law & Sharia", "Diploma in Legal Studies"],
    duration: "4 Years",
    credits: "136 Credit Hours",
    entryRequirements: [
      "Secondary school certificate",
      "Minimum 60% aggregate (or equivalent)",
      "Strong reading and writing skills",
    ],
  },
  {
    id: "agriculture",
    name: "Faculty of Agriculture",
    shortName: "Agriculture",
    image: DHAPTI_IMAGES.agriculture,
    description:
      "Addressing food security and sustainable farming through applied agricultural science.",
    departments: ["Agronomy", "Animal Science", "Agricultural Extension"],
    degrees: ["B.Sc. Agronomy", "B.Sc. Animal Science", "Diploma in Agriculture"],
    duration: "4 Years",
    credits: "130 Credit Hours",
    entryRequirements: [
      "Science subjects preferred (Biology / Chemistry)",
      "Minimum 60% aggregate (or equivalent)",
      "Commitment to field and laboratory learning",
    ],
  },
];

export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  category: "Campus News" | "Research" | "Admissions" | "Events";
  image: string;
};

export const newsFeed: NewsItem[] = [
  {
    id: "n1",
    title: "Dhapti Opens New Science & Research Laboratory",
    excerpt:
      "State-of-the-art laboratory facilities now support student research across computing and health sciences.",
    date: "Aug 1, 2026",
    category: "Campus News",
    image:
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "n2",
    title: "2026/2027 Admissions Window Now Open",
    excerpt:
      "Prospective students can apply online for undergraduate and postgraduate intakes across all faculties.",
    date: "Jul 28, 2026",
    category: "Admissions",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "n3",
    title: "Faculty Research Symposium Highlights Innovation",
    excerpt:
      "Researchers presented findings on public health, agriculture, and digital transformation in Dhapti.",
    date: "Jul 20, 2026",
    category: "Research",
    image:
      "https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "n4",
    title: "Campus Open Day Draws Record Attendance",
    excerpt:
      "Families and secondary school graduates toured labs, classrooms, and student services on campus.",
    date: "Jul 12, 2026",
    category: "Events",
    image:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "n5",
    title: "Partnership Signed with Regional Health Authority",
    excerpt:
      "Clinical placement pathways expanded for Medicine and Nursing students across Bay Region.",
    date: "Jul 5, 2026",
    category: "Campus News",
    image:
      "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "n6",
    title: "Scholarship Mentorship Program Launches",
    excerpt:
      "Merit scholars will receive academic coaching, internship matching, and leadership seminars.",
    date: "Jun 28, 2026",
    category: "Admissions",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop",
  },
];

export const upcomingEvents = [
  {
    title: "Open Day & Campus Tour",
    date: "Sep 12, 2026",
    time: "9:00 AM – 3:00 PM",
    location: "Main Campus, Dhapti University",
  },
  {
    title: "Graduation Ceremony 2026",
    date: "Oct 18, 2026",
    time: "10:00 AM – 1:00 PM",
    location: "Dhapti Grand Auditorium",
  },
  {
    title: "Research Symposium",
    date: "Nov 7, 2026",
    time: "8:30 AM – 5:00 PM",
    location: "Science Complex Hall B",
  },
];

export const historyTimeline = [
  {
    year: "2016",
    title: "Foundation",
    text: "Dhapti University is established in Dhapti with a mandate to expand access to quality higher education.",
  },
  {
    year: "2018",
    title: "First Graduating Cohort",
    text: "Pioneer students complete undergraduate programs in Business and Computing.",
  },
  {
    year: "2020",
    title: "Campus Expansion",
    text: "New lecture blocks, ICT labs, and student services facilities open on the main campus.",
  },
  {
    year: "2023",
    title: "Health Sciences Growth",
    text: "Medicine and Nursing pathways strengthen clinical partnerships across the region.",
  },
  {
    year: "2026",
    title: "Digital Campus Era",
    text: "Online admissions, student portals, and modern academic systems go fully live.",
  },
];

export const coreValues = [
  {
    title: "Wisdom",
    description: "We pursue knowledge that serves people, communities, and the nation.",
  },
  {
    title: "Effort",
    description: "We value persistence, discipline, and excellence in every academic endeavor.",
  },
  {
    title: "Integrity",
    description: "We uphold honesty, accountability, and ethical leadership.",
  },
  {
    title: "Innovation",
    description: "We embrace new ideas, technology, and creative solutions for Somalia's future.",
  },
];
