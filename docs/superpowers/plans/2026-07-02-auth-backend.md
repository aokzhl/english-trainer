# Auth-бекенд WordForge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять `apps/server` (Fastify + Drizzle/SQLite) с регистрацией, входом, ротацией refresh-токенов и logout по спеке `docs/superpowers/specs/2026-07-02-auth-backend-design.md`.

**Architecture:** Access-JWT 15 минут (`@fastify/jwt`) + stateful refresh-токен 30 дней в httpOnly-cookie с ротацией через таблицу `refresh_tokens`. Структура FEOD-backend: тонкие `routes/` → бизнес-логика в `modules/auth/` → `db/` (Drizzle). Контракт (Zod-схемы) — в `@wordforge/shared`.

**Tech Stack:** Fastify, @fastify/jwt, @fastify/cookie, drizzle-orm + better-sqlite3, drizzle-kit, bcrypt, zod (v4), vitest, tsx, oxlint.

## Global Constraints

- Монорепа pnpm workspaces + Turborepo; зависимости ставить ТОЛЬКО через `pnpm add` (`--filter server` / `--filter @wordforge/shared`), версии руками в package.json не вписывать.
- TypeScript strict, `verbatimModuleSyntax` и `erasableSyntaxOnly` (НЕ использовать parameter properties в классах и enum'ы).
- Формат тела ошибки ВЕЗДЕ: `{ "message": string }`, сообщения на русском.
- Политика пароля: минимум 8 символов, хотя бы одна буква и одна цифра.
- Access-JWT TTL: `15m`, payload `{ sub: <userId: number> }`. Refresh: 32 байта base64url, TTL 30 дней, в БД только sha256-hash.
- Cookie refresh-токена: имя `refresh_token`, `path=/api/auth`, `httpOnly`, `sameSite=lax`, `secure` только в production.
- Email хранится в lowercase (нормализация `trim().toLowerCase()` при регистрации и входе).
- bcrypt cost = 10.
- Тесты — vitest, через `app.inject()`, каждому тест-файлу своя SQLite в tmp.
- Коммит после каждой задачи.

---

## Карта файлов

```
apps/server/
├── package.json              # Task 1
├── tsconfig.json             # Task 1
├── vitest.config.ts          # Task 1
├── .oxlintrc.json            # Task 1
├── drizzle.config.ts         # Task 3
├── drizzle/                  # Task 3 (генерируется drizzle-kit)
├── src/
│   ├── app/
│   │   ├── entry.ts          # Task 9
│   │   ├── buildApp.ts       # Task 1, расширяется в Task 3, 4
│   │   └── config.ts         # Task 1
│   ├── routes/
│   │   └── auth.ts           # Task 4, дополняется в Task 5, 6, 7
│   ├── middlewares/
│   │   └── requireAuth.ts    # Task 8
│   ├── modules/
│   │   └── auth/
│   │       ├── index.ts      # Task 4 (публичный API модуля)
│   │       ├── errors.ts     # Task 4
│   │       ├── service.ts    # Task 4, дополняется в Task 5
│   │       └── refreshTokens.ts # Task 4, дополняется в Task 6, 7
│   ├── db/
│   │   ├── schema.ts         # Task 3
│   │   └── client.ts         # Task 3
│   └── globals/
│       └── fastify.d.ts      # Task 3 (db), Task 4 (jwt payload)
└── tests/
    ├── helpers.ts            # Task 1, обновляется в Task 3
    ├── health.test.ts        # Task 1
    ├── register.test.ts      # Task 4
    ├── login.test.ts         # Task 5
    ├── refresh.test.ts       # Task 6
    ├── logout.test.ts        # Task 7
    └── requireAuth.test.ts   # Task 8

packages/shared/
├── package.json              # Task 2 (zod, vitest через pnpm add)
├── vitest.config.ts          # Task 2
├── src/auth.ts               # Task 2
├── src/index.ts              # Task 2 (re-export auth)
└── tests/auth.test.ts        # Task 2

turbo.json                    # Task 1 (таска test)
package.json (корень)         # Task 1 (скрипт test)
apps/client/vite.config.ts    # Task 9 (proxy /api)
```

---

### Task 1: Скаффолд apps/server + health-check

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`, `apps/server/.oxlintrc.json`, `apps/server/src/app/config.ts`, `apps/server/src/app/buildApp.ts`, `apps/server/tests/helpers.ts`, `apps/server/tests/health.test.ts`
- Modify: `turbo.json` (таска `test`), корневой `package.json` (скрипт `test`)

**Interfaces:**
- Produces: `buildApp(): FastifyInstance` из `src/app/buildApp.ts`; `config` из `src/app/config.ts`; `buildTestApp()` из `tests/helpers.ts`. Роут `GET /api/health` → 200 `{"status":"ok"}`.

- [ ] **Step 1: Каркас пакета**

`apps/server/package.json`:
```json
{
  "name": "server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/app/entry.ts",
    "start": "tsx src/app/entry.ts",
    "build": "tsc --noEmit",
    "lint": "oxlint",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  }
}
```

`apps/server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests", "vitest.config.ts", "drizzle.config.ts"]
}
```

`apps/server/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

