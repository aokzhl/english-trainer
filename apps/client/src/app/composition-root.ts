import { httpClient } from '@/common/utilities/httpClient'
import { createAuthApi, createAuthService } from '@/modules/Auth'
import type { AuthService } from '@/modules/Auth'
import { createSessionStore } from '@/modules/core'
import type { SessionStore } from '@/modules/core'
import { config } from './config'

export type AppGraph = {
  session: SessionStore
  authService: AuthService
}

export function createGraph(): AppGraph {
  const session = createSessionStore()
  const authApi = createAuthApi(httpClient)
  const authService = createAuthService({ authApi, session })
  return { session, authService }
}

export function configureHttp(graph: AppGraph): void {
  httpClient.configure({
    baseUrl: config.apiBaseUrl,
    getToken: () => graph.session.token,
    refresh: () => graph.authService.refresh(),
    onAuthFailure: () => graph.session.clear(),
  })
}
