// Apps da bateria de pacote real: cada um sai da CLI oficial e recebe só o
// mínimo para usar o vitral, como alguém faria seguindo o README.
//
// criar: comando da CLI (roda na pasta de trabalho, com o nome do app no fim).
// preparar(dir): arquivos que a pessoa escreveria. iniciar: servidor de produção.
// Se a CLI falhar (rede, Node antigo), o app sai de modelos/<nome>, cópia
// versionada do que a CLI gera, e o relatório diz isso.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PORTA_REMOTES = 4600
export const REMOTES_URL = `http://localhost:${PORTA_REMOTES}`

const viteCreate = (template) => `npm create -y vite@latest {nome} -- --template ${template} --no-interactive`

/** Põe o plugin do vitral no vite.config.ts gerado pela CLI (ou cria um). */
function pluginVitral(dir, nome, entry) {
  const file = join(dir, 'vite.config.ts')
  const plugin = `vitral({ entry: '${entry}', name: '${nome}' })`
  let config = existsSync(file) ? readFileSync(file, 'utf8') : "import { defineConfig } from 'vite'\n\nexport default defineConfig({\n  plugins: [],\n})\n"
  config = `import vitral from 'vitral/vite'\n${config}`.replace('plugins: [', `base: './',\n  plugins: [${plugin}, `)
  writeFileSync(file, config)
}

const remote = (nome, template, entry, codigo) => ({
  nome,
  tipo: 'remote',
  criar: viteCreate(template),
  preparar(dir) {
    writeFileSync(join(dir, entry), codigo())
    pluginVitral(dir, nome, entry)
  },
  build: 'npm run build',
})

/** Remotes: o app de cada template do create-vite vira um remote. */
export const REMOTES = [
  remote('react', 'react-ts', 'src/vitral-remote.tsx', () =>
    `import App from './App'\nimport { reactRemote } from 'vitral/react'\nimport './index.css'\n\nexport default reactRemote(App)\n`),
  remote('vue', 'vue-ts', 'src/vitral-remote.ts', () =>
    `import App from './App.vue'\nimport { vueRemote } from 'vitral/vue'\nimport './style.css'\n\nexport default vueRemote(App)\n`),
  remote('svelte', 'svelte-ts', 'src/vitral-remote.ts', () =>
    `import App from './App.svelte'\nimport { svelteRemote } from 'vitral/svelte'\nimport './app.css'\n\nexport default svelteRemote(App)\n`),
  remote('solid', 'solid-ts', 'src/vitral-remote.tsx', () =>
    `import App from './App'\nimport { solidRemote } from 'vitral/solid'\nimport './index.css'\n\nexport default solidRemote(App)\n`),
  remote('preact', 'preact-ts', 'src/vitral-remote.tsx', () =>
    `import { App } from './app'\nimport { preactRemote } from 'vitral/preact'\nimport './index.css'\n\nexport default preactRemote(App)\n`),
  remote('lit', 'lit-ts', 'src/vitral-remote.ts', () =>
    `import './my-element'\nimport { elementRemote } from 'vitral/element'\nimport './index.css'\n\nexport default elementRemote('my-element')\n`),
  remote('vanilla', 'vanilla-ts', 'src/vitral-remote.ts', () =>
    `import { defineRemote } from 'vitral'\nimport { setupCounter } from './counter'\nimport './style.css'\n\n` +
    `export default defineRemote({\n  mount(el) {\n    el.innerHTML = '<h1>Vanilla</h1><button id="counter" type="button" class="counter"></button>'\n` +
    `    setupCounter(el.querySelector<HTMLButtonElement>('.counter')!)\n    return { unmount: () => (el.innerHTML = '') }\n  },\n})\n`),
]

const nomes = () => REMOTES.map((r) => r.nome)
const remotesJson = () => JSON.stringify(Object.fromEntries(nomes().map((n) => [n, `${REMOTES_URL}/${n}/vitral.json`])), null, 2)

/** Lista de remotes em JSX (React, Next, React Router). */
const jsxRemotes = () =>
  `REMOTES.map((n) => (\n        <section key={n} data-remote={n}>\n          <Remote name={n} fallback={<p>carregando {n}</p>} />\n        </section>\n      ))`

