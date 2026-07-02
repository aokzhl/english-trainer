import { afterAll, expect, test } from 'vitest'
import { buildTestApp } from './helpers'

const app = await buildTestApp()
afterAll(() => app.close())

test('GET /api/health отвечает 200 {status: ok}', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/health' })
  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ status: 'ok' })
})
