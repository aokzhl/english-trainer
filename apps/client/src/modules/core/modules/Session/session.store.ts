import { makeAutoObservable } from 'mobx'

export function createSessionStore() {
  return makeAutoObservable({
    token: null as string | null,
    get isAuthorized() {
      return this.token !== null
    },
    setToken(token: string) {
      this.token = token
    },
    clear() {
      this.token = null
    },
  })
}

export type SessionStore = ReturnType<typeof createSessionStore>