`apps/server/.oxlintrc.json`:
```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "oxc"]
}
```

- [ ] **Step 2: Установить зависимости (только pnpm add)**

```bash
pnpm --filter server add fastify @fastify/jwt @fastify/cookie drizzle-orm better-sqlite3 bcrypt zod '@wordforge/shared@workspace:*'
pnpm --filter server add -D typescript tsx vitest drizzle-kit oxlint @types/node @types/better-sqlite3 @types/bcrypt
```

- [ ] **Step 3: Написать падающий тест health-check**

`apps/server/tests/helpers.ts`:
```ts
import { buildApp } from '../src/app/buildApp'

export async function buildTestApp() {
  const app = buildApp()
  await app.ready()
  return app
}
```

`apps/server/tests/health.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

test('GET /api/health отвечает 200 {status: ok}', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/health' })
  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ status: 'ok' })
})
```

- [ ] **Step 4: Убедиться, что тест падает**

Run: `pnpm --filter server test`
Expected: FAIL — `Cannot find module '../src/app/buildApp'`

- [ ] **Step 5: Минимальная реализация**

`apps/server/src/app/config.ts`:
```ts
export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  dbPath: process.env.DB_PATH ?? './data/wordforge.db',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  isProd: process.env.NODE_ENV === 'production',
}
```

`apps/server/src/app/buildApp.ts`:
```ts
import fastify from 'fastify'

export function buildApp(opts: { logger?: boolean } = {}) {
  const app = fastify({ logger: opts.logger ?? false })

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
```

- [ ] **Step 6: Убедиться, что тест проходит**

Run: `pnpm --filter server test`
Expected: PASS (1 test)

- [ ] **Step 7: Подключить test к turbo**

В `turbo.json` в `tasks` добавить:
```json
"test": {}
```
В корневой `package.json` в `scripts` добавить:
```json
"test": "turbo run test"
```

Run: `pnpm test` (из корня)
Expected: `server:test` PASS; у client/shared таски test нет — turbo их пропустит.

- [ ] **Step 8: Проверить lint и typecheck, закоммитить**

Run: `pnpm --filter server lint && pnpm --filter server build`
Expected: 0 ошибок.

```bash
git add apps/server turbo.json package.json pnpm-lock.yaml
git commit -m "feat(server): каркас Fastify-приложения с health-check"
```

---

### Task 2: Контракт auth в @wordforge/shared

**Files:**
- Create: `packages/shared/src/auth.ts`, `packages/shared/tests/auth.test.ts`, `packages/shared/vitest.config.ts`
- Modify: `packages/shared/src/index.ts` (re-export), `packages/shared/package.json` (скрипт test)

**Interfaces:**
- Produces (импортируются сервером в Task 4–5 и клиентом позже):
  - `registerBodySchema: ZodObject` — `{ email: string, password: string }` с политикой пароля
  - `loginBodySchema: ZodObject` — `{ email: string, password: string }` (пароль — просто непустой)
  - `authResponseSchema: ZodObject` — `{ accessToken: string }`
  - типы `RegisterBody`, `LoginBody`, `AuthResponse` (z.infer)

- [ ] **Step 1: Установить зависимости**

```bash
pnpm --filter @wordforge/shared add zod
pnpm --filter @wordforge/shared add -D vitest typescript
```

В `packages/shared/package.json` добавить в `scripts`:
```json
"test": "vitest run"
```

`packages/shared/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 2: Написать падающие тесты схем**

`packages/shared/tests/auth.test.ts`:
```ts
import { expect, test } from 'vitest'
import { loginBodySchema, registerBodySchema } from '../src/auth'

