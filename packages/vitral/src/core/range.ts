/**
 * Faixas escritas por pessoas (contrato do host, `vitral doctor`). Fica fora do
 * host mínimo e do dedupe, que só leem as faixas geradas pelo plugin (`^1.2.3`):
 * para essas, `./semver` basta.
 *
 * `version` está na faixa `range`? Aceita a sintaxe do npm: `^1.2.3`,
 * `~1.2.3`, `>=1.2.3`, `>1`, `<2`, `<=1.4`, `1.2.3` (exata), `1.x`, `1.2.*`,
 * `*`, intervalos (`>=18 <20`, `1.2 - 2.3.4`) e alternativas (`^18 || ^19`).
 * Faixa parcial (`^2`, `~2.1`) vale como no npm. Versão com sufixo
 * (`19.0.0-rc.1`) só vale numa faixa que a escreve igual. Faixa que não dá
 * para ler não aceita nada (veja `validRange`).
 */
export function satisfiesRange(version: string, range: string): boolean {
  const v = parts(version)
  if (!v) return false
  const alts = range.split('||')
  if (version.includes('-')) return alts.some((a) => a.trim().replace(/^[=v]+/, '') === version.replace(/^v/, ''))
  const at = pad(v)
  return alts.some((a) => {
    const tests = alternative(a)
    return !!tests && tests.every((t) => t(at))
  })
}

/** A faixa segue a sintaxe que `satisfies` entende? */
export function validRange(range: string): boolean {
  return range.split('||').every((a) => !!alternative(a))
}

type Version = [number, number, number]
type Test = (v: Version) => boolean

const cmp = (a: Version, b: Version) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
const pad = (n: number[]): Version => [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0]
/** Limite de cima (exclusivo): soma um na posição `i` e zera o resto. */
const up = (n: number[], i: number): Version => pad([...n.slice(0, i), n[i] + 1])

/** Números escritos da versão (`1.x` → `[1]`); `null` se não é versão. */
function parts(s: string): number[] | null {
  const m = /^[=v]*(?:(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-[\w.-]+)?(?:\+[\w.-]+)?)?$/.exec(s.trim())
  if (!m) return null
  const out: number[] = []
  for (const p of m.slice(1, 4)) {
    if (p === undefined || /[xX*]/.test(p)) break
    out.push(+p)
  }
  return out
}

/** Comparadores de uma alternativa (todos precisam valer); `null` se inválida. */
function alternative(a: string): Test[] | null {
  const s = a.trim()
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(s)
  if (hyphen) {
    const lo = parts(hyphen[1])
    const hi = parts(hyphen[2])
    if (!lo || !hi) return null
    return [(v) => cmp(v, pad(lo)) >= 0, hi.length === 3 ? (v) => cmp(v, pad(hi)) <= 0 : hi.length ? (v) => cmp(v, up(hi, hi.length - 1)) < 0 : () => true]
  }
  if (!s) return [() => true]
  const out: Test[] = []
  for (const c of s.replace(/(\^|~>?|[<>]=?|=)\s+/g, '$1').split(/\s+/)) {
    const t = comparator(c)
    if (!t) return null
    out.push(t)
  }
  return out
}

function comparator(c: string): Test | null {
  const [, op = '', rest] = /^(\^|~>?|>=|<=|>|<|=)?(.*)$/.exec(c)!
  const n = parts(rest)
  if (!n) return null
  const k = n.length
  const lo = pad(n)
  const between = (hi: Version): Test => (v) => cmp(v, lo) >= 0 && cmp(v, hi) < 0
  if (!k) return op === '<' || op === '>' ? () => false : () => true
  switch (op) {
    case '^':
      // Até o primeiro número diferente de zero; com tudo zero, o último escrito.
      return between(up(n, Math.max(0, n.findIndex((x, i) => x !== 0 || i === k - 1))))
    case '~':
    case '~>':
      return between(up(n, k >= 2 ? 1 : 0))
    case '>=':
      return (v) => cmp(v, lo) >= 0
    case '<':
      return (v) => cmp(v, lo) < 0
    case '>':
      return k === 3 ? (v) => cmp(v, lo) > 0 : (v) => cmp(v, up(n, k - 1)) >= 0
    case '<=':
      return k === 3 ? (v) => cmp(v, lo) <= 0 : (v) => cmp(v, up(n, k - 1)) < 0
    default:
      return k === 3 ? (v) => cmp(v, lo) === 0 : between(up(n, k - 1))
  }
}
