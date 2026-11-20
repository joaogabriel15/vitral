/**
 * Contrato entre host e remote, fora do host mínimo: o loader só baixa este
 * módulo quando o host declara `contract` e o manifesto também.
 */
import { tr } from './lang'
// Só este módulo usa: fica no chunk dele, sem arquivo a mais.
import { satisfiesRange, validRange } from './range'

// `vitral doctor` lê daqui, para as faixas ficarem neste chunk.
export { satisfiesRange }
import { protocol } from './state'
import type { RemoteContract } from './types'

/**
 * Devolve o motivo para recusar o remote (o loader lança `CONTRACT_MISMATCH`)
 * ou `undefined`. Recusa se a versão do contrato estiver fora da faixa do host (a
 * da entrada, `range`, ou a de `configure`), ou se o host oferece (com
 * `dedupe`) uma dependência fora da faixa que o remote espera. Dependência
 * que o host não oferece não conta: o remote usa a própria cópia.
 */
export async function checkContract(c: RemoteContract, range = protocol().settings().contract!): Promise<string | undefined> {
  // Sem imports estáticos de ./semver, ./dedupe ou ./errors: o bundler
  // separaria esses módulos em chunks próprios, e todo host baixaria um
  // arquivo a mais mesmo sem usar contrato.
  const { satisfies } = await import('./dedupe')
  if (!validRange(range))
    return tr(`a faixa de contrato ${range} do host não é uma faixa de versão válida (ex.: '^2', '^1 || ^2', '>=2 <4')`, `the host contract range ${range} is not a valid version range (e.g. '^2', '^1 || ^2', '>=2 <4')`)
  if (c.version && !satisfiesRange(c.version, range)) return tr(`o host aceita contrato ${range}, o remote publica ${c.version}`, `the host accepts contract ${range}, the remote publishes ${c.version}`)
  const offered = protocol().settings().offered ?? {}
  for (const dep in c.peers) {
    const have = offered[dep]
    if (have && !satisfies(have, c.peers[dep])) return tr(`o remote espera ${dep} ${c.peers[dep]}, o host oferece ${have}`, `the remote expects ${dep} ${c.peers[dep]}, the host offers ${have}`)
  }
}
