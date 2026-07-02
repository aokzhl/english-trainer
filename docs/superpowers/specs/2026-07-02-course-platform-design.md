# WordForge v2 — платформа курсов. Дизайн-спека

**Дата:** 2026-07-02
**Статус:** на согласовании
**Автор:** brainstorming-сессия

## 1. Контекст и сдвиг видения

WordForge задумывался как тренажёр английских слов (SRS-карточки для
русскоязычных). Продукт развивается в **платформу курсов**: слова становятся
одним из курсов, рядом появляется **курс по грамматике**, а ключевая новая
ценность — **проверка усвоения через ИИ**.

Пользователь на странице **«Курсы»** выбирает курс (на старте два: «3000 слов
для Intermediate» и «Грамматика»). Курсы **бесплатные** — оплаты и биллинга в
системе нет.

Реально построена на данный момент только авторизация (`users`,
`refresh_tokens`, модуль `auth`, клиентский скелет). SRS-механика из старого
REQUIREMENTS ещё не реализована — разворот делается почти с нуля, ломать
нечего.

## 2. Полное видение vs MVP

| Аспект | Полное видение | MVP |
|--------|----------------|-----|
| Типы курса | vocabulary + grammar (расширяемо) | оба |
| Грамматика: контент | все 14 глав | **первые 5 тем** |
| Грамматика: доступ | все уроки открыты | все уроки открыты |
| Грамматика: зачёт | ИИ-экзамен по теме | ИИ-экзамен по теме, без SRS |
| Словарь | весь (~3000 слов) | **весь (~3000 слов)**, SRS |
| Упражнения | гибрид: банк + генерация на лету | **только банк (заготовлено)** |
| ИИ: проверка ответов (A) | да | **да** |
| ИИ: экзамен по теме (B) | да | **да** |
| ИИ: репетитор-диалог (C) | да | нет |
| ИИ: адаптивность («плывёт» → проще/доп. вопросы) | да | нет |
| Оплата | нет (всегда бесплатно) | нет |

**Явно вне scope MVP:** адаптивный слой, генерация упражнений на лету,
репетитор-диалог (C), колоды phrasal/idioms, стриминг ответов ИИ, восстановление
пароля. Модель данных и код закладывают эти расширения, но не реализуют.

## 3. Доменная модель

Общая **оболочка** над двумя разными по «нутру» типами курса (вариант B из
брейнсторма).

- **Course** — верхнеуровневая единица обучения. Поле `type` (`vocabulary` |
  `grammar`) определяет поведение и внутренние сущности.
- **Enrollment** `(user, course)` — пользователь записан на курс; точка привязки
  общего прогресса по курсу.
- **Курс-словарь** (vocabulary): набор **карточек** (`cards`), сгруппированных по
  темам; прогресс — по системе Лейтнера (`card_progress`).
- **Курс-грамматика** (grammar): последовательность **уроков** (`lessons`), каждый
  = теория (Markdown) + **упражнения** (`exercises`) + **ИИ-экзамен** по теме.
  Прогресс урока — статус `not_started / in_progress / passed`.
- **Оболочка**: страница «Курсы», запись на курс, прогресс по каждому курсу,
  **стрик** (уже на `users`) и **дашборд**, агрегирующий оба курса.

Границы модулей (FEOD, и на клиенте, и на сервере):
`Courses` (оболочка) · `Vocabulary` (SRS) · `Grammar` (уроки/упражнения) ·
`AI` (проверка/экзамен, только сервер) · `Auth` (есть) · `Stats` (дашборд/стрик).

## 4. Модель данных (Drizzle / PostgreSQL)

> **СУБД:** PostgreSQL (решение — делаем сразу под продакшен). Диалект Drizzle
> `pg-core`, драйвер `postgres.js`. Прод и локальная разработка —
> **self-hosted Postgres в Docker** (`docker-compose`; на проде — VPS), тесты —
> **PGlite** (встроенный Postgres в процессе, сохраняет схему «свежая БД на
> тест-файл»). Проект учебный (прод-грейд ради практики бэкенда/инфры,
> единственный пользователь — автор), поэтому managed БД сознательно не
> используем — DB-ops практикуем сами. Типы колонок
> ниже показаны обобщённо (`TEXT/INT`); в Postgres маппятся на
> `varchar/text/integer/serial/timestamptz/boolean/jsonb`. Существующий модуль
> `auth` мигрируется с SQLite на Postgres заодно (он маленький).

Auth-таблицы (`users`, `refresh_tokens`) — без изменений по составу полей. Новые
таблицы:

