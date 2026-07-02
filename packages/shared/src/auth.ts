import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Пароль должен быть не короче 8 символов')
  .regex(/[a-zа-яё]/i, 'Пароль должен содержать хотя бы одну букву')
  .regex(/\d/, 'Пароль должен содержать хотя бы одну цифру')

export const registerBodySchema = z.object({
  email: z.email('Некорректный email'),
  password: passwordSchema,
})
export type RegisterBody = z.infer<typeof registerBodySchema>

export const loginBodySchema = z.object({
  email: z.email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
})
export type LoginBody = z.infer<typeof loginBodySchema>

export const authResponseSchema = z.object({
  accessToken: z.string(),
})
export type AuthResponse = z.infer<typeof authResponseSchema>
