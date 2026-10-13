/**
 * Plugin Vite para quem publica um remote.
 *
 *   // vite.config.ts do remote
 *   plugins: [react(), ilha({ entry: 'src/remote.tsx' })]
 *
 * `vite build` gera `dist/remote.js`, o CSS e `dist/ilha.json` com o hash
 * SRI do JS. O host só precisa da URL do `ilha.json`.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { RemoteManifest } from './index'

export interface IlhaViteOptions {
  /** Arquivo que exporta o remote (default export de reactRemote/vueRemote/defineRemote). */
  entry: string
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
}

export default function ilha(options: IlhaViteOptions): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'ilha',
    config(_, { mode }) {
      // Vite 8+ (rolldown) usa codeSplitting; Vite 5-7 (rollup) usa inlineDynamicImports.
      const rolldown = 'rolldownVersion' in (this as any).meta
      const output = rolldown ? { codeSplitting: false } : { inlineDynamicImports: true }
      return {
        // Código de biblioteca não tem process.env; React e Vue precisam disso.
        define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
        server: { cors: true },
        preview: { cors: true },
        build: {
          lib: { entry: options.entry, formats: ['es'], fileName: () => 'remote.js', cssFileName: 'remote' },
          // Um arquivo só: necessário para verificar o hash SRI no host.
          rollupOptions: { external: options.shared ?? [], output: output as any },
          cssCodeSplit: false,
        },
      }
    },
    configResolved(c) {
      root = c.root
      outDir = resolve(c.root, c.build.outDir)
    },
    writeBundle(_, bundle) {
      const files = Object.values(bundle)
      const entry = files.find((f) => f.type === 'chunk' && f.isEntry)
      if (!entry) return
      const css = files.filter((f) => f.type === 'asset' && f.fileName.endsWith('.css')).map((f) => f.fileName)
      const code = readFileSync(join(outDir, entry.fileName))
      let pkg: { name?: string; version?: string } = {}
      try {
        pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      } catch {}
      const manifest: RemoteManifest = {
        name: options.name ?? pkg.name ?? 'remote',
        version: options.version ?? pkg.version,
        entry: entry.fileName,
        css,
        integrity: 'sha384-' + createHash('sha384').update(code).digest('base64'),
      }
      writeFileSync(join(outDir, 'ilha.json'), JSON.stringify(manifest, null, 2) + '\n')
    },
  }
}

export { ilha }
