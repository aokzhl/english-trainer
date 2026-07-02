import { describe, expect, it, vi } from 'vitest'
import { createSessionStore } from '@/modules/core'
import { createAuthService } from './auth.service'
import type { AuthApi } from './api/authApi'

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    register: vi.fn(async () => ({ accessToken: 'reg' })),
    login: vi.fn(async () => ({ accessToken: 'log' })),
    refresh: vi.fn(async () => ({ accessToken: 'ref' })),
    logout: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('createAuthService', () => {
  it('signIn stores the returned token in session', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.signIn({ email: 'a@b.co', password: 'x' })

    expect(session.token).toBe('log')
  })

  it('register stores the returned token', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.register({ email: 'a@b.co', password: 'passw0rd' })

    expect(session.token).toBe('reg')
  })

  it('bootstrap sets the token when refresh succeeds', async () => {
    const session = createSessionStore()
    const service = createAuthService({ authApi: fakeApi(), session })

    await service.bootstrap()

    expect(session.token).toBe('ref')
    expect(session.isAuthorized).toBe(true)
  })

  it('bootstrap stays guest when refresh fails', async () => {
    const session = createSessionStore()
    const authApi = fakeApi({
      refresh: vi.fn(async () => {
        throw new Error('401')
      }),
    })
    const service = createAuthService({ authApi, session })

    await service.bootstrap()

    expect(session.token).toBeNull()
    expect(session.isAuthorized).toBe(false)
  })

  it('refresh returns null on failure without throwing', async () => {
    const session = createSessionStore()
    const authApi = fakeApi({
      refresh: vi.fn(async () => {
        throw new Error('nope')
      }),
    })
    const service = createAuthService({ authApi, session })

    await expect(service.refresh()).resolves.toBeNull()
  })

  it('logout clears the session even if the request fails', async () => {
    const session = createSessionStore()
    session.setToken('tok')
    const authApi = fakeApi({
      logout: vi.fn(async () => {
        throw new Error('network')
      }),
    })
    const service = createAuthService({ authApi, session })

    await service.logout()

    expect(session.token).toBeNull()
  })
})
