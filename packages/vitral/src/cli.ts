#!/usr/bin/env node
import { canal } from './cli/canal'
import { types } from './cli/types'

const AJUDA = `Uso: vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]

  Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
  --check  só confere se o hash de cada manifesto ainda é o registrado;
           sai com erro se algum mudou (útil no CI).

Uso: vitral canal <vitral.json | url> [--versao x.y.z] [--out arquivo]

  Gera o vitral.json de um canal (stable, beta) que aponta para os arquivos
  de uma versão publicada em ../<versão>/. Padrão de --versao: o version do
  manifesto. Sem --out, escreve na saída padrão.`

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
  const version = flag(args, '--versao')
  const out = flag(args, '--out')
  if (args[0]) canal({ source: args[0], version, out }).catch(fail)
  else fail(new Error(AJUDA))
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
