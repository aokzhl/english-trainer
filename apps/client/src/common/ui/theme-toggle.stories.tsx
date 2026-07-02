import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeToggle } from './theme-toggle'
import { ThemeProvider } from '@/common/theme/theme.provider'
import { createThemeStore } from '@/common/theme/theme.store'

const store = createThemeStore({
  getInitialTheme: () => 'light',
  persist: () => {},
  applyClass: () => {},
})

const meta = {
  title: 'WordForge/ThemeToggle',
  component: ThemeToggle,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider value={store}>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
