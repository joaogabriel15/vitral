import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'

export type MigrateSource = 'single-spa' | 'module-federation'

export interface MigrateOptions {
  /** Diretório do projeto. Padrão: `process.cwd()`. */
  cwd?: string
  /** De onde migrar. Padrão: descoberto pelo package.json e pelos arquivos do projeto. */
  from?: MigrateSource
  /** Só mostra o que mudaria. Não escreve nada. */
  dryRun?: boolean
  log?: (msg: string) => void
}

/** Um arquivo criado (`before: null`) ou alterado. Caminho relativo ao projeto. */
export interface FileChange {
  path: string
  before: string | null
  after: string
}

export interface MigratePlan {
  from: MigrateSource | null
  changes: FileChange[]
  /** O que o comando não converte e precisa ser feito à mão. */
  notes: string[]
}

type Framework = 'react' | 'preact' | 'vue' | 'svelte' | 'solid' | 'angular'

/** Adaptador do vitral e plugin do Vite de cada framework. */
const FRAMEWORKS: Record<Framework, { wrap: [string, string]; plugin: [pkg: string, imp: string, call: string] }> = {
  preact: { wrap: ['vitral/preact', 'preactRemote'], plugin: ['@preact/preset-vite', 'preact', 'preact()'] },
  react: { wrap: ['vitral/react', 'reactRemote'], plugin: ['@vitejs/plugin-react', 'react', 'react()'] },
  vue: { wrap: ['vitral/vue', 'vueRemote'], plugin: ['@vitejs/plugin-vue', 'vue', 'vue()'] },
  svelte: { wrap: ['vitral/svelte', 'svelteRemote'], plugin: ['@sveltejs/vite-plugin-svelte', '{ svelte }', 'svelte()'] },
  solid: { wrap: ['vitral/solid', 'solidRemote'], plugin: ['vite-plugin-solid', 'solid', 'solid()'] },
  angular: { wrap: ['vitral/angular', 'angularRemote'], plugin: ['@analogjs/vite-plugin-angular', 'angular', 'angular()'] },
}
/** Pacote que identifica cada framework. A ordem importa: Preact antes de React. */
const DETECT: [string, Framework][] = [
  ['preact', 'preact'],
  ['react', 'react'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
  ['solid-js', 'solid'],
  ['@angular/core', 'angular'],
]

const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.vue', '.svelte']
const CONFIGS = ['webpack.config', 'rspack.config', 'rsbuild.config', 'vite.config', 'module-federation.config'].flatMap((b) =>
  ['.js', '.cjs', '.mjs', '.ts', '.mts', '.cts'].map((e) => b + e),
)
const MF_CALL = /new\s+(?:[\w$]+\.)*ModuleFederationPlugin\s*\(|\b(?:federation|pluginModuleFederation|createModuleFederationConfig)\s*\(/
// `.mjs`/`.mts`: vale também em projeto CommonJS (webpack), onde um `.js` não carrega `vitral/vite`, que é só ESM.
const VITE_CONFIG = (ts: boolean) => `vite.vitral.config.${ts ? 'mts' : 'mjs'}`
const OUT_DIR = 'dist-vitral'

interface Project {
  cwd: string
  pkg: Record<string, any> | null
  deps: Record<string, string>
  ts: boolean
  framework: Framework | null
}

function read(file: string): string | null {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** `./a\\b` → `./a/b`, sempre começando com `./` ou `../`. */
function rel(from: string, to: string): string {
  const r = relative(from, to).replace(/\\/g, '/')
  return r.startsWith('.') ? r : './' + r
}

/** Caminho de import sem extensão de JS/TS (que o bundler resolve). `.vue` e `.svelte` ficam. */
function spec(from: string, to: string): string {
  return rel(from, to).replace(/\.(tsx?|jsx?|mjs)$/, '')
}

/** Texto entre o delimitador em `start` e o par dele, pulando strings e comentários. */
export function balanced(text: string, start: number): string | null {
  const open = text[start]
  const close = open === '{' ? '}' : open === '(' ? ')' : open === '[' ? ']' : ''
  if (!close) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++
    } else if (c === '/' && text[i + 1] === '/') i = text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i)
    else if (c === '/' && text[i + 1] === '*') i = text.indexOf('*/', i) < 0 ? text.length : text.indexOf('*/', i) + 1
    else if (c === open) depth++
    else if (c === close && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

/** O objeto literal de `chave: { … }` dentro de `text`, ou `null`. */
function objectOf(text: string, key: string): string | null {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(text)
  return m ? balanced(text, m.index + m[0].length - 1) : null
}

/** Pares `'chave': 'valor'` (ou `'chave': { import: 'valor' }`) de um objeto literal. */
export function pairs(obj: string): [string, string][] {
  const re = /(['"`]?)([\w@./-]+)\1\s*:\s*(?:(['"`])([^'"`]+)\3|\{[^}]*?\bimport\s*:\s*(['"`])([^'"`]+)\5[^}]*\})/g
  return [...obj.matchAll(re)].map((m) => [m[2], m[4] ?? m[6]])
}

function project(cwd: string): Project {
  const raw = read(join(cwd, 'package.json'))
  const pkg = raw ? (JSON.parse(raw) as Record<string, any>) : null
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies }
  return { cwd, pkg, deps, ts: existsSync(join(cwd, 'tsconfig.json')), framework: DETECT.find(([d]) => d in deps)?.[1] ?? null }
}

/** Arquivos de código de `dir`, sem `node_modules` nem pastas de build. */
function sources(dir: string, out: string[] = []): string[] {
  let list: import('node:fs').Dirent[]
  try {
    list = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of list) {
    if (e.isDirectory()) {
      if (!/^(node_modules|dist|build|\..*)$/.test(e.name)) sources(join(dir, e.name), out)
    } else if (/\.(tsx?|jsx?|mjs)$/.test(e.name) && !/\.(test|spec|d)\./.test(e.name)) out.push(join(dir, e.name))
  }
  return out
}

/** Arquivo que exporta `mount` e `unmount` do single-spa. */
const LIFECYCLE_EXPORT = /export\s+(?:(?:async\s+)?function\s*\*?\s*mount\b|(?:const|let|var)\s+mount\b|(?:const|let|var)\s*\{[^}]*\bmount\b[^}]*\}|\{[^}]*\bmount\b[^}]*\})/

function configs(cwd: string): { file: string; text: string }[] {
  return CONFIGS.map((f) => ({ file: f, text: read(join(cwd, f)) })).filter((c): c is { file: string; text: string } => c.text !== null)
}

function detect(p: Project): MigrateSource | null {
  if (configs(p.cwd).some((c) => MF_CALL.test(c.text) && /\bexposes\s*:/.test(c.text))) return 'module-federation'
  if (Object.keys(p.deps).some((d) => d === 'single-spa' || d.startsWith('single-spa-'))) return 'single-spa'
  if (configs(p.cwd).some((c) => MF_CALL.test(c.text))) return 'module-federation'
  return null
}

/** `vite.vitral.config.*`: um build à parte, que não mexe no build atual. */
function viteConfig(p: Project, vitral: string, notes: string[]): FileChange | null {
  const path = VITE_CONFIG(p.ts)
  if (existsSync(join(p.cwd, path))) {
    notes.push(`${path} já existe e não foi alterado. Confira se ele usa: ${vitral}`)
    return null
  }
  const fw = p.framework && FRAMEWORKS[p.framework].plugin
  const lines = [
    ...(fw ? [`import ${fw[1]} from '${fw[0]}'`] : []),
    `import { defineConfig } from 'vite'`,
    `import vitral from 'vitral/vite'`,
    ``,
    `// Build do remote vitral (\`npm run build:vitral\`). Gera ${OUT_DIR}/vitral.json, ao lado do build atual.`,
    `export default defineConfig({`,
    `  plugins: [${fw ? fw[2] + ', ' : ''}${vitral}],`,
    `  build: { outDir: '${OUT_DIR}' },`,
    `})`,
    ``,
  ]
  const missing = ['vite', 'vitral', ...(fw ? [fw[0]] : [])].filter((d) => !(d in p.deps) && !(d === '@vitejs/plugin-react' && '@vitejs/plugin-react-swc' in p.deps))
  if (missing.length) notes.push(`Instale as dependências do build novo: npm i -D ${missing.join(' ')}`)
  return { path, before: null, after: lines.join('\n') }
}

/** Script `build:vitral` no package.json, mantendo a indentação do arquivo. */
function buildScript(p: Project): FileChange | null {
  if (!p.pkg || p.pkg.scripts?.['build:vitral']) return null
  const before = read(join(p.cwd, 'package.json'))!
  const indent = /^(\s+)"/m.exec(before)?.[1] ?? '  '
  const pkg = { ...p.pkg, scripts: { ...p.pkg.scripts, 'build:vitral': `vite build -c ${VITE_CONFIG(p.ts)}` } }
  return { path: 'package.json', before, after: JSON.stringify(pkg, null, indent) + (before.endsWith('\n') ? '\n' : '') }
}

/** Mesmo arquivo com uma extensão de código: `./src/Carrinho` → `src/Carrinho.tsx`. */
function resolveSource(base: string, file: string): string {
  const abs = resolve(base, file)
  if (extname(abs) && existsSync(abs)) return abs
  for (const ext of SOURCE_EXT) if (existsSync(abs + ext)) return abs + ext
  for (const ext of SOURCE_EXT) if (existsSync(join(abs, 'index' + ext))) return join(abs, 'index' + ext)
  return abs
}

// ---------------------------------------------------------------------------
// single-spa
// ---------------------------------------------------------------------------

/** `singleSpaReact({ React, ReactDOMClient, rootComponent: Root })` sem outras opções vira `reactRemote(Root)`. */
function reactRoot(text: string, file: string): string | null {
  const call = /\bsingleSpaReact\s*\(/.exec(text)
  const args = call && balanced(text, call.index + call[0].length - 1)
  const obj = args && /^\(\s*(\{[\s\S]*\})\s*\)$/.exec(args)?.[1]
  if (!obj) return null
  const body = obj.slice(1, -1).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')
  const keys = body.split(',').map((k) => k.split(':')[0].trim()).filter(Boolean)
  if (keys.some((k) => !['React', 'ReactDOM', 'ReactDOMClient', 'rootComponent'].includes(k))) return null
  const root = /\brootComponent\s*:\s*([\w$]+)\s*(?:,|$)/.exec(body)?.[1]
  const from = root && new RegExp(`import\\s+${root.replace('$', '\\$')}\\s+from\\s+(['"])([^'"]+)\\1`).exec(text)?.[2]
  if (!from) return null
  return from.startsWith('.') ? resolve(dirname(file), from) : from
}

function singleSpa(p: Project): MigratePlan {
  const changes: FileChange[] = []
  const notes: string[] = []
  const src = existsSync(join(p.cwd, 'src')) ? join(p.cwd, 'src') : p.cwd
  const files = sources(src)
  const found = files.filter((f) => {
    const t = read(f)!
    return LIFECYCLE_EXPORT.test(t) && /\bunmount\b/.test(t)
  })
  const roots = files.filter((f) => /\bregisterApplication\s*\(/.test(read(f)!))
  if (roots.length) {
    notes.push(
      `Root config em ${roots.map((f) => rel(p.cwd, f)).join(', ')}: troque cada registerApplication por configure({ remotes }) e o activeWhen por uma rota do host ou routes() de vitral/routes. Veja https://joaogabriel15.github.io/vitral/migracao/single-spa`,
    )
  }
  if (!found.length) {
    if (!roots.length) notes.push('Nenhum arquivo exporta os lifecycles mount e unmount do single-spa.')
    return { from: 'single-spa', changes, notes }
  }
  const [file, ...others] = found
  if (others.length) notes.push(`Outros arquivos também exportam lifecycles e não foram migrados: ${others.map((f) => rel(p.cwd, f)).join(', ')}`)
  const out = join(src, `vitral-remote.${p.ts ? 'ts' : 'js'}`)
  const outRel = rel(p.cwd, out).replace(/^\.\//, '')
  const text = read(file)!
  const root = /single-spa-react/.test(text) ? reactRoot(text, file) : null
  let code: string
  if (root) {
    const imp = root.startsWith('/') || /^[A-Za-z]:/.test(root) ? spec(src, resolveSource(dirname(root), root)) : root
    code = `import { reactRemote } from 'vitral/react'\nimport Root from '${imp}'\n\nexport default reactRemote(Root)\n`
    notes.push(`${rel(p.cwd, file)} usava singleSpaReact só com rootComponent: ${outRel} usa reactRemote. Quando nenhum host single-spa usar mais o app, remova single-spa-react e o arquivo antigo.`)
  } else {
    code = `import { singleSpaRemote } from 'vitral/single-spa'\nimport * as lifecycles from '${spec(src, file)}'\n\nexport default singleSpaRemote(lifecycles)\n`
    notes.push(
      `${outRel} embrulha os lifecycles de ${rel(p.cwd, file)} sem mudar o app. Para tirar o single-spa do bundle, troque por reactRemote, vueRemote etc. Veja https://joaogabriel15.github.io/vitral/migracao/single-spa`,
    )
  }
  if (existsSync(out)) notes.push(`${outRel} já existe e não foi alterado.`)
  else changes.push({ path: outRel, before: null, after: code })
  const vite = viteConfig(p, `vitral({ entry: '${outRel}' })`, notes)
  if (vite) changes.push(vite)
  const script = buildScript(p)
  if (script) changes.push(script)
  if (/\b(navigateToUrl|mountParcel|mountRootParcel)\b/.test(files.map((f) => read(f)).join('\n'))) {
    notes.push('O código usa navigateToUrl ou parcels do single-spa: fora de um host single-spa, troque navigateToUrl por ctx.navigate e parcels por <Remote> ou createSlot.')
  }
  if (/vite-plugin-single-spa|webpack-config-single-spa|systemjs/.test(Object.keys(p.deps).join(' '))) {
    notes.push('O build atual (SystemJS, vite-plugin-single-spa ou webpack-config-single-spa) continua para os hosts single-spa. Remova-o quando nenhum host usar mais o app.')
  }
  return { from: 'single-spa', changes, notes }
}

// ---------------------------------------------------------------------------
// Module Federation
// ---------------------------------------------------------------------------

function moduleFederation(p: Project): MigratePlan {
  const changes: FileChange[] = []
  const notes: string[] = []
  const found = configs(p.cwd)
    .map((c) => {
      const m = MF_CALL.exec(c.text)
      return m ? { ...c, call: balanced(c.text, m.index + m[0].length - 1) ?? '' } : null
    })
    .filter((c): c is NonNullable<typeof c> => !!c)
  for (const c of found) {
    const remotes = objectOf(c.call, 'remotes')
    const list = remotes ? pairs(remotes) : []
    if (list.length) {
      const sugestoes = list.map(([n, v]) => {
        const url = v.includes('@') ? v.slice(v.indexOf('@') + 1) : v
        return `    ${n}: federationRemote('${url.replace(/[^/]*$/, 'mf-manifest.json')}'),`
      })
      notes.push(
        `${c.file} consome remotes (${list.map(([n]) => n).join(', ')}). Para usar no host vitral antes de eles migrarem:\n  configure({ remotes: {\n${sugestoes.join('\n')}\n  } })\n  com federationRemote de vitral/federation. Quando cada remote migrar, troque pela URL do vitral.json dele.`,
      )
    }
  }
  const remote = found.find((c) => /\bexposes\s*:/.test(c.call))
  if (!remote) {
    if (!found.some((c) => objectOf(c.call, 'remotes'))) notes.push('Nenhuma configuração do Module Federation com exposes encontrada.')
    return { from: 'module-federation', changes, notes }
  }
  const obj = objectOf(remote.call, 'exposes')
  const exposes = obj ? pairs(obj) : []
  if (!exposes.length) {
    notes.push(`${remote.file}: exposes não é um objeto literal com caminhos. Configure exposes do vitral à mão. Veja https://joaogabriel15.github.io/vitral/aprender/exposes`)
    return { from: 'module-federation', changes, notes }
  }
  const name = /\bname\s*:\s*(['"`])([^'"`]+)\1/.exec(remote.call)?.[2]
  const base = join(p.cwd, dirname(remote.file))
  const wrapDir = join(p.cwd, 'src', 'vitral')
  const fw = p.framework && p.framework !== 'angular' ? FRAMEWORKS[p.framework] : null
  const entries: [string, string][] = []
  let entry: string | undefined
  const modules: string[] = []
  for (const [k, f] of exposes) {
    const key = './' + k.replace(/^\.?\/?/, '')
    const file = resolveSource(base, f)
    const fileRel = rel(p.cwd, file).replace(/^\.\//, '')
    // Componente: nome com maiúscula ou arquivo de componente. O resto é módulo sem UI.
    const component = /\.(jsx|tsx|vue|svelte)$/.test(file) || /^[A-Z]/.test(basename(file).replace(/^index\./, basename(dirname(file))))
    if (!component || !fw) {
      entries.push([key, fileRel])
      modules.push(key)
      continue
    }
    const wrapper = join(wrapDir, `${key.slice(2).replace(/[^\w-]/g, '-')}.${p.ts ? 'ts' : 'js'}`)
    const wrapperRel = rel(p.cwd, wrapper).replace(/^\.\//, '')
    const imp = spec(wrapDir, file)
    const [from, fn] = fw.wrap
    const code = `import { ${fn} } from '${from}'\nimport Componente from '${imp}'\n\nexport * from '${imp}'\nexport default ${fn}(Componente)\n`
    if (existsSync(wrapper)) notes.push(`${wrapperRel} já existe e não foi alterado.`)
    else changes.push({ path: wrapperRel, before: null, after: code })
    entries.push([key, wrapperRel])
    entry ??= wrapperRel
  }
  if (!fw) notes.push(`Framework ${p.framework ?? 'não identificado'}: cada parte de exposes aponta para o arquivo original. Um componente precisa exportar default com mount (ex.: ${p.framework === 'angular' ? 'angularRemote(Componente)' : 'defineRemote({ mount })'}).`)
  if (modules.length && fw) notes.push(`Tratados como módulos sem UI (host usa loadModule): ${modules.join(', ')}. Se algum for componente, embrulhe com ${fw.wrap[1]} como em src/vitral/.`)
  entry ??= entries[0][1]
  const lines = entries.map(([k, f]) => `      '${k}': '${f}',`)
  const vitral = `vitral({\n    ${name ? `name: '${name}',\n    ` : ''}entry: '${entry}',\n    exposes: {\n${lines.join('\n')}\n    },\n  })`
  const vite = viteConfig(p, vitral, notes)
  if (vite) changes.push(vite)
  const script = buildScript(p)
  if (script) changes.push(script)
  if (objectOf(remote.call, 'shared') || /\bshared\s*:/.test(remote.call)) {
    notes.push('shared não migra: cada remote vitral leva as próprias dependências. Para usar as do host, veja a opção dedupe do plugin: https://joaogabriel15.github.io/vitral/aprender/dedupe')
  }
  notes.push(`${remote.file} continua gerando o remoteEntry.js para os hosts Module Federation. Remova o plugin quando nenhum host usar mais o remote.`)
  notes.push(`No host vitral: configure({ remotes: { ${name ?? 'nome'}: 'https://…/${OUT_DIR}/vitral.json' } }) e <Remote name="${name ?? 'nome'}${exposes[0][0].replace(/^\.?\//, '/')}" />.`)
  return { from: 'module-federation', changes, notes }
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

/** Diff de linhas, no formato unificado, com `context` linhas em volta de cada mudança. */
export function diff(path: string, before: string | null, after: string, context = 2): string {
  const a = before === null ? [] : before.replace(/\n$/, '').split('\n')
  const b = after.replace(/\n$/, '').split('\n')
  const head = before === null ? `--- /dev/null\n+++ ${path}` : `--- ${path}\n+++ ${path}`
  // LCS em tabela: os arquivos tocados são pequenos.
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const ops: [' ' | '-' | '+', string][] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) ops.push([' ', a[i++]]), j++
    else if (i < a.length && (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push(['-', a[i++]])
    else ops.push(['+', b[j++]])
  }
  const keep = ops.map((_, k) => ops.slice(Math.max(0, k - context), k + context + 1).some(([op]) => op !== ' '))
  const out: string[] = []
  ops.forEach(([op, line], k) => {
    // `@@` marca as linhas puladas antes de cada trecho.
    if (keep[k] && k > 0 && !keep[k - 1]) out.push('@@')
    if (keep[k]) out.push(op + line)
  })
  return `${head}\n${out.join('\n')}`
}

/** O que `vitral migrate` faria no projeto, sem escrever nada. */
export function plan(cwd: string, from?: MigrateSource): MigratePlan {
  const p = project(cwd)
  const source = from ?? detect(p)
  if (source === 'single-spa') return singleSpa(p)
  if (source === 'module-federation') return moduleFederation(p)
  return { from: null, changes: [], notes: ['Não achei single-spa nem Module Federation neste projeto. Use --from single-spa ou --from module-federation.'] }
}

/**
 * `npx vitral migrate`: converte um app do single-spa ou um remote do Module
 * Federation num remote vitral. Mostra um resumo e o diff de cada arquivo;
 * com `dryRun`, não escreve nada.
 */
export function migrate(options: MigrateOptions = {}): MigratePlan {
  const cwd = resolve(options.cwd ?? process.cwd())
  const log = options.log ?? console.log
  const result = plan(cwd, options.from)
  if (result.from) log(`[vitral] migrate: ${result.from === 'single-spa' ? 'single-spa' : 'Module Federation'} em ${cwd}`)
  for (const c of result.changes) log(`  ${c.before === null ? '+' : '~'} ${c.path}${c.before === null ? ' (novo)' : ''}`)
  for (const c of result.changes) log('\n' + diff(c.path, c.before, c.after))
  if (result.notes.length) log(`\nFaça à mão:\n${result.notes.map((n) => `  - ${n}`).join('\n')}`)
  if (options.dryRun) {
    log('\n[vitral] --dry-run: nada foi escrito.')
    return result
  }
  for (const c of result.changes) {
    const file = join(cwd, c.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, c.after)
  }
  if (result.changes.length) log(`\n[vitral] ${result.changes.length} arquivo(s) escrito(s). Rode \`npm run build:vitral\`.`)
  return result
}
