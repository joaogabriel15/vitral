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
import { createRequire } from 'node:module'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { RemoteContract, RemoteManifest } from './index'
import type { ShadowCss } from './core/types'
import { scopeCss } from './css-scope'
import { EXPOSES_ENTRY, EXPOSES_IDS, exposeKeys, loadExposes, resolveExposesId } from './vite-exposes'
import { collect, isSplit, outputs, sri, withSplit, type Split } from './vite/manifest'
import { bundledFiles, createSbom, SBOM_FILE } from './vite/sbom'
import { BOOT, dedupeHooks, dedupeIds, groups, type Group } from './vite/dedupe'
import { type CssBuildOptions, splitShadowCss, transformCss } from './css-build'
import { detectAdapter, ENTRY_ID, entryCode, findEntry, VIRTUAL_ENTRY, type AdapterName } from './vite/adapter'
import { extractProps, typesFile } from './vite/types'
import { MCP_APP_GLOBAL, mcpAppHtml } from './vite/mcp-app'
import { minifyWhitespace } from './vite/minify'
import { loadNext, NEXT_IDS, nextDefine, resolveNextId, type NextOptions } from './vite/next'
import { optimizerPaths, pathCandidates, pathsFor } from './vite/tsconfig'
import { svgComponents, type SvgComponents } from './vite/svg'
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
   * Gera `sbom.cdx.json` (CycloneDX 1.6) com os pacotes npm que entraram no
   * bundle, e o `vitral.json` aponta para ele em `sbom`. Padrão: false.
   */
  sbom?: boolean
  /**
   * `'mcp-app'`: o build gera só `mcp-app.html`, um HTML único com o JS e o
   * CSS inline, para um servidor MCP servir como recurso `ui://` (MCP Apps).
   * As notificações do host viram props e `ctx.events.emit` vira mensagem
   * para o host. Não combina com `exposes`, `dedupe` nem `shared`.
   */
  target?: 'mcp-app'
  /**
   * Grava o build em uma pasta por versão (`dist/1.5.0/`), para publicar
   * cada versão sem apagar as anteriores e escolher qual vale num canal
   * (`canal.json`). Usa `version` (ou a do package.json). Padrão: false.
   */
  versionDir?: boolean
  /**
   * Põe o compile hint do V8 (`//# allFunctionsCalledOnLoad`) nos arquivos
   * que rodam ao montar o remote, para o Chrome compilá-los de uma vez numa
   * thread de fundo. Ajuda em CPU lenta e custa memória (veja o guia de
   * carregamento). Os outros navegadores ignoram. Padrão: false.
   */
  compileHints?: boolean
  /**
   * Pacotes tratados como sem efeitos colaterais, menos o CSS deles: o
   * tree-shaking tira o que o remote não usa. Útil para pacote publicado como
   * código-fonte sem `sideEffects` no package.json. Ex.: `['@empresa/ui']`.
   */
  sideEffectFree?: string[]
  /**
   * Builda com o Vite um código escrito para Next.js: `next/link`,
   * `next/image`, `next/head`, `next/dynamic`, `next/router` e
   * `next/navigation` vêm de `vitral/next`, e as `NEXT_PUBLIC_*` do `.env`
   * entram em `process.env`. `basePath` é o do `next.config`. Também lê os
   * `paths` do tsconfig de cada arquivo, importa `.svg` como componente (com
   * o SVGR do projeto) e builda com `NODE_ENV=production` mesmo com
   * `NODE_ENV=development` no `.env`. Padrão: false.
   */
  next?: boolean | NextOptions
}

