# Конвенции стека этого проекта (WordForge / english-trainer)

Как утверждённый стек (REQUIREMENTS.md, раздел 5) ложится на FEOD.
Стек: React 18 + Vite + TypeScript, MobX, TanStack Router, React Hook Form,
shadcn/ui + Tailwind CSS.

## MobX — вся логика живёт в сторах

**Правило проекта:** по умолчанию ВСЯ логика фронтенда — и бизнес
(SRS-сессия, словарь, авторизация), и UI-состояние (фильтры, сортировки,
открытые панели) — находится в MobX-сторах. React-компоненты тонкие:
рендер + вызов действий стора.

### Размещение сторов

- Стор фичи → `modules/<Feature>/store/<feature>Store.ts` — часть модуля,
  экспортируется через его `index.ts`.
- Общих «корневых» сторов вне модулей НЕ заводим. Если сторам нужно знать
  друг о друге — IoC (интерфейс + внедрение из app), не прямой импорт
  внутренностей.

### DI вместо синглтонов

Для сторов/сервисов с зависимостями используем DI, а не module-scope синглтоны
(`export const store = new Store()`): фабрика `createX(deps)` + провайдер модуля
(`createDi`) + сборка графа в composition root (`app/composition-root.ts`).
Механизм и правила — в скилле `feod-frontend`, `reference/di-and-core.md`.
DI-хелперы живут в `common/lib/react/` (`create-di`, `create-strict-context`,
`use-strict-context`), импорт прямой (без barrel).

### Шаблон стора

```typescript
// modules/Dictionary/store/dictionaryStore.ts
import { makeAutoObservable, runInAction } from 'mobx'
import { fetchCards } from '../api/dictionaryApi'
import type { Card, CardFilters } from '../types/dictionary.types'

class DictionaryStore {
  cards: Card[] = []
  loading = false
  error: string | null = null
  // UI-состояние тоже здесь:
  filters: CardFilters = { deck: 'all', cefr: null, topic: null }
  sort: 'alpha' | 'level' | 'progress' | 'date' = 'alpha'
  expandedCardId: number | null = null

  constructor() {
    makeAutoObservable(this)
  }

  async loadCards() {
    this.loading = true
    this.error = null
    try {
      const cards = await fetchCards(this.filters, this.sort)
      runInAction(() => { this.cards = cards })
    } catch (e) {
      runInAction(() => { this.error = (e as Error).message })
    } finally {
      runInAction(() => { this.loading = false })
    }
  }

  setFilter<K extends keyof CardFilters>(key: K, value: CardFilters[K]) {
    this.filters[key] = value
    void this.loadCards()
  }
}

export const dictionaryStore = new DictionaryStore()
```

### Компоненты

- Каждый компонент, читающий стор, оборачивается в `observer` из `mobx-react-lite`.
- Компонент НЕ содержит вычислений над данными — computed в сторе.
- Компонент НЕ делает запросов — действия стора.

```tsx
// modules/Dictionary/components/WordList.tsx
import { observer } from 'mobx-react-lite'
import { dictionaryStore } from '../store/dictionaryStore'

export const WordList = observer(() => (
  <ul>
    {dictionaryStore.cards.map(card => (
      <WordRow key={card.id} card={card} />
    ))}
  </ul>
))
```

## TanStack Router

- Дерево роутов собирается в `app/router.ts` (code-based routes, не файловый
  плагин — чтобы структура pages оставалась под контролем FEOD).
- Страницы лежат в `pages/` по конвенциям FEOD (`pages/dictionary/index.tsx` и т.д.).
- Модуль может экспортировать свои роуты (`modules/Auth/routes.ts` через
  `index.ts`), app подключает их в общее дерево.
- Пути маршрутов — константами в `common/constants/routes.ts`, не строками
  по месту.
- Расширения типов роутера (`Register` interface) — в `globals/router.d.ts`.
- Защита приватных маршрутов (redirect на /auth без токена) — в app через
  `beforeLoad`, проверка по `authStore` из `modules/Auth`.

## React Hook Form

- Все формы (вход/регистрация, добавление/редактирование слова) — на RHF.
- Форма — компонент модуля (`modules/Auth/components/LoginForm.tsx`);
  RHF управляет ЛОКАЛЬНЫМ состоянием полей (это исключение из правила
  «всё в MobX» — черновик полей формы не является состоянием приложения).
- Сабмит формы вызывает действие MobX-стора: `onSubmit={authStore.login}`.
- Схемы валидации — рядом с формой в модуле; общие валидаторы
  (`validateEmail`) — в `common/utilities/`.

## shadcn/ui + Tailwind

- Компоненты shadcn генерируются в `common/ui/` (настроить `components.json`:
  `"aliases": { "components": "@/common/ui", "utils": "@/common/utilities/cn" }`).
- Каждый компонент shadcn — один файл → соответствует правилам common.
  Barrel-файл для ui НЕ создавать, импорт прямой:
  `import { Button } from '@/common/ui/button'`.
- Хелпер `cn` → `common/utilities/cn.ts`.
- Тема/CSS-переменные Tailwind → `app/assets/styles.css` (глобальный стиль —
  часть настройки приложения).
- Композитные доменные компоненты поверх shadcn (например, `WordCard`) —
  в модулях, НЕ в common/ui.

## Алиасы импортов

- `@/` → `apps/client/src/` (настроено в vite.config + tsconfig).
- Общий контракт API — из пакета `@wordforge/shared` (Zod-схемы, DTO, константы).
- Импорты между уровнями — только через алиас (`@/modules/...`,
  `@/common/...`), не относительными путями «зигзагом» через уровни.
- Внутри модуля — относительные пути (`../store/...`).

## Структура apps/client/src (эталон)

```
apps/client/src/
├── app/
│   ├── entry.tsx            # createRoot + RouterProvider + init интеграций
│   ├── router.ts            # дерево роутов TanStack
│   ├── config.ts
│   ├── assets/styles.css    # Tailwind + тема shadcn
│   ├── integrations/
│   │   └── http.ts          # fetch-клиент: base URL, JWT, обработка 401
│   └── layouts/
│       └── DefaultLayout.tsx
├── pages/
│   ├── index.tsx            # главная (дашборд)
│   ├── auth.tsx             # вход/регистрация
│   ├── dictionary/index.tsx
│   ├── session/[mode].tsx   # тренировка: flash | quiz | type
│   └── [...404].tsx
├── modules/
│   ├── Auth/                # store, LoginForm, RegisterForm, api, routes, index.ts
│   ├── Training/            # store сессии SRS, Flashcard, Quiz, TypeMode, api, index.ts
│   ├── Dictionary/          # store фильтров, WordList, WordRow, WordForm, api, index.ts
│   └── Stats/               # store, StatsCards, StreakBadge, api, index.ts
├── common/
│   ├── ui/                  # shadcn: button.tsx, input.tsx, dialog.tsx...
│   ├── hooks/
│   ├── utilities/           # cn.ts, speak.ts, formatDate.ts
│   ├── constants/           # routes.ts, cefr.ts, decks.ts
│   └── types/               # api.types.ts
└── globals/
    ├── env.d.ts
    └── router.d.ts
```
