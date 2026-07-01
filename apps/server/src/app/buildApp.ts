import fastify from 'fastify'

export function buildApp(opts: { logger?: boolean } = {}) {
  const app = fastify({ logger: opts.logger ?? false })

  app.get('/api/health', () => ({ status: 'ok' }))

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.status(500).send({ message: 'Внутренняя ошибка сервера' })
  })

  return app
}
