declare module '@tanstack/react-router' {
  interface Register {
    router: typeof import('@/app/router').router
  }
}

// Файл должен быть модулем, иначе declare module подменит типы пакета вместо расширения
export {}
