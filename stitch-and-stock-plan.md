# Stitch & Stock — Project Plan

> A personal yarn craft management app for tracking patterns, yarn inventory, and active/finished projects.
> Built with Node.js + Fastify, deployed free via Render + Neon, with GitHub Actions CI/CD.

---

## Goals

- Store and search a personal pattern library (knit/crochet patterns with tags, source URLs, PDF links)
- Track yarn inventory (colorway, weight, yardage, quantity, brand, fiber)
- Manage projects — linking a pattern to yarn(s), with WIP/finished/frogged status
- Deploy automatically on every push to `main` via GitHub Actions → Render
- Zero cost to run

---

## Tech Stack


| Layer      | Choice                                   | Reason                                  |
| ---------- | ---------------------------------------- | --------------------------------------- |
| Backend    | Node.js + Fastify                        | Modern, fast, great TypeScript support  |
| Database   | PostgreSQL via [Neon](https://neon.tech) | Free serverless Postgres, no infra      |
| ORM        | Drizzle ORM                              | Lightweight, type-safe, schema-as-code  |
| Frontend   | React + Vite                             | Fast dev server, simple build output    |
| Deployment | [Render](https://render.com)             | Free tier for web service + static site |
| CI/CD      | GitHub Actions                           | Push to main → test → deploy            |


---

## Monorepo Structure

```
stitch-and-stock/
├── api/                        # Fastify backend
│   ├── src/
│   │   ├── index.ts            # App entry point
│   │   ├── routes/
│   │   │   ├── yarn.ts
│   │   │   ├── patterns.ts
│   │   │   └── projects.ts
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema definitions
│   │   │   ├── migrations/     # Auto-generated migration files
│   │   │   └── client.ts       # DB connection singleton
│   │   └── middleware/
│   │       └── auth.ts         # Clerk Bearer JWT verification
│   ├── package.json
│   └── tsconfig.json
│
├── web/                        # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Yarn.tsx
│   │   │   ├── Patterns.tsx
│   │   │   └── Projects.tsx
│   │   └── api/
│   │       └── client.ts       # Typed fetch wrapper
│   ├── package.json
│   └── vite.config.ts
│
├── shared/                     # Shared TypeScript types
│   └── types.ts                # Yarn, Pattern, Project interfaces
│
├── .github/
│   └── workflows/
│       └── deploy.yml          # CI/CD pipeline
│
├── .env.example                # Template — commit this
├── .env                        # Secrets — gitignore this
└── README.md
```

---

## Database Schema (Drizzle)

### `yarn` table

```ts
export const yarn = pgTable('yarn', {
  id:        serial('id').primaryKey(),
  brand:     text('brand').notNull(),
  colorway:  text('colorway').notNull(),
  weight:    text('weight').notNull(),         // lace, fingering, DK, worsted, bulky, etc.
  fiber:     text('fiber'),                    // merino, acrylic, cotton, etc.
  yardage:   integer('yardage'),               // yards per skein
  skeins:    numeric('skeins').notNull(),      // quantity on hand
  colorCode: text('color_code'),              // hex or dye lot
  photoUrl:  text('photo_url'),
  notes:     text('notes'),
  tags:      text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### `patterns` table

```ts
export const patterns = pgTable('patterns', {
  id:           serial('id').primaryKey(),
  title:        text('title').notNull(),
  designer:     text('designer'),
  craftType:    text('craft_type').notNull(),  // knit | crochet
  difficulty:   text('difficulty'),            // beginner | intermediate | advanced
  yarnWeight:   text('yarn_weight'),           // recommended weight
  yardageNeeded: integer('yardage_needed'),    // total yards for project
  sourceUrl:    text('source_url'),
  pdfUrl:       text('pdf_url'),
  notes:        text('notes'),
  tags:         text('tags').array(),
  createdAt:    timestamp('created_at').defaultNow(),
});
```

### `projects` table

```ts
export const projects = pgTable('projects', {
  id:          serial('id').primaryKey(),
  patternId:   integer('pattern_id').references(() => patterns.id),
  title:       text('title').notNull(),         // custom project name
  status:      text('status').notNull(),        // wip | finished | frogged
  startDate:   date('start_date'),
  endDate:     date('end_date'),
  notes:       text('notes'),
  photoUrl:    text('photo_url'),
  createdAt:   timestamp('created_at').defaultNow(),
});
```

### `project_yarn` join table

```ts
// Links a project to one or more yarns with quantity used
export const projectYarn = pgTable('project_yarn', {
  id:        serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  yarnId:    integer('yarn_id').references(() => yarn.id),
  skeinsUsed: numeric('skeins_used'),
});
```

---

## API Routes

### Yarn


| Method | Path        | Description                                  |
| ------ | ----------- | -------------------------------------------- |
| GET    | `/yarn`     | List all yarn (supports `?weight=`, `?tag=`) |
| GET    | `/yarn/:id` | Get single yarn entry                        |
| POST   | `/yarn`     | Add new yarn                                 |
| PATCH  | `/yarn/:id` | Update yarn (e.g. adjust quantity)           |
| DELETE | `/yarn/:id` | Remove yarn                                  |


### Patterns


| Method | Path            | Description                                                   |
| ------ | --------------- | ------------------------------------------------------------- |
| GET    | `/patterns`     | List all patterns (supports `?craft=`, `?tag=`, `?q=` search) |
| GET    | `/patterns/:id` | Get single pattern                                            |
| POST   | `/patterns`     | Add new pattern                                               |
| PATCH  | `/patterns/:id` | Update pattern                                                |
| DELETE | `/patterns/:id` | Remove pattern                                                |


### Projects


| Method | Path            | Description                                |
| ------ | --------------- | ------------------------------------------ |
| GET    | `/projects`     | List all projects (supports `?status=wip`) |
| GET    | `/projects/:id` | Get project with linked pattern + yarn     |
| POST   | `/projects`     | Create project                             |
| PATCH  | `/projects/:id` | Update status, notes, dates                |
| DELETE | `/projects/:id` | Delete project                             |


### Utility


| Method | Path                          | Description                                        |
| ------ | ----------------------------- | -------------------------------------------------- |
| GET    | `/patterns/:id/yardage-check` | Compare pattern yardage need vs. inventory on hand |


> The `/yardage-check` endpoint is the most architecturally interesting route — it joins pattern requirements against current yarn inventory to tell you if you have enough to cast on.

---

## Key Domain Logic: Yardage Sufficiency Check

When a user selects a pattern, the app should tell them whether they have enough yarn in inventory.

```
yardage_available = yarn.yardage_per_skein * yarn.skeins_on_hand
yardage_needed    = pattern.yardage_needed

sufficient = yardage_available >= yardage_needed
```

This is a non-trivial query because:

- Yarn can be split across multiple skeins of different colorways
- Projects consume yarn from inventory (reducing available quantity)
- A user might want to use multiple yarns for one project

The `/yardage-check` route should account for yarn currently committed to active WIP projects.

---

## Auth

The API uses **[Clerk](https://clerk.com)** session JWTs: clients send `Authorization: Bearer <token>`. The Fastify hook in `api/src/middleware/auth.ts` verifies the token with `@clerk/backend` and sets `request.userId` to the Clerk `sub` claim. Every row in `yarn`, `patterns`, and `projects` stores that same `user_id` so queries stay scoped per user.

The React app uses `@clerk/clerk-react` and `useAuthorizedFetch` to attach the session token to API calls.

---

## Environment Variables

See the committed template [`.env.example`](.env.example) for `DATABASE_URL`, `CLERK_SECRET_KEY`, `PORT`, and Vite `VITE_*` variables (`VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`).

---

## GitHub Actions CI/CD

Workflow: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It runs at the **monorepo root** (`npm ci`, `npm test`, `npm run build`). For PRs and pushes, supply **Actions secrets** as needed: `DATABASE_URL` and `CLERK_SECRET_KEY` so route tests can run; optional `RENDER_DEPLOY_HOOK` triggers a deploy on `main` when set.

### Setup Steps

1. Create a Render web service connected to your GitHub repo
2. Copy the Render deploy hook URL from the service dashboard
3. Add `RENDER_DEPLOY_HOOK`, `DATABASE_URL`, and `CLERK_SECRET_KEY` as GitHub Actions secrets where applicable
4. Render will rebuild when the hook is called (if configured)

---

## Free Tier Services


| Service                      | What to do                                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| [Neon](https://neon.tech)    | Sign up → create project → copy `DATABASE_URL`                    |
| [Render](https://render.com) | Create Web Service (API) + Static Site (frontend), both free tier |
| GitHub Actions               | Free for public repos; 2,000 min/month for private                |


---

## Architecture Decision Records (ADRs)

Document these decisions in your README to make this portfolio-worthy:

### ADR-001: Monorepo with shared types

**Decision:** Keep API and frontend in one repo with a `/shared` package for TypeScript types.
**Rationale:** Eliminates type drift between frontend API calls and backend responses. Shared types are the single source of truth for `Yarn`, `Pattern`, and `Project` shapes.

### ADR-002: Drizzle ORM over Prisma

**Decision:** Use Drizzle instead of Prisma.
**Rationale:** Schema defined as TypeScript, not a separate DSL. Migrations are plain SQL files you can read and reason about. Lighter runtime footprint, better fit for a lean personal project.

### ADR-003: Neon serverless Postgres over SQLite

**Decision:** Use Neon (hosted Postgres) instead of a local SQLite file.
**Rationale:** Keeps the deployment stateless — the Render service holds no data, making deploys and rollbacks safe. Also means the local dev environment and production use the same database engine.

### ADR-004: Clerk session auth with per-row tenancy

**Decision:** Use Clerk for sign-in and verify Bearer JWTs on the API; store `user_id` (Clerk user id) on tenant tables and scope every query with it.
**Rationale:** Real multi-tenant isolation for a personal app that may grow beyond a single device, without building custom auth. Secrets stay server-side; the browser only holds short-lived session tokens.

### ADR-005: Yardage check as a server-side query

**Decision:** Compute yardage sufficiency on the backend, not the frontend.
**Rationale:** Requires joining pattern requirements, yarn inventory, and active project consumption in a single consistent read. Doing this on the frontend would require loading all related data into memory and keeping it in sync.

---

## Development Setup

```bash
# Clone and install
git clone https://github.com/yourname/stitch-and-stock
cd stitch-and-stock

# Install all deps
cd api && npm install
cd ../web && npm install

# Set up env
cp .env.example .env
# Fill in DATABASE_URL from Neon dashboard

# Run migrations
cd api && npm run db:migrate

# Start dev servers (two terminals)
cd api && npm run dev       # http://localhost:3000
cd web && npm run dev       # http://localhost:5173
```

---

## Build Order for Cursor

Start here, in this order:

1. **Monorepo scaffold** — `package.json` files, `tsconfig.json`, folder structure
2. **Drizzle schema** — `api/src/db/schema.ts` with all four tables
3. **DB client** — `api/src/db/client.ts`, run first migration against Neon
4. **Fastify app skeleton** — `api/src/index.ts` with auth middleware wired up
5. **Yarn routes** — full CRUD, GET with filters
6. **Pattern routes** — full CRUD, search by `?q=`
7. **Project routes** — full CRUD, include joined pattern + yarn in GET response
8. **Yardage check route** — `/patterns/:id/yardage-check`
9. **React frontend** — pages for each entity, typed fetch client
10. **GitHub Actions workflow** — `.github/workflows/deploy.yml`
11. **Render + Neon setup** — connect services, set env vars, verify deploy

