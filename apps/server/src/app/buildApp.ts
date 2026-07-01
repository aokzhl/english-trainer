import fastify from 'fastify'
import { createDb } from '../db/client'

export function buildApp(opts: { dbPath: string; logger?: boolean }) {
  const app = fastify({ logger: opts.logger ?? false })

  app.decorate('db', createDb(opts.dbPath))

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
