/**
 * `version` está na faixa `range`? Aceita `^1.2.3`, `~1.2.3`, `>=1.2.3`,
 * `1.2.3` (exata) e `*`. Versão com sufixo (`19.0.0-rc.1`) só vale na
 * faixa exata.
 */
export function satisfies(version: string, range: string): boolean {
  if (range === '*') return true
  const [, op = '', want = ''] = /^(\^|~|>=|=)?(.*)$/.exec(range.trim())!
  if (!op || op === '=' || version.includes('-')) return version === want
  const v = version.split('.').map(Number)
  const w = want.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (v[i] !== w[i]) {
    if (!(v[i] > w[i])) return false
    break
  }
  if (op === '>=') return true
  // ~: mesmo minor. ^: mesmo primeiro número diferente de zero.
  const fixed = op === '~' ? 2 : w[0] ? 1 : w[1] ? 2 : 3
  return v.slice(0, fixed).join('.') === w.slice(0, fixed).join('.')
}
