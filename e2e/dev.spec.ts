// Modo dev: o remote roda em `vite dev`, o host carrega o `vitral.json` de dev
// e uma edição no remote aparece no host sem recarregar a página.
import { cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttp, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))

// framework → [arquivo editado, título, porta do dev server, o estado sobrevive à edição?]
const REMOTES: Record<string, [string, string, number, boolean]> = {
  react: ['src/remote.jsx', 'React', 5391, true],
  vue: ['src/Cartao.vue', 'Vue', 5392, true],
  // O HMR do Svelte 5 troca o componente sem manter o $state local.
  svelte: ['src/Cartao.svelte', 'Svelte', 5393, false],
  solid: ['src/remote.jsx', 'Solid', 5394, false],
  preact: ['src/remote.jsx', 'Preact', 5395, false],
  lit: ['src/remote.js', 'Lit', 5396, false],
  vanilla: ['src/remote.ts', 'Vanilla TS', 5397, false],
  angular: ['src/remote.ts', 'Angular', 5398, false],
}

// Host sem build: a página com `vitral/auto`, servida de verdade (o Chromium
// bloqueia uma página interceptada que acessa localhost).
let host: Server
let hostPort = 0
test.beforeAll(async () => {
  host = createHttp((req, res) => {
    const url = new URL(req.url!, 'http://x')
    if (url.pathname.startsWith('/vitral/')) {
      res.writeHead(200, { 'content-type': 'text/javascript' })
      return res.end(readFileSync(join(root, 'packages/vitral/dist', url.pathname.slice(8))))
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><script type="module" src="/vitral/auto.js"></script>
<vitral-remote src="${url.searchParams.get('src')}" props='{"mensagem":"olá"}'></vitral-remote>`)
  })
  // Porta livre qualquer: cada worker do Playwright sobe o próprio host.
  await new Promise<void>((r) => host.listen(0, r))
  hostPort = (host.address() as { port: number }).port
})
test.afterAll(() => host?.close())

for (const [fw, [file, title, port, keepsState]] of Object.entries(REMOTES)) {
  test(`${fw}: editar o remote atualiza o host sem recarregar`, async ({ page }) => {
    test.setTimeout(90_000)
    // Cópia do exemplo dentro da pasta dele, para resolver as dependências.
    const example = join(root, 'examples/remotes', fw)
    const dir = mkdtempSync(join(example, '.vitral-dev-'))
    for (const f of ['src', 'package.json', 'vite.config.js', 'tsconfig.json']) {
      if (existsSync(join(example, f))) cpSync(join(example, f), join(dir, f), { recursive: true })
    }
    const { createServer } = await import(createRequire(join(example, 'package.json')).resolve('vite'))
    const server = await createServer({ root: dir, configFile: join(dir, 'vite.config.js'), logLevel: 'error', server: { port, strictPort: true } })
    try {
      await server.listen()
      const erros: string[] = []
      page.on('pageerror', (e) => erros.push(e.message))
      await page.goto(`http://localhost:${hostPort}/?src=http://localhost:${port}/vitral.json`)
      const fwText = page.locator('vitral-remote .fw')
      await expect(fwText).toHaveText(title, { timeout: 30_000 })
      await expect(page.locator('vitral-remote .msg')).toHaveText('olá')
      await page.locator('vitral-remote .ping').click()
      await expect(page.locator('vitral-remote .cliques')).toHaveText('1')
      await page.evaluate(() => ((window as any).__semReload = true))

      const path = join(dir, file)
      // Grava e renomeia: com writeFileSync o Vite às vezes lê o arquivo vazio.
      writeFileSync(`${path}.tmp`, readFileSync(path, 'utf8').replace(`>${title}<`, `>${title} editado<`))
      renameSync(`${path}.tmp`, path)
      await expect(fwText).toHaveText(`${title} editado`, { timeout: 20_000 })

      expect(await page.evaluate(() => (window as any).__semReload)).toBe(true)
      await expect(page.locator('vitral-remote .msg')).toHaveText('olá')
      if (keepsState) await expect(page.locator('vitral-remote .cliques')).toHaveText('1')
      expect(erros).toEqual([])
    } finally {
      await server.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
