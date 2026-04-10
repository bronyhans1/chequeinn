# Cheque-Inn HR Frontend

Next.js frontend for the Cheque-Inn HR platform. Connects to the Express backend.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React 18**

## Setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to your backend URL (e.g. `http://localhost:5000`).
2. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production build

```bash
npm run build
```

`npm run build` runs **`prebuild`**, which deletes the `.next` folder first. That avoids **stale incremental cache** after moving/renaming routes (e.g. `PageNotFoundError` for `/login`, `/`, or `Failed to collect page data` for a valid page).

- **`npm run clean`** — remove `.next` only (same script used by `prebuild`).
- **`npm run typecheck`** — `tsc --noEmit` (same TypeScript settings as Next).

If you ever see odd build errors without changing scripts, run `npm run clean` and build again.

## Auth

- **Supabase**: Login uses Supabase Auth (`signInWithPassword`). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. After sign-in, the frontend stores the session `access_token` and sends it as `Authorization: Bearer` to the backend. The backend validates the same token via `supabase.auth.getUser(token)` and returns profile/roles from `GET /api/auth/me`.
- Token is stored in `localStorage` under `cheque_inn_token`. Logout clears it and redirects to `/login`. RouteGuard protects all `(main)` routes.
- Roles from `GET /api/auth/me` (`admin`, `manager`, `HR`, `employee`) drive sidebar visibility; manager/HR-only items are hidden for employees.

## Structure

- `app/` — App Router: root layout, login, and `(main)` group (dashboard, sidebar, protected routes).
- `components/` — UI and layout (Sidebar, Header, Card, Badge, RouteGuard).
- `lib/` — API client, auth context, env, types, and modular API files (`auth.api`, `users.api`, `attendance.api`, `leave.api`, `payroll.api`).

## Backend connection

API base URL is set in `NEXT_PUBLIC_API_BASE_URL`. The client sends `Authorization: Bearer <token>` on requests. Align request/response shapes with the backend; types in `lib/api/*.api.ts` and `lib/types/` are set up for the existing backend modules (auth, users, attendance, leave, payroll).

### Live (wired to backend)

| Area | Endpoints |
|------|-----------|
| Auth | Supabase sign-in → token stored → `GET /api/auth/me` for user/roles |
| Dashboard | `GET /api/attendance/today`, `GET /api/attendance/active` |
| Attendance overview | `GET /api/attendance/today` |
| Lateness summary | `GET /api/attendance/lateness-summary?start=&end=` (date range + table) |
| Flags summary | `GET /api/attendance/flags-summary?start=&end=` (date range + table) |
| Absence summary | `GET /api/attendance/absence-summary?start=&end=` (date range + table) |

### Still placeholder

| Area | Backend hook |
|------|--------------|
| Employees | `GET /api/users` |
| Leave | `GET /api/leave/me`, `GET /api/leave/company` |
| Payroll | `GET /api/payroll/me`, `GET /api/payroll/company` |
| Reports | Export endpoints (Excel/CSV) |
| Settings | Company policy, etc. |
