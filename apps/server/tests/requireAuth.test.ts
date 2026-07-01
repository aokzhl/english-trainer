import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'
import { requireAuth } from '../src/middlewares/requireAuth'

const app = await buildTestApp((a) => {
  a.get('/api/protected', { preHandler: [requireAuth] }, (request) => ({
    userId: request.user.sub,
  }))
})
afterAll(() => app.close())

test('без токена → 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/protected' })
  expect(res.statusCode).toBe(401)
  expect(res.json().message).toBe('Требуется авторизация')
})

test('мусорный токен → 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: 'Bearer not-a-jwt' },
  })
  expect(res.statusCode).toBe(401)
})

test('просроченный токен → 401', async () => {
  const expired = app.jwt.sign({ sub: 1 }, { expiresIn: '1ms' })
  await new Promise((resolve) => setTimeout(resolve, 10))
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: `Bearer ${expired}` },
  })
  expect(res.statusCode).toBe(401)
})

test('валидный токен → 200 с userId', async () => {
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'auth@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'GET',
    url: '/api/protected',
    headers: { authorization: `Bearer ${reg.json().accessToken}` },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().userId).toEqual(expect.any(Number))
})
