type HttpClientConfig = {
  baseUrl: string
  getToken: () => string | null
  onUnauthorized?: () => void
}

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

class HttpClient {
  private config: HttpClientConfig | null = null

  configure(config: HttpClientConfig): void {
    this.config = config
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.config) {
      throw new Error('httpClient не сконфигурирован (см. app/integrations/http.ts)')
    }
    const { baseUrl, getToken, onUnauthorized } = this.config
    const token = getToken()

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    if (response.status === 401) {
      onUnauthorized?.()
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      throw new HttpError(response.status, body?.message ?? response.statusText)
    }
    return response.json() as Promise<T>
  }
}

export const httpClient = new HttpClient()
