# Dhapti University Management System

Dhapti University (Dhapti) — Frontend Foundation (Phase 1, Step 1)

## Tech Stack

- **React 19** + **Vite 6** + **TypeScript**
- **Tailwind CSS 3** + **shadcn/ui**
- **Lucide React** (icons)
- **React Router DOM 7** (navigation)

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Setup Commands

Run these commands in the project root (`D:\University Project`):

```bash
# 1. Install all dependencies
npm install

# 2. Start the development server
npm run dev
```

The app will be available at **http://localhost:5173**

## Additional Commands

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Run ESLint
npm run lint
```

## Project Structure

```
src/
├── assets/              # Images, logos, icons
├── components/
│   ├── ui/              # shadcn/ui components (Button, Input, Card)
│   ├── common/          # Shared layout (Navbar, Sidebar, Footer)
│   ├── website/         # Public website components
│   └── portals/         # Dashboard components (Student/Teacher/Admin)
├── layouts/             # MainLayout, DashboardLayout, AuthLayout
├── pages/
│   ├── public/          # Public website routes
│   ├── student/         # Student portal routes
│   ├── teacher/         # Teacher portal routes
│   └── admin/           # Admin portal routes
├── hooks/               # Custom React hooks
├── utils/               # Utility functions & navigation config
├── types/               # TypeScript type definitions
├── styles/              # Additional global styles
├── lib/                 # shadcn utility (cn helper)
├── App.tsx              # Root router configuration
├── main.tsx             # Application entry point
└── index.css            # Tailwind + Dhapti design system
```

## Routes

| Section | Route | Description |
|---------|-------|-------------|
| **Public** | `/` | Home |
| | `/about` | About Dhapti |
| | `/academics` | Academics |
| | `/admissions` | Admissions |
| | `/research` | Research |
| | `/news` | News & Events |
| | `/contact` | Contact |
| **Student** | `/student/login` | Student login |
| | `/student/dashboard` | Student dashboard |
| | `/student/courses` | My courses |
| | `/student/grades` | Grades |
| | `/student/schedule` | Schedule |
| | `/student/profile` | Profile |
| **Teacher** | `/teacher/login` | Teacher login |
| | `/teacher/dashboard` | Teacher dashboard |
| | `/teacher/courses` | Courses |
| | `/teacher/students` | Students |
| | `/teacher/attendance` | Attendance |
| | `/teacher/grades` | Grades |
| **Admin** | `/admin/login` | Admin login |
| | `/admin/dashboard` | Admin dashboard |
| | `/admin/users` | User management |
| | `/admin/departments` | Departments |
| | `/admin/settings` | Settings |

## Design System

- **Primary (Navy):** `#0F2444` — headers, navigation, primary actions
- **Secondary (Orange):** `#E85D04` — accents, CTAs, highlights
- **Font:** Inter (Google Fonts)
- **Components:** shadcn/ui with CSS variables in `src/index.css`

## Adding More shadcn Components

After `npm install`, you can add additional shadcn/ui components:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add table
```

## Notes

- Login pages use demo navigation (no backend/auth yet)
- Placeholder content on all pages — ready for Step 2 implementation
- No fake API or backend logic included
