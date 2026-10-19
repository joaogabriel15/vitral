/**
 * Contrato entre host e remote, fora do host mínimo: o loader só baixa este
 * módulo quando o host declara `contract` e o manifesto também.
 */
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
  if (c.version && !satisfies(c.version, range)) return `o host aceita contrato ${range}, o remote publica ${c.version}`
  const offered = protocol().settings().offered ?? {}
  for (const dep in c.peers) {
    const have = offered[dep]
    if (have && !satisfies(have, c.peers[dep])) return `o remote espera ${dep} ${c.peers[dep]}, o host oferece ${have}`
  }
}
