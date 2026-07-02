import { httpClient } from '@/common/utilities/httpClient'
import { createThemeStore } from '@/common/theme/theme.store'
import type { ThemeStore } from '@/common/theme/theme.store'
import { createAuthApi, createAuthService } from '@/modules/Auth'
import type { AuthService } from '@/modules/Auth'
import { createSessionStore } from '@/modules/core'
import type { SessionStore } from '@/modules/core'
import { config } from './config'

export type AppGraph = {
  session: SessionStore
  authService: AuthService
  theme: ThemeStore
}

export function createGraph(): AppGraph {
  const session = createSessionStore()
  const authApi = createAuthApi(httpClient)
  const authService = createAuthService({ authApi, session })
  const theme = createThemeStore({
    getInitialTheme: () => {
      const stored = localStorage.getItem('wf.theme')
      if (stored === 'light' || stored === 'dark') return stored
      return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light'
    },
    persist: (value) => localStorage.setItem('wf.theme', value),
    applyClass: (isDark) =>
      document.documentElement.classList.toggle('dark', isDark),
  })
  return { session, authService, theme }
}

export function configureHttp(graph: AppGraph): void {
  httpClient.configure({
    baseUrl: config.apiBaseUrl,
    getToken: () => graph.session.token,
    refresh: () => graph.authService.refresh(),
    onAuthFailure: () => graph.session.clear(),
  })
}
