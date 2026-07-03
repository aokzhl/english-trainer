import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './input'

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { placeholder: 'например, resilient' } }
export const Disabled: Story = {
  args: { disabled: true, placeholder: 'недоступно' },
}
