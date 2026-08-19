# Frontend Contract — Dhapti UMS

**Owner:** Frontend Integration Engineer  
**Absolute rule:** Preserve approved UI/UX. Integration only.

---

## 1. Stack (detected — do not replace)

React 19 · Vite 6 · TypeScript · React Router 7 · Tailwind 3 · shadcn/Radix · Framer Motion · Recharts

---

## 2. Brand & Shell (immutable without approval)

| Token | Value |
|-------|--------|
| Navy | `#002147` |
| Orange | `#ea580c` / `#E85D04` |
| Green | `#16a34a` |
| Shell | `DashboardLayout.tsx` + portal wrappers |
| Nav sources | `studentNavItems` / `teacherNavItems` / `adminNavItems` |

---

## 3. Data Access Contract

| Concern | Implementation |
|---------|----------------|
| HTTP | `src/lib/api.ts` only |
| Base URL | `import.meta.env.VITE_API_URL \|\| "/api"` |
| Auth state | `AuthContext` |
| Mock data | `src/data/*` until API bound |

When binding APIs:

1. Keep JSX structure/classes.  
2. Replace mock arrays with fetched state.  
3. Add loading / error / empty **inline** with existing patterns.  
4. Do not introduce a new design system.

---

## 4. Route Ownership

Routes live in `src/App.tsx`.  
Do not delete registered routes.  
Wiring unwired public pages is allowed **without visual redesign**.

Phase 1I notification routes (API-bound): `/student/notifications`, `/teacher/notifications`, `/admin/notifications`. Header bell: `NotificationBell` (no DashboardLayout redesign).

Phase 1J election routes (API-bound): `/student/elections`, `/admin/elections` (legacy `/student/election` redirects). Mock `src/data/elections.ts` unused by portals.

---

## 5. Form Integration Rules

- Reuse existing inputs/dialogs/buttons.  
- Client validation mirrors server rules (500MB, deadlines, required fields).  
- On success: toast/banner using existing styles; navigate only if current UX already does.

---

## 6. Forbidden Without Explicit Approval

- New global CSS theme  
- Replacing sidebar/nav patterns  
- Framework migration (Next.js, etc.)  
- Deleting portal pages  
- Broad refactors unrelated to the assigned binding task

---

## 7. Handoff Expectation

API Agent delivers documented endpoints → Frontend Agent binds pages listed in task → QA verifies RBAC UX + real data.
