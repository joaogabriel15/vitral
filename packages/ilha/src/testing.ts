/**
 * Utilidades de teste: monte o host sem subir nenhum remote de verdade.
 *
 *   import { mockRemote } from 'ilha/testing'
 *   const carrinho = mockRemote('carrinho', (el, props) => (el.textContent = `itens: ${props.itens}`))
 *   render(<App />)
 *   expect(carrinho.lastProps).toEqual({ itens: 2 })
 */
import { register, type Props, type RemoteContext } from './index'

export interface MockRemote<P extends Props = Props> {
  /** Quantas vezes foi montado. */
  readonly mounts: number
  /** Props mais recentes recebidas (mount ou update). */
  readonly lastProps: P | undefined
  /** Contexto da última montagem (eventos, navigate…). */
  readonly ctx: RemoteContext | undefined
  /** Está montado agora? */
  readonly mounted: boolean
}

/** Registra um remote falso. `render` é chamado no mount e a cada update. */
export function mockRemote<P extends Props = Props>(
  name: string,
  render: (el: HTMLElement, props: P, ctx: RemoteContext) => void = (el) => {
    el.setAttribute('data-mock-remote', name)
  },
): MockRemote<P> {
  const stats = { mounts: 0, lastProps: undefined as P | undefined, ctx: undefined as RemoteContext | undefined, mounted: false }
  register(name, {
    module: {
      mount(el, props, ctx) {
        stats.mounts++
        stats.mounted = true
        stats.lastProps = props as P
        stats.ctx = ctx
        render(el, props as P, ctx)
        return {
          update(next) {
            stats.lastProps = next as P
            render(el, next as P, ctx)
          },
          unmount() {
            stats.mounted = false
            el.replaceChildren()
          },
        }
      },
    },
  })
  return stats
}

/** Remote que sempre falha ao montar, para testar telas de erro. */
export function failingRemote(name: string, message = 'falha simulada'): void {
  register(name, {
    module: {
      mount() {
        throw new Error(message)
      },
    },
  })
}

export { __reset as resetIlha } from './index'
