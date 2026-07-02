import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createDi } from './create-di'

describe('createDi', () => {
  it('throws when used outside its provider', () => {
    const { useDi } = createDi<{ n: number }>()
    function Probe() {
      useDi()
      return null
    }
    expect(() => render(<Probe />)).toThrow('Пустое значение контекста')
  })

  it('provides the injected value to consumers', () => {
    const { Injector, useDi } = createDi<{ n: number }>()
    const value = { n: 42 }
    let captured: { n: number } | undefined
    function Probe() {
      captured = useDi()
      return null
    }
    render(
      <Injector value={value}>
        <Probe />
      </Injector>,
    )
    expect(captured).toBe(value)
  })
})
