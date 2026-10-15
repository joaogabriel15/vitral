import { createInterface } from 'node:readline/promises'
import { create, DEFAULT_SRC, HOSTS, REMOTES } from './create.js'

export const AJUDA = `Uso: npm create vitral@latest [pasta] -- [--host | --remote] [--framework nome] [--src url]

  --host, --remote   o que criar
  --framework, -f    hosts: ${HOSTS.join(', ')}
                     remotes: ${REMOTES.join(', ')} (next, nuxt e sveltekit viram react, vue e svelte)
  --src              vitral.json que o host carrega (padrão: ${DEFAULT_SRC})

Sem as opções, o comando pergunta.`

/** @param {string[]} argv */
export function parseArgs(argv) {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--host' || a === '--remote') o.kind = a.slice(2)
    else if (a === '--framework' || a === '-f') o.framework = argv[++i]
    else if (a === '--src') o.src = argv[++i]
    else if (a === '--help' || a === '-h') o.help = true
    else if (a.startsWith('-')) throw new Error(`Opção desconhecida: ${a}`)
    else o.dir = a
  }
  return o
}

/**
 * @param {string[]} argv
 * @param {{ ask?: (q: string) => Promise<string>, log?: (m: string) => void }} [io]
 */
export async function run(argv, { ask, log = console.log } = {}) {
  const o = parseArgs(argv)
  if (o.help) return log(AJUDA)
  let rl
  const question = ask ?? ((q) => (rl ??= createInterface({ input: process.stdin, output: process.stdout })).question(q))
  try {
    o.dir ??= (await question('Pasta (meu-app): ')).trim() || 'meu-app'
    o.kind ??= /^r/i.test(await question('Host ou remote? (h/r): ')) ? 'remote' : 'host'
    const list = o.kind === 'host' ? HOSTS : REMOTES
    if (!o.framework) {
      const menu = list.map((f, i) => `${i + 1}. ${f}`).join('  ')
      const answer = (await question(`Framework: ${menu}\n> `)).trim()
      o.framework = list[Number(answer) - 1] ?? (answer || list[0])
    }
  } finally {
    rl?.close()
  }
  const files = create(o)
  log(`\nPronto: ${o.kind} ${o.framework} em ${o.dir}\n\n  cd ${o.dir}\n  npm install\n  npm run dev\n`)
  if (o.kind === 'host') log(`O host carrega ${o.src ?? DEFAULT_SRC}. Suba o remote antes.`)
  return files
}
