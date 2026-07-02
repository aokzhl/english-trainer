import type { LoginBody, RegisterBody } from '@wordforge/shared'
import type { SessionStore } from '@/modules/core'
import type { AuthApi } from './api/authApi'

export type AuthServiceDeps = {
  authApi: AuthApi
  session: SessionStore
}

export function createAuthService({ authApi, session }: AuthServiceDeps) {
  const refresh = async (): Promise<string | null> => {
    try {
      const { accessToken } = await authApi.refresh()
      session.setToken(accessToken)
      return accessToken
    } catch {
      return null
    }
  }

  return {
    async signIn(body: LoginBody) {
      const { accessToken } = await authApi.login(body)
      session.setToken(accessToken)
    },
    async register(body: RegisterBody) {
      const { accessToken } = await authApi.register(body)
      session.setToken(accessToken)
    },
    refresh,
    async bootstrap() {
      await refresh()
    },
    async logout() {
      await authApi.logout().catch(() => undefined)
      session.clear()
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
