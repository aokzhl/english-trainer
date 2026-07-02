export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DICTIONARY: '/dictionary',
  COURSES: '/courses',
  // Путь-шаблон TanStack Router; mode: flash | quiz | type
  SESSION: '/session/$mode',
} as const
