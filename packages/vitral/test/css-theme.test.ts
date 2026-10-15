import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { transformCss } from '../src/css-build'
import { mapVars } from '../src/css-theme'

const host = (css: string) => transformCss(css, { theme: 'host', scopeCss: false }, 'x')
const clean = (css: string) => postcss.parse(css).toString().replace(/\s+/g, ' ').trim()

describe("theme: 'host'", () => {
  it('tira as variáveis de :root/:host/html e põe o valor como fallback', () => {
    const out = host(':root, :host { --c: red; --s: 4px } html { --f: serif } .a { color: var(--c); margin: var(--s) var(--f) }')
    expect(clean(out)).toBe('.a { color: var(--c, red); margin: var(--s, 4px) var(--f, serif) }')
  })

  it('mantém o que não é variável no bloco global', () => {
    expect(clean(host(':root { --c: red; color: black } .a { color: var(--c) }'))).toBe(':root { color: black } .a { color: var(--c, red) }')
  })

  it('encadeia variáveis e para em ciclos', () => {
    const out = host(':root { --a: var(--b); --b: var(--a); --c: var(--d, 1px) } .x { top: var(--a); left: var(--c) }')
    expect(out).toContain('top: var(--a, var(--b, var(--a)))')
    expect(out).toContain('left: var(--c, var(--d, 1px))')
  })

  it('o valor do build substitui o fallback escrito, e var() sem tema fica como está', () => {
    const out = host(':root { --a: 1px } .x { top: var(--a, 9px); left: var(--z, var(--a)); right: var(--z,) }')
    expect(out).toContain('top: var(--a, 1px)')
    expect(out).toContain('left: var(--z, var(--a, 1px))')
    expect(out).toContain('right: var(--z,)')
  })

  it('variante escura e blocos com condição saem, mas não viram fallback', () => {
    const css = ':root { --c: white } :root.dark { --c: black } @media (prefers-color-scheme: dark) { :root { --c: gray } } html[data-theme=x] { --c: blue } .a { color: var(--c) }'
    expect(clean(host(css))).toBe('@media (prefers-color-scheme: dark) { } .a { color: var(--c, white) }')
  })

  it('não mexe em listas que misturam seletores globais com outros, nem em :host()', () => {
    const css = ':root, .tema { --c: red } :host(.x) { --d: 1 } .a { color: var(--c) }'
    expect(host(css)).toBe(css)
  })

  it('aceita var() em maiúsculas, strings e escapes', () => {
    const out = host(':root { --q: "a)b" } .a { content: VAR(--q); font: var(--q, "x,(y") } .b { --v\\(: 1; top: myvar(--q) }')
    expect(out).toContain('content: var(--q, "a)b")')
    expect(out).toContain('font: var(--q, "a)b")')
    expect(out).toContain('top: myvar(--q)')
  })

  it('sem tema no remote, nada muda', () => {
    const css = '.a { color: var(--c) }'
    expect(host(css)).toBe(css)
  })
})

describe('mapVars', () => {
  it('ignora var() sem fechamento', () => {
    expect(mapVars('var(--a', () => 'x')).toBe('var(--a')
    expect(mapVars('calc(var(--a) + var(--b, 1px))', (n, f) => `[${n}|${f}]`)).toBe('calc([--a|undefined] + [--b| 1px])')
  })
})
