import { Link } from '@tanstack/react-router'
import { ROUTES } from '@/common/constants/routes'

export function NotFoundPage() {
  return (
    <section className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">Страница не найдена</h1>
      <Link to={ROUTES.HOME} className="text-primary underline">
        На главную
      </Link>
    </section>
  )
}
