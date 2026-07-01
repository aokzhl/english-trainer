import { httpClient } from '@/common/utilities/httpClient'
import { config } from '../config'

// Хранение токена переедет в modules/Auth (authStore), когда модуль появится;
// тогда getToken здесь станет `() => authStore.token` (IoC: app внедряет зависимость).
const TOKEN_KEY = 'wordforge:token'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export function initHttp(): void {
  httpClient.configure({
    baseUrl: config.apiBaseUrl,
    getToken: getAuthToken,
    onUnauthorized: () => setAuthToken(null),
  })
}
