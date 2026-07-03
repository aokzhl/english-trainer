import { Flame, GraduationCap, RotateCcw } from 'lucide-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { StatPill } from './stat-pill'

const meta = {
  title: 'WordForge/StatPill',
  component: StatPill,
  tags: ['autodocs'],
} satisfies Meta<typeof StatPill>

export default meta
type Story = StoryObj<typeof meta>

export const Streak: Story = {
  args: {
    icon: <Flame className="size-4" />,
    value: 7,
    label: 'дней подряд',
    tone: 'streak',
  },
}
export const DueToday: Story = {
  args: {
    icon: <RotateCcw className="size-4" />,
    value: 24,
    label: 'к повторению',
  },
}
export const Learned: Story = {
  args: {
    icon: <GraduationCap className="size-4" />,
    value: 142,
    label: 'выучено',
    tone: 'success',
  },
}
