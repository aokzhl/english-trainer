import type { Db } from './client'
import { courses } from './schema'

const MVP_COURSES = [
  {
    slug: 'vocabulary',
    type: 'vocabulary',
    title: '3000 слов для Intermediate',
    description: 'Словарь по темам с интервальными повторениями.',
    order: 1,
  },
  {
    slug: 'grammar',
    type: 'grammar',
    title: 'Grammar Is All You Need 2.0',
    description: 'Курс грамматики: теория, упражнения, проверка ИИ.',
    order: 2,
  },
]

export async function seedCourses(db: Db): Promise<void> {
  for (const c of MVP_COURSES) {
    await db
      .insert(courses)
      .values(c)
      .onConflictDoNothing({ target: courses.slug })
  }
}
