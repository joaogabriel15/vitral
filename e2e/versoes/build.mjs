// Builda os remotes de versoes/remote com cada versão da lib (versoes/libs.mjs):
// o plugin Vite e a cópia da lib que entra no bundle são os daquela versão,
// como num remote real. Roda antes do e2e (globalSetup).
// Saída: versoes/dist/<versão>-<remote>/, servida pelo CDN de teste como v-<versão>-<remote>.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { VERSOES } from './libs.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
export const REMOTES = ['js', 'react']

export default async function buildAll() {
  // O build do Vite põe NODE_ENV=production no processo, e os workers do
  // Playwright herdam: o dev server do dev.spec perderia o HMR com estado.
  const env = process.env.NODE_ENV
  try {
    await buildEach()
  } finally {
    if (env === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = env
  }
}

async function buildEach() {
  for (const [versao, pkg] of Object.entries(VERSOES)) {
    const { default: vitral } = await import(`${pkg}/vite`)
    for (const remote of REMOTES) {
      await build({
        root: join(here, 'remote'),
        configFile: false,
        logLevel: 'error',
        resolve: { alias: [{ find: /^vitral(\/.*)?$/, replacement: `${pkg}$1` }] },
        build: { outDir: join(here, 'dist', `${versao}-${remote}`), emptyOutDir: true },
        plugins: [vitral({ entry: join(here, 'remote', `${remote}.js`), name: `v-${versao}-${remote}`, version: versao })],
      })
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await buildAll()