test('валидные email и пароль проходят регистрацию', () => {
  const r = registerBodySchema.safeParse({ email: 'a@b.co', password: 'abc12345' })
  expect(r.success).toBe(true)
})

test.each([
  ['короткий', 'a1b2c3'],
  ['без цифр', 'abcdefgh'],
  ['без букв', '12345678'],
])('пароль %s отклоняется при регистрации', (_name, password) => {
  const r = registerBodySchema.safeParse({ email: 'a@b.co', password })
  expect(r.success).toBe(false)
})

test('некорректный email отклоняется', () => {
  const r = registerBodySchema.safeParse({ email: 'не-email', password: 'abc12345' })
  expect(r.success).toBe(false)
})

test('логин не навязывает политику пароля, но требует непустой', () => {
  expect(loginBodySchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  expect(loginBodySchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
})
```

- [ ] **Step 3: Убедиться, что тесты падают**

Run: `pnpm --filter @wordforge/shared test`
Expected: FAIL — `Cannot find module '../src/auth'`

- [ ] **Step 4: Реализовать схемы**

`packages/shared/src/auth.ts`:
```ts
import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен быть не короче 8 символов')
  .regex(/[a-zа-яё]/i, 'Пароль должен содержать хотя бы одну букву')
  .regex(/\d/, 'Пароль должен содержать хотя бы одну цифру')

export const registerBodySchema = z.object({
  email: z.email('Некорректный email'),
  password: passwordSchema,
})
export type RegisterBody = z.infer<typeof registerBodySchema>

export const loginBodySchema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

export const authResponseSchema = z.object({
  accessToken: z.string(),
})
export type AuthResponse = z.infer<typeof authResponseSchema>
```

В `packages/shared/src/index.ts` добавить первой строкой:
```ts
export * from './auth'
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `pnpm --filter @wordforge/shared test`
Expected: PASS (4 tests, включая each-кейсы — 6 assertions)

- [ ] **Step 6: Коммит**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): zod-контракт auth (register/login/response)"
```

---

### Task 3: База данных — схема, клиент, миграции

**Files:**
- Create: `apps/server/src/db/schema.ts`, `apps/server/src/db/client.ts`, `apps/server/drizzle.config.ts`, `apps/server/src/globals/fastify.d.ts`, `apps/server/tests/db.test.ts`
- Modify: `apps/server/src/app/buildApp.ts` (параметр dbPath, декоратор db), `apps/server/tests/helpers.ts` (tmp-БД), `apps/server/.gitignore` (создать: `data/`)

**Interfaces:**
- Consumes: `buildApp` из Task 1.
- Produces:
  - `users`, `refreshTokens` из `src/db/schema.ts` (колонки — см. код ниже)
  - `createDb(dbPath: string): Db` из `src/db/client.ts` — открывает SQLite, включает FK, прогоняет миграции
  - `buildApp({ dbPath })` — БД доступна как `app.db`
  - `buildTestApp()` — создаёт app с уникальной tmp-БД

- [ ] **Step 1: Написать падающий тест БД**

`apps/server/tests/db.test.ts`:
```ts
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../src/db/client'
import { refreshTokens, users } from '../src/db/schema'

test('миграции применяются, users и refresh_tokens доступны', () => {
  const db = createDb(path.join(os.tmpdir(), `wf-db-${randomUUID()}.db`))

  const [user] = db
    .insert(users)
    .values({ email: 'a@b.co', passwordHash: 'hash', createdAt: new Date().toISOString() })
    .returning()
    .all()

  expect(user.id).toBe(1)
  expect(user.streak).toBe(0)

  db.insert(refreshTokens)
    .values({
      userId: user.id,
      tokenHash: 'abc',
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .run()

  const rows = db.select().from(refreshTokens).where(eq(refreshTokens.userId, user.id)).all()
  expect(rows).toHaveLength(1)
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm --filter server test tests/db.test.ts`
Expected: FAIL — `Cannot find module '../src/db/client'`

- [ ] **Step 3: Схема и клиент**

`apps/server/src/db/schema.ts`:
```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  streak: integer('streak').notNull().default(0),
  lastStudyDay: text('last_study_day'),
})

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
})
```

`apps/server/src/db/client.ts`:
```ts
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

const migrationsFolder = path.join(import.meta.dirname, '../../drizzle')

export function createDb(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder })
  return db
}

