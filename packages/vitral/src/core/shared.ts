/**
 * `dedupe` do protocolo, fora do host mínimo: o primeiro que precisa (loader
 * com build dividido, componente de host, `configure({ dedupe })`) instala o
 * método no protocolo da página. Funciona mesmo num protocolo criado por uma
 * cópia antiga da lib.
 */
import { satisfies } from './semver'
import type { Offer, Protocol } from './state'
import type { VitralConfig } from './types'

/** Instala `dedupe` no protocolo, se ainda não houver, e devolve o método. */
export function shared(p: Protocol): NonNullable<Protocol['dedupe']> {
  if (!p.dedupe) {
    const offers = new Map<string, (Offer & { p?: Promise<any> })[]>()
    p.dedupe = (name, range, own) => {
      const list = offers.get(name) ?? []
      offers.set(name, list)
      const hit = list.find((o) => satisfies(o.version, range)) ?? (own && list[list.push(own) - 1])
      if (!hit) return
      if (!hit.p) (hit.p = hit.load()).catch(() => list.splice(list.indexOf(hit), 1))
      return hit.p
    }
  }
  return p.dedupe
}

/** Oferece os módulos do host, como em `configure({ dedupe })`. */
export function offer(p: Protocol, groups: NonNullable<VitralConfig['dedupe']>): void {
  for (const name in groups) {
    const { version, modules } = groups[name]
    shared(p)(name, version, { version, load: async () => modules })
  }
}
