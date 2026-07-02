import { makeAutoObservable, runInAction } from 'mobx'
import type { CourseDto } from '@wordforge/shared'
import { coursesApi } from '../api/coursesApi'

export class CoursesStore {
  courses: CourseDto[] = []
  loading = false

  constructor() {
    makeAutoObservable(this)
  }

  async load() {
    this.loading = true
    const courses = await coursesApi.list()
    runInAction(() => {
      this.courses = courses
      this.loading = false
    })
  }

  async enroll(slug: string) {
    await coursesApi.enroll(slug)
    await this.load()
  }
}
