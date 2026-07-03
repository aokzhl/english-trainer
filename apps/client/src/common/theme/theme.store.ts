// Theme lives in common/ (not modules/core, which FEOD's docs use as the example)
// on purpose: common/ui components must be able to READ the current theme, and
// common cannot import from modules (that would be an upward import). So the theme
// store belongs at the common level to stay reachable from the UIKit. Side effects
// are injected as ports so it stays a testable, single-responsibility unit.
import { makeAutoObservable } from 'mobx'

export type Theme = 'light' | 'dark'

export type ThemeStoreDeps = {
  getInitialTheme: () => Theme
  persist: (theme: Theme) => void
  applyClass: (isDark: boolean) => void
}

export function createThemeStore(deps: ThemeStoreDeps) {
  const store = makeAutoObservable({
    theme: deps.getInitialTheme(),
    get isDark() {
      return this.theme === 'dark'
    },
    setTheme(theme: Theme) {
      this.theme = theme
      deps.applyClass(theme === 'dark')
      deps.persist(theme)
    },
    toggle() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
  })
  deps.applyClass(store.isDark)
  return store
}

export type ThemeStore = ReturnType<typeof createThemeStore>
