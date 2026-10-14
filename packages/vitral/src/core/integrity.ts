import { RemoteError } from './errors'

const clean = (b64: string) => b64.replace(/-/g, '+').replace(/_/g, '/').replace(/=/g, '')

/**
 * Confere `bytes` contra um `integrity` no formato SRI completo: vários hashes
 * separados por espaço, base64 ou base64url, opções `?…` ignoradas. Como no
 * navegador, só o algoritmo mais forte presente decide. O hash é calculado
 * sobre os bytes, nunca sobre o texto decodificado.
 */
export async function verifyIntegrity(name: string, bytes: ArrayBuffer, integrity: string): Promise<void> {
  const hashes = integrity
    .split(/\s+/)
    .map((token) => /^sha(256|384|512)-([\w+/=-]+)/.exec(token))
    .filter((m): m is RegExpExecArray => !!m)
  if (!hashes.length) throw new RemoteError('INTEGRITY', name, `formato de integrity inválido: ${integrity}`)
  const bits = Math.max(...hashes.map((m) => +m[1]))
  const actual = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-' + bits, bytes))))
  const expected = hashes.filter((m) => +m[1] === bits).map((m) => m[2])
  if (!expected.some((h) => clean(h) === clean(actual))) {
    throw new RemoteError('INTEGRITY', name, `o hash não confere: esperado sha${bits}-${expected.join(' ou ')}, obtido sha${bits}-${actual}`)
  }
}
