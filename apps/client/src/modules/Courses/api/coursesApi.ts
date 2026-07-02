import type { CoursesListDto } from '@wordforge/shared'
import { httpClient } from '@/common/utilities/httpClient'

export const coursesApi = {
  list: () => httpClient.get<CoursesListDto>('/api/courses'),
  enroll: (slug: string) =>
    httpClient.post<void>(`/api/courses/${slug}/enroll`, undefined),
}
