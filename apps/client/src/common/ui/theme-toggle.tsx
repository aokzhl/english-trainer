import { Moon, Sun } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { Button } from './button'
import { useThemeStore } from '@/common/theme/theme.provider'

export const ThemeToggle = observer(() => {
  const theme = useThemeStore()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={theme.isDark ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => theme.toggle()}
    >
      {theme.isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  )
})
