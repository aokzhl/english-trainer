import type { CoursesListDto } from '@wordforge/shared'
import { httpClient } from '@/common/utilities/httpClient'

export const coursesApi = {
  list: () => httpClient.get<CoursesListDto>('/courses'),
  enroll: (slug: string) =>
    httpClient.post<void>(`/courses/${slug}/enroll`, undefined),
}
