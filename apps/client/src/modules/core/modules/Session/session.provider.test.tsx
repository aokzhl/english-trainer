import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSessionStore } from './session.store'
import { SessionProvider, useSessionStore } from './session.provider'

describe('SessionProvider', () => {
  it('exposes the injected session store via useSessionStore', () => {
    const store = createSessionStore()
    let captured: unknown
    function Probe() {
      captured = useSessionStore()
      return null
    }
    render(
      <SessionProvider value={store}>
        <Probe />
      </SessionProvider>,
    )
    expect(captured).toBe(store)
  })
})
