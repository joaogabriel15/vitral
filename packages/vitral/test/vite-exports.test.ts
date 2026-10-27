// Origem de cada export, seguindo reexports, sem travar em ciclos.
import { parseAst } from 'vite'
import { describe, expect, it } from 'vitest'
import { exportOrigins, type ParseContext, type Parsed } from '../src/vite/exports'

function ctx(files: Record<string, string>): ParseContext {
  return {
    resolve: async (id) => (files[id.replace('./', '/')] !== undefined ? { id: id.replace('./', '/') } : null),
    // Cada leitura demora: leituras paralelas se cruzam no meio.
    load: async ({ id }) => (await new Promise((r) => setTimeout(r, 5)), { code: files[id] }),
    parse: (code) => parseAst(code),
  }
}

describe('exportOrigins', () => {
  it('reexports circulares lidos em paralelo não travam', async () => {
    const c = ctx({ '/a': `export * from './b'\nexport const a = 1`, '/b': `export * from './a'\nexport const b = 2` })
    const cache = new Map<string, Promise<Parsed>>()
    const [a, b] = await Promise.all([exportOrigins(c, '/a', cache), exportOrigins(c, '/b', cache)])
    expect(Object.fromEntries(a)).toEqual({ a: '/a#a', b: '/b#b' })
    expect(Object.fromEntries(b)).toEqual({ b: '/b#b', a: '/a#a' })
  })

  it('segue export { x as y } from, import + export e não leva default no export *', async () => {
    const c = ctx({
      '/i': `export * from './m'\nexport { v as w } from './v'\nimport { k } from './v'\nexport { k as kk }`,
      '/m': `export default 1\nexport function f() {}`,
      '/v': `export const v = 1, k = 2`,
    })
    expect(Object.fromEntries(await exportOrigins(c, '/i', new Map()))).toEqual({ w: '/v#v', kk: '/v#k', f: '/m#f' })
  })
})
