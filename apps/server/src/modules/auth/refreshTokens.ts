import { createHash, randomBytes } from 'node:crypto'
import { refreshTokens } from '../../db/schema'
import type { Db } from '../../db/client'
import { config } from '../../app/config'

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
