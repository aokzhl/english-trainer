# Foundation (Postgres + course shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the DB layer from SQLite to PostgreSQL and build the course-platform shell (courses list + enrollment + stats skeleton), backend + minimal client.

**Architecture:** Drizzle over PostgreSQL (`pg-core`). Prod/dev use the `postgres-js` driver against a real Postgres (docker-compose locally, managed Postgres — Neon — in prod). Tests use PGlite (in-process Postgres) for the same fast "fresh DB per test-file" pattern that `:memory:` SQLite gave us. Because Postgres drivers are async, `createDb`, `buildApp`, and the auth DB functions become async. On top of the migrated foundation we add the `courses` shell module (list with per-user progress, enroll) and a `stats` skeleton, following FEOD (thin routes → module → `index.ts` public API).

**Tech Stack:** Fastify 5, Drizzle ORM 0.45 (`pg-core`), `postgres` (postgres-js), `@electric-sql/pglite`, `drizzle-kit` 0.31, Zod 4 (`@wordforge/shared`), Vitest 4, React 18 + MobX + TanStack Router (client).

## Global Constraints

- Monorepo: pnpm workspaces + Turborepo. Add deps with `pnpm add` (`--filter server`), never hand-edit versions.
- Formatting: oxfmt — **single quotes, no semicolons**. Lint: oxlint.
- TS: `erasableSyntaxOnly` + `verbatimModuleSyntax` — **no enums, no class parameter-properties**. Use `as const` unions and explicit field assignment.
- Contract lives in `@wordforge/shared` (Zod schemas + types + constants); server validates with it, client reuses it.
- Error responses are always `{ message: string }` with **Russian** text.
- Emails stored lowercase.
- FEOD: thin routes delegate to modules; a module's public API is its `index.ts`.
- Tests are integration-first: `app.inject()` against a fresh PGlite DB per test file; no real port, no cleanup. AI is not touched in this plan.
- Timestamps are real Postgres `timestamp with time zone` columns, surfaced to code as JS `Date` (Drizzle `mode: 'date'`).

---

### Task 1: Postgres dependencies, dev infra, and config

**Files:**
- Modify: `apps/server/package.json` (deps)
- Modify: `apps/server/drizzle.config.ts`
- Modify: `apps/server/src/app/config.ts`
- Create: `docker-compose.yml` (repo root)
- Modify: `package.json` (repo root — `pnpm.onlyBuiltDependencies`)

**Interfaces:**
- Produces: `config.databaseUrl: string` (replaces `config.dbPath`).

- [ ] **Step 1: Swap DB dependencies**

Run:
```bash
pnpm --filter server remove better-sqlite3 @types/better-sqlite3
pnpm --filter server add postgres
pnpm --filter server add -D @electric-sql/pglite
```

- [ ] **Step 2: Drop the better-sqlite3 native-build entry, keep bcrypt**

In root `package.json`, set:
```json
"pnpm": {
  "onlyBuiltDependencies": ["bcrypt"]
}
```

- [ ] **Step 3: Point drizzle-kit at PostgreSQL**

Replace `apps/server/drizzle.config.ts` with:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
```

- [ ] **Step 4: Replace `dbPath` with `databaseUrl` in config**

In `apps/server/src/app/config.ts`, replace the `dbPath` line with:
```ts
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://wordforge:wordforge@localhost:5432/wordforge',
```

- [ ] **Step 5: Add local Postgres**

Create `docker-compose.yml` at repo root:
```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: wordforge
      POSTGRES_PASSWORD: wordforge
      POSTGRES_DB: wordforge
    ports:
      - '5432:5432'
    volumes:
      - wordforge_pg:/var/lib/postgresql/data

volumes:
  wordforge_pg:
