import { expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb } from '../src/db/client'
import { refreshTokens, users } from '../src/db/schema'

test('миграции применяются, users и refresh_tokens доступны', async () => {
  const db = await createTestDb()

  const [user] = await db
    .insert(users)
    .values({ email: 'a@b.co', passwordHash: 'hash' })
    .returning()

  expect(user.id).toBe(1)
  expect(user.streak).toBe(0)

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: 'abc',
    expiresAt: new Date(),
  })

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, user.id))
  expect(rows).toHaveLength(1)
})
