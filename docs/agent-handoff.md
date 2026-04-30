# yarn-aby — repo handoff for agents

This document summarizes **current implementation** versus the **product plan** so another agent (or human) can continue without re-reading the whole repo.

## Product intent

**Stitch & Stock** (repo folder name: **yarn-aby**): a personal yarn-craft app to track **patterns**, **yarn inventory**, and **projects** (WIP/finished/frogged), with optional yardage sufficiency checks. Full functional spec, API tables, and intended build order live in `[stitch-and-stock-plan.md](../stitch-and-stock-plan.md)` at the repo root.

---

## Tech stack (as implemented)


| Layer       | Choice                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo    | npm workspaces: `api`, `web`, `shared` (`[package.json](../package.json)`)                                                                                                                                 |
| API         | Node + Fastify 5 (`[api/src/index.ts](../api/src/index.ts)`)                                                                                                                                               |
| DB          | PostgreSQL (Neon in production); Drizzle ORM (`[api/src/db/schema.ts](../api/src/db/schema.ts)`)                                                                                                           |
| Auth        | **Clerk** — `Authorization: Bearer` session JWT verified with `@clerk/backend` (`[api/src/middleware/auth.ts](../api/src/middleware/auth.ts)`); per-row `user_id` in the database |
| Frontend    | React 19 + Vite 6 (`[web/](../web/)`), `@clerk/clerk-react`                                                                                                                                                |
| CI / deploy | GitHub Actions: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) (test, build, optional Render hook)                                                                                                                                 |


---

## Repository layout

```
yarn-aby/
├── api/                 # Fastify backend
│   ├── src/
│   │   ├── index.ts     # listen(); uses buildApp from app.ts
│   │   ├── app.ts       # buildApp (Clerk vs test auth)
│   │   ├── middleware/auth.ts    # registerClerkAuth
│   │   ├── routes/yarn.ts, patterns.ts, projects.ts   # CRUD + yardage-check
│   │   ├── db/schema.ts|client.ts|migrate.ts|databaseUrl.ts|scope.ts
│   │   ├── types/fastify.d.ts    # FastifyRequest.userId
│   │   └── routes.test.ts
│   ├── drizzle.config.ts
│   └── package.json
├── web/                 # Vite SPA
│   └── src/
│       ├── main.tsx     # ClerkProvider when VITE_CLERK_PUBLISHABLE_KEY set
│       ├── App.tsx      # SignedIn/SignIn/UserButton + Yarn / Patterns / Projects
│       ├── api/client.ts
│       └── hooks/useAuthorizedFetch.ts
├── shared/types.ts      # Yarn, Pattern, Project (+ userId on each)
├── docs/agent-handoff.md
├── stitch-and-stock-plan.md
└── .env.example
```

---

## Database

- **Tables** (Drizzle): `yarn`, `patterns`, `projects`, `project_yarn` — see `[api/src/db/schema.ts](../api/src/db/schema.ts)`.
- **Multi-tenancy**: `user_id` (`text`, Clerk user id, **NOT NULL**) on `yarn`, `patterns`, `projects`. Route handlers use `[api/src/db/scope.ts](../api/src/db/scope.ts)` (`yarnScope`, `patternsScope`, `projectsScope`) on queries; `project_yarn` is accessed only via projects/yarn the user owns.
- **Migrations**: `[api/src/db/migrations/](../api/src/db/migrations/)` — `0000_*` initial tables; `0001_*` adds `user_id`.  
**Caveat**: `0001` uses `ADD COLUMN ... NOT NULL` without default; fails if those tables already have rows — may need a manual nullable → backfill → NOT NULL flow.
- **Commands**: `npm run db:migrate --workspace=api` (requires `DATABASE_URL`); `npm run db:generate --workspace=api` for new SQL.

---

## API behavior today

- **CORS**: `@fastify/cors` with `origin: true`.
- **Auth hook**: Every request except `OPTIONS` must send `Authorization: Bearer <Clerk JWT>`. On success, `request.userId` is set to JWT `sub`.
- **Routes**: Prefixes `/yarn`, `/patterns`, `/projects` with full CRUD and `GET /patterns/:id/yardage-check`. See `api/src/routes/`.

