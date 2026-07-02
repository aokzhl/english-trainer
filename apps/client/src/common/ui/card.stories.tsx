import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
import { Button } from './button'

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Ежедневная цель</CardTitle>
        <CardDescription>10 новых слов в день</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Вы выучили 6 из 10 слов сегодня.</p>
      </CardContent>
      <CardFooter>
        <Button>Продолжить</Button>
      </CardFooter>
    </Card>
  ),
}
