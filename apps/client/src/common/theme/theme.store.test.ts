import { describe, expect, it, vi } from 'vitest'
import { createThemeStore } from './theme.store'

function makeDeps(initial: 'light' | 'dark' = 'light') {
  return {
    getInitialTheme: () => initial,
    persist: vi.fn(),
    applyClass: vi.fn(),
  }
}

describe('theme store', () => {
  it('seeds from getInitialTheme and applies the class on creation', () => {
    const deps = makeDeps('dark')
    const store = createThemeStore(deps)

    expect(store.theme).toBe('dark')
    expect(store.isDark).toBe(true)
    expect(deps.applyClass).toHaveBeenCalledWith(true)
  })

  it('toggle flips the theme, applies the class, and persists', () => {
    const deps = makeDeps('light')
    const store = createThemeStore(deps)
    deps.applyClass.mockClear()

    store.toggle()

    expect(store.theme).toBe('dark')
    expect(deps.applyClass).toHaveBeenLastCalledWith(true)
    expect(deps.persist).toHaveBeenLastCalledWith('dark')
  })

  it('setTheme sets an explicit value', () => {
    const store = createThemeStore(makeDeps('dark'))
    store.setTheme('light')
    expect(store.theme).toBe('light')
    expect(store.isDark).toBe(false)
  })
})
