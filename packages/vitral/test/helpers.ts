import { __reset } from '../src/index'

/** Espera promessas e microtasks pendentes (montagem é assíncrona). */
export const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0))
}

export function cleanup() {
  document.body.replaceChildren()
  __reset()
}
