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
