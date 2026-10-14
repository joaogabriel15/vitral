// Gera um host ou um remote a partir de templates/. Sem dependências.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATES = fileURLToPath(new URL('../templates', import.meta.url))
// vitral e create-vitral saem com a mesma versão ("fixed" no .changeset/config.json).
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export const HOSTS = ['react', 'next', 'vue', 'nuxt', 'angular', 'sveltekit', 'solid', 'preact', 'lit', 'vanilla']
export const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
/** Frameworks de app inteiro viram o remote do framework de componentes. */
export const REMOTE_OF = { next: 'react', nuxt: 'vue', sveltekit: 'svelte' }
export const DEFAULT_SRC = 'http://localhost:5174/vitral.json'

const ANGULAR = ['@angular/core', '@angular/common', '@angular/compiler', '@angular/platform-browser'].map((d) => [d, '^22.0.0'])
const ANGULAR_DEV = { '@analogjs/vite-plugin-angular': '^2.8.0', '@angular/build': '^22.0.0', '@angular/compiler-cli': '^22.0.0', typescript: '~6.0.0' }
const ANGULAR_TS = "angular({ tsconfig: new URL('./tsconfig.json', import.meta.url).pathname })"

// framework → [dependências, devDependencies, import do plugin do Vite, chamada]
const VITE = {
  react: [{ react: '^19.0.0', 'react-dom': '^19.0.0' }, { '@vitejs/plugin-react': '^6.0.0' }, "import react from '@vitejs/plugin-react'", 'react()'],
  vue: [{ vue: '^3.5.0' }, { '@vitejs/plugin-vue': '^6.0.0' }, "import vue from '@vitejs/plugin-vue'", 'vue()'],
  svelte: [{ svelte: '^5.0.0' }, { '@sveltejs/vite-plugin-svelte': '^7.0.0' }, "import { svelte } from '@sveltejs/vite-plugin-svelte'", 'svelte()'],
  sveltekit: [{ svelte: '^5.0.0' }, { '@sveltejs/kit': '^3.0.0', '@sveltejs/vite-plugin-svelte': '^7.0.0' }, "import { sveltekit } from '@sveltejs/kit/vite'", 'sveltekit()'],
  solid: [{ 'solid-js': '^1.9.0' }, { 'vite-plugin-solid': '^2.11.0' }, "import solid from 'vite-plugin-solid'", 'solid()'],
  preact: [{ preact: '^10.0.0' }, { '@preact/preset-vite': '^2.10.0' }, "import preact from '@preact/preset-vite'", 'preact()'],
  angular: [{ ...Object.fromEntries(ANGULAR), rxjs: '^7.8.0', tslib: '^2.8.0' }, ANGULAR_DEV, "import angular from '@analogjs/vite-plugin-angular'", ANGULAR_TS],
  lit: [{ lit: '^3.3.0' }, {}, '', ''],
  vanilla: [{}, {}, '', ''],
}

// Hosts fora do Vite: [dependências, devDependencies, script dev, porta]
const APPS = {
  next: [{ next: '^16.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' }, {}, 'next dev', 3000],
  nuxt: [{ nuxt: '^4.0.0', vue: '^3.5.0' }, {}, 'nuxt dev', 3000],
}

/**
 * @param {{ dir: string, kind: 'host' | 'remote', framework: string, src?: string }} o
 * @returns {string[]} arquivos criados, relativos a `dir`
 */
export function create({ dir, kind, framework, src = DEFAULT_SRC }) {
  if (kind === 'remote') framework = REMOTE_OF[framework] ?? framework
  const list = kind === 'host' ? HOSTS : REMOTES
  if (!list.includes(framework)) throw new Error(`Template desconhecido: ${kind} ${framework}. Opções: ${list.join(', ')}.`)
  if (existsSync(dir) && readdirSync(dir).length) throw new Error(`A pasta ${dir} não está vazia.`)
  const name = basename(resolve(dir)).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const app = APPS[framework]
  const port = kind === 'remote' ? 5174 : (app?.[3] ?? 5173)
  const vars = { __NAME__: name, __SRC__: src, __PORT__: String(port) }

  mkdirSync(dir, { recursive: true })
  copy(join(TEMPLATES, kind, framework), dir)
  // index.html e e2e comuns. Next, Nuxt e SvelteKit têm a própria página.
  const ownHtml = app || framework === 'sveltekit'
  copy(join(TEMPLATES, kind, '_base'), dir, (f) => !ownHtml || !f.endsWith('.html'))
  copy(join(TEMPLATES, '_comum'), dir)
  renameSync(join(dir, '_gitignore'), join(dir, '.gitignore'))

  const [deps, dev, imp, call] = app ? [app[0], app[1]] : VITE[framework]
  const pkg = {
    name,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: { dev: app ? app[2] : 'vite', build: app ? app[2].replace('dev', 'build') : 'vite build', 'test:e2e': 'playwright test' },
    dependencies: { vitral: `^${version}`, ...deps },
    devDependencies: { ...dev, ...(app ? {} : { vite: '^8.0.0' }), '@playwright/test': '^1.56.0' },
  }
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
  if (!app) writeFileSync(join(dir, 'vite.config.js'), viteConfig(kind, framework, imp, call))

  const files = walk(dir).map((f) => relative(dir, f).split(sep).join('/'))
  const main = files.find((f) => /^src\/main\./.test(f))
  for (const f of files) {
    const path = join(dir, f)
    const text = readFileSync(path, 'utf8')
    const out = text.replace(/__[A-Z]+__/g, (k) => (k === '__MAIN__' ? `/${main}` : (vars[k] ?? k)))
    if (out !== text) writeFileSync(path, out)
  }
  return files.sort()
}

function viteConfig(kind, framework, imp, call) {
  const remote = kind === 'remote'
  const imports = ["import { defineConfig } from 'vite'", imp, remote && "import vitral from 'vitral/vite'"].filter(Boolean)
  const plugins = `  plugins: [${[call, remote && 'vitral()'].filter(Boolean).join(', ')}],`
  const body = remote
    ? `  // O remote é servido de qualquer pasta da CDN; em dev, na porta 5174.\n  base: './',\n${plugins}\n  server: { port: 5174 },`
    : framework === 'vanilla' || framework === 'lit'
      ? // `vitral/element` é importado dinamicamente: sem isto o Vite só o descobre
        // depois de abrir a página e a recarrega no meio do carregamento.
        `${plugins}\n  optimizeDeps: { include: ['vitral/auto', 'vitral/element'] },`
      : plugins
  return `${imports.join('\n')}\n\nexport default defineConfig({\n${body}\n})\n`
}

function copy(from, to, filter = () => true) {
  if (existsSync(from)) cpSync(from, to, { recursive: true, filter: (f) => filter(f) })
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
}
