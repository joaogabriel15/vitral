import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { balanced, diff, migrate, pairs, plan } from '../src/cli/migrate'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const root = mkdtempSync(join(cache, 'migrate-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

/** Cria um projeto com estes arquivos e devolve a pasta. */
function projeto(files: Record<string, string | object>): string {
  const dir = mkdtempSync(join(root, 'p-'))
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    writeFileSync(join(dir, f), typeof body === 'string' ? body : JSON.stringify(body, null, 2) + '\n')
  }
  return dir
}
const ler = (dir: string, f: string) => readFileSync(join(dir, f), 'utf8')
const run = (dir: string, dryRun = false) => {
  const logs: string[] = []
  const result = migrate({ cwd: dir, dryRun, log: (m) => logs.push(m) })
  return { result, out: logs.join('\n') }
}

const SINGLE_SPA_REACT = `import React from 'react'
import ReactDOMClient from 'react-dom/client'
import singleSpaReact from 'single-spa-react'
import Root from './root.component'

const lifecycles = singleSpaReact({
  React,
  ReactDOMClient,
  rootComponent: Root, // o app inteiro
})

export const { bootstrap, mount, unmount } = lifecycles
`

describe('vitral migrate: single-spa', () => {
  it('singleSpaReact só com rootComponent vira reactRemote', () => {
    const dir = projeto({
      'package.json': { name: '@loja/conta', scripts: { build: 'webpack' }, dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0', 'single-spa-react': '^6.0.0' } },
      'src/loja-conta.js': SINGLE_SPA_REACT,
      'src/root.component.jsx': 'export default function Root() { return null }\n',
    })
    const { result, out } = run(dir)
    expect(result.from).toBe('single-spa')
    expect(ler(dir, 'src/vitral-remote.js')).toBe(`import { reactRemote } from 'vitral/react'\nimport Root from './root.component'\n\nexport default reactRemote(Root)\n`)
    expect(ler(dir, 'vite.vitral.config.mjs')).toBe(`import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import vitral from 'vitral/vite'

// Build do remote vitral (\`npm run build:vitral\`). Gera dist-vitral/vitral.json, ao lado do build atual.
export default defineConfig({
  plugins: [react(), vitral({ entry: 'src/vitral-remote.js' })],
  build: { outDir: 'dist-vitral' },
})
`)
    expect(JSON.parse(ler(dir, 'package.json')).scripts).toEqual({ build: 'webpack', 'build:vitral': 'vite build -c vite.vitral.config.mjs' })
    expect(out).toContain('  + src/vitral-remote.js (novo)')
    expect(out).toContain('  ~ package.json')
    expect(out).toContain(`+    "build:vitral": "vite build -c vite.vitral.config.mjs"`)
    expect(out).toContain('npm i -D vite vitral @vitejs/plugin-react')
    expect(out).toContain('usava singleSpaReact só com rootComponent')
    // O arquivo antigo não é tocado: os hosts single-spa continuam funcionando.
    expect(ler(dir, 'src/loja-conta.js')).toBe(SINGLE_SPA_REACT)
  })

  it('outros lifecycles (Vue, à mão) são embrulhados com singleSpaRemote; projeto TS gera .ts', () => {
    const dir = projeto({
      'package.json': { name: 'pedidos', dependencies: { vue: '^3.5.0', 'single-spa-vue': '^3.0.0' }, devDependencies: { vite: '^8.0.0', '@vitejs/plugin-vue': '^6.0.0', 'vite-plugin-single-spa': '^1.0.0' } },
      'tsconfig.json': '{}',
      'src/main.ts': `import { h, createApp } from 'vue'\nimport singleSpaVue from 'single-spa-vue'\nimport App from './App.vue'\n\nconst vueLifecycles = singleSpaVue({ createApp, appOptions: { render() { return h(App) } } })\n\nexport const bootstrap = vueLifecycles.bootstrap\nexport const mount = vueLifecycles.mount\nexport const unmount = vueLifecycles.unmount\n`,
      'src/nav.ts': `import { navigateToUrl } from 'single-spa'\nexport const ir = () => navigateToUrl('/x')\n`,
    })
    const { result } = run(dir)
    expect(ler(dir, 'src/vitral-remote.ts')).toBe(`import { singleSpaRemote } from 'vitral/single-spa'\nimport * as lifecycles from './main'\n\nexport default singleSpaRemote(lifecycles)\n`)
    expect(ler(dir, 'vite.vitral.config.mts')).toContain(`import vue from '@vitejs/plugin-vue'`)
    expect(ler(dir, 'vite.vitral.config.mts')).toContain(`plugins: [vue(), vitral({ entry: 'src/vitral-remote.ts' })]`)
    expect(result.notes.join('\n')).toContain('npm i -D vitral')
    expect(result.notes.join('\n')).not.toContain('@vitejs/plugin-vue')
    expect(result.notes.join('\n')).toContain('navigateToUrl')
    expect(result.notes.join('\n')).toContain('vite-plugin-single-spa')
  })

  it('singleSpaReact com outras opções (errorBoundary) fica no wrapper', () => {
    const dir = projeto({
      'package.json': { dependencies: { react: '^19.0.0', 'single-spa-react': '^6.0.0' } },
      'src/main.jsx': SINGLE_SPA_REACT.replace('rootComponent: Root,', 'rootComponent: Root,\n  errorBoundary: () => null,'),
    })
    run(dir)
    expect(ler(dir, 'src/vitral-remote.js')).toContain(`singleSpaRemote(lifecycles)`)
    expect(ler(dir, 'src/vitral-remote.js')).toContain(`from './main'`)
  })

  it('root config: só orienta, sem escrever', () => {
    const dir = projeto({
      'package.json': { dependencies: { 'single-spa': '^6.0.0' } },
      'src/root-config.js': `import { registerApplication, start } from 'single-spa'\nregisterApplication({ name: '@loja/conta', app: () => System.import('@loja/conta'), activeWhen: ['/conta'] })\nstart()\n`,
    })
    const { result, out } = run(dir)
    expect(result.changes).toEqual([])
    expect(out).toContain('Root config em ./src/root-config.js')
  })

  it('--dry-run mostra o diff e não escreve nada; rodar de novo não duplica', () => {
    const dir = projeto({
      'package.json': { dependencies: { react: '^19.0.0', 'single-spa-react': '^6.0.0' } },
      'src/main.js': SINGLE_SPA_REACT,
    })
    const seco = run(dir, true)
    expect(seco.out).toContain('--- /dev/null\n+++ src/vitral-remote.js\n+import { reactRemote }')
    expect(seco.out).toContain('--dry-run: nada foi escrito')
    expect(existsSync(join(dir, 'src/vitral-remote.js'))).toBe(false)
    expect(existsSync(join(dir, 'vite.vitral.config.mjs'))).toBe(false)
    run(dir)
    const pkg = ler(dir, 'package.json')
    const segunda = run(dir)
    expect(segunda.result.changes).toEqual([])
    expect(segunda.out).toContain('src/vitral-remote.js já existe')
    expect(ler(dir, 'package.json')).toBe(pkg)
  })
})

const WEBPACK_MF = `const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack')

module.exports = {
  entry: './src/index',
  plugins: [
    new ModuleFederationPlugin({
      name: 'carrinho',
      filename: 'remoteEntry.js',
      exposes: {
        './Carrinho': './src/Carrinho',
        './MiniCarrinho': { import: './src/components/MiniCarrinho.tsx' }, // { } no comentário
        './api': './src/api',
      },
      remotes: { catalogo: 'catalogo@https://cdn.loja.com/catalogo/remoteEntry.js' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
}
`

describe('vitral migrate: Module Federation', () => {
  it('exposes vira o plugin vitral, com um wrapper por componente', () => {
    const dir = projeto({
      'package.json': { name: 'carrinho', version: '1.0.0', dependencies: { react: '^19.0.0' }, devDependencies: { webpack: '^5.0.0' } },
      'tsconfig.json': '{}',
      'webpack.config.js': WEBPACK_MF,
      'src/Carrinho.tsx': 'export default function Carrinho() { return null }\n',
      'src/components/MiniCarrinho.tsx': 'export default function MiniCarrinho() { return null }\n',
      'src/api.ts': 'export const soma = (a: number, b: number) => a + b\n',
    })
    const { result, out } = run(dir)
    expect(result.from).toBe('module-federation')
    expect(ler(dir, 'src/vitral/Carrinho.ts')).toBe(
      `import { reactRemote } from 'vitral/react'\nimport Componente from '../Carrinho'\n\nexport * from '../Carrinho'\nexport default reactRemote(Componente)\n`,
    )
    expect(ler(dir, 'src/vitral/MiniCarrinho.ts')).toContain(`import Componente from '../components/MiniCarrinho'`)
    expect(existsSync(join(dir, 'src/vitral/api.ts'))).toBe(false)
    expect(ler(dir, 'vite.vitral.config.mts')).toContain(`  plugins: [react(), vitral({
    name: 'carrinho',
    entry: 'src/vitral/Carrinho.ts',
    exposes: {
      './Carrinho': 'src/vitral/Carrinho.ts',
      './MiniCarrinho': 'src/vitral/MiniCarrinho.ts',
      './api': 'src/api.ts',
    },
  })],`)
    const notas = result.notes.join('\n')
    expect(notas).toContain('módulos sem UI (host usa loadModule): ./api')
    expect(notas).toContain('shared não migra')
    expect(notas).toContain(`catalogo: federationRemote('https://cdn.loja.com/catalogo/mf-manifest.json')`)
    expect(notas).toContain('<Remote name="carrinho/Carrinho" />')
    expect(out).toContain('webpack.config.js continua gerando o remoteEntry.js')
    expect(ler(dir, 'webpack.config.js')).toBe(WEBPACK_MF)
  })

  it('module-federation.config e vite com federation(): também lê', () => {
    const dir = projeto({
      'package.json': { dependencies: { vue: '^3.5.0' }, devDependencies: { vite: '^8.0.0', '@module-federation/vite': '^1.0.0' } },
      'vite.config.js': `import { federation } from '@module-federation/vite'\nimport vue from '@vitejs/plugin-vue'\nexport default { plugins: [vue(), federation({ name: "pedidos", exposes: { "./Lista": "./src/Lista.vue" } })] }\n`,
      'src/Lista.vue': '<template><ul /></template>\n',
    })
    const { result } = run(dir)
    expect(ler(dir, 'src/vitral/Lista.js')).toContain(`import Componente from '../Lista.vue'`)
    expect(ler(dir, 'src/vitral/Lista.js')).toContain(`vueRemote(Componente)`)
    expect(result.notes.join('\n')).toContain('npm i -D vitral @vitejs/plugin-vue')
    // O vite.config.js atual (o build do MF) não muda.
    expect(result.changes.map((c) => c.path)).toEqual(['src/vitral/Lista.js', 'vite.vitral.config.mjs', 'package.json'])
  })

  it('exposes que não é objeto literal, ou só remotes: orienta sem escrever', () => {
    const variavel = projeto({ 'package.json': {}, 'webpack.config.js': `new ModuleFederationPlugin({ name: 'x', exposes: config.exposes })\n` })
    expect(plan(variavel).notes.join('\n')).toContain('exposes não é um objeto literal')
    const soHost = projeto({ 'package.json': {}, 'rspack.config.js': `new rspack.container.ModuleFederationPlugin({ name: 'loja', remotes: { carrinho: 'carrinho@https://cdn.loja.com/carrinho/remoteEntry.js' } })\n` })
    const r = plan(soHost)
    expect(r.from).toBe('module-federation')
    expect(r.changes).toEqual([])
    expect(r.notes[0]).toContain(`carrinho: federationRemote('https://cdn.loja.com/carrinho/mf-manifest.json')`)
  })

  it('sem framework conhecido, exposes aponta para os arquivos originais', () => {
    const dir = projeto({
      'package.json': {},
      'webpack.config.js': `new ModuleFederationPlugin({ name: 'w', exposes: { './Widget': './src/Widget.js' } })\n`,
      'src/Widget.js': 'export function mount() {}\n',
    })
    const { result } = run(dir)
    expect(ler(dir, 'vite.vitral.config.mjs')).toContain(`'./Widget': 'src/Widget.js'`)
    expect(result.notes.join('\n')).toContain('Framework não identificado')
  })
})

describe('vitral migrate: geral', () => {
  it('projeto sem single-spa nem Module Federation', () => {
    const dir = projeto({ 'package.json': { dependencies: { react: '^19.0.0' } } })
    const { result, out } = run(dir)
    expect(result.from).toBeNull()
    expect(out).toContain('Use --from single-spa ou --from module-federation')
  })

  it('--from força a origem', () => {
    const dir = projeto({ 'package.json': {}, 'src/main.js': 'export async function mount() {}\nexport async function unmount() {}\n' })
    expect(plan(dir).from).toBeNull()
    expect(plan(dir, 'single-spa').changes[0].after).toContain(`import * as lifecycles from './main'`)
  })

  it('balanced pula strings e comentários; pairs lê chaves com e sem aspas', () => {
    const t = `x({ a: '}', /* } */ b: [1, 2], // )\n c: "{" })`
    expect(balanced(t, 1)).toBe(t.slice(1))
    expect(balanced(t, t.indexOf('['))).toBe('[1, 2]')
    expect(balanced('a', 0)).toBeNull()
    expect(balanced('{ sem fim', 0)).toBeNull()
    expect(pairs(`{ carrinho: 'c@u', "./A": "./a", './B': { import: './b', name: 'B' } }`)).toEqual([
      ['carrinho', 'c@u'],
      ['./A', './a'],
      ['./B', './b'],
    ])
  })

  it('diff mostra só as linhas mudadas com contexto', () => {
    const antes = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].join('\n') + '\n'
    const depois = ['a', 'b', 'c', 'd', 'E', 'f', 'g', 'h'].join('\n') + '\n'
    expect(diff('x.txt', antes, depois)).toBe('--- x.txt\n+++ x.txt\n@@\n c\n d\n-e\n+E\n f\n g')
    expect(diff('novo.txt', null, 'a\nb\n')).toBe('--- /dev/null\n+++ novo.txt\n+a\n+b')
  })
})
