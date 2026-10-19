import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'
import { create, DEFAULT_SRC, HOSTS, REMOTES } from '../src/create.js'
import { parseArgs, run } from '../src/cli.js'

const tmp = mkdtempSync(join(tmpdir(), 'create-vitral-'))
after(() => rmSync(tmp, { recursive: true, force: true }))
const read = (dir, f) => readFileSync(join(dir, f), 'utf8')
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

for (const fw of REMOTES) {
  test(`remote ${fw}: plugin vitral, App sem adaptador, página de dev e e2e`, () => {
    const dir = join(tmp, `remote-${fw}`)
    const files = create({ dir, kind: 'remote', framework: fw })
    assert.ok(files.some((f) => /^src\/App\.(jsx|vue|svelte|ts|js)$/.test(f)), files.join())
    for (const f of ['index.html', 'e2e/remote.spec.js', 'playwright.config.js', '.gitignore', 'vite.config.js']) assert.ok(files.includes(f), f)
    const pkg = JSON.parse(read(dir, 'package.json'))
    assert.equal(pkg.name, `remote-${fw}`)
    assert.equal(pkg.scripts.dev, 'vite')
    assert.equal(pkg.dependencies.vitral, `^${version}`)
    const config = read(dir, 'vite.config.js')
    assert.match(config, /import vitral from 'vitral\/vite'/)
    assert.match(config, /plugins: \[(.+, )?vitral\(\)\]/)
    assert.match(read(dir, 'playwright.config.js'), /localhost:5174/)
    assert.doesNotMatch(files.map((f) => read(dir, f)).join(), /__[A-Z]+__/)
  })
}

for (const fw of HOSTS) {
  test(`host ${fw}: carrega o remote por src, sem plugin do vitral`, () => {
    const dir = join(tmp, `host-${fw}`)
    const src = 'https://cdn.exemplo.com/carrinho/vitral.json'
    const files = create({ dir, kind: 'host', framework: fw, src })
    const all = files.map((f) => read(dir, f)).join('\n')
    assert.ok(all.includes(src))
    assert.doesNotMatch(all, /vitral\/vite|__[A-Z]+__/)
    assert.ok(files.includes('e2e/host.spec.js'))
    const pkg = JSON.parse(read(dir, 'package.json'))
    assert.ok(pkg.scripts.dev)
    if (files.includes('index.html')) {
      const main = read(dir, 'index.html').match(/src="\/(src\/main\.\w+)"/)?.[1]
      assert.ok(main && files.includes(main), 'index.html aponta para o main')
    }
  })
}

test('host vanilla e lit pré-otimizam vitral/auto e vitral/element', () => {
  for (const framework of ['vanilla', 'lit']) {
    const dir = join(tmp, `host-deps-${framework}`)
    create({ dir, kind: 'host', framework })
    assert.match(read(dir, 'vite.config.js'), /include: \['vitral\/auto', 'vitral\/element'\]/)
  }
})

test('next, nuxt e sveltekit como remote viram react, vue e svelte', () => {
  const dir = join(tmp, 'remote-next')
  create({ dir, kind: 'remote', framework: 'next' })
  assert.match(read(dir, 'vite.config.js'), /plugin-react/)
})

test('erros: template desconhecido e pasta com arquivos', () => {
  assert.throws(() => create({ dir: join(tmp, 'x'), kind: 'host', framework: 'ember' }), /Template desconhecido: host ember/)
  const dir = join(tmp, 'cheia')
  create({ dir, kind: 'remote', framework: 'react' })
  assert.throws(() => create({ dir, kind: 'remote', framework: 'react' }), /não está vazia/)
})

test('parseArgs e perguntas', async () => {
  assert.deepEqual(parseArgs(['app', '--host', '-f', 'vue', '--src', 'u']), { dir: 'app', kind: 'host', framework: 'vue', src: 'u' })
  assert.throws(() => parseArgs(['--xyz']), /Opção desconhecida/)
  const respostas = [join(tmp, 'perguntado'), 'r', '3']
  const logs = []
  const files = await run([], { ask: async () => respostas.shift(), log: (m) => logs.push(m) })
  assert.ok(files.includes('src/App.svelte'))
  assert.match(logs.join(), /npm run dev/)
  const host = []
  await run([join(tmp, 'h'), '--host', '-f', 'react'], { log: (m) => host.push(m) })
  assert.match(host.join(), new RegExp(`carrega ${DEFAULT_SRC}`))
  const ajuda = []
  await run(['--help'], { log: (m) => ajuda.push(m) })
  assert.match(ajuda[0], /^Uso: npm create vitral/)
})

test('o bin roda', async () => {
  const { execFileSync } = await import('node:child_process')
  const out = execFileSync(process.execPath, [fileURLToPath(new URL('../index.js', import.meta.url)), '--help'], { encoding: 'utf8' })
  assert.match(out, /--framework/)
})

test('angular acha o tsconfig em pasta com espaço e acento', async () => {
  for (const kind of ['host', 'remote']) {
    const dir = join(tmp, `pasta com espaço ${kind}`, 'ângular')
    create({ dir, kind, framework: 'angular' })
    const config = read(dir, 'vite.config.js')
    const expr = config.match(/tsconfig: (.+) \}\)/)[1]
    const probe = join(dir, 'probe.mjs')
    writeFileSync(probe, `import { fileURLToPath } from 'node:url'\nexport default ${expr}\n`)
    const { default: path } = await import(pathToFileURL(probe).href)
    assert.equal(path, join(dir, 'tsconfig.json'))
    assert.ok(existsSync(path), path)
  }
})
