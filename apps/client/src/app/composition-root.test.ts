import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from '@/common/utilities/httpClient'
import { configureHttp, createGraph } from './composition-root'

const fetchMock = vi.fn()

function res(status: number, body: unknown = null) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('composition root', () => {
  it('builds a graph with an unauthorized session and a working service', () => {
    const graph = createGraph()

    expect(graph.session.isAuthorized).toBe(false)
    expect(typeof graph.authService.signIn).toBe('function')
  })

  it('configureHttp wires getToken from the session', async () => {
    const graph = createGraph()
    graph.session.setToken('live-token')
    configureHttp(graph)
    fetchMock.mockResolvedValueOnce(res(200, { ok: true }))

    await httpClient.get('/cards')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer live-token',
    )
  })

  it('configureHttp wires onAuthFailure to clear the session', async () => {
    const graph = createGraph()
    graph.session.setToken('stale')
    configureHttp(graph)
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'истекло' })) // GET /cards
      .mockResolvedValueOnce(res(401, { message: 'нет' })) // POST /auth/refresh

    await expect(httpClient.get('/cards')).rejects.toThrow()

    expect(graph.session.isAuthorized).toBe(false)
  })
})
