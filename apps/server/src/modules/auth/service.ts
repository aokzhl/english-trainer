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
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1)
  if (existing) {
    throw new AuthError(409, 'Пользователь с таким email уже существует')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
  const [user] = await db
    .insert(users)
    .values({ email: normalized, passwordHash })
    .returning()

  return { userId: user.id }
}

export async function verifyUser(
  db: Db,
  email: string,
  password: string,
): Promise<{ userId: number }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)
  if (!user) {
    throw new AuthError(401, 'Неверный email или пароль')
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    throw new AuthError(401, 'Неверный email или пароль')
  }
  return { userId: user.id }
}
