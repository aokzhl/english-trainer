type HttpClientConfig = {
  baseUrl: string
  getToken: () => string | null
  refresh: () => Promise<string | null>
  onAuthFailure: () => void
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
  private refreshPromise: Promise<string | null> | null = null

  configure(config: HttpClientConfig): void {
    this.config = config
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<T> {
    if (!this.config) {
      throw new Error(
        'httpClient не сконфигурирован (см. app/composition-root.ts)',
      )
    }
    const { baseUrl, getToken, onAuthFailure } = this.config
    const token = getToken()

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
      const newToken = await this.runRefresh()
      if (newToken !== null) {
        return this.request<T>(path, init, true)
      }
      onAuthFailure()
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string
      } | null
      throw new HttpError(response.status, body?.message ?? response.statusText)
    }

    if (response.status === 204) {
      return undefined as T
    }
    return response.json() as Promise<T>
  }

  private runRefresh(): Promise<string | null> {
    if (this.refreshPromise === null) {
      this.refreshPromise = this.config!.refresh().finally(() => {
        this.refreshPromise = null
      })
    }
    return this.refreshPromise
  }
}

export const httpClient = new HttpClient()
