import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

const body = { email: 'User@Example.com', password: 'abc12345' }

test('успешная регистрация: 201, accessToken, refresh-cookie', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: body })

  expect(res.statusCode).toBe(201)
  expect(res.json().accessToken).toEqual(expect.any(String))

  const cookie = res.cookies.find((c) => c.name === 'refresh_token')
  expect(cookie).toBeDefined()
  expect(cookie?.httpOnly).toBe(true)
  expect(cookie?.path).toBe('/api/auth')
})

test('повторная регистрация того же email (в другом регистре) → 409', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { ...body, email: 'user@example.com' },
  })
  expect(res.statusCode).toBe(409)
  expect(res.json().message).toBe('Пользователь с таким email уже существует')
})

test('слабый пароль → 400 с сообщением схемы', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'new@example.com', password: 'abcdefgh' },
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().message).toBe('Пароль должен содержать хотя бы одну цифру')
})

test('accessToken подписан и содержит sub', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'second@example.com', password: 'abc12345' },
  })
  const payload = app.jwt.verify<{ sub: number }>(res.json().accessToken)
  expect(payload.sub).toEqual(expect.any(Number))
})
