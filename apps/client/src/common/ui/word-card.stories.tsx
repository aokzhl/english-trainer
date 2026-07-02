import type { Meta, StoryObj } from '@storybook/react-vite'
import { WordCard } from './word-card'

const meta = {
  title: 'WordForge/WordCard',
  component: WordCard,
  tags: ['autodocs'],
  args: {
    word: 'resilient',
    translation: 'устойчивый, жизнестойкий',
    level: 'B2',
    category: 'эмоции',
    example: 'She stayed resilient through every setback.',
  },
} satisfies Meta<typeof WordCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Minimal: Story = {
  args: { category: undefined, example: undefined },
}
export const LongExample: Story = {
  args: {
    example:
      'Despite losing the first three rounds, the resilient challenger came back to win the championship in a stunning display of grit.',
  },
}
