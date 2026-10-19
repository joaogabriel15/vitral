#!/usr/bin/env node
import { canal } from './cli/canal'
import { types } from './cli/types'

const AJUDA = `Uso: vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]

  Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
  --check  só confere se o hash de cada manifesto ainda é o registrado;
           sai com erro se algum mudou (útil no CI).

Uso: vitral canal <canal.json> [--stable x.y.z] [--canary x.y.z | off] [--percent n]

  Cria ou edita o canal de um remote (canary e rollback) e mostra como ficou.
  --stable   versão de quem não está na canary (obrigatória ao criar)
  --canary   versão nova para parte dos usuários; off tira a canary
  --percent  parte dos usuários na canary, de 0 a 100`

const fail = (err: Error) => {
  console.error(err.message)
  process.exitCode = 1
}

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
    fail,
  )
} else if (command === 'canal' && args.length) {
  const stable = flag(args, '--stable')
  const canary = flag(args, '--canary')
  const percent = flag(args, '--percent')
  try {
    if (!args[0]) throw new Error(AJUDA)
    canal({ file: args[0], stable, canary, percent: percent === undefined ? undefined : Number(percent) })
  } catch (err) {
    fail(err as Error)
  }
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
