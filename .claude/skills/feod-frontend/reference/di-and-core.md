# DI через React-контекст и модуль core

Как в этом проекте внедряются зависимости в сторы/сервисы и как устроен слой
фундаментальных модулей `modules/core`. Это конкретная реализация принципа IoC
из `level-modules.md` — используй её по умолчанию для сторов и сервисов.

## Зачем DI (а не синглтоны)

- **Тестируемость.** Стор/сервис создаётся фабрикой `createX(deps)`; в тесте
  передаём фейковые зависимости, без глобального состояния между тестами.
- **Явные зависимости.** Что нужно модулю — видно в сигнатуре фабрики, а не
  прячется в импортах внутренностей.
- **Слабая связанность.** Конкретную реализацию (api-клиент, флаги окружения)
  внедряет `app` в composition root, модуль о ней не знает.
- **Одна реализация на дерево.** Инстанс живёт в React-контексте, а не в
  module-scope синглтоне — нет «протекания» между окружениями/тестами.

## Три кирпича DI — `common/lib/react`

Однофайловые common-сущности без бизнес-логики. Barrel-файла нет, импорт прямой.

### 1. Строгий контекст

```typescript
// common/lib/react/create-strict-context.ts
import { createContext } from 'react'

export const createStrictContext = <T>() => createContext<T | null>(null)
```

```typescript
// common/lib/react/use-strict-context.ts
import { useContext, type Context } from 'react'

export const useStrictContext = <T>(context: Context<T | null>): T => {
  const value = useContext(context)
  if (value === null) throw new Error('Пустое значение контекста')
  return value
}
```

Контекст стартует с `null`; чтение вне провайдера — громкая ошибка, а не
молчаливый `undefined`. Это фича: забыл обернуть — узнаешь сразу.

### 2. `createDi<T>()` — контекст + хук одним вызовом

```typescript
// common/lib/react/create-di.ts
import { createStrictContext } from './create-strict-context'
import { useStrictContext } from './use-strict-context'

export const createDi = <T>() => {
  const injector = createStrictContext<T>()
  const useDi = () => useStrictContext(injector)
  return { Injector: injector.Provider, useDi }
}
```

### 3. `Compose` — плоская композиция провайдеров

```tsx
// common/lib/react/compose-providers.tsx
import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'

type WrapperElement = ReactElement<{ children?: ReactNode }>
type ComposeProps = { children: [...WrapperElement[], ReactNode] }

export const Compose = ({ children }: ComposeProps) => {
  const items = Children.toArray(children)
  const lastChild = items.pop()
  return items.reduceRight<ReactNode>(
    (acc, wrapper) =>
      isValidElement(wrapper)
        ? createElement(wrapper.type, wrapper.props, acc)
        : acc,
    lastChild,
  )
}
```

Избавляет от лестницы `<A><B><C>...`. Порядок = вложенность: провайдер выше
в списке — внешний, его значение доступно всем нижним.

## Фабрика стора/сервиса

Стор/сервис — **фабрика** `createX(deps)`, а НЕ module-scope синглтон
(`export const store = new Store()` — так больше не делаем для сторов с
зависимостями). Тип выводим из фабрики.

```typescript
// modules/core/modules/auth/session/session.store.ts
import { makeAutoObservable } from 'mobx'
import type { Session } from './session.types'

export function createSessionStore() {
  return makeAutoObservable({
    session: null as Session | null,
    get isAuthorized() {
      return this.session !== null
    },
    get user() {
      return this.session?.user ?? null
    },
    setSession(value: Session) {
      this.session = value
    },
    setToken(token: string) {
      if (this.session) this.session.token = token
    },
    clearSession() {
      this.session = null
    },
  })
}

export type SessionStore = ReturnType<typeof createSessionStore>
```

Сервис с зависимостями получает их объектом-параметром — это точка IoC:

