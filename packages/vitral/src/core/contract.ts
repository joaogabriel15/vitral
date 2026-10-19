/**
 * Contrato entre host e remote, fora do host mínimo: o loader só baixa este
 * módulo quando o host declara `contract` e o manifesto também.
 */
import { RemoteError } from './errors'
import { satisfies } from './semver'
import { protocol } from './state'
import type { RemoteContract } from './types'

/**
 * Recusa o remote se a versão do contrato estiver fora da faixa do host (a
 * da entrada, `range`, ou a de `configure`), ou se o host oferece (com
 * `dedupe`) uma dependência fora da faixa que o remote espera. Dependência
 * que o host não oferece não conta: o remote usa a própria cópia.
 */
export function checkContract(name: string, c: RemoteContract, range = protocol().settings().contract!): void {
  const fail = (msg: string) => {
    throw new RemoteError('CONTRACT_MISMATCH', name, msg)
  }
  if (c.version && !satisfies(c.version, range)) fail(`o host aceita contrato ${range}, o remote publica ${c.version}`)
  const offered = protocol().settings().offered ?? {}
  for (const dep in c.peers) {
    const have = offered[dep]
    if (have && !satisfies(have, c.peers[dep])) fail(`o remote espera ${dep} ${c.peers[dep]}, o host oferece ${have}`)
  }
}