---

## Frontend behavior today

- If `VITE_CLERK_PUBLISHABLE_KEY` is **missing at build time**, `[web/src/main.tsx](../web/src/main.tsx)` shows setup instructions (this is what appeared on Render until env was set).
- Signed-in shell: `[App.tsx](../web/src/App.tsx)` with `Yarn` / `Patterns` / `Projects` pages — list/create UI using `useAuthorizedFetch` and shared types.

---

## Environment variables

Authoritative template: `[.env.example](../.env.example)`.


| Variable                     | Where                                | Purpose                                                    |
| ---------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `DATABASE_URL`               | API, drizzle-kit, migrate            | Postgres connection                                        |
| `CLERK_SECRET_KEY`           | API                                  | `verifyToken`                                              |
| `CLERK_PUBLISHABLE_KEY`      | optional API                         | Clerk helpers if needed                                    |
| `PORT`                       | API                                  | default `3000`                                             |
| `VITE_CLERK_PUBLISHABLE_KEY` | **Web build** (local + Render build) | Clerk React — **must exist when `vite build` runs**        |
| `VITE_API_URL`               | **Web build**                        | API origin for `fetch` (default localhost:3000 in example) |


`DATABASE_URL` validation is centralized in `[api/src/db/databaseUrl.ts](../api/src/db/databaseUrl.ts)` (used by client + drizzle config — empty URL fails fast).

---

## Deployment notes (Render / Clerk)

- **Vite**: `VITE_*` are inlined at **build** time. On Render, set `VITE_CLERK_PUBLISHABLE_KEY` on whichever service runs `npm run build` for `web`, then **redeploy with cache clear** if needed.
- **Single Render Web Service**: if only the API is deployed, the SPA must either be built/served by that same service or hosted separately — otherwise production URL only serves JSON/API behavior.
- **Clerk Dashboard**: add production (and localhost) frontend URLs so OAuth/sign-in works.

---

## Plan doc vs reality

`[stitch-and-stock-plan.md](../stitch-and-stock-plan.md)` **Build order** (§ Build Order for Cursor):


| Step | Plan item                       | Status                                                        |
| ---- | ------------------------------- | ------------------------------------------------------------- |
| 1    | Monorepo scaffold               | Done                                                          |
| 2    | Drizzle schema (4 tables)       | Done (+ `user_id` migration beyond original doc)              |
| 3    | DB client + migrations          | Done                                                          |
| 4    | Fastify skeleton + auth         | Done (**Clerk**, not API key)                                 |
| 5–7  | Yarn / Patterns / Projects CRUD | Done                                                          |
| 8    | `/patterns/:id/yardage-check`   | Done                                                          |
| 9    | React pages + typed API usage   | Done (minimal list/create + pattern yardage check UI)         |
| 10   | GitHub Actions `deploy.yml`     | Done (`.github/workflows/deploy.yml`)                         |
| 11   | Render + Neon setup             | **Operational** (user-specific); see sections above           |


**Plan doc auth / ADR-004**: Updated in-repo to describe Clerk + `user_id` (see `stitch-and-stock-plan.md`).

---

## Local development shortcuts

- Root scripts: `npm run dev:api`, `npm run dev:web`, `npm test`, `npm run build`.
- Cursor/VS Code tasks: `[.vscode/tasks.json](../.vscode/tasks.json)` (`dev:api`, `dev:web`, full stack, test, build, `db:migrate`).

---

## Suggested next work (for the next agent)

1. UX polish: edit-in-place, filters in the UI, better error toasts.
2. Stricter validation (e.g. Zod) and OpenAPI if the API is shared.
3. README / portfolio narrative; expand ADRs in README if desired.

---

## Files not to confuse with source of truth

- `[README.md](../README.md)` is minimal (title only).
- **This file** is a snapshot for handoff; the detailed API/schema narrative remains in `[stitch-and-stock-plan.md](../stitch-and-stock-plan.md)` plus the actual TypeScript sources.

