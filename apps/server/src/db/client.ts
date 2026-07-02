import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from './schema'

const migrationsFolder = path.join(import.meta.dirname, '../../drizzle')

export async function createDb(connectionString: string) {
  const client = postgres(connectionString)
  const db = drizzlePostgres({ client, schema })
  await migratePostgres(db, { migrationsFolder })
  return db
}

export async function createTestDb() {
  const client = new PGlite()
  const db = drizzlePglite({ client, schema })
  await migratePglite(db, { migrationsFolder })
  return db as unknown as Db
}

export type Db = Awaited<ReturnType<typeof createDb>>
