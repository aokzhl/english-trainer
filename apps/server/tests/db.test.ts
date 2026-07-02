import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../src/db/client'
import { refreshTokens, users } from '../src/db/schema'

test('миграции применяются, users и refresh_tokens доступны', () => {
  const db = createDb(':memory:')

  const [user] = db
    .insert(users)
    .values({
      email: 'a@b.co',
      passwordHash: 'hash',
      createdAt: new Date().toISOString(),
    })
    .returning()
    .all()

  expect(user.id).toBe(1)
  expect(user.streak).toBe(0)

  db.insert(refreshTokens)
    .values({
      userId: user.id,
      tokenHash: 'abc',
      expiresAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    })
    .run()

  const rows = db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, user.id))
    .all()
  expect(rows).toHaveLength(1)
})
