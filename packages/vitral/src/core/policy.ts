/**
 * Quanto baixar além do que a página usa agora, pelos sinais de rede e
 * aparelho do visitante. Uma tabela de heurística, no lugar do aprendizado
 * por reforço do Alohamora (NSDI'21):
 *
 * | Sinal                                   | Política     |
 * | --------------------------------------- | ------------ |
 * | `saveData`, ou rede `slow-2g` / `2g`     | `'lazy'`     |
 * | rede `3g`, ou memória até 2 GB           | `'critical'` |
 * | o resto, ou sem sinal                    | `'all'`      |
 *
 * A rede é o `effectiveType` que o navegador calcula com o RTT e a banda
 * medidos (ECT). Chrome e Edge dão os sinais; Safari e Firefox, não, e lá
 * vale `'all'`.
 *
 * - `'all'`: tudo que o host pediu.
 * - `'critical'`: sem o preload ocioso dos outros remotes e sem os chunks
 *   das rotas (`warmRoutes`), que baixam sem saber se vão ser usados. O
 *   prefetch previsto (`vitral/prefetch`) e o `prefetch="idle"` de um remote
 *   da página continuam: na rede lenta é onde eles economizam mais tempo.
 * - `'lazy'`: só o que a página usa agora. O remote que já veio com HTML do
 *   servidor só hidrata quando aparece na tela.
 *
 * `configure({ policy })` fixa uma política.
 */
import { protocol } from './state'

export type Policy = 'all' | 'critical' | 'lazy'

/** Sinais do navegador (Network Information, Device Memory) ou dos Client Hints. */
export interface Signals {
  saveData?: boolean
  /** `slow-2g`, `2g`, `3g` ou `4g`. */
  effectiveType?: string
  /** Memória do aparelho, em GB (arredondada pelo navegador). */
  deviceMemory?: number
}

/** A tabela de heurística. Sinal ausente não conta. */
export function choose(s: Signals): Policy {
  // `undefined` em comparação dá `false`: só o sinal presente decide.
  return s.saveData || /2g/.test(s.effectiveType!) ? 'lazy' : s.effectiveType == '3g' || s.deviceMemory! <= 2 ? 'critical' : 'all'
}

/** Os sinais deste navegador. */
export function signals(): Signals {
  const n = (typeof navigator == 'object' ? navigator : {}) as Navigator & { connection?: Signals; deviceMemory?: number }
  return { saveData: n.connection?.saveData, effectiveType: n.connection?.effectiveType, deviceMemory: n.deviceMemory }
}

/**
 * Os sinais dos Client Hints de uma requisição (`Save-Data`, `ECT`,
 * `Device-Memory`), para o servidor decidir. O Chrome só manda os dois
 * últimos depois de um `Accept-CH: ECT, Device-Memory`.
 */
export function signalsFrom(headers: Headers | Record<string, string | string[] | undefined>): Signals {
  const get = (k: string): string | undefined => {
    if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(k) ?? undefined
    const v = (headers as Record<string, string | string[] | undefined>)[k]
    return Array.isArray(v) ? v[0] : v
  }
  const memory = Number(get('device-memory'))
  return { saveData: get('save-data') === 'on' || undefined, effectiveType: get('ect'), deviceMemory: Number.isFinite(memory) && get('device-memory') ? memory : undefined }
}

/**
 * A política deste visitante agora: a de `configure({ policy })`, ou a
 * tabela. A mesma conta de `choose(signals())`, escrita de novo para o
 * núcleo não carregar as duas funções.
 */
export function policy(): Policy {
  const n: any = typeof navigator == 'object' ? navigator : {}
  const c = n.connection || {}
  return protocol().settings().policy || (c.saveData || /2g/.test(c.effectiveType) ? 'lazy' : c.effectiveType == '3g' || n.deviceMemory <= 2 ? 'critical' : 'all')
}
