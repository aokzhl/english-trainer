import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { refreshTokens } from '../../db/schema'
import type { Db } from '../../db/client'
import { config } from '../../app/config'
import { AuthError } from './errors'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function issueRefreshToken(db: Db, userId: number): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expiresAt = new Date(
    now.getTime() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  db.insert(refreshTokens)
    .values({ userId, tokenHash: hashToken(token), expiresAt, createdAt: now.toISOString() })
    .run()

  return { token, expiresAt }
}

export function rotateRefreshToken(
  db: Db,
  token: string,
): { userId: number; token: string; expiresAt: string } {
  const row = db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .get()

  if (!row) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }

  db.delete(refreshTokens).where(eq(refreshTokens.id, row.id)).run()

  if (row.expiresAt <= new Date().toISOString()) {
    throw new AuthError(401, 'Сессия истекла, войдите снова')
  }

  const next = issueRefreshToken(db, row.userId)
  return { userId: row.userId, ...next }
}