export type Db = ReturnType<typeof createDb>
```

`apps/server/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
```

- [ ] **Step 4: Сгенерировать миграцию**

Run: `pnpm --filter server db:generate`
Expected: в `apps/server/drizzle/` появился `0000_*.sql` с `CREATE TABLE users` и `CREATE TABLE refresh_tokens`. Открыть SQL-файл и проверить, что обе таблицы и FK на месте.

- [ ] **Step 5: Убедиться, что тест проходит**

Run: `pnpm --filter server test tests/db.test.ts`
Expected: PASS

- [ ] **Step 6: Подключить БД к приложению**

`apps/server/src/globals/fastify.d.ts`:
```ts
import type { Db } from '../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

export {}
```

В `apps/server/src/app/buildApp.ts` заменить сигнатуру и добавить декоратор (полный новый вид файла):
```ts
import fastify from 'fastify'
import { createDb } from '../db/client'

export function buildApp(opts: { dbPath: string; logger?: boolean }) {
  const app = fastify({ logger: opts.logger ?? false })

  app.decorate('db', createDb(opts.dbPath))

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
```

`apps/server/tests/helpers.ts` (полный новый вид):
```ts
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { buildApp } from '../src/app/buildApp'

type App = ReturnType<typeof buildApp>

export async function buildTestApp(extend?: (app: App) => void) {
  const dbPath = path.join(os.tmpdir(), `wordforge-test-${randomUUID()}.db`)
  const app = buildApp({ dbPath })
  extend?.(app)
  await app.ready()
  return app
}
```

`apps/server/.gitignore`:
```
data/
```

- [ ] **Step 7: Все тесты, lint, typecheck**

Run: `pnpm --filter server test && pnpm --filter server lint && pnpm --filter server build`
Expected: PASS (health + db), 0 ошибок lint/tsc.

- [ ] **Step 8: Коммит**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): схема БД users/refresh_tokens, drizzle-клиент и миграции"
```

---

### Task 4: POST /api/auth/register

**Files:**
- Create: `apps/server/src/modules/auth/errors.ts`, `apps/server/src/modules/auth/service.ts`, `apps/server/src/modules/auth/refreshTokens.ts`, `apps/server/src/modules/auth/index.ts`, `apps/server/src/routes/auth.ts`, `apps/server/tests/register.test.ts`
- Modify: `apps/server/src/app/buildApp.ts` (jwt, cookie, роуты, AuthError в error handler), `apps/server/src/globals/fastify.d.ts` (типы JWT)

**Interfaces:**
- Consumes: `registerBodySchema` из `@wordforge/shared`; `app.db`, схемы из Task 3.
- Produces:
  - `AuthError` (`errors.ts`): `class AuthError extends Error { status: number }`, конструктор `(status: number, message: string)`
  - `registerUser(db: Db, email: string, password: string): Promise<{ userId: number }>` — бросает `AuthError(409, 'Пользователь с таким email уже существует')`
  - `issueRefreshToken(db: Db, userId: number): { token: string; expiresAt: string }`
  - `setRefreshCookie(reply, token, expiresAt)` — внутренняя функция `routes/auth.ts`
  - Роут `POST /api/auth/register` → 201 `{accessToken}` + cookie
  - Хелпер тестов: `registerUser(app, email?, password?)` в `tests/register.test.ts` НЕ шарится; каждый тест-файл делает register через `app.inject` сам

- [ ] **Step 1: Написать падающие тесты**

`apps/server/tests/register.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

const body = { email: 'User@Example.com', password: 'abc12345' }

test('успешная регистрация: 201, accessToken, refresh-cookie', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: body })

  expect(res.statusCode).toBe(201)
  expect(res.json().accessToken).toEqual(expect.any(String))

  const cookie = res.cookies.find((c) => c.name === 'refresh_token')
  expect(cookie).toBeDefined()
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.path).toBe('/api/auth')
})

test('повторная регистрация того же email (в другом регистре) → 409', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { ...body, email: 'user@example.com' },
  })
  expect(res.statusCode).toBe(409)
  expect(res.json().message).toBe('Пользователь с таким email уже существует')
})

test('слабый пароль → 400 с сообщением схемы', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'new@example.com', password: 'abcdefgh' },
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().message).toBe('Пароль должен содержать хотя бы одну цифру')
})

test('accessToken подписан и содержит sub', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'second@example.com', password: 'abc12345' },
  })
  const payload = app.jwt.verify<{ sub: number }>(res.json().accessToken)
  expect(payload.sub).toEqual(expect.any(Number))
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `pnpm --filter server test tests/register.test.ts`
Expected: FAIL — 404 на `/api/auth/register` (роут не зарегистрирован)

- [ ] **Step 3: Модуль auth**

`apps/server/src/modules/auth/errors.ts`:
```ts
export class AuthError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}
```

`apps/server/src/modules/auth/refreshTokens.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto'
import { refreshTokens } from '../../db/schema'
import type { Db } from '../../db/client'
import { config } from '../../app/config'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function issueRefreshToken(db: Db, userId: number): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  db.insert(refreshTokens)
    .values({ userId, tokenHash: hashToken(token), expiresAt, createdAt: now.toISOString() })
    .run()

  return { token, expiresAt }
}
```

`apps/server/src/modules/auth/service.ts`:
```ts
import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import type { Db } from '../../db/client'
import { AuthError } from './errors'

