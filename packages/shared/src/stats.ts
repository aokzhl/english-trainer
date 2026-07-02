import { z } from 'zod'

export const statsDto = z.object({
  streak: z.number().int().nonnegative(),
  courses: z.array(
    z.object({
      slug: z.string(),
      done: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
  ),
})
export type StatsDto = z.infer<typeof statsDto>