export default function vitral(options: VitralViteOptions = {}): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let pkg: { name?: string; version?: string } = {}
  let manifest: RemoteManifest | undefined
  let split: Split | undefined
  let modules = new Set<string>()
  let entry = options.entry
  let adapter: AdapterName = 'element'
  let framework: AdapterName = 'element'
  const entryFile = () => resolve(root, entry!)
  let serve = false
  let minify = false
  let rolldown = false
  let shared: Group[] = []
  let svg: Promise<SvgComponents | undefined> | undefined
  const dedupe = !!options.dedupe?.length
  const hooks = dedupeHooks(() => (options.exposes ? EXPOSES_ENTRY : options.adapter === false ? entryFile() : ENTRY_ID), () => shared)
  const mcp = options.target === 'mcp-app'
  const next: NextOptions | undefined = options.next === true ? {} : options.next || undefined
  const paths = !!next && next.tsconfigPaths !== false
  const files = !!options.dedupe?.some((d) => d.endsWith('/*'))
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
    async config(user, { mode, command }) {
      entry ??= findEntry(resolve(user.root ?? process.cwd()))
      if (!entry) throw new Error('[vitral] não achei a entrada do remote (src/remote.* ou src/App.*). Use vitral({ entry }).')
      // Vite 8+ (rolldown) usa codeSplitting; Vite 5-7 (rollup) usa inlineDynamicImports.
      rolldown = 'rolldownVersion' in ((this as any)?.meta ?? {})
      // O Vite troca NODE_ENV por development quando o .env pede (e o JSX sai
      // com jsxDEV). O app Next tem NODE_ENV=development no .env de dev; o build continua de produção.
      if (next && command === 'build' && mode !== 'development' && process.env.VITE_USER_NODE_ENV === undefined) process.env.VITE_USER_NODE_ENV = ''
      // Vite 8: o Rolldown tira os espaços ao gerar o código.
      const whitespace = rolldown && user.build?.minify !== false ? { minify: { codegen: { removeWhitespace: true } } } : {}
      const dir = options.versionDir ? versionDir(user.root ?? process.cwd(), user.build?.outDir, options.version) : undefined
      return {
        // Código de biblioteca não tem process.env; React e Vue precisam disso.
        define: next
          ? nextDefine({ ...process.env, ...(await import('vite')).loadEnv(mode, user.root ?? process.cwd(), 'NEXT_PUBLIC_') } as Record<string, string>, mode)
          : { 'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production') },
        server: { cors: true },
        preview: { cors: true },
        // O remote não tem index.html: sem isso o Vite só descobre as
        // dependências no primeiro request e recarrega a página do host.
        optimizeDeps: optimizeDeps(command === 'serve', user, entry, options.adapter, next && { rolldown, paths }),
        build: mcp ? {
          // Um IIFE só, sem chunks: o HTML do MCP App não pode buscar arquivos.
          lib: { entry: options.adapter === false ? entry : ENTRY_ID, formats: ['iife'], name: MCP_APP_GLOBAL, fileName: () => 'mcp-app.js', cssFileName: 'remote' },
          rollupOptions: { output: rolldown ? { codeSplitting: false } : { inlineDynamicImports: true } } as any,
          cssCodeSplit: false,
        } : {
          // Nomes com hash: cache eterno no CDN. Só o vitral.json muda a cada deploy.
          lib: { entry: dedupe ? BOOT : options.exposes ? EXPOSES_ENTRY : options.adapter === false ? entry : ENTRY_ID, fileName: () => 'remote-[hash].js', cssFileName: 'remote' },
          // Arquivo único (hosts antigos e caminho com blob:) e build dividido (manifesto v2).
          rollupOptions: {
            external: options.shared ?? [],
            output: outputs(rolldown, !!options.compileHints).map((o) => ({ ...o, ...whitespace })) as any,
            ...(options.sideEffectFree?.length && { treeshake: { moduleSideEffects: pureExcept(options.sideEffectFree) } }),
          },
          cssCodeSplit: false,
          // A entrada do dedupe usa top-level await, fora do target padrão do Vite 5 e 6.
          ...(dedupe && !user.build?.target && { target: 'es2022' }),
          ...(dir && { outDir: dir }),
        },
      }
    },
    configResolved(c) {
      root = c.root
      framework = detectAdapter(c.plugins)
      adapter = options.adapter || framework
      serve = c.command === 'serve'
      minify = !serve && c.build.minify !== false
      // O plugin põe NODE_ENV=production no código; NODE_ENV=development num
      // .env faz o Vite compilar o JSX de dev, que não existe no React de produção.
      if (!serve && c.mode !== 'development' && process.env.NODE_ENV === 'development') {
        throw new Error('[vitral] NODE_ENV=development (de um .env?) num build de produção: o JSX sai com jsxDEV e o remote quebra. Rode com NODE_ENV=production.')
      }
      outDir = resolve(c.root, c.build.outDir)
      try {
        pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      } catch {}
    },
    async buildStart() {
      // Em dev cada pacote vem do próprio node_modules: o dedupe é só do build.
      // Resolução do Node, não this.resolve: no Rollup (Vite 5-7) o plugin
      // commonjs faz this.load do pacote, que não anda durante o buildStart.
      if (dedupe && !serve) {
        hooks.reset()
        shared = await groups(options.dedupe!, root, entry!, nodeResolve)
      }
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
      filter: {
        id: [
          ...(dedupe ? [dedupeIds(options.dedupe!)] : []),
          ...(options.exposes ? [EXPOSES_IDS] : []),
          ...(next ? [NEXT_IDS] : []),
          // `paths` do tsconfig e dedupe de `pacote/*`: qualquer import que não é relativo.
          ...(paths || files ? [/^[^.\0]/] : []),
          /__vitral_entry__\.js$/,
          DEV_IDS,
        ],
      },
      async handler(id, importer, opts) {
        const shim = next && resolveNextId(id)
        if (shim) return shim
        const own = dedupe && !serve ? hooks.resolveId.handler(id, importer) : null
        if (own) return own
        if (options.exposes && resolveExposesId(id)) return resolveExposesId(id)
        if (id.endsWith(ENTRY_ID)) return VIRTUAL_ENTRY
        const dev = resolveDevId(id)
        if (dev) return dev
        if (!importer || importer.startsWith('\0') || id.startsWith('\0') || /^(\.|\/|[a-zA-Z]:|virtual:)/.test(id)) return null
        const byShared = files && !serve && hooks.files()
        const config = paths ? pathsFor(importer.split('?')[0]) : null
        const candidates = config ? pathCandidates(id, config) : undefined
        if (!candidates && !byShared) return null
        for (const c of candidates ?? [id]) {
          const r = await this.resolve(c, importer, { ...opts, skipSelf: true })
          if (!r || r.external) continue
          return (byShared && (await hooks.resolved(this as any, r.id, importer))) || r
        }
        return null
      },
    },
    load: {
      // Antes do vite:asset, que faria do .svg uma URL.
      order: 'pre',
      // Todos os módulos virtuais do vitral: \0vitral... e \0virtual:vitral...
      filter: { id: [/^\x00(virtual:)?vitral/, ...(next?.svgr !== false && next ? [/\.svg$/] : [])] },
      async handler(id) {
        if (next && next.svgr !== false && id.endsWith('.svg') && !id.startsWith('\0')) {
          const svgr = await (svg ??= svgComponents(root))
          return svgr ? svgr.transform(id) : null
        }
        const own = dedupe && !serve ? await hooks.load(this as any, id) : null
        if (own != null) return own
        const exposed = options.exposes ? loadExposes(id, root, entry!, options.exposes, options.adapter === false ? undefined : ENTRY_ID) : null
        if (exposed != null) return exposed
        const shim = next && loadNext(id, next)
        if (shim) return shim
        if (id === VIRTUAL_ENTRY) return entryCode(resolve(root, entry!), adapter, scopeName(), !!next)
        if (id === VIRTUAL_DEV_ENTRY) return devEntryCode(framework, options.adapter === false ? resolve(root, entry!) : undefined)
        return loadPreamble(id)
      },
    },
    // Vite 5-7: depois do minificador do Vite, que no modo lib deixa os espaços.
    renderChunk: {
      order: 'post',
      handler(code, chunk, out) {
        if (minify && !rolldown && out.format === 'es') return minifyWhitespace(code, chunk.fileName, !!out.sourcemap)
      },
    },
    transform: {
      filter: { id: DEV_CSS },
      handler(code, id) {
        if (serve && options.scopeCss !== false) return scopeDevCss(code, id, scopeName())
      },
    },
    writeBundle(_, bundle) {
      // As duas saídas têm os mesmos módulos; juntar cobre o que só uma tiver.
      if (options.sbom) bundledFiles(bundle as any, modules)
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
      if (options.sbom) {
        const bom = createSbom({ root, name: done.name, version: done.version, files: modules, entry: readFileSync(join(outDir, done.entry)), tool: ownVersion() })
        writeFileSync(join(outDir, SBOM_FILE), JSON.stringify(bom, null, 2) + '\n')
        done.sbom = { file: SBOM_FILE, integrity: sri(join(outDir, SBOM_FILE)) }
      }
      manifest = split = undefined
      modules = new Set()
      writeFileSync(join(outDir, 'vitral.json'), JSON.stringify(done, null, 2) + '\n')
      const props = options.types === false ? null : await extractProps(root, entryFile())
      if (props) writeFileSync(join(outDir, 'vitral.d.ts'), typesFile(done.name, props))
    },
  }
}

