# Эталонный пример модуля

Адаптация официального примера FEOD (модуль UserManagement) под стек проекта
(React + TS + MobX). Использовать как образец при создании новых модулей.

## Дерево файлов

```
modules/
└── UserManagement/
    ├── components/
    │   ├── UserList.tsx
    │   ├── UserCard.tsx
    │   └── UserForm.tsx
    ├── store/
    │   └── userStore.ts
    ├── api/
    │   └── userApi.ts
    ├── types/
    │   └── user.types.ts
    ├── utils/
    │   └── formatUserName.ts
    ├── README.md
    └── index.ts
```

## types/user.types.ts

```typescript
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'user' | 'guest'
  createdAt: string
  updatedAt: string
}

export interface CreateUserDto {
  name: string
  email: string
  role: User['role']
}

export interface UpdateUserDto extends CreateUserDto {
  id: string
}
```

## api/userApi.ts

DTO и типы ответов держим рядом с API. Используем HTTP-клиент из app —
он передаётся/инициализируется через интеграцию, у модуля нет знания о JWT.

```typescript
import { http } from '@/app/... ' // ❌ НЕТ! modules не импортирует app
```

⚠️ Правильный вариант: обезличенный клиент в `common/utilities/http.ts`
(тонкая обёртка над fetch), а JWT-интерцептор и base URL конфигурируются
из app через IoC:

```typescript
// common/utilities/http.ts — обезличенная обёртка (один файл, без домена)
// modules/UserManagement/api/userApi.ts
import { http } from '@/common/utilities/http'
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types'

export const fetchUsers = () => http.get<User[]>('/users')
export const fetchUserById = (id: string) => http.get<User>(`/users/${id}`)
export const createUser = (data: CreateUserDto) => http.post<User>('/users', data)
export const updateUser = (data: UpdateUserDto) => http.put<User>(`/users/${data.id}`, data)
export const deleteUser = (id: string) => http.delete(`/users/${id}`)
```

## store/userStore.ts (MobX)

Состояние + вычисления + действия. Вся логика здесь, не в компонентах.

```typescript
import { makeAutoObservable, runInAction } from 'mobx'
import * as api from '../api/userApi'
import type { User, CreateUserDto, UpdateUserDto } from '../types/user.types'

class UserStore {
  users: User[] = []
  currentUser: User | null = null
  loading = false
  error: string | null = null

  constructor() {
    makeAutoObservable(this)
  }

  get usersCount() {
    return this.users.length
  }

  get admins() {
    return this.users.filter(u => u.role === 'admin')
  }

  async loadUsers() {
    this.loading = true
    this.error = null
    try {
      const users = await api.fetchUsers()
      runInAction(() => { this.users = users })
    } catch (e) {
      runInAction(() => { this.error = (e as Error).message })
    } finally {
      runInAction(() => { this.loading = false })
    }
  }

  async addUser(data: CreateUserDto) {
    const user = await api.createUser(data)
    runInAction(() => { this.users.push(user) })
  }

  async removeUser(id: string) {
    await api.deleteUser(id)
    runInAction(() => {
      this.users = this.users.filter(u => u.id !== id)
      if (this.currentUser?.id === id) this.currentUser = null
    })
  }
}

export const userStore = new UserStore()
```

## components/UserList.tsx

Тонкий компонент: observer + рендер + вызовы действий стора.

```tsx
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { userStore } from '../store/userStore'
import { UserCard } from './UserCard'

export const UserList = observer(() => {
  useEffect(() => {
    if (userStore.users.length === 0) void userStore.loadUsers()
  }, [])

  if (userStore.loading) return <div>Загрузка...</div>
  if (userStore.error) return <div>{userStore.error}</div>

  return (
    <ul>
      {userStore.users.map(user => (
        <UserCard key={user.id} user={user} onDelete={() => userStore.removeUser(user.id)} />
      ))}
    </ul>
  )
})
```

## components/UserForm.tsx (React Hook Form)

RHF управляет локальным состоянием полей; сабмит — действие стора.

```tsx
import { useForm } from 'react-hook-form'
import { userStore } from '../store/userStore'
import type { CreateUserDto } from '../types/user.types'

export function UserForm({ onSuccess }: { onSuccess?: () => void }) {
  const { register, handleSubmit, formState } = useForm<CreateUserDto>()

  const onSubmit = handleSubmit(async data => {
    await userStore.addUser(data)
    onSuccess?.()
  })

  return (
    <form onSubmit={onSubmit}>
      <input {...register('name', { required: true })} />
      <input {...register('email', { required: true })} type="email" />
      <button type="submit" disabled={formState.isSubmitting}>Сохранить</button>
    </form>
  )
}
```

## utils/formatUserName.ts

```typescript
import type { User } from '../types/user.types'

export const formatUserName = (user: User) => `${user.name} (${user.email})`
```

## index.ts — публичный API

Экспортируем только то, что нужно снаружи. Внутренности недоступны.

```typescript
export { UserList } from './components/UserList'
export { UserForm } from './components/UserForm'
export { userStore } from './store/userStore'
export type { User, CreateUserDto } from './types/user.types'
export { formatUserName } from './utils/formatUserName'
// API-функции наружу НЕ экспортируем — снаружи работают через store
```

## Использование на странице

```tsx
// pages/users/index.tsx
import { observer } from 'mobx-react-lite'
import { UserList, UserForm, userStore } from '@/modules/UserManagement'

export const UsersPage = observer(() => (
  <div>
    <UserForm onSuccess={() => userStore.loadUsers()} />
    <UserList />
  </div>
))
```

## Почему так (плюсы из документации FEOD)

- **Изоляция** — весь код фичи в одном месте;
- **Переиспользуемость и портативность** — модуль можно перенести в другой проект;
- **Тестируемость** — модуль тестируется независимо;
- **Ясность назначения** — по структуре видно, что делает модуль;
- **Простота масштабирования** — вырос — добавь подмодули.
