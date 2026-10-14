// create-vitral de ponta a ponta: gera cada template, instala o vitral
// empacotado, sobe o remote e o host em modo dev, edita o remote e vê o host
// mudar sem recarregar. Precisa de rede (npm) e roda à parte: pnpm test:create.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'packages/create-vitral/index.js')
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NUXT_TELEMETRY_DISABLED: '1', BROWSER: 'none' }

// host → remote usado com ele. Cada template aparece pelo menos uma vez.
const PARES: [string, string][] = [
  ['react', 'react'],
  ['next', 'react'],
  ['vue', 'vue'],
  ['nuxt', 'vue'],
  ['angular', 'angular'],
  ['sveltekit', 'svelte'],
  ['solid', 'solid'],
  ['preact', 'preact'],
  ['lit', 'lit'],
  ['vanilla', 'vanilla'],
]

// O create.setup.ts empacota o vitral uma vez, numa pasta temporária.
const tarball = process.env.VITRAL_TGZ!
const tmp = dirname(tarball)

function freePort(): Promise<number> {
  return new Promise((ok) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number }
      s.close(() => ok(port))
    })
  })
}

/** Gera o projeto pelo bin da CLI e instala com o vitral do tarball. */
function scaffold(dir: string, args: string[]) {
  execFileSync(process.execPath, [cli, dir, ...args], { stdio: 'ignore' })
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  pkg.dependencies.vitral = `file:${tarball}`
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
  execFileSync('pnpm', ['install', '--prefer-offline', '--no-frozen-lockfile', '--ignore-workspace', '--reporter=silent'], { cwd: dir, env, stdio: 'pipe' })
}

/** `npm run dev` com a porta pedida; espera a URL responder. */
async function dev(dir: string, port: number, url: string, log: string[]): Promise<ChildProcess> {
  const proc = spawn('pnpm', ['run', 'dev', '--port', String(port)], { cwd: dir, env, detached: true })
  proc.stdout!.on('data', (d) => log.push(String(d)))
  proc.stderr!.on('data', (d) => log.push(String(d)))
  for (let i = 0; i < 240; i++) {
    if (proc.exitCode !== null) break
    const ok = await fetch(url).then((r) => r.ok, () => false)
    if (ok) return proc
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`dev não subiu em ${url}:\n${log.join('').slice(-3000)}`)
}

const stop = (p?: ChildProcess) => {
  try {
    if (p?.pid) process.kill(-p.pid, 'SIGTERM')
  } catch {}
}

test.describe.configure({ mode: 'parallel' })

for (const [host, remote] of PARES) {
  test(`host ${host} + remote ${remote}: editar o remote atualiza o host sem recarregar`, async ({ page }) => {
    test.setTimeout(300_000)
    const base = mkdtempSync(join(tmp, `${host}-`))
    const remoteDir = join(base, 'remote')
    const hostDir = join(base, 'host')
    const [rPort, hPort] = [await freePort(), await freePort()]
    const src = `http://localhost:${rPort}/vitral.json`
    const log: string[] = []
    let r: ChildProcess | undefined
    let h: ChildProcess | undefined
    try {
      scaffold(remoteDir, ['--remote', '-f', remote])
      scaffold(hostDir, ['--host', '-f', host, '--src', src])
      r = await dev(remoteDir, rPort, src, log)
      h = await dev(hostDir, hPort, `http://localhost:${hPort}/`, log)

      const erros: string[] = []
      page.on('pageerror', (e) => erros.push(e.message))
      // Página de desenvolvimento do próprio remote.
      await page.goto(`http://localhost:${rPort}/`)
      await expect(page.getByRole('heading', { name: 'Olá, dev' })).toBeVisible({ timeout: 60_000 })

      await page.goto(`http://localhost:${hPort}/`)
      const titulo = page.getByRole('heading', { level: 2 })
      await expect(titulo).toHaveText('Olá, host', { timeout: 60_000 })
      await page.getByRole('button', { name: /Cliques/ }).click()
      await expect(page.getByRole('button', { name: /Cliques/ })).toHaveText('Cliques: 1')
      await page.evaluate(() => ((window as any).__semReload = true))

      const app = join(remoteDir, 'src', readdirSync(join(remoteDir, 'src')).find((f) => f.startsWith('App.'))!)
      // Grava e renomeia, como muitos editores: com writeFileSync o Vite às vezes lê
      // o arquivo vazio (entre o truncate e a escrita) e não há segundo evento.
      writeFileSync(`${app}.tmp`, readFileSync(app, 'utf8').replace('Olá,', 'Oi,'))
      renameSync(`${app}.tmp`, app)
      await expect(titulo).toHaveText('Oi, host', { timeout: 30_000 })
      expect(await page.evaluate(() => (window as any).__semReload)).toBe(true)
      expect(erros).toEqual([])
    } catch (err) {
      throw new Error(`${(err as Error).message}\n--- log dos servidores ---\n${log.join('').slice(-4000)}`)
    } finally {
      stop(h)
      stop(r)
    }
  })
}
