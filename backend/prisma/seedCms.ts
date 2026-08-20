/**
 * Rich initial CMS content for admin editors + public site.
 * Idempotent upserts by slug / facultyKey / programKey / nav label+href+location.
 */
import type { PrismaClient } from "@prisma/client";

const PUBLISHED = "PUBLISHED" as const;
const now = () => new Date();

const FACULTY_HERO: Record<string, string> = {
  medicine:
    "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=1200&auto=format&fit=crop",
  engineering:
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1200&auto=format&fit=crop",
  business:
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1200&auto=format&fit=crop",
  science:
    "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?q=80&w=1200&auto=format&fit=crop",
  law: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?q=80&w=1200&auto=format&fit=crop",
  agriculture:
    "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1200&auto=format&fit=crop",
};

const CDN_SLIDES = [
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1920&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1920&auto=format&fit=crop",
] as const;

function p(text: string) {
  return `<p>${text}</p>`;
}

function ul(items: string[]) {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

export async function seedCmsContent(prisma: PrismaClient) {
  console.log("Seeding CMS news, events, navigation, faculties & programs...");

  // --- News (stable slugs) ---
  const newsPosts = [
    {
      slug: "biu-opens-new-science-research-laboratory",
      title: "Dhapti Opens New State-of-the-Art Science & Research Laboratory",
      category: "Campus News",
      excerpt:
        "Advanced computing and medical testing facilities now open on the main campus.",
      body: [
        `<p><img src="${CDN_SLIDES[0]}" alt="Dhapti Science &amp; Research Laboratory" /></p>`,
        p(
          "Dhapti University has officially inaugurated its new research lab equipped with advanced computing and medical testing facilities. The facility strengthens hands-on learning for Computing &amp; IT and Medicine students and expands Dhapti’s capacity for applied research across Bay Region."
        ),
        p(
          "University leadership welcomed faculty, industry partners, and student researchers to the opening ceremony, highlighting collaboration, innovation, and community impact as the laboratory’s guiding pillars."
        ),
      ].join(""),
    },
    {
      slug: "2026-2027-academic-year-admissions-now-open",
      title: "2026/2027 Academic Year Admissions Now Open",
      category: "Admissions",
      excerpt:
        "Applications are open for undergraduate and diploma programmes across all six faculties.",
      body: [
        `<p><img src="${CDN_SLIDES[1]}" alt="Dhapti Admissions 2026/2027" /></p>`,
        p(
          "Applications are now being accepted for all 6 faculties across undergraduate and diploma programs. Prospective students can apply online through the Dhapti admissions portal and track application status in real time."
        ),
        p(
          "Admissions advisors are available on campus and via email at admissions@dhapti.edu.so to guide applicants through document requirements, entry assessments, and scholarship opportunities."
        ),
      ].join(""),
    },
    {
      slug: "annual-innovation-tech-symposium-2026",
      title: "Annual Innovation & Tech Symposium 2026",
      category: "Research",
      excerpt:
        "Students showcased software engineering and AI projects at Dhapti’s annual symposium.",
      body: [
        `<p><img src="${CDN_SLIDES[2]}" alt="Innovation &amp; Tech Symposium 2026" /></p>`,
        p(
          "Dhapti students presented cutting-edge software engineering and AI projects during the annual symposium. Judges from academia and industry recognised outstanding work in digital health, smart agriculture, and civic technology."
        ),
        p(
          "The symposium continues Dhapti’s commitment to research-led teaching and preparing graduates who can build practical solutions for Somalia’s digital future."
        ),
      ].join(""),
    },
  ] as const;

  for (const post of newsPosts) {
    await prisma.cmsNewsPost.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        category: post.category,
        excerpt: post.excerpt,
        body: post.body,
        status: PUBLISHED,
        publishedAt: now(),
      },
      update: {
        title: post.title,
        category: post.category,
        excerpt: post.excerpt,
        body: post.body,
        status: PUBLISHED,
        publishedAt: now(),
      },
    });
  }

  // --- Events (wipe prior seed-tagged events then recreate for stable demo set) ---
  await prisma.cmsEvent.deleteMany({
    where: {
      OR: [
        { title: { contains: "Dhapti Annual Convocation" } },
        { title: { contains: "Open Campus Orientation Day" } },
        { title: { contains: "Somalia Digital Health & AI Workshop" } },
      ],
    },
  });

  await prisma.cmsEvent.createMany({
    data: [
      {
        title: "Dhapti Annual Convocation & Graduation Ceremony 2026",
        description:
          "Celebrate the graduating class of 2026 with faculty awards, keynote remarks, and formal conferral of degrees at the Dhapti Main Auditorium.",
        location: "Dhapti Main Auditorium, Dhapti",
        startsAt: new Date("2026-09-15T09:00:00.000Z"),
        endsAt: new Date("2026-09-15T14:00:00.000Z"),
        registrationUrl: "https://biu.edu.so/register",
        status: PUBLISHED,
        publishedAt: now(),
      },
      {
        title: "Open Campus Orientation Day & Tour",
        description:
          "Prospective students and families are invited to tour classrooms, laboratories, and student services, and meet faculty from all six Dhapti faculties.",
        location: "Main Campus, Horseed District",
        startsAt: new Date("2026-08-25T08:30:00.000Z"),
        endsAt: new Date("2026-08-25T13:00:00.000Z"),
        registrationUrl: null,
        status: PUBLISHED,
        publishedAt: now(),
      },
      {
        title: "Somalia Digital Health & AI Workshop",
        description:
          "A hands-on workshop exploring AI applications in public health, clinical decision support, and health information systems for Somalia.",
        location: "Faculty of IT Lab 2",
        startsAt: new Date("2026-08-30T10:00:00.000Z"),
        endsAt: new Date("2026-08-30T16:00:00.000Z"),
        registrationUrl: null,
        status: PUBLISHED,
        publishedAt: now(),
      },
    ],
  });

  // --- Navigation: replace seed header/footer menus cleanly ---
  await prisma.cmsNavItem.deleteMany({
    where: {
      OR: [
        { location: "HEADER" },
        { location: "FOOTER" },
      ],
    },
  });

  const headerItems = [
    { label: "Home", href: "/", sortOrder: 0 },
    { label: "About Dhapti", href: "/about", sortOrder: 1 },
    { label: "Faculties & Programs", href: "/faculties", sortOrder: 2 },
    { label: "Admissions", href: "/admissions", sortOrder: 3 },
    { label: "News & Events", href: "/news", sortOrder: 4 },
    { label: "Contact Us", href: "/contact", sortOrder: 5 },
  ];

  for (const item of headerItems) {
    await prisma.cmsNavItem.create({
      data: {
        label: item.label,
        href: item.href,
        location: "HEADER",
        sortOrder: item.sortOrder,
        visible: true,
      },
    });
  }

  const quickLinks = await prisma.cmsNavItem.create({
    data: {
      label: "Quick Links",
      href: "#",
      location: "FOOTER",
      sortOrder: 0,
      visible: true,
    },
  });

  const footerChildren = [
    { label: "Student Portal", href: "/student/login", sortOrder: 1 },
    { label: "Teacher Portal", href: "/teacher/login", sortOrder: 2 },
    { label: "Admin Portal", href: "/admin/login", sortOrder: 3 },
  ];

  for (const item of footerChildren) {
    await prisma.cmsNavItem.create({
      data: {
        label: item.label,
        href: item.href,
        location: "FOOTER",
        sortOrder: item.sortOrder,
        visible: true,
        parentId: quickLinks.id,
      },
    });
  }

  // --- Faculty marketing (publicSite keys) ---
  const faculties = [
    {
      facultyKey: "science",
      name: "Faculty of Computing & IT",
      shortName: "Computing & IT",
      departments: [
        "Computer Science",
        "Information Technology",
        "Software Engineering",
      ],
      degrees: [
        "B.Sc. Computer Science",
        "B.Sc. Information Technology",
        "B.Sc. Software Engineering",
      ],
      duration: "4 Years",
      credits: "132 Credit Hours",
      overview:
        "The Faculty of Computing & IT prepares graduates for Somalia’s digital economy through rigorous programming, systems, and applied AI coursework backed by modern laboratories.",
      careers:
        "Software engineer, systems analyst, cybersecurity specialist, IT project manager, and research assistant roles across public and private sectors.",
      admissions:
        "Secondary mathematics preferred; minimum 60% aggregate (or equivalent); aptitude for problem-solving and digital skills.",
      dean: "Welcome to Computing & IT at Dhapti — where we build problem-solvers who ship real solutions for our communities.",
    },
    {
      facultyKey: "medicine",
      name: "Faculty of Medicine & Health Sciences",
      shortName: "Medicine",
      departments: ["General Medicine", "Nursing", "Public Health", "Pharmacy"],
      degrees: [
        "MBBS",
        "B.Sc. Nursing",
        "B.Sc. Public Health",
        "Diploma in Clinical Medicine",
      ],
      duration: "4–6 Years",
      credits: "120–180 Credit Hours",
      overview:
        "Training compassionate clinicians and public health professionals for Somalia and the region, with strong clinical practice and community health partnerships.",
      careers:
        "Physician, nurse, public health officer, clinical laboratory scientist, and health programme coordinator.",
      admissions:
        "Strong science subjects; minimum 70% aggregate (or equivalent); entrance interview / aptitude assessment.",
      dean: "Our faculty forms healers who serve with excellence, ethics, and empathy.",
    },
    {
      facultyKey: "business",
      name: "Faculty of Business & Economics",
      shortName: "Business",
      departments: [
        "Business Administration",
        "Accounting & Finance",
        "Economics",
      ],
      degrees: [
        "BBA",
        "B.Sc. Accounting & Finance",
        "Diploma in Business Management",
      ],
      duration: "4 Years",
      credits: "128 Credit Hours",
      overview:
        "Developing ethical entrepreneurs, accountants, and managers for Somalia’s growing economy through case-based learning and industry attachments.",
      careers:
        "Business analyst, accountant, banking officer, entrepreneur, and public administration specialist.",
      admissions:
        "Secondary school certificate in any stream; minimum 60% aggregate; basic English proficiency.",
      dean: "We prepare leaders who create value for enterprise and society.",
    },
    {
      facultyKey: "engineering",
      name: "Faculty of Engineering & Technology",
      shortName: "Engineering",
      departments: [
        "Civil Engineering",
        "Electrical Engineering",
        "Computer Engineering",
      ],
      degrees: [
        "B.Sc. Civil Engineering",
        "B.Sc. Electrical Engineering",
        "B.Sc. Computer Engineering",
        "Diploma in ICT",
      ],
      duration: "4 Years",
      credits: "140 Credit Hours",
      overview:
        "Preparing engineers who design resilient infrastructure and digital systems for national development, with strong lab and field practice.",
      careers:
        "Civil engineer, electrical engineer, site supervisor, ICT infrastructure specialist, and project engineer.",
      admissions:
        "Mathematics and Physics at secondary level; minimum 65% aggregate; placement assessment for foundation modules.",
      dean: "Engineer the future of Dhapti and beyond with integrity and precision.",
    },
    {
      facultyKey: "law",
      name: "Faculty of Law & Sharia",
      shortName: "Law",
      departments: ["Law", "Sharia Studies"],
      degrees: ["Bachelor of Law & Sharia", "Diploma in Legal Studies"],
      duration: "4 Years",
      credits: "136 Credit Hours",
      overview:
        "Forming legal professionals grounded in justice, ethics, and Islamic jurisprudence for courts, government, and civil society.",
      careers:
        "Advocate, legal advisor, court officer, compliance specialist, and Sharia counsellor.",
      admissions:
        "Secondary school certificate; minimum 60% aggregate; strong reading and writing skills.",
      dean: "Justice begins with rigorous study and moral courage.",
    },
    {
      facultyKey: "agriculture",
      name: "Faculty of Agriculture",
      shortName: "Agriculture",
      departments: ["Agronomy", "Animal Science", "Agricultural Extension"],
      degrees: [
        "B.Sc. Agronomy",
        "B.Sc. Animal Science",
        "Diploma in Agriculture",
      ],
      duration: "4 Years",
      credits: "130 Credit Hours",
      overview:
        "Addressing food security and sustainable farming through applied agricultural science, extension, and field research in Bay Region.",
      careers:
        "Agronomist, livestock officer, agricultural extension agent, agribusiness manager, and research technician.",
      admissions:
        "Science subjects preferred (Biology / Chemistry); minimum 60% aggregate; commitment to field and laboratory learning.",
      dean: "Grow knowledge that feeds communities and sustains our land.",
    },
  ] as const;

  for (const f of faculties) {
    await prisma.cmsFacultyMarketing.upsert({
      where: { facultyKey: f.facultyKey },
      create: {
        facultyKey: f.facultyKey,
        name: f.name,
        shortName: f.shortName,
        heroImageUrl: FACULTY_HERO[f.facultyKey] ?? "",
        overviewHtml: p(f.overview),
        careerProspectsHtml: p(f.careers),
        admissionRequirementsHtml: ul(
          f.admissions.split(";").map((s) => s.trim()).filter(Boolean)
        ),
        deanWelcomeHtml: p(f.dean),
        departmentsJson: JSON.stringify(f.departments),
        degreesJson: JSON.stringify(f.degrees),
        duration: f.duration,
        credits: f.credits,
        status: PUBLISHED,
        publishedAt: now(),
      },
      update: {
        name: f.name,
        shortName: f.shortName,
        heroImageUrl: FACULTY_HERO[f.facultyKey] ?? "",
        overviewHtml: p(f.overview),
        careerProspectsHtml: p(f.careers),
        admissionRequirementsHtml: ul(
          f.admissions.split(";").map((s) => s.trim()).filter(Boolean)
        ),
        deanWelcomeHtml: p(f.dean),
        departmentsJson: JSON.stringify(f.departments),
        degreesJson: JSON.stringify(f.degrees),
        duration: f.duration,
        credits: f.credits,
        status: PUBLISHED,
        publishedAt: now(),
      },
    });
  }

  // --- Program marketing (flagship + diplomas; tuition $1,200/sem) ---
  const programs = [
    {
      programKey: "bsc-computer-science",
      facultyKey: "science",
      title: "Computer Science",
      degreeTitle: "Bachelor of Science in Computer Science",
      duration: "4 Years",
      creditHours: "132",
      overview:
        "A comprehensive degree covering algorithms, software engineering, databases, networks, and AI with project-based studio courses.",
      careers:
        "Software developer, data analyst, DevOps engineer, and systems architect.",
    },
    {
      programKey: "bsc-information-technology",
      facultyKey: "science",
      title: "Information Technology",
      degreeTitle: "Bachelor of Science in Information Technology",
      duration: "4 Years",
      creditHours: "132",
      overview:
        "Applied IT systems, infrastructure, cybersecurity fundamentals, and enterprise support for organisational digital transformation.",
      careers:
        "IT support lead, network administrator, cybersecurity analyst, and ICT officer.",
    },
    {
      programKey: "mbbs",
      facultyKey: "medicine",
      title: "Medicine & Surgery",
      degreeTitle: "Bachelor of Medicine and Bachelor of Surgery (MBBS)",
      duration: "6 Years",
      creditHours: "180",
      overview:
        "Clinical and biomedical training preparing physicians for hospital and community practice in Somalia.",
      careers: "Medical doctor, clinical researcher, and public health clinician.",
    },
    {
      programKey: "bsc-nursing",
      facultyKey: "medicine",
      title: "Nursing",
      degreeTitle: "Bachelor of Science in Nursing",
      duration: "4 Years",
      creditHours: "140",
      overview:
        "Professional nursing education with clinical placements emphasising patient safety and community care.",
      careers: "Registered nurse, ward supervisor, and community health nurse.",
    },
    {
      programKey: "bba",
      facultyKey: "business",
      title: "Business Administration",
      degreeTitle: "Bachelor of Business Administration (BBA)",
      duration: "4 Years",
      creditHours: "128",
      overview:
        "Management, marketing, finance, and entrepreneurship for private sector and NGO leadership roles.",
      careers: "Operations manager, marketing officer, and entrepreneur.",
    },
    {
      programKey: "bsc-accounting-finance",
      facultyKey: "business",
      title: "Accounting & Finance",
      degreeTitle: "Bachelor of Science in Accounting & Finance",
      duration: "4 Years",
      creditHours: "128",
      overview:
        "Financial reporting, auditing, taxation, and banking practice aligned to regional professional standards.",
      careers: "Accountant, auditor, and banking officer.",
    },
    {
      programKey: "bsc-civil-engineering",
      facultyKey: "engineering",
      title: "Civil Engineering",
      degreeTitle: "Bachelor of Science in Civil Engineering",
      duration: "4 Years",
      creditHours: "140",
      overview:
        "Structural design, construction management, and infrastructure systems for resilient communities.",
      careers: "Civil engineer, site engineer, and project supervisor.",
    },
    {
      programKey: "bsc-electrical-engineering",
      facultyKey: "engineering",
      title: "Electrical Engineering",
      degreeTitle: "Bachelor of Science in Electrical Engineering",
      duration: "4 Years",
      creditHours: "140",
      overview:
        "Power systems, electronics, and control engineering with laboratory-intensive coursework.",
      careers: "Electrical engineer, power systems technician, and automation specialist.",
    },
    {
      programKey: "llb-sharia",
      facultyKey: "law",
      title: "Law & Sharia",
      degreeTitle: "Bachelor of Law & Sharia",
      duration: "4 Years",
      creditHours: "136",
      overview:
        "Integrated study of civil law and Islamic jurisprudence for advocacy and advisory practice.",
      careers: "Advocate, legal advisor, and court officer.",
    },
    {
      programKey: "bsc-agronomy",
      facultyKey: "agriculture",
      title: "Agronomy",
      degreeTitle: "Bachelor of Science in Agronomy",
      duration: "4 Years",
      creditHours: "130",
      overview:
        "Crop science, soil management, and sustainable production systems for food security.",
      careers: "Agronomist, farm manager, and agricultural extension officer.",
    },
    {
      programKey: "diploma-ict",
      facultyKey: "science",
      title: "Diploma in ICT",
      degreeTitle: "Diploma in Information & Communication Technology",
      duration: "2 Years",
      creditHours: "72",
      overview:
        "A practical diploma pathway into networking, office systems, and entry-level software support roles.",
      careers: "ICT technician, helpdesk officer, and junior developer.",
    },
    {
      programKey: "diploma-business-management",
      facultyKey: "business",
      title: "Diploma in Business Management",
      degreeTitle: "Diploma in Business Management",
      duration: "2 Years",
      creditHours: "72",
      overview:
        "Foundational business skills for supervisors and small-enterprise operators in Dhapti and beyond.",
      careers: "Office supervisor, sales coordinator, and small business manager.",
    },
  ] as const;

  for (const prog of programs) {
    await prisma.cmsProgramMarketing.upsert({
      where: { programKey: prog.programKey },
      create: {
        programKey: prog.programKey,
        facultyKey: prog.facultyKey,
        title: prog.title,
        degreeTitle: prog.degreeTitle,
        overviewHtml: p(prog.overview),
        duration: prog.duration,
        creditHours: prog.creditHours,
        tuitionPerSemester: "$1,200",
        careerOpportunitiesHtml: p(prog.careers),
        status: PUBLISHED,
        publishedAt: now(),
      },
      update: {
        facultyKey: prog.facultyKey,
        title: prog.title,
        degreeTitle: prog.degreeTitle,
        overviewHtml: p(prog.overview),
        duration: prog.duration,
        creditHours: prog.creditHours,
        tuitionPerSemester: "$1,200",
        careerOpportunitiesHtml: p(prog.careers),
        status: PUBLISHED,
        publishedAt: now(),
      },
    });
  }

  console.log(
    `CMS seed: ${newsPosts.length} news, 3 events, ${headerItems.length} header + footer nav, ${faculties.length} faculties, ${programs.length} programs.`
  );

  await seedCustomPages(prisma);
}

