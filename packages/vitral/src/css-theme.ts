/**
 * `theme: 'host'`: o remote usa o tema do host quando ele existe.
 *
 * Tira as variáveis declaradas nos blocos globais do remote (`:root`,
 * `:host`, `html`, `body`) e reescreve cada `var(--x)` como
 * `var(--x, <valor do build>)`. É o mesmo resultado do `theme(reference)` do
 * Tailwind v4, mas para qualquer CSS.
 */
import type { Root, Rule } from 'postcss'

// `:root`, `html.dark`, `:root[data-theme=dark]`, `:host`: sem combinador.
const GLOBAL = /^(?::root|:host|html|body)([.:[#][^\s>+~]*)?$/i
const CONDITIONAL = /^(?:media|supports|container|scope|starting-style)$/i

export function hostTheme(root: Root): void {
  const theme = new Map<string, string>()
  root.walkRules((rule: Rule) => {
    if (!rule.selectors.every((s) => GLOBAL.test(s.trim()))) return
    // Só o bloco sem condição e sem modificador vira valor de fallback.
    const base = rule.selectors.every((s) => !GLOBAL.exec(s.trim())![1]) && !insideConditional(rule)
    rule.each((node) => {
      if (node.type !== 'decl' || !node.prop.startsWith('--')) return
      if (base) theme.set(node.prop, node.value.trim())
      node.remove()
    })
    if (!rule.nodes.length) rule.remove()
  })
  if (!theme.size) return
  root.walkDecls((decl) => {
    if (/var\(/i.test(decl.value)) decl.value = withFallbacks(decl.value, theme, new Set())
  })
}

function insideConditional(rule: Rule): boolean {
  for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule' && CONDITIONAL.test((p as { name: string }).name)) return true
  }
  return false
}

function withFallbacks(value: string, theme: Map<string, string>, seen: Set<string>): string {
  return mapVars(value, (name, fallback) => {
    const own = theme.get(name)
    // O valor do build vence o fallback escrito: era ele que valia no remote.
    if (own !== undefined && !seen.has(name)) {
      return `var(${name}, ${withFallbacks(own, theme, new Set(seen).add(name))})`
    }
    return fallback === undefined ? `var(${name})` : `var(${name},${withFallbacks(fallback, theme, seen)})`
  })
}

/**
 * Chama `fn` para cada `var(--nome[, fallback])` de primeiro nível de `value`
 * e troca o trecho pelo retorno. `fallback` vem cru (pode ser `''`).
 */
export function mapVars(value: string, fn: (name: string, fallback: string | undefined) => string): string {
  let out = ''
  let i = 0
  for (;;) {
    const start = findVar(value, i)
    if (start < 0) return out + value.slice(i)
    const open = start + 4
    const close = matchParen(value, open)
    if (close < 0) return out + value.slice(i)
    const inner = value.slice(open, close)
    const comma = topLevelComma(inner)
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim()
    out += value.slice(i, start) + fn(name, comma < 0 ? undefined : inner.slice(comma + 1))
    i = close + 1
  }
}

function findVar(value: string, from: number): number {
  const re = /var\(/gi
  re.lastIndex = from
  for (let m = re.exec(value); m; m = re.exec(value)) {
    if (!/[\w-]/.test(value[m.index - 1] ?? '')) return m.index
  }
  return -1
}

// Posição do `)` que fecha o `(` em `open - 1`, pulando strings e escapes.
function matchParen(s: string, open: number): number {
  let depth = 1
  let quote = ''
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') i++
    else if (quote) quote = c === quote ? '' : quote
    else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')' && !--depth) return i
  }
  return -1
}

function topLevelComma(s: string): number {
  let depth = 0
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') i++
    else if (quote) quote = c === quote ? '' : quote
    else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && !depth) return i
  }
  return -1
}
