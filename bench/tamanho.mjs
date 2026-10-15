// Tamanho do código de host de cada ferramenta: só a API que um host usa,
// empacotada com esbuild (minificada) e comprimida com brotli nível 11.
//
//   pnpm build && node bench/tamanho.mjs
//
// Instala as versões fixadas abaixo numa pasta temporária (não mexe no
// lockfile), mede e grava bench/tamanho.json e docs/public/tamanho-host.svg.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cpus, platform, release, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants } from 'node:zlib'

const ESBUILD = '0.28.2'
const root = fileURLToPath(new URL('..', import.meta.url))
const vitralDist = join(root, 'packages/vitral/dist/index.js')

// [nome, pacote@versão, código de entrada com a API de host]
const ferramentas = [
  ['vitral', null, `export { configure, createSlot } from ${JSON.stringify(vitralDist)}`],
  ['single-spa', 'single-spa@6.0.3', `export { registerApplication, start } from 'single-spa'`],
  ['wujie', 'wujie@2.1.0', `export { startApp } from 'wujie'`],
  ['Module Federation (runtime)', '@module-federation/runtime@2.9.2', `export { init, loadRemote } from '@module-federation/runtime'`],
  ['micro-app', '@micro-zoe/micro-app@1.0.0-rc.32', `export { default } from '@micro-zoe/micro-app'`],
  ['qiankun', 'qiankun@2.10.16', `export { registerMicroApps, start } from 'qiankun'`],
  ['Garfish', 'garfish@1.19.12', `export { default } from 'garfish'`],
]

if (!existsSync(vitralDist)) {
  console.error('Rode `pnpm build` antes: falta packages/vitral/dist/index.js')
  process.exit(1)
}

const dir = mkdtempSync(join(tmpdir(), 'vitral-tamanho-'))
try {
  const pacotes = [`esbuild@${ESBUILD}`, ...ferramentas.map((f) => f[1]).filter(Boolean)]
  execFileSync('npm', ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', '--prefix', dir, ...pacotes], { stdio: 'inherit' })
  const { build } = await import(join(dir, 'node_modules/esbuild/lib/main.js'))

  const resultados = []
  for (const [nome, pacote, codigo] of ferramentas) {
    const out = await build({
      stdin: { contents: codigo, resolveDir: dir, loader: 'js' },
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      write: false,
      logLevel: 'silent',
      define: { 'process.env.NODE_ENV': '"production"' },
    })
    const bytes = out.outputFiles[0].contents
    const brotli = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length
    resultados.push({ nome, pacote: pacote ?? vitral(), entrada: codigo.replace(vitralDist, 'vitral'), minKB: kb(bytes.length), brotliKB: kb(brotli) })
    console.log(`${nome.padEnd(30)} ${kb(brotli).toFixed(1).padStart(6)} kB`)
  }

  const dados = {
    data: new Date().toISOString().slice(0, 10),
    metodo: `esbuild ${ESBUILD} (bundle, minify, esm, browser, es2020) e brotli nível 11`,
    maquina: { cpu: cpus()[0]?.model, nucleos: cpus().length, so: `${platform()} ${release()}`, node: process.version },
    resultados,
  }
  writeFileSync(join(root, 'bench/tamanho.json'), JSON.stringify(dados, null, 2) + '\n')
  writeFileSync(join(root, 'docs/public/tamanho-host.svg'), grafico(dados))
} finally {
  rmSync(dir, { recursive: true, force: true })
}

function kb(n) {
  return Math.round((n / 1000) * 10) / 10
}

// Versão do package.json mais o commit medido: o código local pode estar à frente da versão publicada.
function vitral() {
  const { version } = JSON.parse(readFileSync(join(root, 'packages/vitral/package.json'), 'utf8'))
  try {
    return `vitral@${version} (commit ${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim()})`
  } catch {
    return `vitral@${version}`
  }
}

// Barras horizontais, do menor para o maior.
function grafico({ data, resultados }) {
  const linhas = [...resultados].sort((a, b) => a.brotliKB - b.brotliKB)
  const max = Math.max(...linhas.map((r) => r.brotliKB))
  const [x0, larg, alt, topo] = [230, 360, 30, 44]
  const h = topo + linhas.length * alt + 34
  const barras = linhas
    .map((r, i) => {
      const y = topo + i * alt
      const w = Math.max(2, (r.brotliKB / max) * larg)
      const cor = r.nome === 'vitral' ? '#8b5cf6' : '#94a3b8'
      return [
        `<text x="${x0 - 10}" y="${y + 19}" text-anchor="end">${r.nome}</text>`,
        `<rect x="${x0}" y="${y + 5}" width="${w.toFixed(1)}" height="20" rx="3" fill="${cor}"/>`,
        `<text x="${(x0 + w + 8).toFixed(1)}" y="${y + 19}">${r.brotliKB.toFixed(1).replace('.', ',')} kB</text>`,
      ].join('')
    })
    .join('\n  ')
  const [a, m, d] = data.split('-')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 ${h}" width="680" height="${h}" font-family="system-ui, sans-serif" font-size="14" fill="#64748b">
  <text x="20" y="26" font-size="15" font-weight="600">Código de host, minificado e com brotli (menor é melhor)</text>
  ${barras}
  <text x="20" y="${h - 12}" font-size="12">Medido em ${d}/${m}/${a} com bench/tamanho.mjs</text>
</svg>
`
}
