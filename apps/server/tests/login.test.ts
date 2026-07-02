import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

beforeAll(async () => {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'user@example.com', password: 'abc12345' },
  })
})

test('успешный вход: 200, accessToken, refresh-cookie', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'USER@example.com', password: 'abc12345' },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().accessToken).toEqual(expect.any(String))
  expect(res.cookies.find((c) => c.name === 'refresh_token')).toBeDefined()
})

test('неверный пароль и неизвестный email дают одинаковый 401', async () => {
  const wrongPassword = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: 'wrong123' },
  })
  const unknownEmail = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'ghost@example.com', password: 'abc12345' },
  })

  expect(wrongPassword.statusCode).toBe(401)
  expect(unknownEmail.statusCode).toBe(401)
  expect(wrongPassword.json().message).toBe('Неверный email или пароль')
  expect(unknownEmail.json().message).toBe(wrongPassword.json().message)
})

test('пустой пароль → 400', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'user@example.com', password: '' },
  })
  expect(res.statusCode).toBe(400)
})
