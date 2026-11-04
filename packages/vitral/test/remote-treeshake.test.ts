// O remote empacotado só leva o lado do remote: sem o `<vitral-remote>`, sem
// o loader do host e sem chunks à parte. Testa o `dist`, porque é o que o
// bundler do remote recebe (o `pnpm check` builda antes dos testes).
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'

const dist = resolve(__dirname, '../dist')
const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
const dirs: string[] = []
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

async function bundle(code: string): Promise<{ files: number; js: string }> {
  mkdirSync(cache, { recursive: true })
  const dir = mkdtempSync(join(cache, 'treeshake-'))
  dirs.push(dir)
  const entry = join(dir, 'remote.js')
  writeFileSync(entry, code)
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ['es'] },
      rolldownOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/, /^vue($|\/)/] },
    },
  })) as unknown as { output: { type: string; code?: string }[] }[]
  const chunks = [out].flat().flatMap((o) => o.output).filter((c) => c.type === 'chunk')
  return { files: chunks.length, js: chunks.map((c) => c.code).join('\n') }
}

describe.skipIf(!existsSync(join(dist, 'index.js')))('remote empacotado', () => {
  it('Web Component e html`` não levam o <vitral-remote> nem o loader', async () => {
    const { files, js } = await bundle(
      `import { elementRemote } from '${dist}/element.js'\nimport { component, html } from '${dist}/index.js'\n` +
        `export const a = elementRemote('x-a')\nexport default component({ render: () => html\`<p>x</p>\` })\n`,
    )
    expect(js).not.toContain('observedAttributes')
    expect(files).toBe(1)
  })

  it('Vue não leva o VitralRemote nem o loader', async () => {
    const { files, js } = await bundle(`import { vueRemote } from '${dist}/vue.js'\nexport default vueRemote({ render: () => null })\n`)
    expect(js).not.toContain('VitralRemote')
    expect(files).toBe(1)
  })

  it('React leva o escopo dos portais no mesmo arquivo', async () => {
    const { files, js } = await bundle(`import { reactRemote } from '${dist}/react.js'\nexport default reactRemote(() => null)\n`)
    expect(js).toContain('__reactFiber$')
    expect(files).toBe(1)
  })
})