const BCRYPT_COST = 10

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function registerUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: number }> {
  const normalized = normalizeEmail(email)
  const existing = db.select().from(users).where(eq(users.email, normalized)).get()
  if (existing) {
    throw new AuthError(409, 'Пользователь с таким email уже существует')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const [user] = db
    .insert(users)
    .values({ email: normalized, passwordHash, createdAt: new Date().toISOString() })
    .returning()
    .all()

  return { userId: user.id }
}
```

`apps/server/src/modules/auth/index.ts`:
```ts
export { AuthError } from './errors'
export { registerUser, normalizeEmail } from './service'
export { issueRefreshToken, hashToken } from './refreshTokens'
```

- [ ] **Step 4: Роут и подключение плагинов**

`apps/server/src/routes/auth.ts`:
```ts
import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { registerBodySchema } from '@wordforge/shared'
import { issueRefreshToken, registerUser } from '../modules/auth'
import { config } from '../app/config'

export const REFRESH_COOKIE = 'refresh_token'

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    path: '/api/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    expires: new Date(expiresAt),
  })
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message })
    }

    const { userId } = await registerUser(app.db, parsed.data.email, parsed.data.password)
    const refresh = issueRefreshToken(app.db, userId)
    const accessToken = await reply.jwtSign({ sub: userId })

    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return reply.status(201).send({ accessToken })
  })
}
```

`apps/server/src/globals/fastify.d.ts` (полный новый вид):
```ts
import type { Db } from '../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number }
    user: { sub: number }
  }
}

export {}
```

`apps/server/src/app/buildApp.ts` (полный новый вид):
```ts
import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import { createDb } from '../db/client'
import { AuthError } from '../modules/auth'
import { authRoutes } from '../routes/auth'
import { config } from './config'

export function buildApp(opts: { dbPath: string; logger?: boolean }) {
  const app = fastify({ logger: opts.logger ?? false })

  app.decorate('db', createDb(opts.dbPath))

  app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.accessTokenTtl },
  })
  app.register(fastifyCookie)

  app.register(authRoutes, { prefix: '/api/auth' })

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.status).send({ message: error.message })
    }
    request.log.error(error)
    return reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
```

- [ ] **Step 5: Убедиться, что тесты проходят**

Run: `pnpm --filter server test`
Expected: PASS (health, db, register — все)

- [ ] **Step 6: Lint, typecheck, коммит**

Run: `pnpm --filter server lint && pnpm --filter server build`
Expected: 0 ошибок.

```bash
git add apps/server
git commit -m "feat(server): регистрация с access-JWT и refresh-cookie"
```

---

### Task 5: POST /api/auth/login

**Files:**
- Create: `apps/server/tests/login.test.ts`
- Modify: `apps/server/src/modules/auth/service.ts` (+`verifyUser`), `apps/server/src/modules/auth/index.ts` (экспорт), `apps/server/src/routes/auth.ts` (+роут)

**Interfaces:**
- Consumes: `loginBodySchema` из `@wordforge/shared`; `setRefreshCookie`, `issueRefreshToken` из Task 4.
- Produces: `verifyUser(db: Db, email: string, password: string): Promise<{ userId: number }>` — бросает `AuthError(401, 'Неверный email или пароль')` и для неизвестного email, и для неверного пароля. Роут `POST /api/auth/login` → 200 `{accessToken}` + cookie.

- [ ] **Step 1: Написать падающие тесты**

`apps/server/tests/login.test.ts`:
```ts
import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

beforeAll(async () => {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'user@example.com', password: 'abc12345' },
  })
})

