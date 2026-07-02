# Auth-фронтенд WordForge — дизайн

Дата: 2026-07-02. Статус: черновик на ревью пользователя (дизайн-сессия в Claude Code).

Первая фаза `apps/client`: авторизация (вход, регистрация, выход, восстановление
сессии) поверх собственного DI. Базируется на бэкенд-контракте
(`docs/superpowers/specs/2026-07-02-auth-backend-design.md`), схемах
`@wordforge/shared` и DI-паттерне из скилла `feod-frontend`
(`reference/di-and-core.md`).

Это первая работа с фронтендом фичи — вместе с ней вводятся и фиксируются:
свой DI (контейнер через React-контекст), слой `modules/core`, и **файловый
роутинг** TanStack (замена нынешнего code-based).

## Решения, принятые в брейншторме

| Вопрос | Решение |
|--------|---------|
| Механизм DI | Свой: `createDi` (строгий контекст) + фабрики `createX(deps)` + composition root. Библиотеку (inversify/tsyringe) не тянем |
| Создание графа | Composition root в `app` строит `session`/`authService`, конфигурирует `httpClient`; провайдеры отдают готовые инстансы |
| Хранение access-токена | Только в памяти (`sessionStore.token`). На диск не пишем |
| Восстановление сессии | Silent refresh на старте (POST `/auth/refresh` по refresh-cookie) до рендера роутера |
| Обработка 401 | Refresh-on-401 + повтор запроса в `httpClient` (single-flight); провал → clear + redirect `/auth` |
| Разложение модулей | `modules/core/modules/Session` (фундамент) + `modules/Auth` (формы, api, service, страницы) |
| Профиль пользователя | Вне скоупа: бэкенд отдаёт только `{ accessToken }`, `/me` нет. `Session = { token }`, `isAuthorized = !!token` |
| Роутинг | Файловый (TanStack router-plugin); `routesDirectory` = FEOD-слой `pages/` |
| Защита маршрутов | `beforeLoad` в pathless layout-роуте `_authenticated`, `session` в router context |
| Экран auth | Один маршрут `/auth` с табами Вход/Регистрация |

## DI-инфраструктура (`common/lib/react`)

Три однофайловые common-сущности (без barrel, импорт прямой) — как в
`reference/di-and-core.md`:

- `create-strict-context.ts` — `createContext<T | null>(null)`;
- `use-strict-context.ts` — `useStrictContext`, кидает при `null`;
- `create-di.ts` — `createDi<T>() → { Injector, useDi }`;
- `compose-providers.tsx` — `Compose` для плоской композиции провайдеров.

## Модули

### `modules/core/modules/Session` — фундамент

```
Session/
├── session.store.ts     # createSessionStore(): token в памяти + isAuthorized/setToken/clear
├── session.provider.tsx # SessionProvider (value pass-through) + useSessionStore
├── session.types.ts     # Session = { token: string }
└── index.ts             # SessionProvider, useSessionStore, тип SessionStore, Session
```

`core/index.ts` реэкспортирует `Session`. Стор — MobX (`makeAutoObservable`):

```typescript
export function createSessionStore() {
  return makeAutoObservable({
    token: null as string | null,
    get isAuthorized() { return this.token !== null },
    setToken(token: string) { this.token = token },
    clear() { this.token = null },
  })
}
export type SessionStore = ReturnType<typeof createSessionStore>
```

`core` не импортирует прикладные модули.

### `modules/Auth` — фича

```
Auth/
├── api/authApi.ts       # createAuthApi(http): register/login/refresh/logout; ответы валидируются authResponseSchema
├── auth.service.ts      # createAuthService({ authApi, session }): signIn/register/logout/bootstrap/refresh
├── auth.provider.tsx    # AuthServiceProvider (value pass-through) + useAuthService
├── components/
│   ├── AuthTabs.tsx     # Tabs (shadcn) Вход/Регистрация; проп onSuccess
│   ├── LoginForm.tsx    # RHF + zodResolver(loginBodySchema)
│   └── RegisterForm.tsx # RHF + zodResolver(registerBodySchema)
└── index.ts             # AuthServiceProvider, useAuthService, AuthTabs, тип AuthService
```

