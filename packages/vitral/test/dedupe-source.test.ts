// Dedupe de um pacote publicado como código-fonte TypeScript (`pacote/*`),
// importado por especificador, por `paths` do tsconfig e por arquivo interno.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import vitral from '../src/vite'
import { protocol, resetProtocol } from '../src/core/state'
import { shared } from '../src/core/dedupe'
import type { RemoteManifest } from '../src/index'

const root = mkdtempSync(join(tmpdir(), 'vitral-source-'))
const out = join(root, 'dist')
const write = (file: string, text: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true })
  writeFileSync(join(root, file), text)
}
let m: RemoteManifest
let warnings: string[] = []

beforeAll(async () => {
  write('package.json', JSON.stringify({ name: 'app', type: 'module' }))
  write(
    'tsconfig.json',
    // Comentário e vírgula sobrando, como o tsconfig aceita.
    `{ "compilerOptions": { "baseUrl": ".", "paths": {
      // alias do app para dentro do pacote
      "@/components/ui/*": ["./node_modules/@acme/ui/src/components/*"],
      "@ui-hidden": ["./node_modules/@acme/ui/src/hidden.ts"],
      "@/*": ["./src/*"],
    } } }`,
  )
  const ui = 'node_modules/@acme/ui/'
  write(ui + 'package.json', JSON.stringify({ name: '@acme/ui', version: '1.2.3', exports: { '.': './src/index.ts', './routes': './src/routes/index.ts', './styles/*': './src/styles/*' } }))
  write(ui + 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }))
  write(ui + 'src/index.ts', `export * from './components'\nexport { store as useStore } from '@/store/store'\n`)
  write(ui + 'src/components/index.ts', `export { Button } from './button/button'\nexport { Card } from './card/card'\nexport { C } from './x/c'\n`)
  // Barrel interno com nomes que o pacote não publica (A, B) ao lado de um que publica (C).
  write(ui + 'src/components/x/index.ts', `export { A, B } from './a'\nexport { C } from './c'\n`)
  write(ui + 'src/components/x/a.ts', `export const A: string = 'a-proprio'\nexport const B: string = 'b-proprio'\n`)
  write(ui + 'src/components/x/c.ts', `import './side'\nexport const C: string = 'c-proprio'\n`)
  write(ui + 'src/components/x/side.ts', `;(globalThis as any).vazou = 'efeito-do-pacote'\n`)
  // \`export default\` de um binding público e um nome que o pacote não publica.
  write(ui + 'src/components/card/card.ts', `export const Card: string = 'card-proprio'\nexport const cardPrivate: string = 'card-privado'\nexport default Card\n`)
  write(ui + 'src/components/button/button.ts', `export const Button: string = 'botao-proprio'\n`)
  write(ui + 'src/store/store.ts', `export const store = { id: 'store-proprio' }\n`)
  write(ui + 'src/hidden.ts', `export const hidden: string = 'oculto'\n`)
  write(ui + 'src/routes/index.ts', `export const routes: string[] = ['rota-propria']\n`)
  write('src/local.ts', `export const local = 'local'\n`)
  write(
    'src/remote.ts',
    `import { Button, useStore } from '@acme/ui'
import { routes } from '@acme/ui/routes'
import { Button as Deep } from '@/components/ui/button/button'
import { store } from '@/components/ui/../store/store'
import { hidden } from '@ui-hidden'
import CardDefault, { Card as CardDeep, cardPrivate } from '@/components/ui/card/card'
import { local } from '@/local'
import { C } from '@/components/ui/x/index'
export default { mount() {}, Button, useStore, routes, Deep, store, hidden, local, CardDefault, CardDeep, cardPrivate, C }
`,
  )
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    customLogger: { info() {}, warn: (msg: string) => warnings.push(msg), warnOnce() {}, error() {}, clearScreen() {}, hasErrorLogged: () => false, hasWarned: false } as any,
    plugins: [vitral({ entry: 'src/remote.ts', adapter: false, next: true, dedupe: ['@acme/ui/*'], types: false })],
    build: { outDir: out, emptyOutDir: true },
  })
  m = JSON.parse(readFileSync(join(out, 'vitral.json'), 'utf8'))
}, 60_000)

afterAll(() => rmSync(root, { recursive: true, force: true }))
afterEach(() => resetProtocol())

let copies = 0
async function importSplit() {
  const dir = join(out, `copia-${copies++}`)
  cpSync(join(out, 'split'), join(dir, 'split'), { recursive: true })
  return (await import(pathToFileURL(join(dir, m.split!.entry)).href)).default
}