test('успешный вход: 200, accessToken, refresh-cookie', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'USER@example.com', password: 'abc12345' },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().accessToken).toEqual(expect.any(String))
  expect(res.cookies.find((c) => c.name === 'refresh_token')).toBeDefined()
})

test('неверный пароль и неизвестный email дают одинаковый 401', async () => {
  const wrongPassword = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: 'wrong123' },
  })
  const unknownEmail = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ghost@example.com', password: 'abc12345' },
  })

  expect(wrongPassword.statusCode).toBe(401)
  expect(unknownEmail.statusCode).toBe(401)
  expect(wrongPassword.json().message).toBe('Неверный email или пароль')
  expect(unknownEmail.json().message).toBe(wrongPassword.json().message)
})

test('пустой пароль → 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: '' },
  })
  expect(res.statusCode).toBe(400)
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `pnpm --filter server test tests/login.test.ts`
Expected: FAIL — 404 на `/api/auth/login`

- [ ] **Step 3: Реализация**

В `apps/server/src/modules/auth/service.ts` добавить:
```ts
export async function verifyUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: number }> {
  const user = db.select().from(users).where(eq(users.email, normalizeEmail(email))).get()
  if (!user) {
    throw new AuthError(401, 'Неверный email или пароль')
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    throw new AuthError(401, 'Неверный email или пароль')
  }
  return { userId: user.id }
}
```

В `apps/server/src/modules/auth/index.ts` дополнить экспорт:
```ts
export { registerUser, verifyUser, normalizeEmail } from './service'
```

В `apps/server/src/routes/auth.ts` добавить внутрь `authRoutes` (импортировав `loginBodySchema` из `@wordforge/shared` и `verifyUser` из `../modules/auth`):
```ts
app.post('/login', async (request, reply) => {
  const parsed = loginBodySchema.safeParse(request.body)
  if (!parsed.success) {
    return reply.status(400).send({ message: parsed.error.issues[0].message })
  }

  const { userId } = await verifyUser(app.db, parsed.data.email, parsed.data.password)
  const refresh = issueRefreshToken(app.db, userId)
  const accessToken = await reply.jwtSign({ sub: userId })

  setRefreshCookie(reply, refresh.token, refresh.expiresAt)
  return reply.status(200).send({ accessToken })
})
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `pnpm --filter server test`
Expected: PASS все файлы.

- [ ] **Step 5: Lint, typecheck, коммит**

Run: `pnpm --filter server lint && pnpm --filter server build`

```bash
git add apps/server
git commit -m "feat(server): вход по email и паролю"
```

---

### Task 6: POST /api/auth/refresh (ротация)

**Files:**
- Create: `apps/server/tests/refresh.test.ts`
- Modify: `apps/server/src/modules/auth/refreshTokens.ts` (+`rotateRefreshToken`), `apps/server/src/modules/auth/index.ts`, `apps/server/src/routes/auth.ts` (+роут)

**Interfaces:**
- Consumes: `hashToken`, `issueRefreshToken`, `REFRESH_COOKIE`, `setRefreshCookie` из Task 4.
- Produces: `rotateRefreshToken(db: Db, token: string): { userId: number; token: string; expiresAt: string }` — удаляет старую запись, создаёт новую; бросает `AuthError(401, 'Сессия истекла, войдите снова')` если токен неизвестен или просрочен. Роут `POST /api/auth/refresh` → 200 `{accessToken}` + новая cookie.

- [ ] **Step 1: Написать падающие тесты**

`apps/server/tests/refresh.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { buildTestApp } from './helpers'
import { hashToken } from '../src/modules/auth'
import { refreshTokens } from '../src/db/schema'

const app = await buildTestApp()
afterAll(() => app.close())

async function registerAndGetRefresh(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'abc12345' },
  })
  const cookie = res.cookies.find((c) => c.name === 'refresh_token')
  if (!cookie) throw new Error('refresh-cookie не выдана')
  return cookie.value
}

test('refresh выдаёт новый accessToken и ротирует токен', async () => {
  const oldToken = await registerAndGetRefresh('rotate@example.com')

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: oldToken },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().accessToken).toEqual(expect.any(String))

  const newCookie = res.cookies.find((c) => c.name === 'refresh_token')
  expect(newCookie).toBeDefined()
  expect(newCookie?.value).not.toBe(oldToken)

  // старый токен после ротации мёртв
  const replay = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: oldToken },
  })
  expect(replay.statusCode).toBe(401)
})

test('без cookie → 401', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' })
  expect(res.statusCode).toBe(401)
})

