/**
 * `vitral prior`: as transições da população para o `prior` de
 * `vitral/prefetch`, a partir de sessões agregadas (uma por linha, um array
 * JSON de rotas, ou `{ "path": [...] }`). Só entram transições vistas por
 * muita gente, para o arquivo público não contar o caminho de ninguém.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Prior } from '../core/markov'

export interface PriorOptions {
  /** Contagem mínima de uma transição. Padrão 5. */
  minCount?: number
  /** Total mínimo de transições saindo de uma rota. Padrão 20. */
  minRow?: number
  /** Destinos por rota. Padrão 10. */
  top?: number
}

/** Conta as transições das sessões e tira as raras. */
export function buildPrior(lines: string[], o: PriorOptions = {}): Prior {
  const { minCount = 5, minRow = 20, top = 10 } = o
  const t: Record<string, Record<string, number>> = Object.create(null)
  for (const line of lines) {
    if (!line.trim()) continue
    let s: unknown
    try {
      s = JSON.parse(line)
    } catch {
      continue
    }
    const path = Array.isArray(s) ? s : (s as { path?: unknown })?.path
    if (!Array.isArray(path)) continue
    for (let i = 1; i < path.length; i++) {
      const [a, b] = [path[i - 1], path[i]]
      if (typeof a !== 'string' || typeof b !== 'string' || a === b || a === '__proto__' || b === '__proto__') continue
      const row = (t[a] ??= Object.create(null))
      row[b] = (row[b] ?? 0) + 1
    }
  }
  const out: Prior['t'] = {}
  for (const from of Object.keys(t).sort()) {
    const kept = Object.entries(t[from])
      .filter(([, n]) => n >= minCount)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
      .slice(0, top)
    if (kept.reduce((a, [, n]) => a + n, 0) >= minRow) out[from] = Object.fromEntries(kept)
  }
  return { t: out }
}

export function prior(file: string, out: string | undefined, o: PriorOptions): void {
  const p = buildPrior(readFileSync(file, 'utf8').split('\n'), o)
  const json = JSON.stringify(p)
  if (out) {
    writeFileSync(out, json + '\n')
    console.log(`[vitral] ${Object.keys(p.t).length} rotas em ${out}`)
  } else console.log(json)
}
