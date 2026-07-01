import { expect, test } from 'vitest'
import { loginBodySchema, registerBodySchema } from '../src/auth'

test('валидные email и пароль проходят регистрацию', () => {
  const r = registerBodySchema.safeParse({ email: 'a@b.co', password: 'abc12345' })
  expect(r.success).toBe(true)
})

test.each([
  ['короткий', 'a1b2c3'],
  ['без цифр', 'abcdefgh'],
  ['без букв', '12345678'],
])('пароль %s отклоняется при регистрации', (_name, password) => {
  const r = registerBodySchema.safeParse({ email: 'a@b.co', password })
  expect(r.success).toBe(false)
})

test('некорректный email отклоняется', () => {
  const r = registerBodySchema.safeParse({ email: 'не-email', password: 'abc12345' })
  expect(r.success).toBe(false)
})

test('логин не навязывает политику пароля, но требует непустой', () => {
  expect(loginBodySchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  expect(loginBodySchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
})
