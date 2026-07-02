import type { Meta, StoryObj } from '@storybook/react-vite'
import { Progress } from './progress'

const meta = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>
export default meta
type Story = StoryObj<typeof meta>

export const AtStart: Story = { args: { value: 15 } }
export const Midway: Story = { args: { value: 60 } }
export const Full: Story = { args: { value: 100 } }
