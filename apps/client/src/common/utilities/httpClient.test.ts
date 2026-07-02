import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, httpClient } from './httpClient'

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

describe('httpClient', () => {
  it('sends bearer token and credentials, returns json', async () => {
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'tok',
      refresh: async () => null,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(200, { ok: true }))

    const data = await httpClient.get<{ ok: boolean }>('/cards')

    expect(data).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/cards')
    expect(init.credentials).toBe('include')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('refreshes once on 401 then retries with the new token', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return 'new'
    })
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => token,
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'нет доступа' }))
      .mockResolvedValueOnce(res(200, { ok: true }))

    const data = await httpClient.get<{ ok: boolean }>('/cards')

    expect(data).toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer new')
  })

  it('calls onAuthFailure and throws when refresh fails', async () => {
    const onAuthFailure = vi.fn()
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh: async () => null,
      onAuthFailure,
    })
    fetchMock.mockResolvedValueOnce(res(401, { message: 'сессия истекла' }))

    await expect(httpClient.get('/cards')).rejects.toBeInstanceOf(HttpError)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on 401 from an /auth/ path', async () => {
    const refresh = vi.fn(async () => 'new')
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => null,
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(401, { message: 'неверные данные' }))

    await expect(httpClient.post('/auth/login', {})).rejects.toBeInstanceOf(
      HttpError,
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('shares a single refresh across concurrent 401s', async () => {
    const refresh = vi.fn(async () => 'new')
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh,
      onAuthFailure: () => {},
    })
    fetchMock
      .mockResolvedValueOnce(res(401, {}))
      .mockResolvedValueOnce(res(401, {}))
      .mockImplementation(() => res(200, { ok: true }))

    await Promise.all([httpClient.get('/a'), httpClient.get('/b')])

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('calls onAuthFailure when the retried request still returns 401', async () => {
    const onAuthFailure = vi.fn()
    const refresh = vi.fn(async () => 'new')
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh,
      onAuthFailure,
    })
    fetchMock
      .mockResolvedValueOnce(res(401, { message: 'нет' }))
      .mockResolvedValueOnce(res(401, { message: 'опять' }))

    await expect(httpClient.get('/cards')).rejects.toBeInstanceOf(HttpError)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('calls onAuthFailure when refresh itself rejects', async () => {
    const onAuthFailure = vi.fn()
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'old',
      refresh: async () => {
        throw new Error('refresh boom')
      },
      onAuthFailure,
    })
    fetchMock.mockResolvedValueOnce(res(401, { message: 'нет' }))

    await expect(httpClient.get('/cards')).rejects.toBeInstanceOf(HttpError)

    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('returns undefined for 204 responses', async () => {
    httpClient.configure({
      baseUrl: '/api',
      getToken: () => 'tok',
      refresh: async () => null,
      onAuthFailure: () => {},
    })
    fetchMock.mockResolvedValueOnce(res(204))

    await expect(httpClient.post('/auth/logout')).resolves.toBeUndefined()
  })
})
