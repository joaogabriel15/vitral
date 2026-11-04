/**
 * Escolha de versão do `dedupe` para todos os remotes de uma vez, no build
 * ou no servidor do host. No navegador, cada remote pega a primeira oferta
 * que serve, na ordem em que chega: com um remote em `^1.0` (cópia 1.2) e
 * outro em `^1.3` (cópia 1.4), a página baixa as duas, embora a 1.4 sirva
 * aos dois. Aqui, com os manifestos de todos, cada grupo fica com o menor
 * conjunto de versões que atende todas as faixas (a oferta do host primeiro,
 * depois as mais novas), e cada remote recebe a cópia que deve usar.
 *
 * Cada grupo é um pacote só, sem dependências entre grupos: o problema do
 * PubGrub fica reduzido a uma cobertura de conjuntos pequena, resolvida
 * exata até 12 versões candidatas. O conflito sai explicado em texto.
 */
import { satisfies } from './semver'
import type { RemoteManifest } from './types'

/** A cópia de outro remote que um remote usa no lugar da própria. */
export interface PlannedCopy {
  /** Faixa e versão da cópia própria que esta substitui (`^1.0.0@1.2.0`): outro deploy do remote não usa o plano. */
  for?: string
  version: string
  /** URL da cópia (absoluta, ou a partir da raiz do site). */
  file: string
  chunks?: string[]
  /** Hash SRI da cópia e dos chunks dela, pela mesma URL. */
  sri?: Record<string, string>
}

/** Por remote, por grupo: a cópia a usar. Remote ou grupo fora do plano segue como antes. */
export type DedupePlan = Record<string, Record<string, PlannedCopy>>

interface Need {
  remote: string
  range: string
  copy: PlannedCopy
}

const parts = (v: string) => v.split(/[.-]/).map((n) => Number(n) || 0)
/** Ordem decrescente de versão. */
const newer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return 0
}

/**
 * `remotes`: nome → `{ url, manifest }`. `host`: versão de cada grupo que o
 * host oferece (o React do host entra como `react`).
 */
export function planDedupe(remotes: Record<string, { url: string; manifest: RemoteManifest }>, host: Record<string, string> = {}): { plan: DedupePlan; notes: string[] } {
  const groups = new Map<string, Need[]>()
  for (const [remote, { url, manifest }] of Object.entries(remotes)) {
    if (!manifest.split) continue
    const base = new URL(url, 'http://host.invalid/')
    const at = (f: string) => {
      const u = new URL(f, base)
      return u.origin === 'http://host.invalid' ? u.pathname + u.search : u.href
    }
    for (const d of manifest.dedupe ?? []) {
      const files = [d.file, ...(d.chunks ?? [])]
      const sri = Object.fromEntries(files.filter((f) => manifest.files?.[f]).map((f) => [at(f), manifest.files![f]]))
      const copy: PlannedCopy = { version: d.version, file: at(d.file), ...(d.chunks?.length && { chunks: d.chunks.map(at) }), sri }
      ;(groups.get(d.name) ?? groups.set(d.name, []).get(d.name)!).push({ remote, range: d.range, copy })
    }
  }
  const plan: DedupePlan = {}
  const notes: string[] = []
  for (const [group, needs] of groups) {
    // Candidatas: a oferta do host e uma cópia por versão, da mais nova para a mais velha.
    const copies = new Map<string, PlannedCopy | null>()
    if (host[group]) copies.set(host[group], null)
    for (const n of [...needs].sort((a, b) => newer(a.copy.version, b.copy.version))) if (!copies.has(n.copy.version)) copies.set(n.copy.version, n.copy)
    const versions = [...copies.keys()]
    const chosen = cover(versions, needs.map((n) => n.range), host[group])
    if (chosen.length > 1) {
      const by = (v: string) => needs.filter((n) => pick(chosen, n.range, host[group]) === v).map((n) => `${n.remote} (${n.range})`)
      notes.push(`${group}: as faixas não têm uma versão em comum; a página com todos os remotes baixa ${chosen.length} cópias: ${chosen.map((v) => `${v}${copies.get(v) === null ? ' do host' : ''} para ${by(v).join(', ')}`).join('; ')}.`)
    }
    for (const n of needs) {
      const v = pick(chosen, n.range, host[group])
      const copy = v ? copies.get(v) : undefined
      // A própria cópia ou a oferta do host: o navegador já resolve sozinho.
      if (!copy || v === n.copy.version) continue
      ;(plan[n.remote] ??= {})[group] = { ...copy, for: `${n.range}@${n.copy.version}` }
    }
  }
  return { plan, notes }
}

/** A versão de `chosen` para `range`: a do host, se serve; senão a mais nova que serve. */
function pick(chosen: string[], range: string, host?: string): string | undefined {
  if (host && chosen.includes(host) && satisfies(host, range)) return host
  return chosen.filter((v) => satisfies(v, range)).sort(newer)[0]
}

/**
 * Menor conjunto de `versions` que atende todas as `ranges`. No empate,
 * fica o que tem a oferta do host e, depois, as versões mais novas. Exato
 * até 12 candidatas; acima disso, guloso (a que atende mais faixas primeiro).
 */
function cover(versions: string[], ranges: string[], host?: string): string[] {
  const serves = versions.map((v) => ranges.map((r) => satisfies(v, r)))
  const ok = (set: number[]) => ranges.every((_, j) => set.some((i) => serves[i][j]))
  const score = (set: number[]) => (set.some((i) => versions[i] === host) ? 1e6 : 0) - set.reduce((a, i) => a + i, 0)
  if (versions.length <= 12) {
    for (let size = 1; size <= versions.length; size++) {
      let best: number[] | undefined
      for (let mask = 0; mask < 1 << versions.length; mask++) {
        const set = versions.map((_, i) => i).filter((i) => mask & (1 << i))
        if (set.length === size && ok(set) && (!best || score(set) > score(best))) best = set
      }
      if (best) return best.map((i) => versions[i])
    }
  }
  const left = new Set(ranges.map((_, j) => j))
  const out: string[] = []
  while (left.size) {
    let best = -1
    let count = 0
    for (let i = 0; i < versions.length; i++) {
      const c = [...left].filter((j) => serves[i][j]).length
      if (c > count) (best = i), (count = c)
    }
    if (best < 0) break
    out.push(versions[best])
    for (const j of [...left]) if (serves[best][j]) left.delete(j)
  }
  return out
}
