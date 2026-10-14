// Compara dois resultados do benchmark e falha se algum ficou mais de 10% pior.
//
//   node bench/compare.mjs base.json head.json
import { readFileSync } from 'node:fs'

const [baseFile, headFile] = process.argv.slice(2)
const base = JSON.parse(readFileSync(baseFile, 'utf8'))
const head = JSON.parse(readFileSync(headFile, 'utf8'))

// Folga absoluta para métricas pequenas, onde 10% é ruído (ex.: 20 KB de heap).
const METRICS = { coldReadyMs: 50, warmReadyMs: 50, jsKB: 1, heapGrowthKB: 100 }
const LIMIT = 0.1

let failed = false
const rows = ['| Métrica | main | PR | Diferença |', '| --- | --- | --- | --- |']
for (const [key, slack] of Object.entries(METRICS)) {
  const a = base[key]
  const b = head[key]
  const diff = a ? (b - a) / a : 0
  const worse = b > a * (1 + LIMIT) && b - a > slack
  if (worse) failed = true
  rows.push(`| ${key} | ${a} | ${b} | ${(diff * 100).toFixed(1)}%${worse ? ' ❌' : ''} |`)
}
console.log(rows.join('\n'))
if (failed) {
  console.log(`\nAlguma métrica ficou mais de ${LIMIT * 100}% pior que a main.`)
  process.exit(1)
}
