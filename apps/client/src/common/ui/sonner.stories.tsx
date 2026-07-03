import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from './button'
import { Toaster } from './sonner'
import { ThemeProvider } from '@/common/theme/theme.provider'
import { createThemeStore } from '@/common/theme/theme.store'

function ToasterDemo() {
  return (
    <>
      <Button onClick={() => toast('Сохранено')}>Показать уведомление</Button>
      <Toaster />
    </>
  )
}

const meta = {
  title: 'UI/Sonner',
  component: ToasterDemo,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      const store = createThemeStore({
        getInitialTheme: () => 'light',
        persist: () => {},
        applyClass: () => {},
      })
      return (
        <ThemeProvider value={store}>
          <Story />
        </ThemeProvider>
      )
    },
  ],
} satisfies Meta<typeof ToasterDemo>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }
