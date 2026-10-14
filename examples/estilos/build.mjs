// Build do e2e de estilos: o mesmo remote com e sem as opções de CSS do
// plugin, e três hosts (Tailwind v4, CSS legado e Tailwind v3).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwind from '@tailwindcss/vite'
import postcss from 'postcss'
import tailwindV3 from 'tailwindcss-v3'
import { build } from 'vite'
import vitral from 'vitral/vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const dist = join(here, 'dist')

const remotes = {
  padrao: {},
  opcoes: { theme: 'host', layers: 'flatten', renameRegisteredProperties: true },
}
for (const [name, options] of Object.entries(remotes)) {
  await build({
    root: here,
    configFile: false,
    logLevel: 'warn',
    plugins: [tailwind(), vitral({ entry: 'remote/remote.js', name, ...options })],
    build: { outDir: join(dist, 'remote', name), emptyOutDir: true },
  })
}

const host = join(here, 'host')
await build({
  root: host,
  configFile: false,
  // O /v3.css só é gerado depois (abaixo); o Vite avisaria que ele não existe.
  logLevel: 'error',
  plugins: [tailwind()],
  build: {
    outDir: join(dist, 'host'),
    emptyOutDir: true,
    rollupOptions: { input: ['index', 'legado', 'v3'].map((p) => join(host, `${p}.html`)) },
  },
})

// Host com o Tailwind v3 de verdade (base, components e utilities).
const v3 = await postcss([tailwindV3({ content: [{ raw: readFileSync(join(host, 'v3.html'), 'utf8') }] })]).process(
  '@tailwind base; @tailwind components; @tailwind utilities;',
  { from: undefined },
)
writeFileSync(join(dist, 'host', 'v3.css'), v3.css)