```typescript
// modules/core/modules/auth/auth.service.ts
import type { AuthApi } from './repository/auth.api'
import type { Session } from './session/session.types'

type AuthServiceDeps = {
  authApi: AuthApi
  setSession: (value: Session) => void
}

export function createAuthService({ authApi, setSession }: AuthServiceDeps) {
  return {
    async signIn(payload: SignInPayload) {
      const { accessToken, user } = await authApi.login(payload)
      setSession({ user, token: accessToken })
    },
    // register, ...
  }
}

export type AuthService = ReturnType<typeof createAuthService>
```

Тело стора — по стеку проекта (MobX): `makeAutoObservable` на объекте или
класс + `new` внутри фабрики. Детали конвенций стора — `docs/frontend-conventions.md`.

## Провайдер модуля — `x.provider.tsx`

Каждый стор/сервис получает свой провайдер: `createDi` даёт контекст и хук,
`useState(() => createX(deps))` создаёт инстанс один раз.

```tsx
// modules/core/modules/auth/session/session.provider.tsx
import { useState, type ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import { createSessionStore, type SessionStore } from './session.store'

export const { Injector, useDi: useSessionStore } = createDi<SessionStore>()

export const SessionProvider = ({ children }: { children?: ReactNode }) => {
  const [sessionStore] = useState(() => createSessionStore())
  return <Injector value={sessionStore}>{children}</Injector>
}
```

Провайдер, зависящий от других единиц, берёт **внешние** зависимости пропсами,
а **родительские сторы** — через их хук (провайдер-родитель стоит выше в дереве):

```tsx
// modules/core/modules/auth/auth.provider.tsx
export const { Injector, useDi: useAuthService } = createDi<AuthService>()

export const AuthServiceProvider = ({
  children,
  authApi, // внешняя реализация — внедряет app
}: {
  children: ReactNode
  authApi: AuthApi
}) => {
  const { setSession } = useSessionStore() // родительский стор из ancestor-провайдера
  const [authService] = useState(() => createAuthService({ authApi, setSession }))
  return <Injector value={authService}>{children}</Injector>
}
```

## Composition root — `app/app.provider.tsx`

`app` — единственное место, где известны конкретные реализации. Он собирает
провайдеры в порядке зависимостей и внедряет реализации (api-клиент, флаги):

```tsx
// app/app.provider.tsx
import { Compose } from '@/common/lib/react/compose-providers'
import { ThemeProvider } from '@/common/theme/theme.provider'
import { SessionProvider } from '@/modules/core'

export const AppProvider = ({ children }: { children: ReactNode }) => (
  <Compose>
    <SessionProvider />
    <ThemeProvider />
    {children}
  </Compose>
)
```

Направление импортов соблюдено: `app → modules → common`. Модули объявляют
контракты (`AuthApi`, тип deps), `app` подставляет реализации. `ThemeProvider`
берётся из `common`, а не из `core` — см. ниже «Когда НЕ в core, а в common».

## Использование в компоненте

Компонент тонкий: берёт стор/сервис хуком и оборачивается в `observer`.

```tsx
import { observer } from 'mobx-react-lite'
import { useSessionStore } from '@/modules/core'

export const UserBadge = observer(() => {
  const session = useSessionStore()
  if (!session.isAuthorized) return null
  return <span>{session.user?.email}</span>
})
```

## Тестирование

Два пути, оба без глобального состояния:

- **Юнит-тест логики** — вызвать фабрику напрямую с фейковыми deps:
  ```typescript
  const store = createAuthService({ authApi: fakeApi, setSession: vi.fn() })
  ```
- **Тест компонента** — отрендерить под провайдером с подставленной зависимостью:
  ```tsx
  render(
    <SessionProvider>
      <AuthServiceProvider authApi={fakeApi}>
        <ComponentUnderTest />
      </AuthServiceProvider>
    </SessionProvider>,
  )
  ```

## Правила DI (нарушать нельзя)

