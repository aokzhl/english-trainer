import { makeAutoObservable, runInAction } from 'mobx'
import type { CourseDto } from '@wordforge/shared'
import { coursesApi } from '../api/coursesApi'

export class CoursesStore {
  courses: CourseDto[] = []
  loading = false
  error: string | null = null

  constructor() {
    makeAutoObservable(this)
  }

  async load() {
    this.loading = true
    this.error = null
    try {
      const courses = await coursesApi.list()
      runInAction(() => {
        this.courses = courses
      })
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : String(e)
      })
    } finally {
      runInAction(() => {
        this.loading = false
      })
    }
  }

  async enroll(slug: string) {
    this.error = null
    try {
      await coursesApi.enroll(slug)
      await this.load()
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : String(e)
      })
    }
  }
}
