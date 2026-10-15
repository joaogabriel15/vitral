// Tabela em Markdown da cobertura dos testes de unidade, para o resumo do CI.
//
//   node scripts/cobertura.mjs packages/vitral/coverage/coverage-summary.json
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'

const file = process.argv[2]
const summary = JSON.parse(readFileSync(file, 'utf8'))
const METRICS = ['lines', 'statements', 'functions', 'branches']
const NAMES = { lines: 'Linhas', statements: 'Instruções', functions: 'Funções', branches: 'Ramos' }
const pct = (m) => `${m.pct.toFixed(1)}% (${m.covered}/${m.total})`

const rows = Object.entries(summary)
  .filter(([key]) => key !== 'total')
  .map(([path, m]) => `| \`${relative(process.cwd(), path)}\` | ${METRICS.map((k) => pct(m[k])).join(' | ')} |`)

console.log(`## Cobertura (testes de unidade)

| Arquivo | ${METRICS.map((k) => NAMES[k]).join(' | ')} |
| --- | ${METRICS.map(() => '---').join(' | ')} |
| **Total** | ${METRICS.map((k) => `**${pct(summary.total[k])}**`).join(' | ')} |
${rows.join('\n')}
`)