1. Один провайдер на стор/сервис; инстанс создаётся в `useState(() => ...)`.
2. Зависимости входят через параметр фабрики (внешние — пропсами провайдера,
   родительские сторы — через их `useDi`-хук). Прямых импортов чужих
   внутренностей нет.
3. Чтение контекста вне провайдера — ошибка (строгий контекст). Не «чинить»
   дефолтным значением.
4. Конкретные реализации известны только `app` (composition root). Модуль
   знает интерфейс, не реализацию.

---

# Модуль core — фундаментальные модули

## Что это

`modules/core` — модуль, чей `index.ts` реэкспортирует **подмодули-фундаменты**:
кросс-сквозную инфраструктуру, от которой зависят другие модули и `app`.

```
modules/core/
├── index.ts                 # реэкспорт публичного API подмодулей
└── modules/                 # фрактальность: core — модуль с подмодулями
    ├── auth/                # + session/ (стор сессии), формы, api, routes
    ├── feature-flags/
    └── i18n/
```

```typescript
// modules/core/index.ts
export * from './modules/auth'
export * from './modules/feature-flags'
export * from './modules/i18n'
```

## Критерий «класть в core»

Единица относится к `core`, если:

- это кросс-сквозная инфраструктура (сессия, i18n, флаги);
- от неё зависят другие (прикладные) модули и/или `app`;
- она **сама НЕ зависит от прикладных модулей** (иначе это не фундамент);
- её **НЕ нужно** потреблять из `common` (иначе — см. следующий раздел).

`session` — каноничный пример: токен и `user`, на которые смотрят все остальные
модули, но сам он не знает ни про один прикладной модуль.

## Когда НЕ в core, а в common

Ключевое ограничение: `common` **не может импортировать из `modules`** (импорт
вверх по цепочке `app → pages → modules → common` запрещён). Поэтому если
кросс-сквозную единицу должны **читать common-сущности** (например,
`common/ui`-компоненты), её нельзя держать в `core` — её кладут в `common`.

Каноничные примеры — **тема** (`theme`) и **менеджер диалогов**
(`dialog-manager`): базовые UI-компоненты в `common/ui` хотят знать текущую тему
или открыть диалог, а тянуть их из `modules/core` им нельзя. Значит стор + провайдер
живут в `common` (напр. `common/theme/theme.store.ts` + `theme.provider.tsx` через
`common/lib/react/create-di`), а `app` создаёт инстанс в composition root и
прокидывает его в провайдер пропсом `value` — как для core-сторов.

Правило: **потребитель из `common` → сущность в `common`; потребитель только из
`modules`/`app` → сущность в `core`.**

## Это фрактальность, а не новый слой

`core` — обычный модуль уровня `modules/` со своими подмодулями, а НЕ шестой
горизонтальный слой. Мы масштабируемся вложенностью модулей, как требует FEOD,
и не плодим новые уровни в цепочке `app → pages → modules → common`.

## Правила доступа

- Снаружи в `core` — только через `modules/core/index.ts` (или напрямую в
  подмодуль по правилам сквозного модуля, если так организован публичный API).
- `core` (и его подмодули) **не импортирует прикладные модули** — только
  `common`, другие core-подмодули и общий контракт `@wordforge/shared`.
- Публичный API сессии (`SessionProvider`, `useSessionStore`, тип `Session`)
  экспортируется наружу через `core/index.ts`.

## Сессия внутри core

`core/modules/auth/session/`:

- `session.store.ts` — `createSessionStore()` (см. пример выше);
- `session.provider.tsx` — `SessionProvider` + `useSessionStore`;
- `session.types.ts` — тип `Session` (`{ user, token }`).

`SessionProvider` ставится **самым верхним** в composition root — его значение
нужно и http-интеграции (взять токен), и приватным маршрутам, и всем модулям.
Токен из сессии `app` прокидывает в `httpClient` через IoC
(`getToken: () => sessionStore.session?.token ?? null`), заменяя временное
хранение токена в `localStorage` из `app/integrations/http.ts`.
