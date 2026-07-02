import { observer } from 'mobx-react-lite'
import type { CourseDto } from '@wordforge/shared'

export const CourseCard = observer(function CourseCard(props: {
  course: CourseDto
  onEnroll: (slug: string) => void
}) {
  const { course, onEnroll } = props
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{course.title}</h3>
      <p className="text-sm text-muted-foreground">{course.description}</p>
      {course.enrolled ? (
        <span className="text-sm text-green-600">Вы записаны</span>
      ) : (
        <button
          type="button"
          className="mt-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          onClick={() => onEnroll(course.slug)}
        >
          Записаться
        </button>
      )}
    </div>
  )
})
