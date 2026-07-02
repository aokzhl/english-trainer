import { createContext } from 'react'

export const createStrictContext = <T>() => createContext<T | null>(null)
