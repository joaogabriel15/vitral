/**
 * `dedupe` do protocolo, fora do host mínimo: o primeiro que precisa (loader
 * com build dividido, componente de host, `configure({ dedupe })`) instala o
 * método no protocolo da página. Funciona mesmo num protocolo criado por uma
 * cópia antiga da lib.
 */
import { satisfies } from './semver'
import type { Offer, Protocol } from './state'
import type { VitralConfig } from './types'

export { satisfies }

const KEY = 'vitral:dedupe:'
const remembered = (k: string) => {
  try {
    return localStorage.getItem(KEY + k)
  } catch {
    return null
  }
}
const remember = (k: string, url: string) => {
  try {
    localStorage.setItem(KEY + k, url)
  } catch {}
}

/** Instala `dedupe` no protocolo, se ainda não houver, e devolve o método. */
export function shared(p: Protocol): NonNullable<Protocol['dedupe']> {
  if (!p.dedupe) {
    type Entry = Offer & { p?: Promise<any> }
    const offers = new Map<string, Entry[]>()
    const waiting = new Map<string, (o: Entry) => void>()
    const drop = (list: Entry[], o: Entry) => list.includes(o) && list.splice(list.indexOf(o), 1)
    const start = (name: string, list: Entry[], o: Entry): Promise<any> => {
      if (!o.p) {
        ;(o.p = o.load()).catch(() => drop(list, o))
        if (o.url) o.p.then(() => remember(`${name}@${o.version}`, o.url!), () => {})
      }
      return o.p
    }
    p.dedupe = (name, range, offer) => {
      const own = offer as Entry | undefined
      const list = offers.get(name) ?? []
      offers.set(name, list)
      if (own?.url) waiting.get(name + own.url)?.(own)
      let hit = list.find((o) => satisfies(o.version, range))
      if (!hit && own) {
        hit = list[list.push(own) - 1]
        // Na visita anterior esta versão veio de outra URL, que está no cache
        // HTTP. Os remotes chegam quase juntos: espera um pouco pela oferta dela.
        const want = own.url && remembered(`${name}@${own.version}`)
        if (want && want !== own.url) {
          own.p = new Promise<Entry>((resolve) => {
            waiting.set(name + want, resolve)
            setTimeout(resolve, 300, own)
          }).then((o) => {
            waiting.delete(name + want)
            if (o === own) own.p = undefined
            return start(name, list, o)
          })
          own.p.catch(() => drop(list, own))
        }
      }
      return hit && start(name, list, hit)
    }
  }
  return p.dedupe
}

/** Oferece os módulos do host, como em `configure({ dedupe })`. */
export function offer(p: Protocol, groups: NonNullable<VitralConfig['dedupe']>): void {
  for (const name in groups) {
    const { version, modules } = groups[name]
    shared(p)(name, version, { version, load: async () => modules })
    // O contrato confere só o que o próprio host oferece.
    p.configure({ offered: { ...p.settings().offered, [name]: version } })
  }
}
