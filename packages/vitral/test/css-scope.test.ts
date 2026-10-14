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
