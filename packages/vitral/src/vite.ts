/**
 * Plugin Vite para quem publica um remote.
 *
 *   // vite.config.ts do remote
 *   plugins: [react(), vitral()]
 *
 *   // src/App.tsx: o plugin embrulha com o adaptador do framework
 *   export default App
 *
 * `vite build` gera `dist/remote.js`, o CSS e `dist/vitral.json` com o hash
 * SRI do JS. O host só precisa da URL do `vitral.json`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { RemoteManifest } from './index'
import { scopeCss } from './css-scope'
import { detectAdapter, ENTRY_ID, entryCode, findEntry, VIRTUAL_ENTRY, type AdapterName } from './vite/adapter'
import { devEntryCode, devManifest, loadPreamble, resolveDevId, scopeDevCss, serveDevManifest, VIRTUAL_DEV_ENTRY } from './vite/dev'

export interface VitralViteOptions {
  /**
   * Arquivo cujo `export default` é o remote: um componente do framework ou
   * um objeto com `mount`. Padrão: `src/remote.*` ou `src/App.*`.
   */
  entry?: string
  /**
   * Adaptador que embrulha o `export default`. Padrão: descoberto pelos
   * plugins do Vite (React, Vue, Svelte, Solid, Preact, Angular; sem nenhum,
   * Web Component ou função). `false` usa o export como está.
   */
  adapter?: AdapterName | false
  /** Nome do remote no manifesto. Padrão: `name` do package.json. */
  name?: string
  /** Versão no manifesto. Padrão: `version` do package.json. */
  version?: string
  /**
   * Dependências que NÃO entram no bundle e vêm do import map do host
   * (ex.: ['react', 'react-dom', 'react-dom/client']). Padrão: nenhuma, cada
   * remote leva suas dependências e nunca há conflito de versão.
   */
  shared?: string[]
  /**
   * Prefixa todo o CSS do remote para valer só dentro dele (inclusive o
   * preflight/tema do Tailwind). Padrão: true.
   */
  scopeCss?: boolean
}

export default function vitral(options: VitralViteOptions = {}): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let pkg: { name?: string; version?: string } = {}
  let entry = options.entry
  let adapter: AdapterName = 'element'
  let framework: AdapterName = 'element'
  let serve = false
  const scopeName = () =>
    (options.name ?? pkg.name ?? 'remote').replace(/[^a-zA-Z0-9_-]/g, '-')
  return {
    name: 'vitral',
    config(user, { mode }) {
      entry ??= findEntry(resolve(user.root ?? process.cwd()))
      if (!entry) throw new Error('[vitral] não achei a entrada do remote (src/remote.* ou src/App.*). Use vitral({ entry }).')
      // Vite 8+ (rolldown) usa codeSplitting; Vite 5-7 (rollup) usa inlineDynamicImports.
      const rolldown = 'rolldownVersion' in (this as any).meta
      const output = rolldown ? { codeSplitting: false } : { inlineDynamicImports: true }
      return {
        // Código de biblioteca não tem process.env; React e Vue precisam disso.
        define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
        server: { cors: true },
        preview: { cors: true },
        build: {
          // Nomes com hash: cache eterno no CDN. Só o vitral.json muda a cada deploy.
          lib: { entry: options.adapter === false ? entry : ENTRY_ID, formats: ['es'], fileName: () => 'remote-[hash].js', cssFileName: 'remote' },
          // Um arquivo só: necessário para verificar o hash SRI no host.
          rollupOptions: { external: options.shared ?? [], output: output as any },
          cssCodeSplit: false,
        },
      }
    },
    configResolved(c) {
      root = c.root
      framework = detectAdapter(c.plugins)
      adapter = options.adapter || framework
      serve = c.command === 'serve'
      outDir = resolve(c.root, c.build.outDir)
      try {
        pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      } catch {}
    },
    // Modo dev: /vitral.json aponta para um módulo com o cliente HMR.
    configureServer(server) {
      const scope = options.scopeCss === false ? undefined : scopeName()
      serveDevManifest(server, () => devManifest(options.name ?? pkg.name ?? 'remote', scope))
    },
    resolveId(id) {
      if (id.endsWith(ENTRY_ID)) return VIRTUAL_ENTRY
      return resolveDevId(id)
    },
    load(id) {
      if (id === VIRTUAL_ENTRY) return entryCode(resolve(root, entry!), adapter, scopeName())
      if (id === VIRTUAL_DEV_ENTRY) return devEntryCode(framework, options.adapter === false ? resolve(root, entry!) : undefined)
      return loadPreamble(id)
    },
    transform(code, id) {
      if (serve && options.scopeCss !== false) return scopeDevCss(code, id, scopeName())
    },
    writeBundle(_, bundle) {
      const files = Object.values(bundle)
      const entry = files.find((f) => f.type === 'chunk' && f.isEntry)
      if (!entry) return
      // CSS: aplica o escopo e põe hash no nome (Vite não põe hash no CSS em modo lib).
      const css = files
        .filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'))
        .map((f) => {
          const from = join(outDir, f.fileName)
          let text = readFileSync(from, 'utf8')
          if (options.scopeCss !== false) text = scopeCss(text, scopeName())
          const hash = createHash('sha256').update(text).digest('base64url').slice(0, 8)
          const name = f.fileName.replace(/\.css$/, `-${hash}.css`)
          writeFileSync(join(outDir, name), text)
          if (name !== f.fileName) rmSync(from)
          return name
        })
      const code = readFileSync(join(outDir, entry.fileName))
      const manifest: RemoteManifest = {
        name: options.name ?? pkg.name ?? 'remote',
        version: options.version ?? pkg.version,
        entry: entry.fileName,
        css,
        integrity: 'sha384-' + createHash('sha384').update(code).digest('base64'),
        ...(options.scopeCss === false ? {} : { scope: scopeName() }),
      }
      writeFileSync(join(outDir, 'vitral.json'), JSON.stringify(manifest, null, 2) + '\n')
    },
  }
}

export { vitral }
