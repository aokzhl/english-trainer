# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

WordForge — a spaced-repetition English vocabulary trainer for Russian-speaking learners (UI language is Russian). Full product spec is in `REQUIREMENTS.md` (authoritative; read it before non-trivial feature work).

## Monorepo layout

pnpm workspaces + Turborepo. Three packages:

- `apps/client` — React 18 + Vite + TypeScript. Frontend, organized by **FEOD** (see below).
- `apps/server` — Fastify + TypeScript. Drizzle ORM over SQLite (`better-sqlite3`).
- `packages/shared` (`@wordforge/shared`) — the **single source of truth for the client↔server contract**: Zod schemas, DTO types, and shared constants (CEFR levels, decks, SRS intervals). The server validates requests with these schemas; the client reuses them in React Hook Form (`zodResolver`) and to type responses. Change the contract here and TypeScript breaks both sides at once — that's intentional.

`apps` never import each other; shared code flows only through `packages/`.

## Commands

Run from the repo root (Turborepo fans out to packages):

```bash
pnpm install          # first; see native-build note below
pnpm dev              # client (:5173) + server (:3001) in parallel
pnpm build            # tsc + vite build (client), tsc --noEmit (server)
pnpm lint             # oxlint across packages
pnpm test             # vitest across packages
pnpm format           # oxfmt --write across the repo
pnpm format:check     # verify formatting (also run in pre-push)
```

Per-package / single-test (faster feedback loop):

```bash
pnpm --filter server test                       # all server tests
pnpm --filter server test tests/login.test.ts   # one file
pnpm --filter server dev                         # server only, tsx watch
pnpm --filter @wordforge/shared test
pnpm --filter server db:generate                 # regenerate Drizzle migration after editing db/schema.ts
```

The linter is **oxlint** (not ESLint) and the formatter is **oxfmt** — separate tools (oxlint doesn't format, oxfmt doesn't lint). Formatting is repo-wide from a single root `.oxfmtrc.json` (project style: **single quotes, no semicolons**); it also sorts `package.json` keys. Type-checking is a dedicated `typecheck` script (`tsc`), also part of `build`. Git hooks (lefthook) run format+lint on pre-commit and format-check+lint+typecheck+test on pre-push.

### Native build gotcha (pnpm 10)

pnpm 10 blocks dependency postinstall scripts by default, so `better-sqlite3`'s native binding may not build and the server/tests fail with "Could not locate the bindings file". The root `package.json` lists `pnpm.onlyBuiltDependencies: ["better-sqlite3", "bcrypt"]` — keep it. If the binding is still missing (no `*.node` under `node_modules/.pnpm/better-sqlite3@*/.../build/Release/`), build it manually: `cd` into that package dir and run `npm run build-release`. (`bcrypt` ships prebuilt binaries and needs no manual step.)

Add dependencies with `pnpm add` (`-Dw` for root, `--filter <pkg>` for a package) — don't hand-edit versions into `package.json`.

## Frontend architecture — FEOD

`apps/client/src` follows **Fractal Entity Oriented Design** (feod.dev). This is enforced, not aspirational. There is a project skill **`feod-frontend`** — invoke it for ANY work under `apps/client/` (adding components/modules/pages/stores, refactoring, "where does this file go"). Project-specific conventions live in `docs/frontend-conventions.md` and `docs/module-example.md`.

Load-bearing rules:

- **Layers & import direction (strictly downward):** `app → pages → modules → common`. Upper layers know about lower ones, never the reverse. `globals` is available everywhere without import.
  - `app/` — bootstrap only: entry, TanStack Router tree (`router.ts`), config, integrations, layouts. No business logic.
  - `pages/` — thin, URL-bound; compose modules and handle loading/error. File paths mirror routes.
  - `modules/<Feature>/` — the heart of the app; each is a self-contained unit with its own `store/`, components, `api/`, `index.ts`. **Import another module only through its `index.ts`** (public API), never reach into its internals.
  - `common/` — single-file entities, no business logic, **no barrel/`index.ts` files** (import directly, e.g. `@/common/ui/button`).
- **All logic lives in MobX stores** — both business (SRS session, dictionary, auth) and UI state (filters, sorts, open panels). React components are thin `observer` wrappers that render + call store actions; no computation or data-fetching in components. Exception: React Hook Form owns local form-field draft state.
- Import alias `@/` → `apps/client/src` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- Router is **code-based** TanStack Router assembled in `app/router.ts` (not the file-based plugin). Route paths are constants in `common/constants/routes.ts`. The `Register` type augmentation lives in `globals/router.d.ts` — note that file needs a trailing `export {}` so `declare module` augments (not replaces) the package types.

Stack: MobX, TanStack Router, React Hook Form, shadcn/ui (generated into `common/ui/`) + Tailwind v4 (via `@tailwindcss/vite`; theme in `app/assets/styles.css`).

## Backend architecture

`apps/server/src` mirrors FEOD for the backend — thin routes delegate to modules:

- `app/buildApp.ts` — assembles the Fastify instance (registers `@fastify/jwt`, `@fastify/cookie`, routes, a single `AuthError`-aware error handler, and decorates `app.db`). `buildApp({ dbPath })` is what both `entry.ts` and tests call. `app/config.ts` is the only place env vars are read.
- `routes/` — thin handlers: parse/validate with a `@wordforge/shared` Zod schema, call a module function, map result to HTTP.
- `modules/<domain>/` — business logic, public API via `index.ts` (e.g. `modules/auth`).
- `db/` — `schema.ts` (Drizzle tables) + `client.ts` (`createDb(dbPath)` opens SQLite, enables FKs, runs migrations from `drizzle/`). Edit `schema.ts` then run `db:generate`.
- `middlewares/requireAuth.ts` — `preHandler` guarding protected routes via access-JWT.

Conventions: error responses are always `{ message: string }` with Russian text (the client's `httpClient` expects this shape). Emails stored lowercase.

**Auth model:** access-JWT (15 min, `Authorization: Bearer`) + **stateful** refresh token (32 random bytes, 30 days, only its sha256 hash stored in `refresh_tokens`) delivered as an httpOnly cookie scoped to `/api/auth`. `/auth/refresh` rotates: old row deleted, new issued. Client and API are same-origin in dev via Vite's `/api` proxy (no CORS).

## TypeScript notes

`erasableSyntaxOnly` + `verbatimModuleSyntax` are on across packages: no enums and no class parameter-properties (they don't erase). Prefer `as const` unions and explicit field assignment.

## Workflow (superpowers)

This repo uses the superpowers plugin process for feature work: brainstorm → spec → plan → TDD implementation. Design specs go in `docs/superpowers/specs/`, implementation plans in `docs/superpowers/plans/` (see the auth-backend pair for the established format). Backend tests are integration-first: `vitest` driving `app.inject()` against a fresh in-memory SQLite (`:memory:`) per test file — no real port, no cleanup.
