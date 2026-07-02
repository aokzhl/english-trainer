import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { ROUTES } from '@/common/constants/routes'
import { NotFoundPage } from '@/pages/[...404]'
import { CoursesPage } from '@/pages/courses'
import { HomePage } from '@/pages/index'
import { DefaultLayout } from './layouts/DefaultLayout'

const rootRoute = createRootRoute({
  component: DefaultLayout,
  notFoundComponent: NotFoundPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: ROUTES.HOME,
  component: HomePage,
})

const coursesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: ROUTES.COURSES,
  component: CoursesPage,
})

const routeTree = rootRoute.addChildren([homeRoute, coursesRoute])

export const router = createRouter({ routeTree })
