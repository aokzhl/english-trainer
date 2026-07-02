import type { FastifyInstance } from 'fastify'
import { enrollInCourse, listCourses } from '../modules/courses'
import { requireAuth } from '../middlewares/requireAuth'

export async function courseRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (req) => {
    return listCourses(app.db, req.user.sub)
  })

  app.post('/:slug/enroll', { preHandler: requireAuth }, async (req, reply) => {
    const { slug } = req.params as { slug: string }
    await enrollInCourse(app.db, req.user.sub, slug)
    return reply.status(204).send()
  })
}
