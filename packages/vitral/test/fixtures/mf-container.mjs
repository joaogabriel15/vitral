// Container do Module Federation (o protocolo de um remoteEntry.js): `init`
// recebe o share scope do host e `get` devolve a fábrica de cada parte. A
// parte `./Carrinho` usa `libx` do host se a versão for 1.x; senão, a própria.
export const inits = []
const own = { quem: 'remote' }
let libx = own

export function init(scope) {
  inits.push(scope)
  const offered = scope.libx && Object.entries(scope.libx).find(([v]) => v.startsWith('1.'))
  libx = offered ? null : own
  return offered ? offered[1].get().then((factory) => void (libx = factory())) : undefined
}

const parts = {
  './Carrinho': () => ({
    mount(el, props, ctx) {
      el.textContent = `${ctx.name}:${props.n}:${libx.quem}`
      return { update: (p) => (el.textContent = `${ctx.name}:${p.n}:${libx.quem}`), unmount: () => (el.textContent = '') }
    },
  }),
  './Contador': () => ({ default: (props) => `contador ${props.n}`, extra: 1 }),
  './api': () => ({ soma: (a, b) => a + b }),
}

export function get(key) {
  if (!parts[key]) return Promise.reject(new Error(`Module "${key}" does not exist in container.`))
  return Promise.resolve(parts[key])
}
