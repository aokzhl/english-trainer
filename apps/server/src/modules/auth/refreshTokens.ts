import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { refreshTokens } from '../../db/schema'
import type { Db } from '../../db/client'
import { config } from '../../app/config'
import { AuthError } from './errors'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function issueRefreshToken(
  db: Db,
  userId: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  )
  await db
    .insert(refreshTokens)
    .values({ userId, tokenHash: hashToken(token), expiresAt })
  return { token, expiresAt }
}

export async function rotateRefreshToken(
  db: Db,
  token: string,
): Promise<{ userId: number; token: string; expiresAt: Date }> {
  // Атомарная ротация: delete ... returning гарантирует, что при гонке двух
  // параллельных refresh только один запрос удалит строку и получит её обратно —
  // второй получит пустой результат и будет отклонён. Так исключается повторное
  // использование одного refresh-токена.
  const [row] = await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .returning()
  if (!row) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }
  if (row.expiresAt <= new Date()) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }
  const next = await issueRefreshToken(db, row.userId)
  return { userId: row.userId, ...next }
}

export async function revokeRefreshToken(db: Db, token: string): Promise<void> {
  await db
    .delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
}
