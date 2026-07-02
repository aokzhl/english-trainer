import type { Meta, StoryObj } from '@storybook/react-vite'
import { Switch } from './switch'

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }
export const On: Story = { args: { defaultChecked: true } }
