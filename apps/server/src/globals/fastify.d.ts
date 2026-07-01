import type { Db } from '../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number }
    user: { sub: number }
  }
}

export {}
