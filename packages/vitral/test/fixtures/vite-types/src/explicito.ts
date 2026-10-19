// Remote com tipos explícitos nos exports: o Oxc lê sem o TypeScript.
import type { Produto } from './tipos'

export interface Opcoes {
  tema?: 'claro' | 'escuro' | null
  limite: number
  [extra: string]: unknown
}

type Ouvinte = (id: number) => void

export default {
  mount(el: HTMLElement, props: { opcoes: Opcoes; produto: Readonly<Produto>; on: Ouvinte; tags: readonly string[]; vitral?: unknown }): { unmount(): void } {
    el.textContent = String(props.opcoes.limite)
    return { unmount: () => el.replaceChildren() }
  },
}