/**
 * `optimizeDeps` do remote. Em dev, o pré-bundle já leva o adaptador e, no
 * modo next, os shims de `next/*` e o plugin dos `paths` do tsconfig.
 */
function optimizeDeps(
  serve: boolean,
  user: { plugins?: unknown; optimizeDeps?: { entries?: unknown } },
  entry: string,
  adapter: AdapterName | false | undefined,
  next?: false | { rolldown: boolean; paths: boolean },
) {
  const own = user.optimizeDeps?.entries ? {} : { entries: [entry] }
  if (!serve) return own
  // Descoberto depois, o vitral/next faria o Vite refazer o pré-bundle, com outra cópia do React.
  const include = [...devOptimizeDeps(user.plugins, entry, adapter).include, ...(next ? ['vitral/next'] : [])]
  return { ...own, include, ...(next && next.paths && optimizerPaths(next.rolldown)) }
}

/** `moduleSideEffects` com os pacotes de `sideEffectFree` sem efeitos, menos o CSS deles. */
export function pureExcept(pkgs: string[]): (id: string) => boolean {
  const dirs = pkgs.map((p) => `/node_modules/${p}/`)
  return (id) => /\.(css|scss|sass|less|styl)($|\?)/.test(id) || !dirs.some((d) => id.replace(/\\/g, '/').includes(d))
}

/** Caminho do pacote como o Node resolve a partir de `importer`, ou null. */
async function nodeResolve(id: string, importer: string): Promise<{ id: string } | null> {
  try {
    return { id: createRequire(importer).resolve(id) }
  } catch {
    return null
  }
}

/** Versão do vitral (o package.json fica uma pasta acima de `dist/` e de `src/`). */
function ownVersion(): string | undefined {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return undefined
  }
}

/** `dist/<versão>`: a pasta do build com `versionDir`. */
function versionDir(root: string, outDir = 'dist', version?: string): string {
  try {
    version ??= JSON.parse(readFileSync(join(resolve(root), 'package.json'), 'utf8')).version
  } catch {}
  if (!version) throw new Error('[vitral] versionDir precisa de uma versão: use vitral({ version }) ou "version" no package.json.')
  return join(outDir, version)
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
