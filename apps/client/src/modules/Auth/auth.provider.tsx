import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { AuthService } from './auth.service'

export const { Injector, useDi: useAuthService } = createDi<AuthService>()

export const AuthServiceProvider = ({
  value,
  children,
}: {
  value: AuthService
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
