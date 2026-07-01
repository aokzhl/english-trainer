import type { Db } from '../db/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
  }
}

export {}
