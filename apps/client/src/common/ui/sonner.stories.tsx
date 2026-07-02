import type { Meta, StoryObj } from '@storybook/react-vite'
import { toast } from 'sonner'
import { Button } from './button'
import { Toaster } from './sonner'

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
} satisfies Meta<typeof ToasterDemo>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }
