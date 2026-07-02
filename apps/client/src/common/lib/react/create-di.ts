import { createStrictContext } from './create-strict-context'
import { useStrictContext } from './use-strict-context'

export const createDi = <T>() => {
  const injector = createStrictContext<T>()
  const useDi = () => useStrictContext(injector)
  return { Injector: injector.Provider, useDi }
}
