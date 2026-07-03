import type { Meta, StoryObj } from '@storybook/react-vite'
import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel } from './form'
import { Input } from './input'

type FormValues = { word: string }

function FormDemo() {
  const form = useForm<FormValues>({ defaultValues: { word: '' } })

  return (
    <Form {...form}>
      <form className="w-80">
        <FormField
          control={form.control}
          name="word"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Слово</FormLabel>
              <FormControl>
                <Input placeholder="например, resilient" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

const meta = {
  title: 'UI/Form',
  component: FormDemo,
  tags: ['autodocs'],
} satisfies Meta<typeof FormDemo>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: {} }