/**
 * Sample published custom pages for /admin/cms/custom-pages and /pages/:slug.
 * Idempotent by stable slug.
 */
export async function seedCustomPages(prisma: PrismaClient) {
  const { getCmsMediaStorage } = await import("../src/lib/cms/mediaStorage.js");
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const os = await import("node:os");

  const storage = getCmsMediaStorage();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "biu-cms-seed-"));

  async function ensurePdfAsset(opts: {
    storageKey: string;
    originalName: string;
    titleLine: string;
  }) {
    const existing = await prisma.cmsMediaAsset.findFirst({
      where: { storageKey: opts.storageKey },
    });
    if (existing) return existing;

    const pdf = Buffer.from(
      `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj
4 0 obj<</Length 68>>stream
BT /F1 18 Tf 72 720 Td (${opts.titleLine.replace(/[()\\]/g, "")}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000192 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
310
%%EOF
`
    );
    const tmpFile = path.join(tmpDir, opts.originalName);
    await fs.writeFile(tmpFile, pdf);
    await storage.saveFromPath(tmpFile, opts.storageKey);
    return prisma.cmsMediaAsset.create({
      data: {
        originalName: opts.originalName,
        storageKey: opts.storageKey,
        mimeType: "application/pdf",
        size: pdf.length,
        altText: opts.originalName,
        caption: opts.titleLine,
      },
    });
  }

  const prospectus = await ensurePdfAsset({
    storageKey: "seed/biu-prospectus-2026.pdf",
    originalName: "Dhapti Prospectus 2026.pdf",
    titleLine: "Dhapti Prospectus 2026",
  });
  const conduct = await ensurePdfAsset({
    storageKey: "seed/biu-student-code-of-conduct.pdf",
    originalName: "Student Code of Conduct.pdf",
    titleLine: "Student Code of Conduct",
  });
  const calendar = await ensurePdfAsset({
    storageKey: "seed/biu-academic-calendar.pdf",
    originalName: "Academic Calendar.pdf",
    titleLine: "Academic Calendar",
  });

  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

  type PageSeed = {
    slug: string;
    title: string;
    metaDescription: string;
    blocks: Array<{ blockType: string; payload: unknown }>;
  };

  const pages: PageSeed[] = [
    {
      slug: "faq",
      title: "Frequently Asked Questions (FAQ)",
      metaDescription:
        "Answers about Dhapti admissions, fees, campus life, and credit transfers.",
      blocks: [
        {
          blockType: "FAQ_ACCORDION_BLOCK",
          payload: {
            sectionTitle: "Frequently Asked Questions",
            items: [
              {
                question: "How do I apply for admission to Dhapti?",
                answer: p(
                  "Submit an online application via the Admissions portal, upload required documents (transcripts, ID, and passport photo), and track your status with the tracking code issued after submission. Admissions advisors are available at admissions@dhapti.edu.so."
                ),
              },
              {
                question: "What are the tuition fees and payment options?",
                answer: p(
                  "Programme fees are published per semester on the Finance & Fees portal. Students may pay by bank transfer or campus cashier. Outstanding balances appear on the student dashboard; receipts are issued for every settled payment."
                ),
              },
              {
                question: "What facilities are available on campus?",
                answer: p(
                  "The main campus includes lecture theatres, laboratories, a library with digital journals, sports grounds, prayer spaces, student lounges, and accessible walkways. Campus Life pages highlight clubs, housing guidance, and student support services."
                ),
              },
              {
                question: "Can I transfer credits from another university?",
                answer: p(
                  "Yes. Credit transfer requests are reviewed by the relevant faculty against Dhapti curriculum mapping. Provide official transcripts and course syllabi. Approved transfers reduce the remaining credit load but must meet residency and grade requirements."
                ),
              },
            ],
            i18n: {},
          },
        },
        {
          blockType: "CALLOUT_BANNER_BLOCK",
          payload: {
            title: "Still have questions?",
            body: "Contact the Dhapti Admissions Help Desk for personalised guidance.",
            ctaLabel: "Contact Admissions",
            ctaHref: "/contact",
            backgroundImageUrl: CDN_SLIDES[1],
            backgroundMediaId: null,
            i18n: {},
          },
        },
      ],
    },
    {
      slug: "downloads",
      title: "Student Resources & Downloads",
      metaDescription:
        "Download the Dhapti prospectus, student code of conduct, and academic calendar.",
      blocks: [
        {
          blockType: "RICH_TEXT_BLOCK",
          payload: {
            heading: "Official documents",
            body: p(
              "Download current university documents for admissions planning, student conduct expectations, and the academic year calendar. Files are tracked with download counters for institutional reporting."
            ),
            i18n: {},
          },
        },
        {
          blockType: "DOWNLOADS_BLOCK",
          payload: {
            sectionTitle: "Available downloads",
            items: [
              {
                title: "Dhapti Prospectus 2026",
                description:
                  "Programmes, faculties, admissions pathways, and campus overview.",
                mediaId: prospectus.id,
                fileName: "Dhapti Prospectus 2026.pdf",
              },
              {
                title: "Student Code of Conduct",
                description:
                  "Community standards, academic integrity, and student responsibilities.",
                mediaId: conduct.id,
                fileName: "Student Code of Conduct.pdf",
              },
              {
                title: "Academic Calendar",
                description:
                  "Semester dates, examination windows, and key university deadlines.",
                mediaId: calendar.id,
                fileName: "Academic Calendar.pdf",
              },
            ],
            i18n: {},
          },
        },
      ],
    },
    {
      slug: "research-policy",
      title: "University Research Policy",
      metaDescription:
        "Dhapti research grants, ethics framework, and scholarly integrity standards.",
      blocks: [
        {
          blockType: "RICH_TEXT_BLOCK",
          payload: {
            heading: "Research grants & ethics framework",
            body: [
              p(
                "Dhapti University advances applied research that serves Bay Region and Somalia. Faculty and postgraduate researchers may apply for internal seed grants through the Research Office, with priority themes in digital health, smart agriculture, education technology, and public policy."
              ),
              p(
                "<strong>Ethics review.</strong> All human-subjects and sensitive-data projects require clearance from the Dhapti Research Ethics Committee before data collection. Proposals must include informed-consent materials, data-protection plans, and risk mitigation statements."
              ),
              p(
                "<strong>Integrity &amp; open scholarship.</strong> Dhapti prohibits plagiarism, data fabrication, and undisclosed conflicts of interest. Researchers are encouraged to deposit accepted manuscripts in the institutional repository and to acknowledge Dhapti affiliation and funding sources in publications."
              ),
              p(
                "<strong>Student research.</strong> Undergraduate capstones and postgraduate theses follow faculty-specific guidelines; supervisors ensure methodology quality and ethical compliance. Outstanding student projects are showcased at the annual Innovation &amp; Tech Symposium."
              ),
              ul([
                "Internal seed grants: call twice per academic year",
                "Ethics applications: submit at least 4 weeks before fieldwork",
                "Publication support: library DOI and repository guidance",
                "Partnerships: industry and NGO co-supervision welcomed",
              ]),
            ].join(""),
            i18n: {},
          },
        },
      ],
    },
  ];

  for (const page of pages) {
    const saved = await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        metaDescription: page.metaDescription,
        status: PUBLISHED,
        publishedAt: now(),
      },
      update: {
        title: page.title,
        metaDescription: page.metaDescription,
        status: PUBLISHED,
        publishedAt: now(),
      },
    });

    await prisma.cmsPageBlock.deleteMany({ where: { pageId: saved.id } });
    await prisma.cmsPageBlock.createMany({
      data: page.blocks.map((b, index) => ({
        pageId: saved.id,
        blockType: b.blockType,
        schemaVersion: 1,
        sortOrder: index,
        jsonPayload: JSON.stringify(b.payload),
      })),
    });
  }

  console.log(
    `CMS custom pages: seeded faq, downloads, research-policy (published).`
  );
}