describe('dedupe de pacote em código-fonte', () => {
  it('um grupo com o pacote e os subpaths do exports, na faixa da versão instalada', () => {
    expect(m.dedupe).toEqual([expect.objectContaining({ name: '@acme/ui', range: '^1.2.3', version: '1.2.3' })])
  })

  it('o código do pacote fica só na cópia própria, menos o arquivo que nenhum export reexporta', () => {
    const read = (f: string) => readFileSync(join(out, f), 'utf8')
    const main = [m.split!.entry, ...m.split!.chunks!].map(read).join('\n')
    expect(main).not.toContain('botao-proprio')
    expect(main).not.toContain('store-proprio')
    expect(main).toContain('oculto')
    expect(read(m.dedupe![0].file) + m.dedupe![0].chunks!.map(read).join('')).toContain('botao-proprio')
    // A cópia própria não entra no que o host aquece.
    expect(m.split!.lazy ?? []).not.toContain(m.dedupe![0].file)
    expect(warnings.join('\n')).toMatch(/hidden\.ts não sai por nenhum export de @acme\/ui/)
    expect(warnings.join('\n')).toMatch(/card\.ts: cardPrivate não sai/)
    expect(warnings.join('\n')).not.toMatch(/card\.ts: .*default/)
  })

  it('nomes não publicados de um barrel interno vêm do arquivo que os define, sem puxar o resto do barrel', () => {
    const read = (f: string) => readFileSync(join(out, f), 'utf8')
    const main = [m.split!.entry, ...m.split!.chunks!].map(read).join('\n')
    expect(main).not.toContain('efeito-do-pacote')
    // Depois do build: quantos arquivos do grupo o código principal alcança, com um caminho.
    expect(warnings.join('\n')).toMatch(/3 arquivo\(s\) de @acme\/ui entram no código principal do remote.*Um caminho: src\/remote\.ts → vitral-deep:node_modules\/@acme\/ui\/src\/components\/x\/index\.ts → node_modules\/@acme\/ui\/src\/components\/x\/a\.ts/)
    expect(warnings.join('\n')).toMatch(/x\/index\.ts: A, B não sai\(em\) por nenhum export de @acme\/ui: esses nomes vêm de uma cópia própria de .*x\/a\.ts/)
  })

  it('com o pacote oferecido, o efeito colateral do barrel não roda', async () => {
    delete (globalThis as any).vazou
    shared(protocol())('@acme/ui', '1.4.0', {
      version: '1.4.0',
      load: async () => ({ '@acme/ui': { Button: 'botao-host', Card: 'card-host', C: 'c-host', useStore: {} }, '@acme/ui/routes': { routes: [] } }),
    })
    const r = await importSplit()
    expect(r.C).toBe('c-host')
    expect((globalThis as any).vazou).toBeUndefined()
  })

  it('sem oferta na página, tudo vem da cópia própria, inclusive pelos aliases', async () => {
    protocol()
    const r = await importSplit()
    expect([r.Button, r.Deep, r.routes, r.hidden, r.local]).toEqual(['botao-proprio', 'botao-proprio', ['rota-propria'], 'oculto', 'local'])
    expect(r.store).toBe(r.useStore)
  })

  it('com o pacote oferecido pelo host, os aliases e o arquivo interno usam o objeto do host', async () => {
    const hostStore = { id: 'host' }
    shared(protocol())('@acme/ui', '1.4.0', {
      version: '1.4.0',
      load: async () => ({ '@acme/ui': { Button: 'botao-host', Card: 'card-host', useStore: hostStore }, '@acme/ui/routes': { routes: ['rota-host'] } }),
    })
    const r = await importSplit()
    expect([r.Button, r.Deep, r.routes]).toEqual(['botao-host', 'botao-host', ['rota-host']])
    // `store` interno sai pelo index como `useStore`: o mesmo objeto do host.
    expect(r.store).toBe(hostStore)
    expect(r.useStore).toBe(hostStore)
    // `export default Card` é o mesmo valor que `Card`; só o nome privado vem da cópia própria.
    expect([r.CardDefault, r.CardDeep, r.cardPrivate]).toEqual(['card-host', 'card-host', 'card-privado'])
  })

  it('o host sem um dos subpaths: a cópia própria inteira, com aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    shared(protocol())('@acme/ui', '1.4.0', { version: '1.4.0', load: async () => ({ '@acme/ui': { Button: 'x' } }) })
    expect((await importSplit()).Button).toBe('botao-proprio')
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/@acme\/ui não tem @acme\/ui\/routes/))
    warn.mockRestore()
  })

  it('build dividido publica os módulos de teste do SRI', () => {
    expect(m.probe).toEqual(['split/vitral-probe.js', 'split/vitral-probe-x.js'])
    expect(readFileSync(join(out, m.probe![0]), 'utf8')).toBe('export{}')
  })
})
