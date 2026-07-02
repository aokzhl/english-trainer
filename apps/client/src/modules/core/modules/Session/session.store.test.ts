import { describe, expect, it } from 'vitest'
import { createSessionStore } from './session.store'

describe('createSessionStore', () => {
  it('starts unauthorized with no token', () => {
    const s = createSessionStore()
    expect(s.token).toBeNull()
    expect(s.isAuthorized).toBe(false)
  })

  it('setToken stores the token and marks authorized', () => {
    const s = createSessionStore()
    s.setToken('abc')
    expect(s.token).toBe('abc')
    expect(s.isAuthorized).toBe(true)
  })

  it('clear removes the token', () => {
    const s = createSessionStore()
    s.setToken('abc')
    s.clear()
    expect(s.token).toBeNull()
    expect(s.isAuthorized).toBe(false)
  })
})