test('просроченный токен → 401', async () => {
  const token = await registerAndGetRefresh('expired@example.com')

  app.db
    .update(refreshTokens)
    .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .run()

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: token },
  })
  expect(res.statusCode).toBe(401)
  expect(res.json().message).toBe('Сессия истекла, войдите снова')
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `pnpm --filter server test tests/refresh.test.ts`
Expected: FAIL — 404 на `/api/auth/refresh`

- [ ] **Step 3: Реализация**

В `apps/server/src/modules/auth/refreshTokens.ts` добавить (импортировав `eq` из `drizzle-orm` и `AuthError` из `./errors`):
```ts
export function rotateRefreshToken(
  db: Db,
  token: string,
): { userId: number; token: string; expiresAt: string } {
  const row = db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .get()

  if (!row) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }

  db.delete(refreshTokens).where(eq(refreshTokens.id, row.id)).run()

  if (row.expiresAt <= new Date().toISOString()) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }

  const next = issueRefreshToken(db, row.userId)
  return { userId: row.userId, ...next }
}
```

В `apps/server/src/modules/auth/index.ts` дополнить:
```ts
export { issueRefreshToken, rotateRefreshToken, hashToken } from './refreshTokens'
```

В `apps/server/src/routes/auth.ts` добавить внутрь `authRoutes` (импортировав `rotateRefreshToken` и `AuthError`):
```ts
app.post('/refresh', async (request, reply) => {
  const token = request.cookies[REFRESH_COOKIE]
  if (!token) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }

  const rotated = rotateRefreshToken(app.db, token)
  const accessToken = await reply.jwtSign({ sub: rotated.userId })

  setRefreshCookie(reply, rotated.token, rotated.expiresAt)
  return reply.status(200).send({ accessToken })
})
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `pnpm --filter server test`
Expected: PASS все файлы.

- [ ] **Step 5: Lint, typecheck, коммит**

Run: `pnpm --filter server lint && pnpm --filter server build`

```bash
git add apps/server
git commit -m "feat(server): ротация refresh-токена"
```

---

### Task 7: POST /api/auth/logout

**Files:**
- Create: `apps/server/tests/logout.test.ts`
- Modify: `apps/server/src/modules/auth/refreshTokens.ts` (+`revokeRefreshToken`), `apps/server/src/modules/auth/index.ts`, `apps/server/src/routes/auth.ts` (+роут)

**Interfaces:**
- Produces: `revokeRefreshToken(db: Db, token: string): void` (идемпотентна). Роут `POST /api/auth/logout` → 204, cookie очищается (`reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })`).

- [ ] **Step 1: Написать падающие тесты**

`apps/server/tests/logout.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

test('logout: 204, refresh после него мёртв, повторный logout безопасен', async () => {
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'bye@example.com', password: 'abc12345' },
  })
  const token = reg.cookies.find((c) => c.name === 'refresh_token')!.value

  const out = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    cookies: { refresh_token: token },
  })
  expect(out.statusCode).toBe(204)

  const cleared = out.cookies.find((c) => c.name === 'refresh_token')
  expect(cleared?.value).toBe('')

  const refresh = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: token },
  })
  expect(refresh.statusCode).toBe(401)

  const again = await app.inject({ method: 'POST', url: '/api/auth/logout' })
  expect(again.statusCode).toBe(204)
})
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `pnpm --filter server test tests/logout.test.ts`
Expected: FAIL — 404 на `/api/auth/logout`

- [ ] **Step 3: Реализация**

В `apps/server/src/modules/auth/refreshTokens.ts` добавить:
```ts
export function revokeRefreshToken(db: Db, token: string): void {
  db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(token))).run()
}
```

В `apps/server/src/modules/auth/index.ts` строка экспорта из `./refreshTokens` принимает вид:
```ts
export { issueRefreshToken, rotateRefreshToken, revokeRefreshToken, hashToken } from './refreshTokens'
```

