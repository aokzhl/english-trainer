import { buildApp } from '../src/app/buildApp'

type App = ReturnType<typeof buildApp>

// ':memory:' — своя изолированная in-memory БД на каждый вызов (у better-sqlite3
// она привязана к соединению, а app держит одно соединение). Ноль cleanup.
export async function buildTestApp(extend?: (app: App) => void) {
  const app = buildApp({ dbPath: ':memory:' })
  extend?.(app)
  await app.ready()
  return app
}
