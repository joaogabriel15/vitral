#!/usr/bin/env node
import { migrate, type MigrateSource } from './cli/migrate'
import { types } from './cli/types'

const AJUDA = `Uso: vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
     vitral migrate [pasta] [--from single-spa|module-federation] [--dry-run]

  types    Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
           --check  só confere se o hash de cada manifesto ainda é o registrado;
                    sai com erro se algum mudou (útil no CI).
  migrate  Converte um app do single-spa ou um remote do Module Federation num
           remote vitral. Mostra o diff de cada arquivo.
           --dry-run  só mostra o que mudaria, sem escrever.`

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}

const [command, ...args] = process.argv.slice(2)
if (command === 'types') {
  const base = flag(args, '--base')
  const out = flag(args, '--out')
  const check = args.includes('--check')
  types({ args: args.filter((a) => a !== '--check'), base, out, check }).then(
    (falhas) => (process.exitCode = falhas ? 1 : 0),
    (err: Error) => {
      console.error(err.message)
      process.exitCode = 1
    },
  )
} else if (command === 'migrate') {
  const from = flag(args, '--from')
  if (from && from !== 'single-spa' && from !== 'module-federation') {
    console.error(`[vitral] --from inválido: ${from}. Use single-spa ou module-federation.`)
    process.exitCode = 1
  } else {
    try {
      const plan = migrate({ cwd: args.find((a) => !a.startsWith('--')), from: from as MigrateSource | undefined, dryRun: args.includes('--dry-run') })
      process.exitCode = plan.from ? 0 : 1
    } catch (err) {
      console.error((err as Error).message)
      process.exitCode = 1
    }
  }
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