`Auth` зависит от `core` только через публичный API (`useSessionStore` внутри
composition root; в рантайме сервис получает `session` как deps-параметр).

## Composition root и bootstrap (`app`)

`app` — единственное место, где известны конкретные реализации. Он строит граф,
конфигурирует не-React `httpClient`, выполняет silent refresh и лишь затем
рендерит роутер.

```
app/
├── composition-root.ts  # createGraph(): { session, authService }; configureHttp(graph)
├── App.tsx              # useState(createGraph); эффект: configureHttp + bootstrap; loader → RouterProvider
├── router.ts            # createRouter({ routeTree, context: { session: undefined! } }) + Register-типизация
└── integrations/http.ts # заменяется: getToken из session, credentials:'include', refresh/onAuthFailure
```

Поток инициализации:

1. `App` один раз строит граф (`createGraph`), кладёт в `useState`.
2. Эффект: `configureHttp(graph)` (см. ниже) → `graph.authService.bootstrap()`.
3. Пока bootstrap в полёте — `LoaderScreen`; после — рендер
   `<AppProvider graph><RouterProvider router context={{ session: graph.session }} /></AppProvider>`.
4. `AppProvider` = `Compose` из `SessionProvider value={graph.session}` +
   `AuthServiceProvider value={graph.authService}`.

Токен в router context к моменту рендера уже разрешён → `beforeLoad` не мигает.

## httpClient — изменения

Текущий `common/utilities/httpClient.ts` расширяется. Новый конфиг:

```typescript
type HttpClientConfig = {
  baseUrl: string
  getToken: () => string | null
  refresh: () => Promise<string | null>  // новый токен или null при неудаче
  onAuthFailure: () => void              // clear session + redirect /auth
}
```

- Все запросы — `credentials: 'include'` (refresh-cookie на `/api/auth`).
- Refresh-on-401: если `status === 401`, путь не начинается с `/auth/`, и повтор
  ещё не делался — вызвать `refresh()` (single-flight: общий in-flight промис,
  чтобы параллельные 401 не устроили стампед). Успех → повтор запроса один раз с
  новым токеном. Неудача → `onAuthFailure()` и проброс `HttpError`.
- `refresh()` сам ходит в `/auth/refresh` (путь `/auth/` → не ретраится, рекурсии нет).

`configureHttp(graph)` в composition root подставляет:
`getToken: () => graph.session.token`,
`refresh: () => graph.authService.refresh()`,
`onAuthFailure: () => { graph.session.clear(); router.navigate({ to: '/auth' }) }`.

`app/integrations/http.ts` теряет `localStorage`-хранение токена (`TOKEN_KEY`,
`getAuthToken`, `setAuthToken` удаляются).

## Потоки данных

- **Вход/Регистрация:** `AuthTabs` → форма (RHF + zod-схема из shared) →
  `authService.signIn/register(body)` → `authApi` POST `/api/auth/{login,register}`
  → `{ accessToken }` → `session.setToken` → `onSuccess` → `navigate(search.redirect ?? '/')`.
  Ошибка (`HttpError.message`, русский) → `form.setError('root', { message })`.
- **Bootstrap:** `authService.bootstrap()` → `authApi.refresh()`: 200 → `setToken`;
  401/ошибка → остаёмся гостем (без токена). Всегда резолвится (не бросает).
- **401 на защищённом запросе:** обрабатывается в `httpClient` (см. выше).
- **Logout:** `authService.logout()` → POST `/api/auth/logout` → `session.clear()` →
  `navigate('/auth')`.

## Роутинг (файловый, TanStack)

Vite-плагин `@tanstack/router-plugin/vite`:
`tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/pages', generatedRouteTree: './src/routeTree.gen.ts' })`,
подключается **перед** `@vitejs/plugin-react`. `routeTree.gen.ts` — в `.gitignore`.

FEOD-реконсиляция: `pages/` остаётся тонким слоем-композитором, но файлы теперь
объявляют роуты через `createFileRoute` и делегируют модулям.