```

- [ ] **Step 6: Delete the old SQLite migrations folder**

The SQLite-dialect migrations are incompatible with Postgres. Run:
```bash
rm -rf apps/server/drizzle
```
(Regenerated in Task 2.)

- [ ] **Step 7: Commit**

```bash
git add apps/server/package.json apps/server/drizzle.config.ts apps/server/src/app/config.ts docker-compose.yml package.json pnpm-lock.yaml
git rm -r --cached apps/server/drizzle 2>/dev/null || true
git commit -m "chore(server): switch DB deps/config to PostgreSQL (postgres-js + pglite)"
```

---

### Task 2: Migrate the schema to `pg-core` and regenerate migrations

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Create: `apps/server/drizzle/*` (generated)

**Interfaces:**
- Produces: `users` (`id: number` serial, `email`, `passwordHash`, `createdAt: Date`, `streak: number`, `lastStudyDay: Date | null`), `refreshTokens` (`id`, `userId`, `tokenHash`, `expiresAt: Date`, `createdAt: Date`).

- [ ] **Step 1: Rewrite `schema.ts` with pg-core types**

Replace `apps/server/src/db/schema.ts` with:
```ts
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  streak: integer('streak').notNull().default(0),
  lastStudyDay: timestamp('last_study_day', {
    withTimezone: true,
    mode: 'date',
  }),
})

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
})
```

Note: `boolean` and `varchar` are imported now for reuse by later tasks in this file; keep the imports even though `boolean` is unused until Task 6.

- [ ] **Step 2: Generate the Postgres migration**

Run:
```bash
pnpm --filter server db:generate
```
Expected: a new `apps/server/drizzle/0000_*.sql` containing `CREATE TABLE "users"` / `"refresh_tokens"` with `serial`/`timestamp with time zone`.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/drizzle
git commit -m "feat(server): pg-core schema for users/refresh_tokens + initial migration"
```

---

### Task 3: Rewrite the DB client (postgres-js + PGlite), async

**Files:**
- Modify: `apps/server/src/db/client.ts`

**Interfaces:**
- Produces:
  - `createDb(connectionString: string): Promise<Db>` — postgres-js, runs migrations.
  - `createTestDb(): Promise<Db>` — in-memory PGlite, runs migrations.
  - `type Db` — Drizzle Postgres DB typed with `schema`.

- [ ] **Step 1: Write the failing test**

Replace `apps/server/tests/db.test.ts` with:
```ts
import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../src/db/client'
import { refreshTokens, users } from '../src/db/schema'

test('миграции применяются, users и refresh_tokens доступны', async () => {
  const db = await createTestDb()

  const [user] = await db
    .insert(users)
    .values({ email: 'a@b.co', passwordHash: 'hash' })
    .returning()

  expect(user.id).toBe(1)
  expect(user.streak).toBe(0)

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: 'abc',
    expiresAt: new Date(),
  })

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, user.id))
  expect(rows).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter server test tests/db.test.ts`
Expected: FAIL — `createTestDb` is not exported.

- [ ] **Step 3: Implement the new client**

Replace `apps/server/src/db/client.ts` with:
```ts
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'

const migrationsFolder = path.join(import.meta.dirname, '../../drizzle')

export async function createDb(connectionString: string) {
  const client = postgres(connectionString)
  const db = drizzlePostgres({ client, schema })
  await migratePostgres(db, { migrationsFolder })
  return db
}

export async function createTestDb() {
  const client = new PGlite()
  const db = drizzlePglite({ client, schema })
  await migratePglite(db, { migrationsFolder })
  return db as unknown as Db
}

export type Db = Awaited<ReturnType<typeof createDb>>
```

Note: PGlite and postgres-js produce structurally identical query builders; the `as unknown as Db` cast in `createTestDb` unifies the type so services accept either.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter server test tests/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/client.ts apps/server/tests/db.test.ts
git commit -m "feat(server): async Db client (postgres-js prod, PGlite tests)"
```

---

### Task 4: Make `buildApp` async and update entry + test helper

**Files:**
- Modify: `apps/server/src/app/buildApp.ts`
- Modify: `apps/server/src/app/entry.ts`
- Modify: `apps/server/tests/helpers.ts`

**Interfaces:**
- Produces:
  - `buildApp(opts: { db: Db; logger?: boolean }): FastifyInstance` — now takes an already-created `db` (creation is async and happens in the caller).
  - `buildTestApp(extend?): Promise<FastifyInstance>` — creates a PGlite db and wires it in.

- [ ] **Step 1: Update the test helper to inject a PGlite db**

Replace `apps/server/tests/helpers.ts` with:
```ts
import { buildApp } from '../src/app/buildApp'
import { createTestDb } from '../src/db/client'

type App = ReturnType<typeof buildApp>

// Свежая изолированная PGlite-БД на каждый вызов — ноль cleanup.
export async function buildTestApp(extend?: (app: App) => void) {
  const db = await createTestDb()
  const app = buildApp({ db })
  extend?.(app)
  await app.ready()
  return app
}
```

- [ ] **Step 2: Take `db` as an argument in `buildApp`**

In `apps/server/src/app/buildApp.ts`, change the signature and decoration:
```ts
import type { Db } from '../db/client'
// ...
export function buildApp(opts: { db: Db; logger?: boolean }) {
  const app = fastify({ logger: opts.logger ?? false })

  app.decorate('db', opts.db)
  // ...rest unchanged...
}
```
Remove the `import { createDb } from '../db/client'` line.

- [ ] **Step 3: Create the db in `entry.ts`**

Update `apps/server/src/app/entry.ts` so it awaits db creation, e.g.:
```ts
import { buildApp } from './buildApp'
import { config } from './config'
import { createDb } from '../db/client'

const db = await createDb(config.databaseUrl)
const app = buildApp({ db, logger: true })

await app.listen({ port: config.port, host: '0.0.0.0' })
```
(Adjust to match the existing `entry.ts` structure; the key change is `const db = await createDb(config.databaseUrl)` then `buildApp({ db })`.)

- [ ] **Step 4: Run the full server suite to verify wiring**

Run: `pnpm --filter server test`
Expected: `db.test.ts` and `health.test.ts` PASS. Auth tests may still FAIL (async DB calls) — fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/app/buildApp.ts apps/server/src/app/entry.ts apps/server/tests/helpers.ts
git commit -m "refactor(server): buildApp takes async-created Db; PGlite test helper"
```

---

### Task 5: Convert auth DB functions to async

**Files:**
- Modify: `apps/server/src/modules/auth/service.ts`
- Modify: `apps/server/src/modules/auth/refreshTokens.ts`
- Modify: `apps/server/src/routes/auth.ts` (await the now-async calls)

**Interfaces:**
- Produces (all async now):
  - `registerUser(db, email, password): Promise<{ userId: number }>`
  - `verifyUser(db, email, password): Promise<{ userId: number }>`
  - `issueRefreshToken(db, userId): Promise<{ token: string; expiresAt: Date }>`
  - `rotateRefreshToken(db, token): Promise<{ userId: number; token: string; expiresAt: Date }>`
  - `revokeRefreshToken(db, token): Promise<void>`

- [ ] **Step 1: Run auth tests to see them fail against Postgres**

Run: `pnpm --filter server test tests/register.test.ts tests/login.test.ts tests/refresh.test.ts tests/logout.test.ts`
Expected: FAIL — sync `.get()/.all()/.run()` no longer exist / return builders, not rows.

- [ ] **Step 2: Rewrite `service.ts` with awaited queries**

In `apps/server/src/modules/auth/service.ts`, replace the query calls:
```ts
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1)
  if (existing) {
    throw new AuthError(409, 'Пользователь с таким email уже существует')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const [user] = await db
    .insert(users)
    .values({ email: normalized, passwordHash })
    .returning()

  return { userId: user.id }
```
and in `verifyUser`:
```ts
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)
  if (!user) {
    throw new AuthError(401, 'Неверный email или пароль')
  }
```
(`createdAt` is now `defaultNow()`, so it is no longer passed on insert.)

- [ ] **Step 3: Rewrite `refreshTokens.ts` as async with Date timestamps**

Replace the bodies in `apps/server/src/modules/auth/refreshTokens.ts`:
```ts
export async function issueRefreshToken(
  db: Db,
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  )
  await db
    .insert(refreshTokens)
    .values({ userId, tokenHash: hashToken(token), expiresAt })
  return { token, expiresAt }
}

export async function rotateRefreshToken(
  db: Db,
  token: string,
): Promise<{ userId: number; token: string; expiresAt: Date }> {
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .limit(1)
  if (!row) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }
  await db.delete(refreshTokens).where(eq(refreshTokens.id, row.id))
  if (row.expiresAt <= new Date()) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }
  const next = await issueRefreshToken(db, row.userId)
  return { userId: row.userId, ...next }
}

export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
}
```

- [ ] **Step 4: Await the calls in `routes/auth.ts`**

In `apps/server/src/routes/auth.ts`, add `await` to every `issueRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`, `registerUser`, `verifyUser` call (they were sync before for the token helpers). Where an `expiresAt` string was set on the cookie, it is now a `Date` — call `.toUTCString()` or pass `expires: expiresAt` (Fastify cookie accepts a `Date` for `expires`). Verify against the existing cookie code and adjust to `expires: expiresAt`.

- [ ] **Step 5: Run the auth suite to verify it passes**

Run: `pnpm --filter server test`
Expected: all server tests PASS (17 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/auth apps/server/src/routes/auth.ts
git commit -m "refactor(server): async auth DB functions for Postgres"
```

---

### Task 6: Courses + enrollments schema and shared contract

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Create: `apps/server/drizzle/*` (generated)
- Create: `packages/shared/src/courses.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces:
  - Tables `courses` (`id`, `slug` unique, `type`, `title`, `description`, `order`, `createdAt`), `enrollments` (`id`, `userId`, `courseId`, `enrolledAt`, unique(`userId`,`courseId`)).
  - `COURSE_TYPES = ['vocabulary', 'grammar'] as const`, `type CourseType`.
  - `courseDto` Zod schema + `type CourseDto` (`{ slug, type, title, description, enrolled, progress: { done, total } }`).

- [ ] **Step 1: Add tables to `schema.ts`**

Append to `apps/server/src/db/schema.ts`:
```ts
export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  type: varchar('type', { length: 16 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull().default(''),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
})

export const enrollments = pgTable('enrollments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.id, { onDelete: 'cascade' }),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
})
```
Add a unique constraint on (`userId`, `courseId`) via a table-level `unique().on(...)` in the third `pgTable` argument.

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter server db:generate`
Expected: new `drizzle/0001_*.sql` with `CREATE TABLE "courses"` / `"enrollments"`.

- [ ] **Step 3: Write the shared contract**

Create `packages/shared/src/courses.ts`:
```ts
import { z } from 'zod'

export const COURSE_TYPES = ['vocabulary', 'grammar'] as const
export type CourseType = (typeof COURSE_TYPES)[number]

export const courseProgressDto = z.object({
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export const courseDto = z.object({
  slug: z.string(),
  type: z.enum(COURSE_TYPES),
  title: z.string(),
  description: z.string(),
  enrolled: z.boolean(),
  progress: courseProgressDto,
})
export type CourseDto = z.infer<typeof courseDto>

export const coursesListDto = z.array(courseDto)
export type CoursesListDto = z.infer<typeof coursesListDto>
```

- [ ] **Step 4: Export from the shared index**

In `packages/shared/src/index.ts`, add near the top:
```ts
export * from './courses'
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/drizzle packages/shared/src/courses.ts packages/shared/src/index.ts
git commit -m "feat: courses/enrollments schema + shared course contract"
```

---

### Task 7: Courses module, routes, and seed

**Files:**
- Create: `apps/server/src/modules/courses/service.ts`
- Create: `apps/server/src/modules/courses/index.ts`
- Create: `apps/server/src/routes/courses.ts`
- Create: `apps/server/src/db/seed.ts`
- Modify: `apps/server/src/app/buildApp.ts` (register routes)
- Modify: `apps/server/src/app/entry.ts` (run seed on boot)
- Create: `apps/server/tests/courses.test.ts`

**Interfaces:**
- Consumes: `Db`, `courses`/`enrollments` tables, `requireAuth` middleware, `CourseDto`.
- Produces:
  - `listCourses(db, userId): Promise<CourseDto[]>`
  - `enrollInCourse(db, userId, slug): Promise<void>` (throws `AuthError(404,...)` for unknown slug — reuse the shared error shape).
  - `seedCourses(db): Promise<void>` — idempotent insert of the two MVP courses.

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/courses.test.ts`:
```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'
import { seedCourses } from '../src/db/seed'

const app = await buildTestApp()
let token = ''

beforeAll(async () => {
  await seedCourses(app.db)
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'c@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'c@example.com', password: 'abc12345' },
  })
  token = res.json().accessToken
})
afterAll(() => app.close())

test('GET /api/courses возвращает 2 курса, не записан', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/courses',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(200)
  const body = res.json()
  expect(body).toHaveLength(2)
  expect(body.every((c: { enrolled: boolean }) => c.enrolled === false)).toBe(
    true,
  )
})

test('POST enroll делает курс enrolled', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/courses/vocabulary/enroll',
    headers: { authorization: `Bearer ${token}` },
  })
  const res = await app.inject({
    method: 'GET',
    url: '/api/courses',
    headers: { authorization: `Bearer ${token}` },
  })
  const vocab = res
    .json()
    .find((c: { slug: string }) => c.slug === 'vocabulary')
  expect(vocab.enrolled).toBe(true)
})

test('enroll на несуществующий курс → 404', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/courses/nope/enroll',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(404)
  expect(res.json().message).toEqual(expect.any(String))
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm --filter server test tests/courses.test.ts`
Expected: FAIL — `seedCourses` / routes do not exist.

- [ ] **Step 3: Implement the seed**

Create `apps/server/src/db/seed.ts`:
```ts
import { sql } from 'drizzle-orm'
import type { Db } from './client'
import { courses } from './schema'

const MVP_COURSES = [
  {
    slug: 'vocabulary',
    type: 'vocabulary',
    title: '3000 слов для Intermediate',
    description: 'Словарь по темам с интервальными повторениями.',
    order: 1,
  },
  {
    slug: 'grammar',
    type: 'grammar',
    title: 'Grammar Is All You Need 2.0',
    description: 'Курс грамматики: теория, упражнения, проверка ИИ.',
    order: 2,
  },
]

export async function seedCourses(db: Db): Promise<void> {
  for (const c of MVP_COURSES) {
    await db
      .insert(courses)
      .values(c)
      .onConflictDoNothing({ target: courses.slug })
  }
  void sql // no-op to keep import if unused after refactor
}
```
(If `sql` is unused, drop its import — do not leave a dangling reference.)

- [ ] **Step 4: Implement the module**

Create `apps/server/src/modules/courses/service.ts`:
```ts
import { and, eq } from 'drizzle-orm'
import type { CourseDto, CourseType } from '@wordforge/shared'
import type { Db } from '../../db/client'
import { AuthError } from '../auth'
import { courses, enrollments } from '../../db/schema'

export async function listCourses(
  db: Db,
  userId: number,
): Promise<CourseDto[]> {
  const rows = await db.select().from(courses).orderBy(courses.order)
  const mine = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
  const enrolledIds = new Set(mine.map((r) => r.courseId))

  return rows.map((c) => ({
    slug: c.slug,
    type: c.type as CourseType,
    title: c.title,
    description: c.description,
    enrolled: enrolledIds.has(c.id),
    progress: { done: 0, total: 0 },
  }))
}

export async function enrollInCourse(
  db: Db,
  userId: number,
  slug: string,
): Promise<void> {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1)
  if (!course) {
    throw new AuthError(404, 'Курс не найден')
  }
  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, course.id),
      ),
    )
    .limit(1)
  if (!existing) {
    await db.insert(enrollments).values({ userId, courseId: course.id })
  }
}
```

Create `apps/server/src/modules/courses/index.ts`:
```ts
export { listCourses, enrollInCourse } from './service'
```

- [ ] **Step 5: Implement the routes**

Create `apps/server/src/routes/courses.ts`:
```ts
import type { FastifyInstance } from 'fastify'
import { enrollInCourse, listCourses } from '../modules/courses'
import { requireAuth } from '../middlewares/requireAuth'

export async function courseRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (req) => {
    return listCourses(app.db, req.user.sub)
  })

  app.post(
    '/:slug/enroll',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { slug } = req.params as { slug: string }
      await enrollInCourse(app.db, req.user.sub, slug)
      return reply.status(204).send()
    },
  )
}
```

- [ ] **Step 6: Register routes in `buildApp`**

In `apps/server/src/app/buildApp.ts`, add after the auth registration:
```ts
import { courseRoutes } from '../routes/courses'
// ...
  app.register(courseRoutes, { prefix: '/api/courses' })
```

- [ ] **Step 7: Seed on boot**

In `apps/server/src/app/entry.ts`, after creating `db`:
```ts
import { seedCourses } from '../db/seed'
// ...
await seedCourses(db)
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter server test tests/courses.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/modules/courses apps/server/src/routes/courses.ts apps/server/src/db/seed.ts apps/server/src/app/buildApp.ts apps/server/src/app/entry.ts apps/server/tests/courses.test.ts
git commit -m "feat(server): courses module (list + enroll) with seed"
```

---

### Task 8: Stats skeleton endpoint

**Files:**
- Create: `apps/server/src/routes/stats.ts`
- Create: `packages/shared/src/stats.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/app/buildApp.ts`
- Create: `apps/server/tests/stats.test.ts`

**Interfaces:**
- Produces: `GET /api/stats` → `{ streak: number, courses: { slug, done, total }[] }` (`statsDto`).

- [ ] **Step 1: Write the failing test**

Create `apps/server/tests/stats.test.ts`:
```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'
import { seedCourses } from '../src/db/seed'

const app = await buildTestApp()
let token = ''

beforeAll(async () => {
  await seedCourses(app.db)
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 's@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 's@example.com', password: 'abc12345' },
  })
  token = res.json().accessToken
})
afterAll(() => app.close())

test('GET /api/stats: стрик 0 и список курсов', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/stats',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().streak).toBe(0)
  expect(res.json().courses).toHaveLength(2)
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm --filter server test tests/stats.test.ts`
Expected: FAIL — route missing.

- [ ] **Step 3: Add the shared DTO**

Create `packages/shared/src/stats.ts`:
```ts
import { z } from 'zod'

export const statsDto = z.object({
  streak: z.number().int().nonnegative(),
  courses: z.array(
    z.object({
      slug: z.string(),
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
})
export type StatsDto = z.infer<typeof statsDto>
```
And add `export * from './stats'` to `packages/shared/src/index.ts`.

- [ ] **Step 4: Implement the route**

Create `apps/server/src/routes/stats.ts`:
```ts
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { StatsDto } from '@wordforge/shared'
import { requireAuth } from '../middlewares/requireAuth'
import { listCourses } from '../modules/courses'
import { users } from '../db/schema'

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (req): Promise<StatsDto> => {
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.id, req.user.sub))
      .limit(1)
    const courses = await listCourses(app.db, req.user.sub)
    return {
      streak: user?.streak ?? 0,
      courses: courses.map((c) => ({
        slug: c.slug,
        done: c.progress.done,
        total: c.progress.total,
      })),
    }
  })
}
```
Register it in `buildApp.ts`:
```ts
import { statsRoutes } from '../routes/stats'
// ...
  app.register(statsRoutes, { prefix: '/api/stats' })
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter server test tests/stats.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/stats.ts packages/shared/src/stats.ts packages/shared/src/index.ts apps/server/src/app/buildApp.ts apps/server/tests/stats.test.ts
git commit -m "feat(server): stats skeleton endpoint"
```

---

### Task 9: Client — Courses page

**Files:**
- Create: `apps/client/src/modules/Courses/api/coursesApi.ts`
- Create: `apps/client/src/modules/Courses/store/CoursesStore.ts`
- Create: `apps/client/src/modules/Courses/components/CourseCard.tsx`
- Create: `apps/client/src/modules/Courses/index.ts`
- Create: `apps/client/src/pages/courses.tsx`
- Modify: `apps/client/src/common/constants/routes.ts`
- Modify: `apps/client/src/app/router.ts`

**Interfaces:**
- Consumes: `httpClient` (`apps/client/src/common/utilities/httpClient.ts`), `CoursesListDto`/`CourseDto` from `@wordforge/shared`.
- Produces: `CoursesStore` (MobX: `courses`, `load()`, `enroll(slug)`), route `ROUTES.courses`.

- [ ] **Step 1: Add the route constant**

In `apps/client/src/common/constants/routes.ts`, add:
```ts
export const ROUTES = {
  // ...existing...
  courses: '/courses',
} as const
```
(Merge into the existing object; keep existing entries.)

- [ ] **Step 2: API wrapper**

Create `apps/client/src/modules/Courses/api/coursesApi.ts`:
```ts
import type { CoursesListDto } from '@wordforge/shared'
import { httpClient } from '@/common/utilities/httpClient'

export const coursesApi = {
  list: () => httpClient.get<CoursesListDto>('/api/courses'),
  enroll: (slug: string) =>
    httpClient.post(`/api/courses/${slug}/enroll`, undefined),
}
```
(Adjust method names/signatures to match the existing `httpClient` API in `common/utilities/httpClient.ts`.)

- [ ] **Step 3: MobX store**

Create `apps/client/src/modules/Courses/store/CoursesStore.ts`:
```ts
import { makeAutoObservable, runInAction } from 'mobx'
import type { CourseDto } from '@wordforge/shared'
import { coursesApi } from '../api/coursesApi'

export class CoursesStore {
  courses: CourseDto[] = []
  loading = false

  constructor() {
    makeAutoObservable(this)
  }

  async load() {
    this.loading = true
    const courses = await coursesApi.list()
    runInAction(() => {
      this.courses = courses
      this.loading = false
    })
  }

  async enroll(slug: string) {
    await coursesApi.enroll(slug)
    await this.load()
  }
}
```

- [ ] **Step 4: Card component + public API**

Create `apps/client/src/modules/Courses/components/CourseCard.tsx`:
```tsx
import { observer } from 'mobx-react-lite'
import type { CourseDto } from '@wordforge/shared'
import { Button } from '@/common/ui/button'

export const CourseCard = observer(function CourseCard(props: {
  course: CourseDto
  onEnroll: (slug: string) => void
}) {
  const { course, onEnroll } = props
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{course.title}</h3>
      <p className="text-sm text-muted-foreground">{course.description}</p>
      {course.enrolled ? (
        <span className="text-sm text-green-600">Вы записаны</span>
      ) : (
        <Button onClick={() => onEnroll(course.slug)}>Записаться</Button>
      )}
    </div>
  )
})
```
Create `apps/client/src/modules/Courses/index.ts`:
```ts
export { CoursesStore } from './store/CoursesStore'
export { CourseCard } from './components/CourseCard'
```
(If `common/ui/button` does not exist yet, generate it with the shadcn CLI per the `feod-frontend`/`ui-styling` conventions, or use a plain `<button>` — do not import a non-existent module.)

- [ ] **Step 5: Page**

Create `apps/client/src/pages/courses.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { CourseCard, CoursesStore } from '@/modules/Courses'

export const CoursesPage = observer(function CoursesPage() {
  const [store] = useState(() => new CoursesStore())
  useEffect(() => {
    store.load()
  }, [store])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Курсы</h1>
      {store.courses.map((c) => (
        <CourseCard key={c.slug} course={c} onEnroll={(s) => store.enroll(s)} />
      ))}
    </div>
  )
})
```

- [ ] **Step 6: Wire the route**

In `apps/client/src/app/router.ts`, add a route for `ROUTES.courses` rendering `CoursesPage`, following the existing code-based route registration pattern in that file.

- [ ] **Step 7: Verify build + typecheck**

Run: `pnpm --filter client build`
Expected: build succeeds, no TS errors.

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/modules/Courses apps/client/src/pages/courses.tsx apps/client/src/common/constants/routes.ts apps/client/src/app/router.ts
git commit -m "feat(client): Courses page (list + enroll) via MobX store"
```

---

### Task 10: Update CLAUDE.md for PostgreSQL

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the DB-related sections**

Update `CLAUDE.md`:
- "Drizzle ORM over SQLite (`better-sqlite3`)" → "Drizzle ORM over **PostgreSQL** (`postgres-js`; PGlite in tests)".
- Replace the entire "Native build gotcha (pnpm 10)" section: `better-sqlite3` native build is gone; keep only the `bcrypt` note in `onlyBuiltDependencies`. Add: local dev needs Postgres via `docker compose up -d`; `DATABASE_URL` env; tests use PGlite (no external DB).
- Backend testing note: "in-memory SQLite (`:memory:`)" → "in-process **PGlite** (`createTestDb()`) per test file".
- `db:generate` note: dialect is now `postgresql`.

- [ ] **Step 2: Run the full suite + build as a final gate**

Run:
```bash
pnpm test
pnpm build
```
Expected: all tests PASS, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — PostgreSQL/PGlite instead of SQLite"
```

---

## Self-Review

**Spec coverage (design spec §4, §8; REQUIREMENTS §6):**
- Postgres migration (schema, client, config, auth async, tests→PGlite, docker-compose) → Tasks 1–5, 10. ✅
- Courses shell (courses/enrollments tables, list, enroll) → Tasks 6–7. ✅
- Shared contract (`courses.ts`, `COURSE_TYPES`, DTOs) → Tasks 6, 8. ✅
- Stats/dashboard skeleton + streak surfaced → Task 8. ✅
- Minimal client (Courses page) → Task 9. ✅
- Out of scope here (later sub-projects): cards/SRS, lessons/exercises, AI, seed of 3000 words / 5 grammar lessons, deploy/CD. Intentional.

**Type consistency:** `Db` is the single async DB type (Task 3), consumed unchanged by Tasks 5–8. `CourseDto` shape defined in Task 6 is produced by `listCourses` (Task 7) and consumed by Task 8 (maps `progress.done/total`) and Task 9 (client). `req.user.sub: number` matches `users.id` serial. Timestamps are `Date` everywhere (schema `mode: 'date'`, auth uses `new Date()`), and the refresh-cookie `expires` takes a `Date`.

**Placeholder scan:** No TBD/TODO. Every code step has concrete code. Two guarded assumptions are called out explicitly (existing `httpClient` method names in Task 9 Step 2; `common/ui/button` may need generation in Task 9 Step 4) — the implementer must match the real signatures rather than invent them.

## Notes for the implementer

- Run `docker compose up -d` before `pnpm --filter server dev` (server needs a real Postgres); tests need nothing extra (PGlite is in-process).
- After Task 5, the whole pre-existing auth suite must stay green — that is the regression gate for the DB migration.
