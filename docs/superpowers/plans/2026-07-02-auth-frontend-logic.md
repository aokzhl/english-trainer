# Auth-фронтенд WordForge — Фаза 1 (логика): план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать всю логику фронтенд-авторизации (DI-инфраструктура, стор сессии, auth-API, auth-сервис, refresh-on-401 в httpClient, composition root) — без UI и роутинга.

**Architecture:** Свой DI через React-контекст (`createDi` + строгий контекст). Сторы/сервисы — фабрики `createX(deps)`; граф собирает composition root в `app`. `httpClient` — синглтон, конфигурируется из composition root (токен из сессии, refresh-on-401 с single-flight и повтором). Сессия — фундаментальный модуль `modules/core/modules/Session`; формы/api/сервис — фича `modules/Auth`.

**Tech Stack:** React 18, MobX, TanStack Router (роутинг — Фаза 2), Zod (`@wordforge/shared`), Vitest + jsdom + @testing-library/react.

**Спека:** `docs/superpowers/specs/2026-07-02-auth-frontend-design.md`.
**DI-паттерн:** скилл `feod-frontend`, `reference/di-and-core.md`.

## Global Constraints

- Форматирование: **одинарные кавычки, без точек с запятой** (oxfmt). Перед каждым коммитом — `pnpm format`.
- `verbatimModuleSyntax`: только-типовые импорты через `import type` / `export type`.
- `erasableSyntaxOnly`: никаких enum и parameter-properties; используем фабрики и явные присваивания.
- Линт: oxlint (`noUnusedLocals`/`noUnusedParameters` включены в tsconfig).
- Тесты co-located рядом с исходником: `<name>.test.ts(x)`.
- Импорты между уровнями — только через алиас `@/`; внутри модуля — относительные пути.
- В другой модуль — только через его `index.ts`.
- Ответы сервера с токеном: `{ accessToken: string }`. Ошибки: `{ message: string }` (русский).
- Хуки: pre-push гоняет format-check + lint + typecheck + test — код должен проходить их все.

---

### Task 1: DI-инфраструктура + тестовый харнесс клиента

**Files:**
- Modify: `apps/client/package.json` (devDeps + скрипт `test`)
- Modify: `apps/client/vite.config.ts` (алиас из tsconfig + тест-конфиг в том же файле)
- Create: `apps/client/src/common/lib/react/create-strict-context.ts`
- Create: `apps/client/src/common/lib/react/use-strict-context.ts`
- Create: `apps/client/src/common/lib/react/create-di.ts`
- Test: `apps/client/src/common/lib/react/create-di.test.tsx`

**Interfaces:**
- Produces:
  - `createStrictContext<T>(): React.Context<T | null>`
  - `useStrictContext<T>(context: Context<T | null>): T` — кидает `Error('Пустое значение контекста')` при `null`
  - `createDi<T>(): { Injector: React.Provider<T | null>, useDi: () => T }`

- [ ] **Step 1: Установить тестовые dev-зависимости**

Run:
```bash
pnpm add -D --filter client vitest jsdom @testing-library/react
```
Expected: пакеты добавлены в `apps/client/package.json` → `devDependencies`.

- [ ] **Step 2: Добавить скрипт `test` в `apps/client/package.json`**

В блок `"scripts"` (рядом с `typecheck`):
```json
"test": "vitest run",
```

- [ ] **Step 3: Обновить `apps/client/vite.config.ts` — алиас из tsconfig + тест-конфиг**

