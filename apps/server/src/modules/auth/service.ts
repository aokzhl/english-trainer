import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import type { Db } from '../../db/client'
import { AuthError } from './errors'

const BCRYPT_COST = 10

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function registerUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: number }> {
  const normalized = normalizeEmail(email)
  const existing = db.select().from(users).where(eq(users.email, normalized)).get()
  if (existing) {
    throw new AuthError(409, 'Пользователь с таким email уже существует')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const [user] = db
    .insert(users)
    .values({ email: normalized, passwordHash, createdAt: new Date().toISOString() })
    .returning()
    .all()

  return { userId: user.id }
}
