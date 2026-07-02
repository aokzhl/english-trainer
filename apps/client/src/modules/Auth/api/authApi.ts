import { authResponseSchema } from '@wordforge/shared'
import type { AuthResponse, LoginBody, RegisterBody } from '@wordforge/shared'

export type HttpPort = {
  post: (path: string, body?: unknown) => Promise<unknown>
}

export type AuthApi = {
  register: (body: RegisterBody) => Promise<AuthResponse>
  login: (body: LoginBody) => Promise<AuthResponse>
  refresh: () => Promise<AuthResponse>
  logout: () => Promise<void>
}

export function createAuthApi(http: HttpPort): AuthApi {
  return {
    async register(body) {
      return authResponseSchema.parse(await http.post('/auth/register', body))
    },
    async login(body) {
      return authResponseSchema.parse(await http.post('/auth/login', body))
    },
    async refresh() {
      return authResponseSchema.parse(await http.post('/auth/refresh'))
    },
    async logout() {
      await http.post('/auth/logout')
    },
  }
}
