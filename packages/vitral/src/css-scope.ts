/**
 * Reescreve o CSS de um remote para valer só dentro dele.
 *
 * Todo seletor ganha o prefixo `[data-vitral-scope="nome"]`, e seletores
 * globais (`:root`, `:host`, `html`, `body`) passam a apontar para o próprio
 * elemento raiz do remote. Assim o preflight e o tema do Tailwind (ou qualquer
 * reset global) do remote não mexem no host nem nos outros remotes.
 *
 * Com `native`, o CSS vai inteiro num `@scope ([data-vitral-scope="nome"])`
 * (Baseline desde dezembro de 2025): os seletores ficam como estão, sem os
 * ~30 bytes do prefixo em cada um, e os globais viram `:scope`. Diferença:
 * o `@scope` não soma especificidade, e o prefixo soma (0,1,0). Uma regra do
 * host com a mesma especificidade, carregada depois, passa a valer dentro do
 * remote. Uma `@layer` do lado do remote não resolve: CSS fora de layer (o do
 * host, em geral) vence o que está em layer.
 */
import postcss, { type AtRule, type Root, type Rule } from 'postcss'

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

export function scopeCss(css: string, scopeName: string, native = false): string {
  const root: Root = postcss.parse(css)
  scopeRoot(root, scopeName, native)
  return root.toString()
}

/** At-rules que não podem (ou não precisam) ficar dentro de `@scope`: são globais por natureza. */
const TOP = /^(charset|import|namespace|keyframes|-webkit-keyframes|font-face|property|counter-style|font-feature-values|font-palette-values|page|view-transition)$/i

export function scopeRoot(root: Root, scopeName: string, native = false): void {
  const scope = `[data-vitral-scope="${scopeName}"]`
  if (native) return nativeScope(root, scope)
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
}

/** Tudo num `@scope`; os seletores globais apontam para a raiz (`:scope`). */
function nativeScope(root: Root, scope: string): void {
  root.walkRules((rule: Rule) => {
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test((p as AtRule).name)) return
    rule.selectors = rule.selectors.map((sel) => {
      const s = sel.trim()
      const m = s.match(GLOBAL)
      return m ? ':scope' + s.slice(m[0].length) : s === '*' ? ':scope, *' : s
    })
  })
  const block = postcss.atRule({ name: 'scope', params: `(${scope})` })
  for (const node of [...root.nodes]) {
    // `@layer` (bloco ou só a ordem) vai para dentro, no lugar: a ordem das layers continua a mesma.
    if (!(node.type === 'atrule' && TOP.test(node.name)) && node.type !== 'comment') block.append(node)
  }
  if (block.nodes?.length) root.append(block)
}