/** Hosts: o app de cada CLI mostra os 7 remotes. */
export const HOSTS = [
  {
    nome: 'vite-react',
    cli: 'create-vite',
    criar: viteCreate('react-ts'),
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(
        join(dir, 'src/App.tsx'),
        `import { configure } from 'vitral'\nimport { Remote } from 'vitral/react'\n\nconst REMOTES = ${JSON.stringify(nomes())}\nconfigure({ remotes: '/remotes.json' })\n\n` +
          `export default function App() {\n  return (\n    <>\n      {${jsxRemotes()}}\n    </>\n  )\n}\n`,
      )
    },
    build: 'npm run build',
    iniciar: (porta) => `npx vite preview --port ${porta} --strictPort`,
  },
  {
    nome: 'next',
    cli: 'create-next-app',
    criar: 'npx -y create-next-app@latest {nome} --ts --app --no-eslint --no-tailwind --no-src-dir --no-turbopack --import-alias @/* --use-npm --skip-install --disable-git --yes',
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(
        join(dir, 'app/remotes.tsx'),
        `'use client'\nimport { configure } from 'vitral'\nimport { Remote } from 'vitral/react'\n\nconst REMOTES = ${JSON.stringify(nomes())}\nif (typeof window !== 'undefined') configure({ remotes: '/remotes.json' })\n\n` +
          `export function Remotes() {\n  return (\n    <>\n      {${jsxRemotes()}}\n    </>\n  )\n}\n`,
      )
      writeFileSync(join(dir, 'app/page.tsx'), `import { Remotes } from './remotes'\n\nexport default function Home() {\n  return <main><Remotes /></main>\n}\n`)
    },
    build: 'npm run build',
    iniciar: (porta) => `npx next start -p ${porta}`,
  },
  {
    nome: 'nuxt',
    cli: 'nuxi init',
    criar: 'npx -y nuxi@latest init {nome} --template minimal --packageManager npm --no-install --gitInit=false --no-modules --force',
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(join(dir, 'app/app.vue'),
        `<script setup lang="ts">\nimport { configure } from 'vitral'\nimport { VitralRemote } from 'vitral/vue'\n\nconst REMOTES = ${JSON.stringify(nomes())}\nif (import.meta.client) configure({ remotes: '/remotes.json' })\n</script>\n\n` +
        `<template>\n  <main>\n    <section v-for="n in REMOTES" :key="n" :data-remote="n">\n      <VitralRemote :name="n">\n        <template #fallback><p>carregando {{ n }}</p></template>\n      </VitralRemote>\n    </section>\n  </main>\n</template>\n`)
    },
    build: 'npm run build',
    iniciar: (porta) => `PORT=${porta} node .output/server/index.mjs`,
  },
  {
    nome: 'angular',
    cli: 'ng new',
    criar: 'npx -y @angular/cli@latest new {nome} --defaults --skip-git --skip-install --ssr=false',
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(join(dir, 'src/app/app.html'),
        `@for (n of remotes; track n) {\n  <section [attr.data-remote]="n">\n    <vitral-remote [attr.name]="n"><p slot="fallback">carregando {{ n }}</p></vitral-remote>\n  </section>\n}\n`)
      const app = readFileSync(join(dir, 'src/app/app.ts'), 'utf8')
        .replace("import { Component", "import { CUSTOM_ELEMENTS_SCHEMA, Component")
        .replace('@Component({', '@Component({\n  schemas: [CUSTOM_ELEMENTS_SCHEMA],')
        .replace(/export class App \{/, `export class App {\n  protected readonly remotes = ${JSON.stringify(nomes())}`)
      writeFileSync(join(dir, 'src/app/app.ts'), app)
      const config = readFileSync(join(dir, 'src/app/app.config.ts'), 'utf8')
        .replace(/^/, "import { provideVitral } from 'vitral/angular'\n")
        .replace('providers: [', "providers: [provideVitral({ remotes: '/remotes.json' }), ")
      writeFileSync(join(dir, 'src/app/app.config.ts'), config)
    },
    build: 'npm run build',
    estatico: 'dist/{nome}/browser',
  },
  {
    nome: 'sveltekit',
    cli: 'sv create',
    criar: 'npx -y sv@latest create {nome} --template minimal --types ts --no-add-ons --no-install',
    preparar(dir) {
      writeFileSync(join(dir, 'static/remotes.json'), remotesJson())
      writeFileSync(join(dir, 'src/routes/+page.svelte'),
        `<script lang="ts">\n  import { browser } from '$app/environment'\n  import { configure } from 'vitral'\n  import { remote } from 'vitral/svelte'\n\n` +
        `  const REMOTES = ${JSON.stringify(nomes())}\n  if (browser) configure({ remotes: '/remotes.json' })\n</script>\n\n` +
        `{#each REMOTES as n (n)}\n  <section data-remote={n}><div use:remote={{ name: n }}></div></section>\n{/each}\n`)
    },
    build: 'npm run build',
    iniciar: (porta) => `npx vite preview --port ${porta} --strictPort`,
  },
  {
    nome: 'astro',
    cli: 'create-astro',
    criar: 'npm create -y astro@latest {nome} -- --template minimal --no-install --no-git --yes',
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(join(dir, 'src/pages/index.astro'),
        `---\nconst REMOTES = ${JSON.stringify(nomes())}\n---\n\n<html lang="pt-BR">\n  <head><meta charset="utf-8" /><title>Astro</title></head>\n  <body>\n` +
        `    {REMOTES.map((n) => (\n      <section data-remote={n}><vitral-remote name={n}><p slot="fallback">carregando {n}</p></vitral-remote></section>\n    ))}\n` +
        `    <script>\n      import { configure } from 'vitral'\n      import { defineVitralElement } from 'vitral/element'\n\n      configure({ remotes: '/remotes.json' })\n      defineVitralElement()\n    </script>\n  </body>\n</html>\n`)
    },
    build: 'npm run build',
    iniciar: (porta) => `npx astro preview --port ${porta}`,
  },
  {
    nome: 'react-router',
    cli: 'create-react-router',
    criar: 'npx -y create-react-router@latest {nome} --yes --no-install --no-git-init',
    preparar(dir) {
      writeFileSync(join(dir, 'public/remotes.json'), remotesJson())
      writeFileSync(join(dir, 'app/routes/home.tsx'),
        `import { configure } from 'vitral'\nimport { Remote } from 'vitral/react'\n\nconst REMOTES = ${JSON.stringify(nomes())}\nif (typeof window !== 'undefined') configure({ remotes: '/remotes.json' })\n\n` +
        `export default function Home() {\n  return (\n    <main>\n      {${jsxRemotes()}}\n    </main>\n  )\n}\n`)
    },
    build: 'npm run build',
    iniciar: (porta) => `PORT=${porta} npm run start`,
  },
]
