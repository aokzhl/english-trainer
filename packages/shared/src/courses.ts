import { z } from 'zod'

export const COURSE_TYPES = ['vocabulary', 'grammar'] as const
export type CourseType = (typeof COURSE_TYPES)[number]

export const courseProgressDto = z.object({
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export const courseDto = z.object({
  slug: z.string(),
  type: z.enum(COURSE_TYPES),
  title: z.string(),
  description: z.string(),
  enrolled: z.boolean(),
  progress: courseProgressDto,
})
export type CourseDto = z.infer<typeof courseDto>

export const coursesListDto = z.array(courseDto)
export type CoursesListDto = z.infer<typeof coursesListDto>
