# Clynsync — Project Overview

## What This Is

**Clynsync** is the frontend for a **Clinic AI Portal** — a clinical content governance
platform built for Mytonomy. Branding, logo, and copy throughout the app confirm this
(`src/assets/mytonomy_logo.png`, footer contact `medops-admin@mytonomy.com`).

The product's purpose, per the marketing copy in `AuthLayout.tsx`:

> "Clinical Content Governance, automated with trust... Enforce safety and peer alignment
> across your clinic's landing portals, patient logins, and EMR communication workflows."

Concretely, it's a tool that:
- Ingests clinical content (patient guidance PDFs/DOCX/HTML, training videos, regulatory
  materials) via an upload / Content Library feature.
- Scans content for compliance risk (e.g. missing FDA warnings, outdated dosage guidance,
  drift from clinical guidelines such as AHA 2024).
- Surfaces "Findings" classified by risk level (High/Medium/Low) requiring
  Subject-Matter-Expert (SME) review and sign-off.
- Tracks a review queue, eventually exporting governance reports.

**Current state:** this is a UI-first prototype/scaffold. Dashboard metrics, findings, and
recent scans are hardcoded mock data. File upload uses a simulated progress bar
(`simulateFileUpload`), not a real backend. Login always "succeeds" client-side even though
a real login API endpoint is defined but unused.

## Tech Stack

| Area | Library | Version |
|---|---|---|
| UI framework | React / React DOM | ^19.2.8 |
| Language | TypeScript | ~6.0.2 |
| Build tool | Vite | ^8.2.0 |
| Routing | react-router-dom (data router) | ^7.18.2 |
| State management | @reduxjs/toolkit (incl. RTK Query) + react-redux | ^2.12.0 / ^9.3.0 |
| Forms & validation | react-hook-form + zod | ^7.85.0 / ^4.4.3 |
| Styling | Tailwind CSS + PostCSS + Autoprefixer | ^3.4.19 |
| Charts | Recharts | ^3.10.1 |
| File processing | mammoth (DOCX), jszip (ZIP) | ^1.12.1 / ^3.10.1 |
| Testing | Vitest, Testing Library, MSW | ^4.1.10 / ^16.3.2 / ^2.15.0 |
| Lint/format | ESLint (flat config) + typescript-eslint, Prettier | ^10.8.1 / ^3.9.6 |

npm scripts: `dev`, `build:stage`, `build:prod`, `preview`, `lint`, `format` / `format:check`,
`typecheck`, `test` / `test:watch` / `test:coverage`.

> Note: `README.md` is still the default Vite React-TS template and has not been customized
> for this project.

## Project Structure

```
src/
├── app/                 # Redux store + RTK Query base API slice
├── assets/              # SVG icons, logo, hero image
├── components/
│   ├── layout/          # Sidebar, PageHeader
│   └── ui/              # Design-system components (Button, Input, CardTable, DonutChart,
│                         #   PageLoader, ProgressBar, Spinner, icons, uploadFile/)
├── feature/auth/         # authSlice (Redux) + authApiSlice (RTK Query endpoints)
├── hooks/useAuth.ts      # Auth hook (Redux state + logout mutation)
├── layouts/              # AuthLayout, DashboardLayout
├── mocks/                # MSW handlers + server setup (tests)
├── pages/
│   ├── auth/             # LoginPage
│   ├── content-library/  # ContentLibraryPage + feature doc
│   └── dashboard/        # DashboardPage + sub-widgets + ReviewQueuePage
├── playground/           # Dev-only component showcase (/playground, dev mode only)
├── routes/               # index.tsx, public.routes.tsx, private.routes.tsx, ProtectedRoute.tsx
├── schemas/              # zod schemas (loginSchema.ts)
├── styles/               # global.css, theme.css (CSS custom properties / design tokens)
├── testing/              # setup.ts, testUtils.tsx
├── types/                # api.ts, contentLibrary.ts
├── utils/                # cn.ts, contentValidation.ts, formatBytes.ts, simulateUpload.ts
└── main.tsx              # App entry (StrictMode, Redux Provider, RouterProvider)
```

Path alias `@/*` → `src/*` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Auth Setup

- **State**: `src/feature/auth/authSlice.ts` — Redux slice holding
  `{ token, isAuthenticated }`, hydrated from `localStorage['auth_token']` on load.
- **API layer**: `src/app/api/apiSlice.ts` defines an RTK Query base slice
  (`reducerPath: 'authApi'`) that attaches `Authorization: Bearer <token>` to requests.
  `src/feature/auth/authApiSlice.ts` injects `login` (`POST /login`) and `logout`
  (`POST /logout`) mutations.
- **Gap**: `LoginPage.tsx` does not call `useLoginMutation` — it fakes a 600ms delay and
  dispatches a hardcoded `'mock-token'`. `useLogoutMutation` is wired up correctly in
  `useAuth.ts`.
- **Route protection**: `src/routes/ProtectedRoute.tsx` checks `useAuth().isAuthenticated`
  and redirects to `/login` if false. Wraps all `/dashboard/*` routes.
- **Validation**: `src/schemas/loginSchema.ts` (zod) — valid email + password min 8 chars.

## Backend / API Integration Points

- **Env vars** (`.env.example`): `VITE_APP_ENV`, `VITE_AUTH_API_URL`
  (default `http://localhost:4000`). Also referenced: `VITE_MAX_UPLOAD_FILE_SIZE_MB`.
- **Dev proxy**: `vite.config.ts` proxies `/api_auth` → `VITE_AUTH_API_URL`.
- **Test mocks**: `src/mocks/handlers.ts` (MSW) mocks `POST */login`
  (`test@example.com` / `password123` → `mock-token`) and `POST */logout`.
- **No other backend exists yet.** Dashboard/findings/scans data is hardcoded in
  components; uploads are simulated client-side (`src/utils/simulateUpload.ts`), explicitly
  flagged in `src/pages/content-library/CONTENT_LIBRARY.md` as "replace with real API call
  when backend is ready."

## Notable Configuration

- **Tailwind** (`tailwind.config.js`): theme colors/spacing/radius driven by CSS variables
  defined in `src/styles/theme.css` (e.g. primary `#005F7F`), enabling opacity modifiers.
- **ESLint** (`eslint.config.js`): flat config, typescript-eslint + react-hooks +
  react-refresh rules, Prettier conflicts disabled.
- **Prettier** (`.prettierrc.json`): singleQuote, trailing commas, tabWidth 2, printWidth 100.
- **TypeScript**: project references (`tsconfig.json` → `tsconfig.app.json` +
  `tsconfig.node.json`), strict mode, `@/*` path alias.
- **Vite / Vitest** (`vite.config.ts`): jsdom test environment, coverage thresholds enforced
  (statements 80%, branches 70%, functions 80%, lines 80%).
- **Spec Kit** (added 2026-08-19): `.specify/` + `.claude/skills/speckit-*` — spec-driven
  workflow commands (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`,
  `/speckit-implement`, etc.). This is dev tooling, not a product feature.
