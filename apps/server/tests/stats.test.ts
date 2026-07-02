import { afterAll, beforeAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'
import { seedCourses } from '../src/db/seed'

const app = await buildTestApp()
let token = ''

beforeAll(async () => {
  await seedCourses(app.db)
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email: 's@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 's@example.com', password: 'abc12345' },
  })
  token = res.json().accessToken
})
afterAll(() => app.close())

test('GET /api/stats: стрик 0 и список курсов', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/stats',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(200)
  expect(res.json().streak).toBe(0)
  expect(res.json().courses).toHaveLength(2)
})
