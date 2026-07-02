import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { CourseCard, CoursesStore } from '@/modules/Courses'

export const CoursesPage = observer(function CoursesPage() {
  const [store] = useState(() => new CoursesStore())
  useEffect(() => {
    void store.load()
  }, [store])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold">Курсы</h1>
      {store.error && <p className="text-destructive">{store.error}</p>}
      {store.loading && <p className="text-muted-foreground">Загрузка...</p>}
      {store.courses.map((c) => (
        <CourseCard
          key={c.slug}
          course={c}
          onEnroll={(s) => void store.enroll(s)}
        />
      ))}
    </div>
  )
})
