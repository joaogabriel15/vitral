// create-vitral de ponta a ponta: gera cada template, instala o vitral
// empacotado, sobe o remote e o host em modo dev, edita o remote e vê o host
// mudar sem recarregar. Precisa de rede (npm) e roda à parte: pnpm test:create.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
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

/**
 * `npm run dev` numa porta livre; espera a URL responder. Os testes rodam em
 * paralelo e outro servidor pode pegar a porta entre a escolha e o bind: Vite,
 * Next e Nuxt então sobem em outra porta e avisam "in use". Nesse caso para e
 * tenta outra porta.
 */
async function dev(dir: string, path: string, log: string[]): Promise<{ proc: ChildProcess; port: number }> {
  for (let attempt = 0; ; attempt++) {
    const port = await freePort()
    const url = `http://localhost:${port}${path}`
    const own: string[] = []
    const proc = spawn('pnpm', ['run', 'dev', '--port', String(port)], { cwd: dir, env, detached: true })
    const add = (d: unknown) => (own.push(String(d)), log.push(String(d)))
    proc.stdout!.on('data', add)
    proc.stderr!.on('data', add)
    const taken = () => /in use/i.test(own.join(''))
    for (let i = 0; i < 240 && proc.exitCode === null && !taken(); i++) {
      const ok = await fetch(url).then((r) => r.ok, () => false)
      if (ok && !taken()) return { proc, port }
      await new Promise((r) => setTimeout(r, 500))
    }
    stop(proc)
    if (!taken() || attempt === 2) throw new Error(`dev não subiu em ${url}:\n${log.join('').slice(-3000)}`)
  }
}

/** Troca a URL do remote nos arquivos gerados do host (fora de node_modules). */
function pointHost(dir: string, from: string, to: string) {
  for (const f of readdirSync(dir)) {
    const path = join(dir, f)
    if (f === 'node_modules' || f.startsWith('.')) continue
    if (statSync(path).isDirectory()) pointHost(path, from, to)
    else {
      const text = readFileSync(path, 'utf8')
      if (text.includes(from)) writeFileSync(path, text.replaceAll(from, to))
    }
  }
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
    // A porta do remote só se sabe ao subir: o host é gerado com esta URL e apontado depois.
    const placeholder = 'http://localhost:1/vitral.json'
    const log: string[] = []
    let r: ChildProcess | undefined
    let h: ChildProcess | undefined
    try {
      scaffold(remoteDir, ['--remote', '-f', remote])
      scaffold(hostDir, ['--host', '-f', host, '--src', placeholder])
      const remoteDev = await dev(remoteDir, '/vitral.json', log)
      r = remoteDev.proc
      const rPort = remoteDev.port
      pointHost(hostDir, placeholder, `http://localhost:${rPort}/vitral.json`)
      const hostDev = await dev(hostDir, '/', log)
      h = hostDev.proc
      const hPort = hostDev.port

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
