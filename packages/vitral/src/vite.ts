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
import type { RemoteContract, RemoteManifest } from './index'
import type { ShadowCss } from './core/types'
import { scopeCss } from './css-scope'
import { EXPOSES_ENTRY, EXPOSES_IDS, exposeKeys, loadExposes, resolveExposesId } from './vite-exposes'
import { collect, isSplit, outputs, withSplit, type Split } from './vite/manifest'
import { BOOT, dedupeHooks, dedupeIds, groups, type Group } from './vite/dedupe'
import { type CssBuildOptions, splitShadowCss, transformCss } from './css-build'
import { detectAdapter, ENTRY_ID, entryCode, findEntry, VIRTUAL_ENTRY, type AdapterName } from './vite/adapter'
import { extractProps, typesFile } from './vite/types'
import { MCP_APP_GLOBAL, mcpAppHtml } from './vite/mcp-app'
import { DEV_CSS, DEV_IDS, devEntryCode, devManifest, devOptimizeDeps, loadPreamble, resolveDevId, scopeDevCss, serveDevManifest, VIRTUAL_DEV_ENTRY } from './vite/dev'

export interface VitralViteOptions extends CssBuildOptions {
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
   * @deprecated Use `dedupe`, que cai na própria cópia se a versão não servir.
   */
  shared?: string[]
  /**
   * Prefixa todo o CSS do remote para valer só dentro dele (inclusive o
   * preflight/tema do Tailwind). Padrão: true.
   */
  scopeCss?: boolean
  /**
   * Outros componentes e módulos do remote, por nome. O host usa
   * `carrinho/MiniCarrinho` ou `loadModule('carrinho/api')`.
   *
   *   exposes: { './MiniCarrinho': 'src/MiniCarrinho.tsx', './api': 'src/api.ts' }
   *
   * Um componente exporta `default` com `mount` (`reactRemote(Mini)` etc.).
   */
  exposes?: Record<string, string>
  /**
   * Dependências que o remote usa da página, se a versão servir (padrão: `^`
   * da versão instalada), ou da própria cópia. Ex.: `['react']` (o grupo do
   * React inteiro) ou `['vue']`.
   */
  dedupe?: string[]
  /**
   * Publica `vitral.d.ts` com o tipo das props do `export default`, para o
   * host checar as props (`npx vitral types`). Precisa de TypeScript no
   * projeto e de entrada .ts/.tsx/.js/.jsx. Padrão: true.
   */
  types?: boolean
  /**
   * Contrato publicado no `vitral.json`. O host que declara
   * `contract: '^2'` só monta o remote se `version` estiver na faixa. As
   * faixas de `dedupe` entram sozinhas, em `peers`. Padrão: sem versão.
   */
  contract?: { version?: string }
  /**
   * `'mcp-app'`: o build gera só `mcp-app.html`, um HTML único com o JS e o
   * CSS inline, para um servidor MCP servir como recurso `ui://` (MCP Apps).
   * As notificações do host viram props e `ctx.events.emit` vira mensagem
   * para o host. Não combina com `exposes`, `dedupe` nem `shared`.
   */
  target?: 'mcp-app'
}