В `apps/server/src/routes/auth.ts` добавить внутрь `authRoutes`:
```ts
app.post('/logout', async (request, reply) => {
  const token = request.cookies[REFRESH_COOKIE]
  if (token) {
    revokeRefreshToken(app.db, token)
  }
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' })
  return reply.status(204).send()
})
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `pnpm --filter server test`
Expected: PASS все файлы.

- [ ] **Step 5: Lint, typecheck, коммит**

Run: `pnpm --filter server lint && pnpm --filter server build`

```bash
git add apps/server
git commit -m "feat(server): logout с отзывом refresh-токена"
```

---

### Task 8: Middleware requireAuth

**Files:**
- Create: `apps/server/src/middlewares/requireAuth.ts`, `apps/server/tests/requireAuth.test.ts`

**Interfaces:**
- Produces: `requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>` — preHandler; при невалидном/отсутствующем access-JWT отвечает 401 `{message: 'Требуется авторизация'}`; при валидном кладёт payload в `request.user` (`{ sub: number }`). Будущие защищённые роуты подключают его как `{ preHandler: [requireAuth] }`.

- [ ] **Step 1: Написать падающие тесты**

`apps/server/tests/requireAuth.test.ts`:
```ts
import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'
import { requireAuth } from '../src/middlewares/requireAuth'

const app = await buildTestApp((a) => {
  a.get('/api/protected', { preHandler: [requireAuth] }, (request) => ({
    userId: request.user.sub,
  }))
})
afterAll(() => app.close())

test('без токена → 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/protected' })
  expect(res.statusCode).toBe(401)
  expect(res.json().message).toBe('Требуется авторизация')
})

test('мусорный токен → 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: 'Bearer not-a-jwt' },
  })
  expect(res.statusCode).toBe(401)
})

test('просроченный токен → 401', async () => {
  const expired = app.jwt.sign({ sub: 1 }, { expiresIn: '1ms' })
  await new Promise((resolve) => setTimeout(resolve, 10))
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: `Bearer ${expired}` },
  })
  expect(res.statusCode).toBe(401)
})

test('валидный токен → 200 с userId', async () => {
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'auth@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: `Bearer ${reg.json().accessToken}` },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().userId).toEqual(expect.any(Number))
})
```

Примечание: `buildTestApp(extend)` регистрирует тестовый роут до `app.ready()` — хелпер из Task 3 это уже умеет. `app.jwt.sign` доступен только после `ready`, поэтому просроченный токен подписывается внутри теста.

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `pnpm --filter server test tests/requireAuth.test.ts`
Expected: FAIL — `Cannot find module '../src/middlewares/requireAuth'`

- [ ] **Step 3: Реализация**

`apps/server/src/middlewares/requireAuth.ts`:
```ts
import type { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    await reply.status(401).send({ message: 'Требуется авторизация' })
  }
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `pnpm --filter server test`
Expected: PASS все файлы.

- [ ] **Step 5: Lint, typecheck, коммит**

Run: `pnpm --filter server lint && pnpm --filter server build`

```bash
git add apps/server
git commit -m "feat(server): middleware requireAuth"
```

---

### Task 9: Entry, dev-прокси клиента, финальная проверка

**Files:**
- Create: `apps/server/src/app/entry.ts`
- Modify: `apps/client/vite.config.ts` (proxy `/api`)

**Interfaces:**
- Consumes: `buildApp`, `config`.
- Produces: `pnpm dev` в корне поднимает сервер на `:3001` и клиент на `:5173` с проксированием `/api`.

- [ ] **Step 1: Entry**

`apps/server/src/app/entry.ts`:
```ts
import { buildApp } from './buildApp'
import { config } from './config'

const app = buildApp({ dbPath: config.dbPath, logger: true })

app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
```

- [ ] **Step 2: Прокси на клиенте**

В `apps/client/vite.config.ts` добавить в `defineConfig`:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:3001',
  },
},
```

- [ ] **Step 3: Ручная проверка запуска**

Run (из корня, фоном или в отдельном терминале): `pnpm --filter server dev`
Затем: `curl -s http://localhost:3001/api/health`
Expected: `{"status":"ok"}`

Затем: `curl -s -X POST http://localhost:3001/api/auth/register -H 'Content-Type: application/json' -d '{"email":"smoke@test.ru","password":"abc12345"}' -i | head -12`
Expected: `HTTP/1.1 201`, заголовок `set-cookie: refresh_token=...`, тело `{"accessToken":"..."}`. Остановить сервер, удалить `apps/server/data/` (смоук-артефакт).

- [ ] **Step 4: Полная проверка воркспейса**

Run: `pnpm build && pnpm lint && pnpm test` (из корня)
Expected: все таски turbo зелёные (client+server+shared build/lint, server+shared test).

- [ ] **Step 5: Коммит**

```bash
git add apps/server apps/client/vite.config.ts
git commit -m "feat(server): entry-точка; dev-прокси /api на клиенте"
```
