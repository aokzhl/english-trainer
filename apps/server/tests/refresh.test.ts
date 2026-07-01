import { afterAll, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { buildTestApp } from './helpers'
import { hashToken } from '../src/modules/auth'
import { refreshTokens } from '../src/db/schema'

const app = await buildTestApp()
afterAll(() => app.close())

async function registerAndGetRefresh(email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'abc12345' },
  })
  const cookie = res.cookies.find((c) => c.name === 'refresh_token')
  if (!cookie) throw new Error('refresh-cookie не выдана')
  return cookie.value
}

test('refresh выдаёт новый accessToken и ротирует токен', async () => {
  const oldToken = await registerAndGetRefresh('rotate@example.com')

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: oldToken },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().accessToken).toEqual(expect.any(String))

  const newCookie = res.cookies.find((c) => c.name === 'refresh_token')
  expect(newCookie).toBeDefined()
  expect(newCookie?.value).not.toBe(oldToken)

  // старый токен после ротации мёртв
  const replay = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: oldToken },
  })
  expect(replay.statusCode).toBe(401)
})

test('без cookie → 401', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' })
  expect(res.statusCode).toBe(401)
})

test('просроченный токен → 401', async () => {
  const token = await registerAndGetRefresh('expired@example.com')

  app.db
    .update(refreshTokens)
    .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .run()

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: token },
  })
  expect(res.statusCode).toBe(401)
  expect(res.json().message).toBe('Сессия истекла, войдите снова')
})