export default function vitral(options: VitralViteOptions = {}): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let pkg: { name?: string; version?: string } = {}
  let manifest: RemoteManifest | undefined
  let split: Split | undefined
  let entry = options.entry
  let adapter: AdapterName = 'element'
  let framework: AdapterName = 'element'
  const entryFile = () => resolve(root, entry!)
  let serve = false
  let shared: Group[] = []
  const dedupe = !!options.dedupe?.length
  const hooks = dedupeHooks(() => (options.exposes ? EXPOSES_ENTRY : options.adapter === false ? entryFile() : ENTRY_ID), () => shared)
  const mcp = options.target === 'mcp-app'
  if (mcp && (options.exposes || dedupe || options.shared?.length)) {
    throw new Error("[vitral] target: 'mcp-app' gera um HTML único: não combina com exposes, dedupe nem shared.")
  }
  const scopeName = () =>
    (options.name ?? pkg.name ?? 'remote').replace(/[^a-zA-Z0-9_-]/g, '-')
  // Junta o JS e o CSS do build em mcp-app.html e apaga os dois.
  const mcpApp = (files: { type: string; fileName: string }[], js: string) => {
    const css = files.filter((f) => f.type === 'asset' && f.fileName.endsWith('.css')).map((f) => f.fileName)
    const read = (file: string) => {
      const text = readFileSync(join(outDir, file), 'utf8')
      rmSync(join(outDir, file))
      return text
    }
    const scope = options.scopeCss === false ? undefined : scopeName()
    const html = mcpAppHtml({
      name: options.name ?? pkg.name ?? 'remote',
      version: options.version ?? pkg.version,
      scope,
      code: read(js),
      css: css.map((f) => transformCss(read(f), options, scopeName())),
    })
    writeFileSync(join(outDir, 'mcp-app.html'), html)
  }
  return {
    name: 'vitral',
    config(user, { mode, command }) {
      entry ??= findEntry(resolve(user.root ?? process.cwd()))
      if (!entry) throw new Error('[vitral] não achei a entrada do remote (src/remote.* ou src/App.*). Use vitral({ entry }).')
      // Vite 8+ (rolldown) usa codeSplitting; Vite 5-7 (rollup) usa inlineDynamicImports.
      const rolldown = 'rolldownVersion' in (this as any).meta
      return {
        // Código de biblioteca não tem process.env; React e Vue precisam disso.
        define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
        server: { cors: true },
        ...(command === 'serve' && { optimizeDeps: devOptimizeDeps(user.plugins, entry, options.adapter) }),
        preview: { cors: true },
        // O remote não tem index.html: sem isso o Vite só descobre as
        // dependências no primeiro request e recarrega a página do host.
        optimizeDeps: user.optimizeDeps?.entries ? undefined : { entries: [entry] },
        build: mcp ? {
          // Um IIFE só, sem chunks: o HTML do MCP App não pode buscar arquivos.
          lib: { entry: options.adapter === false ? entry : ENTRY_ID, formats: ['iife'], name: MCP_APP_GLOBAL, fileName: () => 'mcp-app.js', cssFileName: 'remote' },
          rollupOptions: { output: rolldown ? { codeSplitting: false } : { inlineDynamicImports: true } } as any,
          cssCodeSplit: false,
        } : {
          // Nomes com hash: cache eterno no CDN. Só o vitral.json muda a cada deploy.
          lib: { entry: dedupe ? BOOT : options.exposes ? EXPOSES_ENTRY : options.adapter === false ? entry : ENTRY_ID, fileName: () => 'remote-[hash].js', cssFileName: 'remote' },
          // Arquivo único (hosts antigos e caminho com blob:) e build dividido (manifesto v2).
          rollupOptions: { external: options.shared ?? [], output: outputs(rolldown) as any },
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
    async buildStart() {
      // Em dev cada pacote vem do próprio node_modules: o dedupe é só do build.
      if (dedupe && !serve) shared = await groups(options.dedupe!, root, entry!, (id, importer) => this.resolve(id, importer, { skipSelf: true }))
    },
    // Modo dev: /vitral.json aponta para um módulo com o cliente HMR.
    configureServer(server) {
      const scope = options.scopeCss === false ? undefined : scopeName()
      serveDevManifest(server, () => devManifest(options.name ?? pkg.name ?? 'remote', scope))
    },
    // Filtros de hook (Rolldown, Vite 6.3+): os módulos que não são do vitral
    // nem chegam ao JS. As checagens nos handlers continuam para Vite 5 e 6.0-6.2.
    resolveId: {
      order: 'pre',
      filter: { id: [...(dedupe ? [dedupeIds(options.dedupe!)] : []), ...(options.exposes ? [EXPOSES_IDS] : []), /__vitral_entry__\.js$/, DEV_IDS] },
      handler(id, importer) {
        const own = dedupe && !serve ? hooks.resolveId.handler(id, importer) : null
        if (own) return own
        if (options.exposes && resolveExposesId(id)) return resolveExposesId(id)
        if (id.endsWith(ENTRY_ID)) return VIRTUAL_ENTRY
        return resolveDevId(id)
      },
    },
    load: {
      // Todos os módulos virtuais do vitral: \0vitral... e \0virtual:vitral...
      filter: { id: /^\x00(virtual:)?vitral/ },
      handler(id) {
        const own = dedupe && !serve ? hooks.load(id) : null
        if (own != null) return own
        const exposed = options.exposes ? loadExposes(id, root, entry!, options.exposes, options.adapter === false ? undefined : ENTRY_ID) : null
        if (exposed != null) return exposed
        if (id === VIRTUAL_ENTRY) return entryCode(resolve(root, entry!), adapter, scopeName())
        if (id === VIRTUAL_DEV_ENTRY) return devEntryCode(framework, options.adapter === false ? resolve(root, entry!) : undefined)
        return loadPreamble(id)
      },
    },
    transform: {
      filter: { id: DEV_CSS },
      handler(code, id) {
        if (serve && options.scopeCss !== false) return scopeDevCss(code, id, scopeName())
      },
    },
    writeBundle(_, bundle) {
      if (isSplit(bundle)) return void (split = collect(outDir, bundle))
      const files = Object.values(bundle)
      const entry = files.find((f) => f.type === 'chunk' && f.isEntry)
      if (!entry) return
      if (mcp) return mcpApp(files as any, entry.fileName)
      // CSS: aplica o escopo e põe hash no nome (Vite não põe hash no CSS em modo lib).
      const emit = (file: string, text: string, kind = '') => {
        const hash = createHash('sha256').update(text).digest('base64url').slice(0, 8)
        const name = file.replace(/\.css$/, `${kind}-${hash}.css`)
        writeFileSync(join(outDir, name), text)
        return name
      }
      const shadow: ShadowCss = { css: [] }
      const css = files
        .filter((f) => f.type === 'asset' && f.fileName.endsWith('.css'))
        .map((f) => {
          const from = join(outDir, f.fileName)
          const text = transformCss(readFileSync(from, 'utf8'), options, scopeName())
          const name = emit(f.fileName, text)
          if (name !== f.fileName) rmSync(from)
          // Para o Shadow DOM, o mesmo CSS já separado: o runtime só adota.
          const split = splitShadowCss(text)
          shadow.css.push(split.css === text ? name : emit(f.fileName, split.css, '-shadow'))
          if (split.global) (shadow.global ??= []).push(emit(f.fileName, split.global, '-global'))
          if (split.imports.length) (shadow.imports ??= []).push(...split.imports)
          if (split.rebase) shadow.rebase = true
          return name
        })
      const code = readFileSync(join(outDir, entry.fileName))
      manifest = {
        name: options.name ?? pkg.name ?? 'remote',
        version: options.version ?? pkg.version,
        entry: entry.fileName,
        css,
        ...(css.length ? { shadow } : {}),
        integrity: 'sha384-' + createHash('sha384').update(code).digest('base64'),
        ...(options.scopeCss === false ? {} : { scope: scopeName() }),
        ...(options.exposes ? { exposes: Object.keys(exposeKeys(options.exposes)) } : {}),
        ...contractOf(options.contract?.version, shared),
      }
    },
    async closeBundle() {
      if (!manifest) return
      const done = withSplit(manifest, outDir, split, shared)
      manifest = split = undefined
      writeFileSync(join(outDir, 'vitral.json'), JSON.stringify(done, null, 2) + '\n')
      const props = options.types === false ? null : await extractProps(root, entryFile())
      if (props) writeFileSync(join(outDir, 'vitral.d.ts'), typesFile(done.name, props))
    },
  }
}

/** `contract` do manifesto: a versão da opção e a faixa de cada grupo de `dedupe`. Sem nenhum dos dois, nada. */
function contractOf(version: string | undefined, groups: Group[]): Pick<RemoteManifest, 'contract'> {
  const contract: RemoteContract = {
    ...(version && { version }),
    ...(groups.length && { peers: Object.fromEntries(groups.map((g) => [g.name, g.range])) }),
  }
  return Object.keys(contract).length ? { contract } : {}
}

export { vitral }