```
courses
  id, slug UNIQUE, type TEXT,           -- 'vocabulary' | 'grammar'
  title, description, "order" INT, created_at

enrollments
  id, user_id → users, course_id → courses,
  enrolled_at,  UNIQUE(user_id, course_id)

-- vocabulary --
cards
  id, course_id → courses,
  deck TEXT,                             -- 'words' (задел: phrasal|idioms)
  en TEXT, ru TEXT, example TEXT NULL,
  cefr TEXT,                             -- A1..C2 (для этой книги ≈ B1/B2)
  topic TEXT,                            -- 'Appearance', 'Transport'...
  subtopic TEXT NULL,                    -- 'Body Shape', 'First Impression'
  note TEXT NULL,                        -- стилистическая пометка из книги
  synonyms TEXT NULL,                    -- через запятую
  antonyms TEXT NULL,                    -- через запятую
  owner_id → users NULL,                 -- NULL = встроенная (seed)
  created_at

card_progress
  user_id → users, card_id → cards,
  level INT DEFAULT 0,                   -- 0..6, 6 = выучено
  due_at TEXT, hidden INT DEFAULT 0,
  PRIMARY KEY (user_id, card_id)

-- grammar --
lessons
  id, course_id → courses, "order" INT,
  slug, title, theory_md TEXT, created_at

exercises
  id, lesson_id → lessons, "order" INT,
  type TEXT,                             -- см. ниже
  prompt TEXT,
  payload TEXT NULL,                     -- JSON: варианты / токены и т.п.
  answer TEXT,                           -- эталон (строка или JSON)
  ai_checked INT DEFAULT 0               -- 0 = автопроверка, 1 = проверяет ИИ

exercise_attempts
  id, user_id → users, exercise_id → exercises,
  user_answer TEXT, correct INT, feedback TEXT NULL, created_at

lesson_progress
  user_id → users, lesson_id → lessons,
  status TEXT DEFAULT 'not_started',     -- not_started|in_progress|passed
  exam_passed INT DEFAULT 0,
  exam_feedback TEXT NULL, updated_at,
  PRIMARY KEY (user_id, lesson_id)

exam_attempts  (опционально, для истории/аудита)
  id, user_id, lesson_id, questions_json TEXT, verdict_json TEXT, created_at
```

**Типы упражнений** (`exercises.type`):
- Автопроверяемые (`ai_checked = 0`): `fill_blank`, `multiple_choice`,
  `reorder` — сверка нормализованной строки/выбора.
- Проверяемые ИИ (`ai_checked = 1`): `translate`, `correct_error` — вердикт ИИ.

## 5. Контракт (`@wordforge/shared`) и API

Схемы Zod и типы DTO — единый источник правды; сервер валидирует, клиент типизует
и переиспользует в RHF. Новые файлы: `courses.ts`, `cards.ts`, `lessons.ts`,
`exercises.ts`, `ai.ts`. Константы: `CEFR`, `DECKS`, `EXERCISE_TYPES`,
`SRS_INTERVALS` (сразу→1→2→4→7→15→30), `EXAM_PASS_THRESHOLD`.

```
--- оболочка ---
GET  /api/courses                      список курсов + прогресс пользователя
POST /api/courses/:slug/enroll         записаться
GET  /api/stats                        дашборд: по курсам, стрик, счётчики

--- vocabulary ---
GET  /api/courses/:slug/cards          словарь с прогрессом (?topic=&status=&search=&sort=&order=)
GET  /api/courses/:slug/session        SRS-сессия (due + новые), ?topic=&size=15
POST /api/review                       {card_id, known} → SRS-уровень + стрик

--- grammar ---
GET  /api/courses/:slug/lessons        уроки + статусы
GET  /api/lessons/:id                  теория + упражнения
POST /api/lessons/:id/exercises/:eid/attempt   {answer} → {correct, feedback}
POST /api/lessons/:id/exam             {answers?} → генерация/проверка ИИ-экзамена
```

Ответы об ошибке — `{ message: string }` с русским текстом (как в текущем
`httpClient`). Все `/api/*`, кроме auth, требуют access-JWT.

## 6. ИИ-интеграция (сервер; MVP = A + B)

- **Только на сервере.** Ключ API не покидает бэкенд. Новый модуль
  `apps/server/src/modules/ai` с интерфейсом `AiClient`.
- **Провайдер — Claude** (Anthropic SDK). Точная модель и цена пиннятся при
  реализации (через справку `claude-api`): дешёвая модель на проверку ответов,
  более сильная — на экзамен. Модель и ключ — через `app/config.ts` (env).
