import { describe, expect, it } from 'vitest'
import { scopeCss } from '../src/css-scope'

const S = '[data-vitral-scope="x"]'

describe('scopeCss', () => {
  it('prefixa seletores e mapeia :root/:host/html/body para a raiz do remote', () => {
    const out = scopeCss(':root, :host { --c: red } html { line-height: 1.5 } body { margin: 0 } .h-\\[10px\\] { height: 10px }', 'x')
    expect(out).toContain(`${S}, ${S} { --c: red }`)
    expect(out).toContain(`${S} { line-height: 1.5 }`)
    expect(out).toContain(`${S} { margin: 0 }`)
    expect(out).toContain(`${S} .h-\\[10px\\]`)
  })

  it('preflight (*) vale para a raiz e descendentes', () => {
    expect(scopeCss('* { box-sizing: border-box }', 'x')).toContain(`${S}, ${S} * {`)
  })

  it('não mexe em @keyframes nem em @property, e entra em @layer/@media', () => {
    const out = scopeCss('@keyframes spin { from { a: 1 } to { a: 2 } } @property --tw-x { syntax: "*" } @layer utilities { @media (min-width: 1px) { .p-4 { padding: 1rem } } }', 'x')
    expect(out).toContain('from { a: 1 }')
    expect(out).toContain('@property --tw-x')
    expect(out).toContain(`${S} .p-4`)
  })
})

describe("scopeCss native (@scope)", () => {
  it('põe tudo num @scope, sem prefixo, e os globais viram :scope', () => {
    const out = scopeCss(':root, :host { --c: red } body { margin: 0 } .h-\\[10px\\] { height: 10px }', 'x', true)
    expect(out).toMatch(/^@scope \(\[data-vitral-scope="x"\]\) \{/)
    expect(out).toContain(':scope, :scope { --c: red }')
    expect(out).toContain(':scope { margin: 0 }')
    expect(out).toContain('.h-\\[10px\\] { height: 10px }')
    expect(out).not.toContain(`${S} .h`)
  })

  it('preflight (*) vale para a raiz (:scope) e descendentes', () => {
    expect(scopeCss('* { box-sizing: border-box }', 'x', true)).toContain(':scope, * {')
  })

  it('deixa no topo @keyframes, @font-face e @property, e as @layer no lugar', () => {
    const css = '@layer theme, base; @keyframes spin { from { a: 1 } } @font-face { font-family: X } @property --tw-x { syntax: "*" } @layer base { .p-4 { padding: 1rem } }'
    const out = scopeCss(css, 'x', true)
    const at = out.indexOf('@scope')
    for (const s of ['@keyframes spin', '@font-face', '@property --tw-x']) expect(out.indexOf(s)).toBeLessThan(at)
    expect(out.indexOf('@layer theme, base;')).toBeGreaterThan(at)
    expect(out.indexOf('@layer base {')).toBeGreaterThan(out.indexOf('@layer theme, base;'))
    expect(out).toContain('from { a: 1 }')
  })

  it('sem regras de estilo, não cria @scope vazio', () => {
    expect(scopeCss('@font-face { font-family: X }', 'x', true)).not.toContain('@scope')
  })
})
