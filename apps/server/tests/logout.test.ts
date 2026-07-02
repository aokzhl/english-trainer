import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

test('logout: 204, refresh после него мёртв, повторный logout безопасен', async () => {
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 'bye@example.com', password: 'abc12345' },
  })
  const token = reg.cookies.find((c) => c.name === 'refresh_token')!.value

  const out = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    cookies: { refresh_token: token },
  })
  expect(out.statusCode).toBe(204)

  const cleared = out.cookies.find((c) => c.name === 'refresh_token')
  expect(cleared?.value).toBe('')

  const refresh = await app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    cookies: { refresh_token: token },
  })
  expect(refresh.statusCode).toBe(401)

  const again = await app.inject({ method: 'POST', url: '/api/auth/logout' })
  expect(again.statusCode).toBe(204)
})
