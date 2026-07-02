import type { ReactNode } from 'react'
import { createDi } from '@/common/lib/react/create-di'
import type { ThemeStore } from './theme.store'

export const { Injector, useDi: useThemeStore } = createDi<ThemeStore>()

export const ThemeProvider = ({
  value,
  children,
}: {
  value: ThemeStore
  children?: ReactNode
}) => <Injector value={value}>{children}</Injector>
