import { eq } from 'drizzle-orm'
import type { CourseDto, CourseType } from '@wordforge/shared'
import type { Db } from '../../db/client'
import { AuthError } from '../auth'
import { courses, enrollments } from '../../db/schema'

export async function listCourses(
  db: Db,
  userId: number,
): Promise<CourseDto[]> {
  const rows = await db.select().from(courses).orderBy(courses.order)
  const mine = await db
    .select({ courseId: enrollments.courseId })
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
  const enrolledIds = new Set(mine.map((r) => r.courseId))

  return rows.map((c) => ({
    slug: c.slug,
    type: c.type as CourseType,
    title: c.title,
    description: c.description,
    enrolled: enrolledIds.has(c.id),
    progress: { done: 0, total: 0 },
  }))
}

export async function enrollInCourse(
  db: Db,
  userId: number,
  slug: string,
): Promise<void> {
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1)
  if (!course) {
    throw new AuthError(404, 'Курс не найден')
  }
  // Идемпотентно и без гонок: полагаемся на unique(userId, courseId).
  // Повторная (в т.ч. параллельная) запись — тихий no-op вместо 500 по нарушению
  // уникальности.
  await db
    .insert(enrollments)
    .values({ userId, courseId: course.id })
    .onConflictDoNothing({
      target: [enrollments.userId, enrollments.courseId],
    })
}