```
pages/                          # routesDirectory
├── __root.tsx                  # createRootRouteWithContext<{ session: SessionStore }>(); DefaultLayout + Outlet; notFoundComponent
├── auth.tsx                    # '/auth': validateSearch(redirect); beforeLoad — авторизованного увести на redirect; component → <AuthTabs onSuccess=navigate>
├── _authenticated.tsx          # pathless layout: beforeLoad — !context.session.isAuthorized → redirect('/auth', {redirect: location.href}); <Outlet/>
└── _authenticated/
    └── index.tsx               # '/' — защищённая главная (тонкая, композиция модулей)
```

- `router.ts` создаёт роутер с `context: { session: undefined! }`; реальный
  `session` подаётся через `<RouterProvider context>` из composition root.
- Пути — константы в `common/constants/routes.ts` (`AUTH = '/auth'`, `HOME = '/'`).
- Текущий `pages/index.tsx` переезжает в `pages/_authenticated/index.tsx`;
  `pages/[...404].tsx` заменяется `notFoundComponent` в `__root`.

## Обработка ошибок

- Клиентская валидация — zod-схемы `@wordforge/shared` (сообщения уже русские),
  через `zodResolver` в RHF.
- Серверные ошибки — `HttpError.message` (русский) в корневую ошибку формы
  (`setError('root')`). Тостов пока нет — не вводим.

## Общий контракт

Изменения в `@wordforge/shared` не нужны: переиспользуем `loginBodySchema`,
`registerBodySchema`, `authResponseSchema` (последняя валидирует ответы
login/register/refresh на клиенте).

## Тестирование

Стек клиентских тестов (добавить в `apps/client`): `vitest`,
`@testing-library/react`, `@testing-library/user-event`, `jsdom`,
`@tanstack/router-plugin` (для генерации дерева в тестовой vite-конфигурации).
TDD (RED → GREEN → REFACTOR). Сценарии:

- **DI:** `useStrictContext` вне провайдера — кидает; внутри — отдаёт значение.
- **session.store:** `setToken`/`clear`/`isAuthorized`.
- **authService** (фейковые `authApi` + `session`): login/register ставят токен;
  logout чистит; bootstrap ставит токен на 200 и остаётся гостем на 401 (не бросает).
- **httpClient refresh-on-401** (мок `fetch`): 401 → refresh → повтор с новым
  токеном; провал refresh → `onAuthFailure` + проброс; `/auth/*` не ретраится;
  single-flight (один refresh на пачку параллельных 401).
- **LoginForm/RegisterForm** (рендер под провайдерами с фейк-сервисом):
  клиентская валидация показывает ошибки; сабмит зовёт сервис; серверная ошибка
  (409/401) видна в форме.

## Документация — привести в соответствие

Файловый роутинг и DI меняют ранее задокументированные конвенции:

- `CLAUDE.md` — «Router is code-based… (not the file-based plugin)» → файловый.
- `docs/frontend-conventions.md` — секция TanStack Router (code-based, guard
  через `beforeLoad` по `authStore`) → файловый роутинг, `pages/` как
  `routesDirectory`, `session` в router context.
- Скилл `feod-frontend`: `reference/level-app.md`, `reference/level-pages.md` —
  упоминания code-based роутера → файловый.
- Синглтон-примеры (`docs/frontend-conventions.md`, `docs/module-example.md`,
  `export const store = new Store()`) — отметить, что для сторов с зависимостями
  действует DI из `reference/di-and-core.md`.
- Выбор `common/lib/react/` (а не `common/utilities/`) для DI-хелперов —
  зафиксировать в `frontend-conventions.md`.

## Зависимости (через `pnpm add --filter @wordforge/client`)

Runtime — всё нужное уже установлено (`@tanstack/react-router`,
`react-hook-form`, `@hookform/resolvers`, `mobx`, `mobx-react-lite`, `zod`).

Добавить:
- dev: `@tanstack/router-plugin`, `vitest`, `@testing-library/react`,
  `@testing-library/user-event`, `jsdom`;
- Tabs shadcn (`common/ui/tabs.tsx`) генерируется CLI и тянет `@radix-ui/react-tabs`.

Версии не вписываем руками — только `pnpm add` / shadcn CLI.

## Вне скоупа этой фазы

Профиль пользователя и `GET /me`, отображение email/стрика в шапке,
восстановление пароля, подтверждение email, «запомнить меня», тосты,
детект повторного использования refresh-токена, i18n (UI уже на русском строками).
