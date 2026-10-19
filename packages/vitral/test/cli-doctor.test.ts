import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cspAllows, doctor, doctorCli, exportsMount, format, matchesIntegrity, type DoctorReport } from '../src/cli/doctor'

// Servidor HTTP local com os arquivos de cada remote. Cada rota tem corpo e
// headers; o padrão é JS/JSON com `Access-Control-Allow-Origin: *`.
type Route = { body: string | Buffer; headers?: Record<string, string>; status?: number }
const routes: Record<string, Route> = {}
let server: Server
let base = ''
const url = (path: string) => `${base}${path}`

const sha = (body: string | Buffer, bits = 384) => `sha${bits}-` + createHash(`sha${bits}`).update(body).digest('base64')
const JS = { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' }
const JSON_H = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
const BOM = 'const m=(el,p)=>{el.textContent=p.msg;return{unmount(){el.replaceChildren()}}};export default{mount:m};'
const CSS = '[data-vitral-scope=bom] p{color:red}'

/** Publica um remote: `vitral.json` + JS (+ arquivos extras). */
function remote(name: string, manifest: Record<string, unknown>, js: string | Buffer = BOM, jsHeaders: Record<string, string> = JS) {
  routes[`/${name}/remote.js`] = { body: js, headers: jsHeaders }
  routes[`/${name}/vitral.json`] = { body: JSON.stringify({ name, entry: 'remote.js', integrity: sha(js), ...manifest }), headers: JSON_H }
}

// Fora do repositório: o React da lib não pode ser achado como se fosse do host.
const dir = mkdtempSync(join(tmpdir(), 'vitral-doctor-'))
/** Projeto host com React 19.1.0 instalado. */
const hostReact = join(dir, 'host-react')

beforeAll(async () => {
  server = createServer((req, res) => {
    const r = routes[req.url!.split('?')[0]]
    if (!r) return res.writeHead(404).end('não existe')
    res.writeHead(r.status ?? 200, r.headers ?? {}).end(r.body)
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  remote('bom', { version: '1.2.0', css: ['style.css'], files: { 'style.css': sha(CSS) }, contract: { version: '2.1.0' } })
  routes['/bom/style.css'] = { body: CSS, headers: { 'content-type': 'text/css' } }
  remote('sem-cors-manifesto', {})
  routes['/sem-cors-manifesto/vitral.json'].headers = { 'content-type': 'application/json' }
  remote('sem-cors-js', {}, BOM, { 'content-type': 'text/javascript' })
  remote('outra-origem-cors', {}, BOM, { ...JS, 'access-control-allow-origin': 'https://outro.exemplo.com' })
  routes['/html/vitral.json'] = { body: '<!doctype html><html><body>app</body></html>', headers: { 'content-type': 'text/html', 'access-control-allow-origin': '*' } }
  routes['/sem-entry/vitral.json'] = { body: JSON.stringify({ name: 'sem-entry' }), headers: JSON_H }
  remote('sem-mount', {}, 'export const total = 1;')
  remote('so-exposes', { exposes: ['./api'] }, 'export const exposes = {};')
  remote('hash-errado', { integrity: sha('outra coisa') })
  remote('tipo-errado', {}, BOM, { 'access-control-allow-origin': '*', 'content-type': 'text/html' })
  remote('sem-hash', { integrity: undefined })
  remote('contrato-3', { contract: { version: '3.0.0' } })
  remote('arquivo-faltando', { files: { 'split/chunk.js': sha('x') } })
  remote('grande', {}, `export default{mount(){}};/*${randomBytes(300 * 1024).toString('base64')}*/`)
  remote('react-proprio', {}, `${BOM}var r={__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE:{}};`)
  const dd = (range: string, version: string) => ({ dedupe: [{ name: 'react', range, version, file: 'split/react.js' }], contract: { peers: { react: range } } })
  remote('react-18', dd('^18.3.1', '18.3.1'), `${BOM}var r={__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:{}};`)
  remote('react-19', dd('^19.0.0', '19.1.0'))
  routes['/remotes.json'] = { body: JSON.stringify({ bom: '/bom/vitral.json', ruim: { url: '/hash-errado/vitral.json' } }), headers: JSON_H }
  routes['/host/'] = {
    body: `<!doctype html><meta http-equiv="Content-Security-Policy" content="style-src 'self'">`,
    headers: { 'content-type': 'text/html', 'content-security-policy': `script-src 'self'; connect-src 'self' ${'https://cdn.exemplo.com'}` },
  }

  mkdirSync(join(hostReact, 'node_modules/react'), { recursive: true })
  writeFileSync(join(hostReact, 'package.json'), JSON.stringify({ name: 'host' }))
  writeFileSync(join(hostReact, 'node_modules/react/package.json'), JSON.stringify({ name: 'react', version: '19.1.0' }))
})

afterAll(() => {
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

const ORIGIN = 'https://host.exemplo.com'
const run = (args: string[], extra: Parameters<typeof doctor>[0] = {}) => doctor({ cwd: dir, origin: ORIGIN, args, ...extra })
const checks = (r: DoctorReport, name?: string) => (name ? r.remotes.find((x) => x.name === name)!.checks : r.host)
const find = (r: DoctorReport, name: string | undefined, text: string) => checks(r, name).find((c) => c.title.includes(text))

describe('npx vitral doctor', () => {
  it('remote em ordem: tudo ✓ e código de saída 0', async () => {
    const r = await run([`bom=${url('/bom/vitral.json')}`], { contract: '^2' })
    expect(checks(r, 'bom').map((c) => [c.status, c.title])).toEqual([
      ['ok', 'CORS do manifesto: Access-Control-Allow-Origin *'],
      ['ok', 'manifesto válido: bom 1.2.0'],
      ['ok', 'CORS do JS: Access-Control-Allow-Origin *'],
      ['ok', 'exporta default com mount'],
      ['ok', 'integrity do manifesto confere'],
      ['ok', expect.stringMatching(/^tamanho do JS: .* kB \(.* kB com gzip\)$/)],
      ['ok', '1 arquivo(s) do manifesto conferem com o hash'],
      ['ok', 'contrato 2.1.0 na faixa ^2 do host'],
    ])
    expect(r).toMatchObject({ ok: true, errors: 0 })
    const logs: string[] = []
    expect(await doctorCli([`bom=${url('/bom/vitral.json')}`, '--origin', ORIGIN], { cwd: dir }, (m) => logs.push(m))).toBe(0)
    expect(logs[0]).toContain('  ✓ manifesto válido: bom 1.2.0')
    expect(logs[0]).toContain('Tudo certo.')
  })

  it('CORS: sem o header no manifesto ou no JS é erro, com causa e o que fazer', async () => {
    const r = await run([`a=${url('/sem-cors-manifesto/vitral.json')}`, `b=${url('/sem-cors-js/vitral.json')}`, `c=${url('/outra-origem-cors/vitral.json')}`])
    expect(find(r, 'a', 'CORS do manifesto')).toMatchObject({ status: 'error', title: 'CORS do manifesto: a resposta não tem Access-Control-Allow-Origin' })
    expect(find(r, 'a', 'CORS do manifesto')!.fix).toContain(`Access-Control-Allow-Origin: ${ORIGIN}`)
    expect(find(r, 'b', 'CORS do JS')).toMatchObject({ status: 'error' })
    expect(find(r, 'c', 'CORS do JS')).toMatchObject({ status: 'error', title: 'CORS do JS: Access-Control-Allow-Origin é https://outro.exemplo.com' })
    expect(find(r, 'c', 'CORS do JS')!.cause).toContain(`o host está em ${ORIGIN}`)
    // Remote na mesma origem do host não precisa de CORS.
    const mesma = await run([`a=${url('/sem-cors-manifesto/vitral.json')}`], { origin: base })
    expect(find(mesma, 'a', 'CORS')).toBeUndefined()
    // Sem origem do host, o header de outra origem vira aviso.
    const semOrigem = await doctor({ cwd: dir, args: [`c=${url('/outra-origem-cors/vitral.json')}`] })
    expect(find(semOrigem, 'c', 'CORS do JS')!.status).toBe('warn')
    expect(find(semOrigem, undefined, 'origem do host desconhecida')!.status).toBe('warn')
  })

  it('manifesto inválido: HTML no lugar do JSON, sem entry, 404 e servidor fora do ar', async () => {
    const livre = createServer().listen(0, '127.0.0.1')
    await new Promise((ok) => livre.once('listening', ok))
    const fora = `http://127.0.0.1:${(livre.address() as AddressInfo).port}/x/vitral.json`
    livre.close()
    const r = await run([`html=${url('/html/vitral.json')}`, `entry=${url('/sem-entry/vitral.json')}`, `nada=${url('/nada/vitral.json')}`, `fora=${fora}`])
    expect(find(r, 'html', 'manifesto inválido')).toMatchObject({ status: 'error', title: 'manifesto inválido: não é JSON' })
    expect(find(r, 'html', 'manifesto inválido')!.cause).toContain('devolveu HTML')
    expect(find(r, 'entry', 'manifesto inválido')).toMatchObject({ status: 'error', title: 'manifesto inválido: falta o campo entry' })
    expect(find(r, 'nada', 'manifesto:')).toMatchObject({ status: 'error', title: 'manifesto: HTTP 404' })
    expect(find(r, 'fora', 'manifesto:')).toMatchObject({ status: 'error', title: 'manifesto: não foi possível baixar (ECONNREFUSED)' })
    expect(r.errors).toBe(4)
  })

  it('JS: sem mount, Content-Type errado e só partes expostas', async () => {
    const r = await run([`a=${url('/sem-mount/vitral.json')}`, `b=${url('/tipo-errado/vitral.json')}`, `c=${url('/so-exposes/vitral.json')}`])
    expect(find(r, 'a', 'exporta')).toMatchObject({ status: 'error', title: 'o JS não exporta mount (nem default com mount)' })
    expect(find(r, 'a', 'exporta')!.fix).toContain('defineRemote')
    expect(find(r, 'b', 'servido como')).toMatchObject({ status: 'error', title: 'JS servido como text/html' })
    expect(find(r, 'c', 'exporta')!.status).toBe('warn')
  })

  it('integrity: do manifesto, a fixada no host e a dos arquivos', async () => {
    const r = await run([`a=${url('/hash-errado/vitral.json')}`, `b=${url('/sem-hash/vitral.json')}`, `c=${url('/arquivo-faltando/vitral.json')}`])
    expect(find(r, 'a', 'integrity')).toMatchObject({ status: 'error', title: 'integrity do manifesto não confere com o JS publicado' })
    expect(find(r, 'b', 'integrity')).toMatchObject({ status: 'warn', title: 'sem integrity: o JS roda sem conferência' })
    expect(find(r, 'c', 'arquivos do manifesto')).toMatchObject({ status: 'error', title: 'arquivos do manifesto com problema: split/chunk.js (HTTP 404)' })

    // Hash fixado no host (remotes.json com { url, integrity }) e velho.
    writeFileSync(join(dir, 'fixado.json'), JSON.stringify({ bom: { url: url('/bom/vitral.json'), integrity: sha('velho', 256) } }))
    const fixado = await run(['fixado.json'])
    expect(find(fixado, 'bom', 'integrity do host')).toMatchObject({ status: 'error', title: 'integrity do host (remotes.json) não confere com o JS publicado' })
    expect(find(fixado, 'bom', 'integrity do manifesto')!.status).toBe('ok')
  })

  it('contrato: fora da faixa do host é erro; a faixa pode vir do remotes.json', async () => {
    const r = await run([`a=${url('/contrato-3/vitral.json')}`, `b=${url('/sem-hash/vitral.json')}`], { contract: '^2' })
    expect(find(r, 'a', 'contrato incompatível')).toMatchObject({ status: 'error', title: 'contrato incompatível: o host aceita ^2, o remote publica 3.0.0' })
    expect(find(r, 'a', 'contrato incompatível')!.cause).toContain('CONTRACT_MISMATCH')
    expect(find(r, 'b', 'aceita contrato')!.status).toBe('warn')
    writeFileSync(join(dir, 'contrato.json'), JSON.stringify({ a: { url: url('/contrato-3/vitral.json'), contract: '^3' } }))
    expect(find(await run(['contrato.json'], { contract: '^2' }), 'a', 'na faixa')!.status).toBe('ok')
    // Sem faixa no host, só informa.
    expect(find(await run([`a=${url('/contrato-3/vitral.json')}`]), 'a', 'contrato 3.0.0')!.title).toContain('passe --contract')
  })

  it('tamanho: aviso acima de 250 kB com gzip; erro acima de --max-kb', async () => {
    expect(find(await run([`g=${url('/grande/vitral.json')}`]), 'g', 'tamanho')!.status).toBe('warn')
    expect(find(await run([`g=${url('/grande/vitral.json')}`], { maxKb: 1000 }), 'g', 'tamanho')!.status).toBe('ok')
    expect(find(await run([`b=${url('/bom/vitral.json')}`], { maxKb: 0.01 }), 'b', 'tamanho')!.status).toBe('error')
  })

  it('React duplicado e versões divergentes de dedupe', async () => {
    const r = await run([`a=${url('/react-proprio/vitral.json')}`, `b=${url('/react-18/vitral.json')}`, `c=${url('/react-19/vitral.json')}`], { cwd: hostReact })
    expect(find(r, 'a', 'leva o próprio')).toMatchObject({ status: 'warn', title: 'o remote leva o próprio react e o host também tem react 19.1.0' })
    expect(find(r, 'a', 'leva o próprio')!.fix).toContain("dedupe: ['react']")
    // Com dedupe a cópia do arquivo único é esperada: não acusa.
    expect(find(r, 'b', 'leva o próprio')).toBeUndefined()
    expect(find(r, 'b', 'react:')).toMatchObject({ status: 'warn', title: 'react: o remote espera ^18.3.1, o host tem 19.1.0' })
    expect(find(r, 'c', 'react 19.1.0 do host serve')!.status).toBe('ok')
    expect(find(r, undefined, 'versões divergentes')).toMatchObject({ status: 'warn', title: 'react em versões divergentes: b ^18.3.1, c ^19.0.0' })
    // Sem React no host, nada de duplicado.
    expect(find(await run([`a=${url('/react-proprio/vitral.json')}`]), 'a', 'leva o próprio')).toBeUndefined()
  })

  it('CSP do host: header e <meta> da página', async () => {
    const r = await doctor({ cwd: dir, host: url('/host/'), args: [`bom=${url('/bom/vitral.json')}`] })
    expect(find(r, undefined, 'CSP encontrada')!.title).toContain(`header de ${url('/host/')}`)
    // Mesma origem: 'self' libera o manifesto e o JS; o <meta> só tem style-src.
    expect(find(r, 'bom', 'CSP (header')).toMatchObject({ status: 'ok' })
    expect(find(r, 'bom', 'sem blob:')).toMatchObject({ status: 'warn' })

    // Remote em outra origem que o host: script-src 'self' bloqueia.
    routes['/host2/'] = { body: '<!doctype html>', headers: { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'" } }
    const hostOutro = `http://localhost:${new URL(base).port}/host2/`
    const r2 = await doctor({ cwd: dir, host: hostOutro, args: [`bom=${url('/bom/vitral.json')}`] })
    const csp = find(r2, 'bom', 'CSP')!
    expect(csp).toMatchObject({ status: 'error', title: `CSP (header de ${hostOutro}) bloqueia o remote` })
    expect(csp.cause).toContain('default-src não inclui http://127.0.0.1')
    expect(csp.fix).toContain('script-src e connect-src')

    // index.html do projeto, sem --host.
    writeFileSync(join(dir, 'index.html'), `<meta http-equiv="Content-Security-Policy" content="script-src https://cdn.exemplo.com blob:; connect-src *">`)
    const r3 = await run([`bom=${url('/bom/vitral.json')}`])
    expect(find(r3, 'bom', 'CSP')).toMatchObject({ status: 'error' })
    expect(find(r3, 'bom', 'CSP')!.cause).toContain('script-src não inclui')
    rmSync(join(dir, 'index.html'))
  })

  it('lê o remotes.json por URL, com URLs relativas a ele, e um vitral.json direto', async () => {
    const r = await run([url('/remotes.json')])
    expect(r.remotes.map((x) => [x.name, x.url])).toEqual([
      ['bom', url('/bom/vitral.json')],
      ['ruim', url('/hash-errado/vitral.json')],
    ])
    expect(r.ok).toBe(false)
    const um = await run([url('/bom/vitral.json')])
    expect(um.remotes.map((x) => x.name)).toEqual(['bom'])
    // remotes.json local: URL relativa vale a partir da página do host.
    writeFileSync(join(dir, 'relativo.json'), JSON.stringify({ bom: '/bom/vitral.json' }))
    const local = await doctor({ cwd: dir, host: url('/host/'), args: ['relativo.json'] })
    expect(local.remotes[0].url).toBe(url('/bom/vitral.json'))
  })

  it('--json e código de saída 1 com erro (para o CI)', async () => {
    const logs: string[] = []
    const code = await doctorCli([`a=${url('/sem-mount/vitral.json')}`, '--json', '--origin', ORIGIN, '--max-kb', '100'], { cwd: dir }, (m) => logs.push(m))
    expect(code).toBe(1)
    const r = JSON.parse(logs[0]) as DoctorReport
    expect(r).toMatchObject({ ok: false, errors: 1 })
    expect(r.remotes[0].checks.find((c) => c.status === 'error')!.title).toContain('mount')
    expect(format(r)).toContain('  ✗ o JS não exporta mount (nem default com mount)\n      Causa: o host recusa o módulo (INVALID_MODULE).\n      O que fazer: ')
    expect(format(r)).toMatch(/1 erro\(s\), \d+ aviso\(s\)\.$/)
  })

  describe('funções puras', () => {
    it('exportsMount', () => {
      expect(exportsMount('export function mount(el){}')).toBe('mount')
      expect(exportsMount('const a=1;export{a as mount};')).toBe('mount')
      expect(exportsMount('var x={mount(){}};export{x as default};')).toBe('default')
      expect(exportsMount('export default {}')).toBe('missing')
      expect(exportsMount('export const montar = 1')).toBe('missing')
    })

    it('matchesIntegrity: o algoritmo mais forte decide', () => {
      const b = Buffer.from('abc')
      expect(matchesIntegrity(b, sha(b))).toBe(true)
      expect(matchesIntegrity(b, `${sha(b, 256)} ${sha('x', 512)}`)).toBe(false)
      expect(matchesIntegrity(b, `md5-xxx`)).toBeUndefined()
    })

    it('cspAllows', () => {
      const js = 'https://cdn.empresa.com/carrinho/remote.js'
      expect(cspAllows(['https://cdn.empresa.com'], js)).toBe(true)
      expect(cspAllows(['*.empresa.com'], js)).toBe(true)
      expect(cspAllows(['https://cdn.empresa.com/carrinho/'], js)).toBe(true)
      expect(cspAllows(['https://cdn.empresa.com/perfil/'], js)).toBe(false)
      expect(cspAllows(['https:'], js)).toBe(true)
      expect(cspAllows(['*'], js)).toBe(true)
      expect(cspAllows(["'self'"], js, 'https://cdn.empresa.com')).toBe(true)
      expect(cspAllows(["'self'", 'blob:'], js, 'https://app.empresa.com')).toBe(false)
      expect(cspAllows(['https://cdn.empresa.com:8443'], js)).toBe(false)
    })
  })
})
