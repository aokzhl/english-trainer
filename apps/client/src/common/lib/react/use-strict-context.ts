import { useContext, type Context } from 'react'

export const useStrictContext = <T>(context: Context<T | null>): T => {
  const value = useContext(context)
  if (value === null) throw new Error('Пустое значение контекста')
  return value
}
