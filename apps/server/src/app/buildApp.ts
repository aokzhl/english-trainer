import fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import type { Db } from '../db/client'
import { AuthError } from '../modules/auth'
import { authRoutes } from '../routes/auth'
import { config } from './config'

export function buildApp(opts: { db: Db; logger?: boolean }) {
  const app = fastify({ logger: opts.logger ?? false })

  app.decorate('db', opts.db)

  app.register(fastifyJwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.accessTokenTtl },
  })
  app.register(fastifyCookie)

  app.register(authRoutes, { prefix: '/api/auth' })

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.status).send({ message: error.message })
    }
    request.log.error(error)
    return reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