- **A. Проверка ответа** (`ai_checked` упражнения): вход — `{prompt, reference,
  userAnswer}`, выход — `{correct: boolean, explanation_ru: string, hint?:
  string}`. Структурированный ответ, валидируется Zod, при несоответствии —
  повтор.
- **B. Экзамен по теме:** ИИ по теории урока генерирует несколько вопросов,
  оценивает ответы, возвращает `{passed: boolean, feedback: string, perQuestion:
  [...]}`. Request/response, без стриминга. Порог сдачи — `EXAM_PASS_THRESHOLD`.
- **Инъекция для тестов.** `AiClient` декорируется на `app` (как `app.db`).
  `buildApp({ db, aiClient })` позволяет подменить фейковым детерминированным
  клиентом; реальные вызовы к Claude в тестах не идут. (В Фундаменте `buildApp`
  уже принимает готовый `db`, а не `dbPath` — тот же паттерн инъекции для
  `aiClient`.)
- **Задел (не в MVP):** адаптивность (серия ошибок → упрощённое объяснение +
  2–3 доп. вопроса под слабое место), генерация упражнений на лету, репетитор-
  диалог (C). Интерфейс `AiClient` проектируется так, чтобы эти методы
  добавлялись, не ломая существующие.

## 7. Пайплайн контента (seed)

- **Словарь:** `docs/source/words-3000-intermediate.md` → структурированный seed
  (`topic/subtopic/en/ru/synonyms/note`, `cefr` ≈ B1/B2, `deck='words'`).
  Конвертация — субагентами на дешёвой модели, по темам; результат — вычитывается.
- **Грамматика (5 тем):** главы 1–5 из `docs/source/grammar-2.0.md` → записи
  уроков (`theory_md`) + **банк упражнений** ~10–15 на урок (сгенерировать по
  теории, вычитать), с эталонными ответами и флагом `ai_checked`.
- Seed кладётся в `apps/server/src/db/seed-data.ts`, заливается идемпотентно;
  пополнение словаря/уроков — без изменения кода.

## 8. Влияние на существующее

- **REQUIREMENTS.md переписывается в v2** (платформа курсов). Раздел про SRS
  сохраняется как механика курса-словаря. Auth-раздел — без изменений.
- **Код:** добавляются модули `Courses/Vocabulary/Grammar/AI/Stats` (сервер и
  клиент по FEOD), новые таблицы и миграции, схемы в `@wordforge/shared`.
  Бизнес-логика `auth` не меняется, но **слой БД мигрирует с SQLite на Postgres**
  (`db/schema.ts`, `db/client.ts`, тесты).
- **СУБД → PostgreSQL** (см. раздел 4): driver `postgres.js`, диалект `pg-core`,
  `docker-compose` для dev, PGlite для тестов, **self-hosted Postgres в Docker
  на VPS** в проде. Уходит native-build gotcha `better-sqlite3`.
- **CLAUDE.md** обновляется под Postgres (разделы про SQLite/`better-sqlite3` и
  схему тестов) — в рамках итерации «Фундамент».
- **Инфраструктура — отдельный полноценный под-проект** (учебная цель: практика
  инфры/систем-дизайна). Self-hosted на VPS: Dockerfile'ы приложения,
  `docker-compose.prod`, reverse-proxy + TLS (Caddy), CI/CD автодеплой,
  бэкапы Postgres + restore-драйлы, наблюдаемость (structured logs + метрики).
  В итерации «Фундамент» — только БД-фундамент (Postgres, миграции, env,
  docker-compose, PGlite); прод-деплой — свой под-проект.
- **ADR** (`docs/adr/`) — короткие записи ключевых решений (БД, инфра, границы
  модулей) для практики систем-дизайна.
- Роуты клиента (TanStack, code-based): `/`, `/courses`, `/courses/$slug`
  (словарь или список уроков по типу), `/lessons/$id`, `/session`, `/dashboard`.

## 9. Тестирование

Integration-first, как в проекте: `vitest` + `app.inject()` против свежего
**PGlite** (встроенный Postgres) на файл теста — сохраняет быстрый детерминизм
без внешнего Postgres в CI. ИИ-клиент замокан (детерминированные вердикты).
Покрываем: запись на курс, SRS-переходы уровней и стрик, автопроверку
упражнений, ИИ-проверку (через фейк), сдачу/провал экзамена, агрегаты дашборда.

## 10. Открытые вопросы к этапу реализации

- Пин конкретных моделей Claude и оценка стоимости запроса (через `claude-api`).
- Формат хранения сгенерированных вопросов экзамена (persist `exam_attempts` или
  нет) — влияет на воспроизводимость/аудит.
- Нормализация ответов автопроверки (регистр, пунктуация, синонимичные варианты).
```
