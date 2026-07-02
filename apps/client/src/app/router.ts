import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { ROUTES } from '@/common/constants/routes'
import { NotFoundPage } from '@/pages/[...404]'
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

const routeTree = rootRoute.addChildren([homeRoute])

export const router = createRouter({ routeTree })
