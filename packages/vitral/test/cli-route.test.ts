import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { doctorCli } from '../src/cli/doctor'
import { routeEntry, routeReport } from '../src/cli/route'

const dir = mkdtempSync(join(tmpdir(), 'vitral-route-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))
const write = (f: string, v: unknown) => {
  mkdirSync(join(dir, f, '..'), { recursive: true })
  writeFileSync(join(dir, f), typeof v === 'string' ? v : JSON.stringify(v))
}
const KB = 1024

// Stats no formato do webpack: o _app, a página e um chunk comum.
write('stats.json', {
  entrypoints: {
    main: { chunks: ['main'] },
    'pages/_app': { chunks: ['app'] },
    'pages/loja/[[...slug]]': { chunks: [42, 'loja'] },
    'pages/index': { chunks: ['home'] },
  },
  chunks: [
    { id: 'main', modules: [{ name: './node_modules/next/dist/client/index.js', size: 60 * KB }] },
    {
      id: 'app',
      modules: [
        { name: './src/locales/pt/comum.json', size: 120 * KB },
        { name: './src/locales/en/comum.json', size: 118 * KB },
        { name: './src/locales/es/comum.json', size: 119 * KB },
        { name: './node_modules/auth-lib/index.js', size: 88 * KB, providedExports: ['login'], usedExports: ['login'] },
      ],
    },
    {
      id: 42,
      modules: [
        // Concatenado: contam os módulos de dentro.
        { name: './node_modules/@empresa/ui/index.js + 2 modules', size: 1, modules: [{ name: './node_modules/@empresa/ui/index.js', size: 4 * KB }, { name: './node_modules/@empresa/ui/layout.js', size: 30 * KB }] },
        { name: './node_modules/chart-lib/index.js', size: 113 * KB, providedExports: ['Chart'], usedExports: [] },
        { name: './node_modules/.pnpm/date-lib@3.0.0/node_modules/date-lib/index.js', size: 40 * KB, providedExports: ['format'], usedExports: true, reasons: [{ moduleName: './.vitral/host-config.mjs' }] },
      ],
    },
    { id: 'loja', modules: [{ name: './pages/loja/[[...slug]].tsx', size: 2 * KB }] },
    { id: 'home', modules: [{ name: './pages/index.tsx', size: 9 * KB }] },
  ],
})
write('node_modules/chart-lib/package.json', { name: 'chart-lib', version: '2.15.0' })
write('node_modules/date-lib/package.json', { name: 'date-lib', version: '3.0.0' })
write('remote/vitral.json', { name: 'loja', entry: 'remote.js', dedupe: [{ name: 'react', range: '^19.0.0', version: '19.0.0', file: 'split/r.js' }], sbom: { file: 'sbom.cdx.json', integrity: 'x' } })
write('remote/sbom.cdx.json', { components: [{ name: 'chart-lib', version: '2.12.0' }, { name: 'react', version: '19.0.0' }, { group: '@empresa', name: 'ui', version: '1.0.0' }] })
write('sem-sbom/vitral.json', { name: 'outro', entry: 'remote.js' })

describe('vitral doctor --stats --route', () => {
  it('acha o entrypoint da rota por nome, caminho ou rota com parâmetros', () => {
    const names = ['pages/_app', 'pages/index', 'pages/loja/[[...slug]]']
    expect(routeEntry(names, '/loja')).toBe('pages/loja/[[...slug]]')
    expect(routeEntry(names, 'pages/index')).toBe('pages/index')
    expect(routeEntry(names, '/')).toBe('pages/index')
  })

  it('soma o shell e a página, por pacote, e aponta o que pesa sem servir à rota', () => {
    const r = routeReport({ stats: 'stats.json', route: '/loja', remotes: ['remote', 'sem-sbom'], cwd: dir })
    expect(r.entries).toEqual(['main', 'pages/_app', 'pages/loja/[[...slug]]'])
    // A home não entra; o concatenado conta pelos dois módulos de dentro.
    expect(r.bytes).toBe((60 + 120 + 118 + 119 + 88 + 4 + 30 + 113 + 40 + 2) * KB)
    expect(r.packages[0]).toEqual({ name: '(código do app)', bytes: (120 + 118 + 119 + 2) * KB })
    expect(r.packages.find((p) => p.name === '@empresa/ui')!.bytes).toBe(34 * KB)
    expect(r.packages.find((p) => p.name === 'date-lib')).toBeDefined()
    const titles = r.checks.map((c) => c.title)
    expect(titles).toEqual([
      'traduções no JS da rota: 3 arquivo(s), 357 kB',
      '1 módulo(s) sem nenhum export usado na rota: 113 kB',
      'ofertas de share com todos os exports: 1 módulo(s), 40 kB',
      expect.stringMatching(/^loja: 2 pacote\(s\) que o host e o remote levam cada um: chart-lib \(113 kB no host; 2\.15\.0 no host, 2\.12\.0 no remote\), @empresa\/ui/),
      'outro: sem SBOM, não dá para cruzar os pacotes',
    ])
    // O React está no dedupe do remote: não aparece. Mesmo major: sugere share.
    expect(r.checks[3].fix).toContain('["chart-lib"]')
  })

  it('avisa quando os stats não têm os módulos da maior parte da rota', () => {
    write('stats-pobre.json', {
      entrypoints: { 'pages/_app': { chunks: ['app'] }, 'pages/loja': { chunks: ['loja'], assets: [{ name: 'static/chunks/loja.js', size: 2000 * KB }] } },
      chunks: [
        { id: 'app', files: ['static/chunks/app.js'], modules: [{ name: './pages/_app.tsx', size: 40 * KB }] },
        { id: 'loja', files: ['static/chunks/loja.js'], modules: [{ name: './pages/loja.tsx', size: 42 * KB }] },
      ],
      assets: [{ name: 'static/chunks/app.js', size: 500 * KB }],
    })
    const r = routeReport({ stats: 'stats-pobre.json', route: '/loja', cwd: dir })
    expect(r.checks[0]).toMatchObject({ status: 'warn', title: 'os stats só mostram 82 kB dos 2500 kB que a rota carrega' })
  })

  it('pela CLI, com --json, e erro claro para rota que não existe', async () => {
    const out: string[] = []
    expect(await doctorCli(['--stats', 'stats.json', '--route', '/loja', '--json'], { cwd: dir }, (m) => out.push(m))).toBe(0)
    expect(JSON.parse(out[0]).route).toBe('pages/loja/[[...slug]]')
    await expect(doctorCli(['--stats', 'stats.json', '--route', '/nada'], { cwd: dir }, () => {})).rejects.toThrow(/pages\/loja/)
  })
})
