import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { SessionStore } from './session.store'

export const { Injector, useDi: useSessionStore } = createDi<SessionStore>()

export const SessionProvider = ({
  value,
  children,
}: {
  value: SessionStore
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
