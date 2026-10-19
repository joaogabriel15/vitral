/**
 * `version` está na faixa `range`? Aceita `^1.2.3`, `~1.2.3`, `>=1.2.3`,
 * `1.2.3` (exata) e `*`. Faixa parcial (`^2`, `~2.1`) vale como no npm.
 * Versão com sufixo (`19.0.0-rc.1`) só vale na faixa exata.
 */
export function satisfies(version: string, range: string): boolean {
  if (range === '*') return true
  const [, op = '', want = ''] = /^(\^|~|>=|=)?(.*)$/.exec(range.trim())!
  if (!op || op === '=' || version.includes('-')) return version === want
  // O que falta na versão ou na faixa vale zero.
  const [v, w] = [version, want].map((s) => (s + '.0.0').split('.', 3).map(Number))
  for (let i = 0; i < 3; i++) if (v[i] !== w[i]) {
    if (!(v[i] > w[i])) return false
    break
  }
  if (op === '>=') return true
  // ~: mesmo minor. ^: mesmo primeiro número diferente de zero. Nunca mais
  // números do que a faixa escreveu (`^0` aceita qualquer 0.x).
  const fixed = Math.min(want.split('.').length, op === '~' ? 2 : w[0] ? 1 : w[1] ? 2 : 3)
  return v.slice(0, fixed).join('.') === w.slice(0, fixed).join('.')
}