Не дублируем алиас руками: используем встроенную опцию Vite `resolve.tsconfigPaths: true` (берёт `paths` из tsconfig). Тест-конфиг кладём сюда же (`defineConfig` из `vitest/config`) — отдельный `vitest.config.ts` не нужен.

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
  },
})
```

> **Проверка/фолбэк:** Vite читает `apps/client/tsconfig.json` — а он у нас содержит только `references` (сам `@/*` в `tsconfig.app.json`). Резолв `@/` реально проверяется на Task 3 (тест рендерит `session.provider.tsx`, который импортит `@/common/lib/react/create-di`). Если тесты падают с «Failed to resolve import '@/...'», значит oxc-резолвер не прошёл по `references` — тогда фолбэк: вернуть явный алиас в этот же файл вместо `tsconfigPaths`:
> ```ts
> import path from 'node:path'
> // ...
> resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
> ```

- [ ] **Step 4: Написать падающий тест `create-di.test.tsx`**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDi } from './create-di'

describe('createDi', () => {
  it('throws when used outside its provider', () => {
    const { useDi } = createDi<{ n: number }>()
    function Probe() {
      useDi()
      return null
    }
    expect(() => render(<Probe />)).toThrow('Пустое значение контекста')
  })

  it('provides the injected value to consumers', () => {
    const { Injector, useDi } = createDi<{ n: number }>()
    const value = { n: 42 }
    let captured: { n: number } | undefined
    function Probe() {
      captured = useDi()
      return null
    }
    render(
      <Injector value={value}>
        <Probe />
      </Injector>,
    )
    expect(captured).toBe(value)
  })
})
```

- [ ] **Step 5: Запустить тест — убедиться, что падает**

Run: `pnpm --filter client test create-di`
Expected: FAIL — модуль `./create-di` не найден.

- [ ] **Step 6: Реализовать три DI-хелпера**

`create-strict-context.ts`:
```ts
import { createContext } from 'react'

export const createStrictContext = <T>() => createContext<T | null>(null)
```

`use-strict-context.ts`:
```ts
import { useContext, type Context } from 'react'

export const useStrictContext = <T>(context: Context<T | null>): T => {
  const value = useContext(context)
  if (value === null) throw new Error('Пустое значение контекста')
  return value
}
```

`create-di.ts`:
```ts
import { createStrictContext } from './create-strict-context'
import { useStrictContext } from './use-strict-context'

export const createDi = <T>() => {
  const injector = createStrictContext<T>()
  const useDi = () => useStrictContext(injector)
  return { Injector: injector.Provider, useDi }
}
```

- [ ] **Step 7: Запустить тест — убедиться, что проходит**

Run: `pnpm --filter client test create-di`
Expected: PASS (2 теста).

- [ ] **Step 8: Формат и коммит**

```bash
pnpm format
git add apps/client/package.json pnpm-lock.yaml apps/client/vite.config.ts apps/client/src/common/lib/react/
git commit -m "feat(client): DI helpers (createDi, strict context) + vitest harness"
```
(Замечание: lock-файл лежит в корне репозитория — добавляй тот путь, что показал `git status`.)

---

### Task 2: Стор сессии

**Files:**
- Create: `apps/client/src/modules/core/modules/Session/session.store.ts`
- Test: `apps/client/src/modules/core/modules/Session/session.store.test.ts`

**Interfaces:**
- Produces:
  - `createSessionStore(): SessionStore`
  - `type SessionStore` со свойствами: `token: string | null`, `get isAuthorized(): boolean`, `setToken(token: string): void`, `clear(): void`

- [ ] **Step 1: Написать падающий тест `session.store.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { createSessionStore } from './session.store'

describe('createSessionStore', () => {
  it('starts unauthorized with no token', () => {
    const s = createSessionStore()
    expect(s.token).toBeNull()
    expect(s.isAuthorized).toBe(false)
  })

  it('setToken stores the token and marks authorized', () => {
    const s = createSessionStore()
    s.setToken('abc')
    expect(s.token).toBe('abc')
    expect(s.isAuthorized).toBe(true)
  })

  it('clear removes the token', () => {
    const s = createSessionStore()
    s.setToken('abc')
    s.clear()
    expect(s.token).toBeNull()
    expect(s.isAuthorized).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test session.store`
Expected: FAIL — `./session.store` не найден.

- [ ] **Step 3: Реализовать `session.store.ts`**

```ts
import { makeAutoObservable } from 'mobx'

export function createSessionStore() {
  return makeAutoObservable({
    token: null as string | null,
    get isAuthorized() {
      return this.token !== null
    },
    setToken(token: string) {
      this.token = token
    },
    clear() {
      this.token = null
    },
  })
}

export type SessionStore = ReturnType<typeof createSessionStore>
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm --filter client test session.store`
Expected: PASS (3 теста).

- [ ] **Step 5: Формат и коммит**

```bash
pnpm format
git add apps/client/src/modules/core/modules/Session/session.store.ts apps/client/src/modules/core/modules/Session/session.store.test.ts
git commit -m "feat(client): session store (token in memory)"
```

---

### Task 3: Провайдер сессии + публичный API модуля core

**Files:**
- Create: `apps/client/src/modules/core/modules/Session/session.provider.tsx`
- Create: `apps/client/src/modules/core/modules/Session/index.ts`
- Create: `apps/client/src/modules/core/index.ts`
- Test: `apps/client/src/modules/core/modules/Session/session.provider.test.tsx`

**Interfaces:**
- Consumes: `createDi` (Task 1), `createSessionStore`, `SessionStore` (Task 2)
- Produces (реэкспорт из `@/modules/core`):
  - `SessionProvider: (props: { value: SessionStore, children?: ReactNode }) => JSX.Element`
  - `useSessionStore(): SessionStore`
  - `createSessionStore`, тип `SessionStore`

- [ ] **Step 1: Написать падающий тест `session.provider.test.tsx`**

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSessionStore } from './session.store'
import { SessionProvider, useSessionStore } from './session.provider'

describe('SessionProvider', () => {
  it('exposes the injected session store via useSessionStore', () => {
    const store = createSessionStore()
    let captured: unknown
    function Probe() {
      captured = useSessionStore()
      return null
    }
    render(
      <SessionProvider value={store}>
        <Probe />
      </SessionProvider>,
    )
    expect(captured).toBe(store)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test session.provider`
Expected: FAIL — `./session.provider` не найден.

- [ ] **Step 3: Реализовать `session.provider.tsx`**

Провайдер — pass-through: инстанс создаёт composition root (см. Task 7), провайдер лишь кладёт его в контекст.

```tsx
import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { SessionStore } from './session.store'

export const { Injector, useDi: useSessionStore } = createDi<SessionStore>()

export const SessionProvider = ({
  value,
  children,
}: {
  value: SessionStore
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
```

- [ ] **Step 4: Создать `session/index.ts`**

```ts
export { createSessionStore } from './session.store'
export type { SessionStore } from './session.store'
export { SessionProvider, useSessionStore } from './session.provider'
```

- [ ] **Step 5: Создать `core/index.ts`**

```ts
export * from './modules/Session'
```

- [ ] **Step 6: Запустить — убедиться, что проходит**

Run: `pnpm --filter client test session.provider`
Expected: PASS (1 тест).

- [ ] **Step 7: Формат и коммит**

```bash
pnpm format
git add apps/client/src/modules/core/
git commit -m "feat(client): session provider + core module public API"
```

---

### Task 4: httpClient — refresh-on-401 + удаление legacy-хранения токена

**Files:**
- Modify: `apps/client/src/common/utilities/httpClient.ts` (полная замена содержимого)
- Delete: `apps/client/src/app/integrations/http.ts`
- Modify: `apps/client/src/app/entry.tsx` (убрать `initHttp`)
- Test: `apps/client/src/common/utilities/httpClient.test.ts`

**Interfaces:**
- Produces:
  - `type HttpClientConfig = { baseUrl: string, getToken: () => string | null, refresh: () => Promise<string | null>, onAuthFailure: () => void }`
  - `httpClient` с методами `configure(config)`, `get<T>(path)`, `post<T>(path, body?)`, `put<T>(path, body?)`, `delete<T>(path)`
  - `class HttpError extends Error { status: number }`
  - Поведение: `credentials: 'include'`; на 401 (если путь не начинается с `/auth/` и повтор ещё не делался) — один общий `refresh()` (single-flight), при успехе повтор запроса с новым токеном, при `null` — `onAuthFailure()` и проброс `HttpError`; `204` → `undefined`.

- [ ] **Step 1: Написать падающий тест `httpClient.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, httpClient } from './httpClient'

const fetchMock = vi.fn()

function res(status: number, body: unknown = null) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('httpClient', () => {
  it('sends bearer token and credentials, returns json', async () => {
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'tok',
      refresh: async () => null,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(200, { ok: true }))

    const data = await httpClient.get<{ ok: boolean }>('/cards')

    expect(data).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/cards')
    expect(init.credentials).toBe('include')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('refreshes once on 401 then retries with the new token', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return 'new'
    })
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => token,
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'нет доступа' }))
      .mockResolvedValueOnce(res(200, { ok: true }))

    const data = await httpClient.get<{ ok: boolean }>('/cards')

    expect(data).toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new')
  })

  it('calls onAuthFailure and throws when refresh fails', async () => {
    const onAuthFailure = vi.fn()
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh: async () => null,
      onAuthFailure,
    })
    fetchMock.mockResolvedValueOnce(res(401, { message: 'сессия истекла' }))

    await expect(httpClient.get('/cards')).rejects.toBeInstanceOf(HttpError)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on 401 from an /auth/ path', async () => {
    const refresh = vi.fn(async () => 'new')
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => null,
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(401, { message: 'неверные данные' }))

    await expect(httpClient.post('/auth/login', {})).rejects.toBeInstanceOf(
      HttpError,
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shares a single refresh across concurrent 401s', async () => {
    const refresh = vi.fn(async () => 'new')
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValue(res(200, { ok: true }))

    await Promise.all([httpClient.get('/a'), httpClient.get('/b')])

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for 204 responses', async () => {
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'tok',
      refresh: async () => null,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(204))

    await expect(httpClient.post('/auth/logout')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test httpClient`
Expected: FAIL — новые поля конфига/поведение отсутствуют.

- [ ] **Step 3: Заменить содержимое `httpClient.ts`**

```ts
type HttpClientConfig = {
  baseUrl: string
  getToken: () => string | null
  refresh: () => Promise<string | null>
  onAuthFailure: () => void
}

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

class HttpClient {
  private config: HttpClientConfig | null = null
  private refreshPromise: Promise<string | null> | null = null

  configure(config: HttpClientConfig): void {
    this.config = config
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<T> {
    if (!this.config) {
      throw new Error(
        'httpClient не сконфигурирован (см. app/composition-root.ts)',
      )
    }
    const { baseUrl, getToken, onAuthFailure } = this.config
    const token = getToken()

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
      const newToken = await this.runRefresh()
      if (newToken !== null) {
        return this.request<T>(path, init, true)
      }
      onAuthFailure()
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string
      } | null
      throw new HttpError(response.status, body?.message ?? response.statusText)
    }

    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  }

  private runRefresh(): Promise<string | null> {
    if (this.refreshPromise === null) {
      this.refreshPromise = this.config!.refresh().finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }
}

export const httpClient = new HttpClient()
```

- [ ] **Step 4: Удалить legacy-интеграцию токена**

```bash
git rm apps/client/src/app/integrations/http.ts
```

- [ ] **Step 5: Убрать `initHttp` из `entry.tsx`**

Заменить содержимое `apps/client/src/app/entry.tsx` на:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import './assets/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```
(Конфигурирование `httpClient` переезжает в composition root, Task 7; в рантайме оно подключается в Фазе 2. Текущая главная страница запросов не делает.)

- [ ] **Step 6: Запустить тесты и typecheck**

Run: `pnpm --filter client test httpClient && pnpm --filter client typecheck`
Expected: тесты PASS (6), typecheck без ошибок (нет висящих импортов `initHttp`).

- [ ] **Step 7: Формат и коммит**

```bash
pnpm format
git add apps/client/src/common/utilities/httpClient.ts apps/client/src/common/utilities/httpClient.test.ts apps/client/src/app/entry.tsx
git commit -m "feat(client): httpClient refresh-on-401 + drop localStorage token"
```

---

### Task 5: Auth-API клиент

**Files:**
- Create: `apps/client/src/modules/Auth/api/authApi.ts`
- Test: `apps/client/src/modules/Auth/api/authApi.test.ts`

**Interfaces:**
- Consumes: `authResponseSchema`, типы `AuthResponse`, `LoginBody`, `RegisterBody` из `@wordforge/shared`
- Produces:
  - `type HttpPort = { post: (path: string, body?: unknown) => Promise<unknown> }`
  - `createAuthApi(http: HttpPort): AuthApi`
  - `type AuthApi = { register(body: RegisterBody): Promise<AuthResponse>, login(body: LoginBody): Promise<AuthResponse>, refresh(): Promise<AuthResponse>, logout(): Promise<void> }`

- [ ] **Step 1: Написать падающий тест `authApi.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createAuthApi } from './authApi'

describe('createAuthApi', () => {
  it('posts credentials to /auth/login and parses accessToken', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok' }))
    const api = createAuthApi({ post })

    const result = await api.login({ email: 'a@b.co', password: 'x' })

    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.co',
      password: 'x',
    })
    expect(result).toEqual({ accessToken: 'tok' })
  })

  it('registers via /auth/register', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok' }))
    const api = createAuthApi({ post })

    await api.register({ email: 'a@b.co', password: 'passw0rd' })

    expect(post).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.co',
      password: 'passw0rd',
    })
  })

  it('refreshes via /auth/refresh with no body', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok2' }))
    const api = createAuthApi({ post })

    const result = await api.refresh()

    expect(post).toHaveBeenCalledWith('/auth/refresh')
    expect(result.accessToken).toBe('tok2')
  })

  it('rejects when the response shape is invalid', async () => {
    const post = vi.fn(async () => ({ nope: true }))
    const api = createAuthApi({ post })

    await expect(api.login({ email: 'a@b.co', password: 'x' })).rejects.toThrow()
  })

  it('logs out via /auth/logout', async () => {
    const post = vi.fn(async () => undefined)
    const api = createAuthApi({ post })

    await api.logout()

    expect(post).toHaveBeenCalledWith('/auth/logout')
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test authApi`
Expected: FAIL — `./authApi` не найден.

- [ ] **Step 3: Реализовать `authApi.ts`**

```ts
import { authResponseSchema } from '@wordforge/shared'
import type { AuthResponse, LoginBody, RegisterBody } from '@wordforge/shared'

export type HttpPort = {
  post: (path: string, body?: unknown) => Promise<unknown>
}

export type AuthApi = {
  register: (body: RegisterBody) => Promise<AuthResponse>
  login: (body: LoginBody) => Promise<AuthResponse>
  refresh: () => Promise<AuthResponse>
  logout: () => Promise<void>
}

export function createAuthApi(http: HttpPort): AuthApi {
  return {
    async register(body) {
      return authResponseSchema.parse(await http.post('/auth/register', body))
    },
    async login(body) {
      return authResponseSchema.parse(await http.post('/auth/login', body))
    },
    async refresh() {
      return authResponseSchema.parse(await http.post('/auth/refresh'))
    },
    async logout() {
      await http.post('/auth/logout')
    },
  }
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm --filter client test authApi`
Expected: PASS (5 тестов).

- [ ] **Step 5: Формат и коммит**

```bash
pnpm format
git add apps/client/src/modules/Auth/api/
git commit -m "feat(client): auth API client with response validation"
```

---

### Task 6: Auth-сервис + провайдер + публичный API модуля Auth

**Files:**
- Create: `apps/client/src/modules/Auth/auth.service.ts`
- Create: `apps/client/src/modules/Auth/auth.provider.tsx`
- Create: `apps/client/src/modules/Auth/index.ts`
- Test: `apps/client/src/modules/Auth/auth.service.test.ts`

**Interfaces:**
- Consumes: `AuthApi` (Task 5), `SessionStore`/`createSessionStore` из `@/modules/core` (Task 3), `createDi` (Task 1), `LoginBody`/`RegisterBody` из `@wordforge/shared`
- Produces (реэкспорт из `@/modules/Auth`):
  - `createAuthService(deps: { authApi: AuthApi, session: SessionStore }): AuthService`
  - `type AuthService = { signIn(body: LoginBody): Promise<void>, register(body: RegisterBody): Promise<void>, refresh(): Promise<string | null>, bootstrap(): Promise<void>, logout(): Promise<void> }`
  - `AuthServiceProvider: (props: { value: AuthService, children?: ReactNode }) => JSX.Element`
  - `useAuthService(): AuthService`
  - `createAuthApi`, типы `AuthApi`, `HttpPort`

- [ ] **Step 1: Написать падающий тест `auth.service.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from '@/modules/core'
import { createAuthService } from './auth.service'
import type { AuthApi } from './api/authApi'

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    register: vi.fn(async () => ({ accessToken: 'reg' })),
    login: vi.fn(async () => ({ accessToken: 'log' })),
    refresh: vi.fn(async () => ({ accessToken: 'ref' })),
    logout: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('createAuthService', () => {
  it('signIn stores the returned token in session', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.signIn({ email: 'a@b.co', password: 'x' })

    expect(session.token).toBe('log')
  })

  it('register stores the returned token', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.register({ email: 'a@b.co', password: 'passw0rd' })

    expect(session.token).toBe('reg')
  })

  it('bootstrap sets the token when refresh succeeds', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.bootstrap()

    expect(session.token).toBe('ref')
    expect(session.isAuthorized).toBe(true)
  })

  it('bootstrap stays guest when refresh fails', async () => {
    const session = createSessionStore()
    const authApi = fakeApi({
      refresh: vi.fn(async () => {
        throw new Error('401')
      }),
    })
    const service = createAuthService({ authApi, session })

    await service.bootstrap()

    expect(session.token).toBeNull()
    expect(session.isAuthorized).toBe(false)
  })

  it('refresh returns null on failure without throwing', async () => {
    const session = createSessionStore()
    const authApi = fakeApi({
      refresh: vi.fn(async () => {
        throw new Error('nope')
      }),
    })
    const service = createAuthService({ authApi, session })

    await expect(service.refresh()).resolves.toBeNull()
  })

  it('logout clears the session even if the request fails', async () => {
    const session = createSessionStore()
    session.setToken('tok')
    const authApi = fakeApi({
      logout: vi.fn(async () => {
        throw new Error('network')
      }),
    })
    const service = createAuthService({ authApi, session })

    await service.logout()

    expect(session.token).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test auth.service`
Expected: FAIL — `./auth.service` не найден.

- [ ] **Step 3: Реализовать `auth.service.ts`**

```ts
import type { LoginBody, RegisterBody } from '@wordforge/shared'
import type { SessionStore } from '@/modules/core'
import type { AuthApi } from './api/authApi'

export type AuthServiceDeps = {
  authApi: AuthApi
  session: SessionStore
}

export function createAuthService({ authApi, session }: AuthServiceDeps) {
  const refresh = async (): Promise<string | null> => {
    try {
      const { accessToken } = await authApi.refresh()
      session.setToken(accessToken)
      return accessToken
    } catch {
      return null
    }
  }

  return {
    async signIn(body: LoginBody) {
      const { accessToken } = await authApi.login(body)
      session.setToken(accessToken)
    },
    async register(body: RegisterBody) {
      const { accessToken } = await authApi.register(body)
      session.setToken(accessToken)
    },
    refresh,
    async bootstrap() {
      await refresh()
    },
    async logout() {
      await authApi.logout().catch(() => undefined)
      session.clear()
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
```

- [ ] **Step 4: Реализовать `auth.provider.tsx`**

```tsx
import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { AuthService } from './auth.service'

export const { Injector, useDi: useAuthService } = createDi<AuthService>()

export const AuthServiceProvider = ({
  value,
  children,
}: {
  value: AuthService
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
```

- [ ] **Step 5: Создать `Auth/index.ts`**

```ts
export { createAuthApi } from './api/authApi'
export type { AuthApi, HttpPort } from './api/authApi'
export { createAuthService } from './auth.service'
export type { AuthService } from './auth.service'
export { AuthServiceProvider, useAuthService } from './auth.provider'
```

- [ ] **Step 6: Запустить тесты и typecheck**

Run: `pnpm --filter client test auth.service && pnpm --filter client typecheck`
Expected: тесты PASS (6), typecheck без ошибок.

- [ ] **Step 7: Формат и коммит**

```bash
pnpm format
git add apps/client/src/modules/Auth/
git commit -m "feat(client): auth service + provider + module public API"
```

---

### Task 7: Composition root

**Files:**
- Create: `apps/client/src/app/composition-root.ts`
- Test: `apps/client/src/app/composition-root.test.ts`

**Interfaces:**
- Consumes: `httpClient` (Task 4), `createAuthApi`/`createAuthService`/`AuthService` (Tasks 5–6), `createSessionStore`/`SessionStore` (Task 3), `config.apiBaseUrl` из `app/config.ts`
- Produces:
  - `type AppGraph = { session: SessionStore, authService: AuthService }`
  - `createGraph(): AppGraph`
  - `configureHttp(graph: AppGraph): void` — конфигурирует `httpClient`: `getToken` из сессии, `refresh` из сервиса, `onAuthFailure` = `session.clear()`

- [ ] **Step 1: Написать падающий тест `composition-root.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/common/utilities/httpClient'
import { configureHttp, createGraph } from './composition-root'

const fetchMock = vi.fn()

function res(status: number, body: unknown = null) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('composition root', () => {
  it('builds a graph with an unauthorized session and a working service', () => {
    const graph = createGraph()

    expect(graph.session.isAuthorized).toBe(false)
    expect(typeof graph.authService.signIn).toBe('function')
  })

  it('configureHttp wires getToken from the session', async () => {
    const graph = createGraph()
    graph.session.setToken('live-token')
    configureHttp(graph)
    fetchMock.mockResolvedValueOnce(res(200, { ok: true }))

    await httpClient.get('/cards')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer live-token',
    )
  })

  it('configureHttp wires onAuthFailure to clear the session', async () => {
    const graph = createGraph()
    graph.session.setToken('stale')
    configureHttp(graph)
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'истекло' })) // GET /cards
      .mockResolvedValueOnce(res(401, { message: 'нет' })) // POST /auth/refresh

    await expect(httpClient.get('/cards')).rejects.toThrow()

    expect(graph.session.isAuthorized).toBe(false)
  })
})
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter client test composition-root`
Expected: FAIL — `./composition-root` не найден.

- [ ] **Step 3: Реализовать `composition-root.ts`**

```ts
import { httpClient } from '@/common/utilities/httpClient'
import { createAuthApi, createAuthService } from '@/modules/Auth'
import type { AuthService } from '@/modules/Auth'
import { createSessionStore } from '@/modules/core'
import type { SessionStore } from '@/modules/core'
import { config } from './config'

export type AppGraph = {
  session: SessionStore
  authService: AuthService
}

export function createGraph(): AppGraph {
  const session = createSessionStore()
  const authApi = createAuthApi(httpClient)
  const authService = createAuthService({ authApi, session })
  return { session, authService }
}

export function configureHttp(graph: AppGraph): void {
  httpClient.configure({
    baseUrl: config.apiBaseUrl,
    getToken: () => graph.session.token,
    refresh: () => graph.authService.refresh(),
    onAuthFailure: () => graph.session.clear(),
  })
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm --filter client test composition-root`
Expected: PASS (3 теста).

- [ ] **Step 5: Формат и коммит**

```bash
pnpm format
git add apps/client/src/app/composition-root.ts apps/client/src/app/composition-root.test.ts
git commit -m "feat(client): composition root (graph + httpClient wiring)"
```

---

### Task 8: Документация + финальная проверка

**Files:**
- Modify: `docs/frontend-conventions.md` (расположение DI-хелперов + заметка DI vs синглтоны)

**Interfaces:** нет (только доки + прогон всего пакета).

- [ ] **Step 1: Обновить `docs/frontend-conventions.md`**

В секцию про MobX/сторы (после «Размещение сторов») добавить абзац:
```markdown
### DI вместо синглтонов

Для сторов/сервисов с зависимостями используем DI, а не module-scope синглтоны
(`export const store = new Store()`): фабрика `createX(deps)` + провайдер модуля
(`createDi`) + сборка графа в composition root (`app/composition-root.ts`).
Механизм и правила — в скилле `feod-frontend`, `reference/di-and-core.md`.
DI-хелперы живут в `common/lib/react/` (`create-di`, `create-strict-context`,
`use-strict-context`), импорт прямой (без barrel).
```

- [ ] **Step 2: Прогнать весь клиентский пакет — тесты, typecheck, lint, формат**

Run:
```bash
pnpm --filter client test && pnpm --filter client typecheck && pnpm --filter client lint && pnpm format:check
```
Expected: все зелёные. Всего 7 тестовых файлов (create-di, session.store, session.provider, httpClient, authApi, auth.service, composition-root), все PASS.

- [ ] **Step 3: Коммит**

```bash
git add docs/frontend-conventions.md
git commit -m "docs(client): note DI-over-singletons and DI helper location"
```

---

## Что НЕ входит в Фазу 1 (переносится в Фазу 2 — UI и роутинг)

- `Compose` (`common/lib/react/compose-providers.tsx`) — нужен только при композиции провайдеров в рендере.
- Компоненты `AuthTabs`, `LoginForm`, `RegisterForm`; shadcn `Tabs`; loader-экран.
- Файловый роутинг TanStack (vite-plugin, `__root`, `_authenticated` + `beforeLoad`, `/auth`), миграция `pages/`.
- `app/App.tsx` (рендер, `RouterProvider` с `session` в context), вызов `configureHttp`/`bootstrap` из `App`; `onAuthFailure` → `router.navigate('/auth')`.
- Правки доков про роутинг (CLAUDE.md, conventions, `level-app`/`level-pages`).

## Self-Review (выполнено при написании плана)

- **Покрытие спеки (Фаза 1):** DI-инфра → Task 1; Session стор/провайдер/core API → Tasks 2–3; httpClient refresh-on-401 + удаление localStorage → Task 4; authApi → Task 5; authService/провайдер/Auth API → Task 6; composition root (createGraph/configureHttp) → Task 7; правки доков → Task 8. Тест-инфра → Task 1.
- **Заглушки:** нет — каждый шаг с кодом/командой и ожидаемым результатом.
- **Согласованность типов:** `SessionStore` (`token`/`isAuthorized`/`setToken`/`clear`), `AuthApi`/`AuthResponse`, `HttpPort.post`, `AuthService` (`signIn`/`register`/`refresh`/`bootstrap`/`logout`), `HttpClientConfig`, `AppGraph` — имена и сигнатуры совпадают между задачами.
