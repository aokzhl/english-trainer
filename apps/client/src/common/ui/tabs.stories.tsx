import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="cards" className="w-80">
      <TabsList>
        <TabsTrigger value="cards">Карточки</TabsTrigger>
        <TabsTrigger value="quiz">Викторина</TabsTrigger>
        <TabsTrigger value="spelling">Письмо</TabsTrigger>
      </TabsList>
      <TabsContent value="cards">Карточки</TabsContent>
      <TabsContent value="quiz">Викторина</TabsContent>
      <TabsContent value="spelling">Письмо</TabsContent>
    </Tabs>
  ),
}
