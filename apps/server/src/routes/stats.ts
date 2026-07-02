import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { StatsDto } from '@wordforge/shared'
import { requireAuth } from '../middlewares/requireAuth'
import { listCourses } from '../modules/courses'
import { users } from '../db/schema'

export async function statsRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (req): Promise<StatsDto> => {
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.id, req.user.sub))
      .limit(1)
    const courses = await listCourses(app.db, req.user.sub)
    return {
      streak: user?.streak ?? 0,
      courses: courses.map((c) => ({
        slug: c.slug,
        done: c.progress.done,
        total: c.progress.total,
      })),
    }
  })
}
