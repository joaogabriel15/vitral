#!/usr/bin/env node
import { types } from './cli/types'

const AJUDA = `Uso: vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]

  Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
  --check  só confere se o hash de cada manifesto ainda é o registrado;
           sai com erro se algum mudou (útil no CI).`

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
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
