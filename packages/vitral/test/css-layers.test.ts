import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { transformCss } from '../src/css-build'

const flat = (css: string) => transformCss(css, { layers: 'flatten', scopeCss: false }, 'x')
const rename = (css: string) => transformCss(css, { renameRegisteredProperties: true, scopeCss: false }, 'x')
const clean = (css: string) => postcss.parse(css).toString().replace(/\s+/g, ' ').trim()

describe("layers: 'flatten'", () => {
  it('tira os @layer e segue a ordem declarada, com o CSS sem camada no fim', () => {
    const css = '@layer base, utilities; .solto { a: 1 } @layer utilities { .u { a: 2 } } @layer base { .b { a: 3 } } @layer utilities { .u2 { a: 4 } }'
    expect(clean(flat(css))).toBe('.b { a: 3 } .u { a: 2 } .u2 { a: 4 } .solto { a: 1 }')
  })

  it('mantém @charset, @import e o comentário inicial no topo', () => {
    const css = '/*! licença */ @charset "utf-8"; @import url(https://x.com/a.css); @layer a { .a { b: 1 } } /* fim */'
    expect(clean(flat(css))).toBe('/*! licença */ @charset "utf-8"; @import url(https://x.com/a.css); .a { b: 1 } /* fim */')
  })

  it('subcamadas e camadas anônimas', () => {
    const css = '@layer a { .a1 { x: 1 } @layer b { .b { x: 2 } } .a2 { x: 3 } } @layer { .anon { x: 4 } }'
    expect(clean(flat(css))).toBe('.b { x: 2 } .a1 { x: 1 } .a2 { x: 3 } .anon { x: 4 }')
  })

  it('camadas dentro de @media e @supports', () => {
    const css = '@media (min-width: 1px) { @layer u { .m { x: 1 } } .solta { x: 2 } } @supports (a: b) { .s { x: 3 } }'
    expect(clean(flat(css))).toBe('@media (min-width: 1px) { .m { x: 1 } .solta { x: 2 } } @supports (a: b) { .s { x: 3 } }')
  })

  it('CSS sem camada continua igual', () => {
    const css = '.a { x: 1 } @media print { .b { x: 2 } }'
    expect(flat(css)).toBe(css)
  })
})

describe('renameRegisteredProperties', () => {
  it('renomeia as --tw-* registradas no @property e em cada uso', () => {
    const css = '@property --tw-shadow { syntax: "*"; inherits: false } @property --tw-shadow-color { syntax: "*"; inherits: false } .s { --tw-shadow: 0 0 var(--tw-shadow-color, red); box-shadow: var(--tw-shadow); transition-property: --tw-shadow; --tw-ease: x }'
    expect(clean(rename(css))).toBe(
      '@property --tw-x-shadow { syntax: "*"; inherits: false } @property --tw-x-shadow-color { syntax: "*"; inherits: false } .s { --tw-x-shadow: 0 0 var(--tw-x-shadow-color, red); box-shadow: var(--tw-x-shadow); transition-property: --tw-x-shadow; --tw-ease: x }',
    )
  })

  it('não mexe em propriedades registradas fora do --tw-', () => {
    const css = '@property --angulo { syntax: "<angle>"; inherits: false } .a { --angulo: 1deg; rotate: var(--angulo) }'
    expect(rename(css)).toBe(css)
  })
})
