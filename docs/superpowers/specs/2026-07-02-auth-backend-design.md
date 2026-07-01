# Auth-бекенд WordForge — дизайн

Дата: 2026-07-02. Статус: утверждено пользователем (дизайн-сессия в Claude Code).

Первая фаза `apps/server`: регистрация, вход, продление и завершение сессии.
Базируется на REQUIREMENTS.md (разделы 4, 5.2–5.4); отклонения от REQUIREMENTS
отмечены явно.

## Решения, принятые в брейншторме

| Вопрос | Решение |
|--------|---------|
| Жизненный цикл сессии | Access-JWT 15 минут + refresh-токен 30 дней с ротацией |
| Хранение refresh | httpOnly-cookie (`path=/api/auth`, `sameSite=lax`, `secure` в prod) |
| Политика пароля | Минимум 8 символов, хотя бы одна буква и одна цифра |
| Refresh-механика | Stateful: таблица `refresh_tokens`, ротация на каждый refresh, отзыв при logout |

## Архитектура

Новый пакет `apps/server` (Fastify + TypeScript, структура FEOD-backend):

```
apps/server/src/
├── app/            # buildApp(): инстанс Fastify, плагины (@fastify/jwt, @fastify/cookie),
│                   # config из env, подключение Drizzle, регистрация роутов; entry.ts — listen
├── routes/         # auth.ts — тонкие обработчики: Zod-валидация + вызов modules/auth
├── middlewares/    # requireAuth.ts — проверка access-JWT (Authorization: Bearer)
├── modules/
│   └── auth/       # бизнес-логика: register, login, rotateRefresh, logout
├── db/             # schema.ts (Drizzle), client.ts, миграции drizzle-kit
└── globals/
```

- Конфиг из env, читается только в `app/config.ts`: `JWT_SECRET` (dev-дефолт),
  `PORT` (3001), `DB_PATH`.
- Клиенту добавляется dev-прокси `/api → http://localhost:3001` в vite.config —
  фронт и API same-origin, CORS не нужен.
- Роуты тонкие: парсинг/валидация запроса Zod-схемами из `@wordforge/shared`,
  вызов функции модуля, маппинг результата в HTTP-ответ.

## Данные (Drizzle, SQLite)

`users` — по схеме REQUIREMENTS 5.3: `id`, `email` (unique, хранится в lowercase),
`password_hash`, `created_at`, `streak`, `last_study_day`.

`refresh_tokens` (новая таблица):

| Колонка | Тип | Примечание |
|---------|-----|-----------|
| id | integer PK | |
| user_id | FK → users.id | cascade delete |
| token_hash | text | sha256 от сырого токена; сырой токен в БД не хранится |
| expires_at | text (ISO) | created_at + 30 дней |
| created_at | text (ISO) | |

## Токены

- **Access:** JWT через `@fastify/jwt`, payload `{ sub: <userId> }`, TTL 15 минут.
  Клиент передаёт в `Authorization: Bearer <token>`.
- **Refresh:** НЕ JWT — 32 случайных байта (`crypto.randomBytes`, base64url).
  Живёт в httpOnly-cookie. На `/auth/refresh` ротация: старая запись удаляется,
  создаётся новая, выдаётся новый access. Просроченные/неизвестные токены → 401.
- **Logout:** удаление записи из `refresh_tokens` + очистка cookie.
- **Пароли:** bcrypt, cost 10.

## API

Все ответы с токеном содержат `{ accessToken }`.
Отклонение от REQUIREMENTS 5.4 (там `{token}`): требования писались до выбора
refresh-схемы, имя `accessToken` отражает наличие второго токена.

| Эндпоинт | Запрос | Успех | Ошибки |
|----------|--------|-------|--------|
| POST /api/auth/register | `{email, password}` | 201 `{accessToken}` + refresh-cookie | 400 валидация; 409 email занят |
| POST /api/auth/login | `{email, password}` | 200 `{accessToken}` + refresh-cookie | 400; 401 (одно сообщение и для неизвестного email, и для неверного пароля) |
| POST /api/auth/refresh | refresh-cookie | 200 `{accessToken}` + новый refresh-cookie | 401 токен неизвестен/просрочен |
| POST /api/auth/logout | refresh-cookie | 204, cookie очищена | — (идемпотентен) |

Контракт в `@wordforge/shared`: Zod-схемы `registerBodySchema`, `loginBodySchema`
(email + политика пароля), `authResponseSchema`; типы выводятся из схем.
Клиент позже переиспользует их в RHF через zodResolver.

## Обработка ошибок

Единый формат тела ошибки: `{ message: string }` — его уже ожидает
`httpClient` клиента. Коды: 400 (Zod-валидация, детали первой ошибки в message),
401 (креды/токены), 409 (дубль email). Сообщения — на русском.

## Тестирование

- Vitest, интеграционные тесты через `app.inject()` (без реального порта).
- Каждому тест-файлу — своя SQLite (файл в tmp), миграции применяются в setup.
- TDD (RED → GREEN → REFACTOR). Сценарии:
  - регистрация: успех; дубль email → 409; слабый пароль → 400;
  - логин: успех; неверный пароль / неизвестный email → 401 с одинаковым message;
  - refresh: успех с ротацией; повторное использование старого токена → 401;
    просроченный → 401;
  - logout: 204, refresh после logout → 401;
  - requireAuth: без токена / с мусорным / с просроченным → 401; с валидным → 200
    (проверяется на тестовом защищённом роуте).
- В turbo.json добавляется таска `test`; `pnpm test` в корне гоняет тесты воркспейса.

## Вне скоупа этой фазы

Восстановление пароля, подтверждение email, rate limiting, детект повторного
использования отозванных refresh-токенов (token reuse detection), интеграция
authStore на клиенте — отдельные работы.
