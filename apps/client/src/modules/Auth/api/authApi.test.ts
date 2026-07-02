import { describe, expect, it, vi } from 'vitest'
import { createAuthApi } from './authApi'

describe('createAuthApi', () => {
  it('posts credentials to /auth/login and parses accessToken', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok' }))
    const api = createAuthApi({ post })

    const result = await api.login({ email: 'a@b.co', password: 'x' })

    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.co',
      password: 'x',
    })
    expect(result).toEqual({ accessToken: 'tok' })
  })

  it('registers via /auth/register', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok' }))
    const api = createAuthApi({ post })

    await api.register({ email: 'a@b.co', password: 'passw0rd' })

    expect(post).toHaveBeenCalledWith('/auth/register', {
      email: 'a@b.co',
      password: 'passw0rd',
    })
  })

  it('refreshes via /auth/refresh with no body', async () => {
    const post = vi.fn(async () => ({ accessToken: 'tok2' }))
    const api = createAuthApi({ post })

    const result = await api.refresh()

    expect(post).toHaveBeenCalledWith('/auth/refresh')
    expect(result.accessToken).toBe('tok2')
  })

  it('rejects when the response shape is invalid', async () => {
    const post = vi.fn(async () => ({ nope: true }))
    const api = createAuthApi({ post })

    await expect(
      api.login({ email: 'a@b.co', password: 'x' }),
    ).rejects.toThrow()
  })

  it('logs out via /auth/logout', async () => {
    const post = vi.fn(async () => undefined)
    const api = createAuthApi({ post })

    await api.logout()

    expect(post).toHaveBeenCalledWith('/auth/logout')
  })
})
