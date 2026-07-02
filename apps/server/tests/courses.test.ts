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
    payload: { email: 'c@example.com', password: 'abc12345' },
  })
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'c@example.com', password: 'abc12345' },
  })
  token = res.json().accessToken
})
afterAll(() => app.close())

test('GET /api/courses возвращает 2 курса, не записан', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/courses',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(200)
  const body = res.json()
  expect(body).toHaveLength(2)
  expect(body.every((c: { enrolled: boolean }) => c.enrolled === false)).toBe(
    true,
  )
})

test('POST enroll делает курс enrolled', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/courses/vocabulary/enroll',
    headers: { authorization: `Bearer ${token}` },
  })
  const res = await app.inject({
    method: 'GET',
    url: '/api/courses',
    headers: { authorization: `Bearer ${token}` },
  })
  const vocab = res
    .json()
    .find((c: { slug: string }) => c.slug === 'vocabulary')
  expect(vocab.enrolled).toBe(true)
})

test('enroll на несуществующий курс → 404', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/courses/nope/enroll',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(res.statusCode).toBe(404)
  expect(res.json().message).toEqual(expect.any(String))
})
