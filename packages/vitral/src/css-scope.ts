/**
 * Reescreve o CSS de um remote para valer só dentro dele.
 *
 * Todo seletor ganha o prefixo `[data-vitral-scope="nome"]`, e seletores
 * globais (`:root`, `:host`, `html`, `body`) passam a apontar para o próprio
 * elemento raiz do remote. Assim o preflight e o tema do Tailwind (ou qualquer
 * reset global) do remote não mexem no host nem nos outros remotes.
 */
import postcss, { type Root, type Rule } from 'postcss'

const GLOBAL = /^(?::root|:host(?:\([^)]*\))?|html|body)(?![\w-])/

export function scopeSelector(selector: string, scope: string): string {
  const s = selector.trim()
  // `:root .x`, `html.dark .x`, `:host([dark]) .x` → raiz do remote
  const m = s.match(GLOBAL)
  if (m) {
    return scope + s.slice(m[0].length)
  }
  // `*` e pseudo-elementos soltos também valem para a própria raiz
  if (s === '*') return `${scope}, ${scope} *`
  return `${scope} ${s}`
}

export function scopeCss(css: string, scopeName: string): string {
  const scope = `[data-vitral-scope="${scopeName}"]`
  const root: Root = postcss.parse(css)
  root.walkRules((rule: Rule) => {
    // Dentro de @keyframes os "seletores" são 0%, from, to.
    let p = rule.parent
    while (p && p.type !== 'root') {
      if (p.type === 'atrule' && /keyframes$/i.test((p as postcss.AtRule).name)) return
      // Regras aninhadas (CSS nesting) herdam o escopo do pai.
      if (p.type === 'rule') return
      p = p.parent
    }
    rule.selectors = rule.selectors.map((sel) => scopeSelector(sel, scope))
  })
  return root.toString()
}
