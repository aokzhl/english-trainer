import { Outlet } from '@tanstack/react-router'

export function DefaultLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
