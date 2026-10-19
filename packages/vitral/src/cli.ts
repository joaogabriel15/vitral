#!/usr/bin/env node
import { createRequire } from 'node:module'
import { serveMcp } from './cli/mcp'
import { add, registry } from './cli/registry'
import { doctorCli } from './cli/doctor'
import { flag, types } from './cli/types'

const AJUDA = `Uso:
  vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
  vitral registry [remotes.json | nome=url ...] [--base url] [--out arquivo] [--name nome]
  vitral add <remote ...> [--registry url|arquivo] [--to remotes.json] [--base url] [--out arquivo] [--force] [--no-types]
  vitral mcp [--registry url|arquivo]
  vitral doctor [remotes.json | url | nome=url ...] [--host url] [--origin url] [--base url]
                [--contract faixa] [--max-kb n] [--json]

  types     Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
            --check só confere se o hash de cada manifesto ainda é o
            registrado; sai com erro se algum mudou (útil no CI).
  registry  Gera vitral-registry.json a partir dos manifestos.
  add       Copia remotes do registro para o remotes.json e roda types.
            Registro padrão: VITRAL_REGISTRY ou vitral-registry.json.
  mcp       Servidor MCP por stdio para agentes (list_remotes, get_remote,
            add_remote).
  doctor    Confere cada remote como o host faria (manifesto, CORS, CSP, mount,
            integrity, contrato, dedupe, tamanho) e explica o que fazer.
            Sai com erro se alguma conferência falhar (útil no CI).`

const falhou = (err: Error) => {
  console.error(err.message)
  process.exitCode = 1
}

function bool(args: string[], name: string): boolean {
  const i = args.indexOf(name)
  if (i >= 0) args.splice(i, 1)
  return i >= 0
}

function version(): string {
  try {
    return (createRequire(import.meta.url)('../package.json') as { version: string }).version
  } catch {
    return '0.0.0'
  }
}

const finish = (run: Promise<number>) =>
  run.then(
    (falhas) => (process.exitCode = falhas ? 1 : 0),
    (err: Error) => {
      console.error(err.message)
      process.exitCode = 1
    },
  )

const [command, ...args] = process.argv.slice(2)
if (command === 'types') {
  const base = flag(args, '--base')
  const out = flag(args, '--out')
  const check = bool(args, '--check')
  finish(types({ args, base, out, check }))
} else if (command === 'registry') {
  const base = flag(args, '--base')
  const out = flag(args, '--out')
  const name = flag(args, '--name')
  finish(registry({ args, base, out, name }))
} else if (command === 'add') {
  const reg = flag(args, '--registry')
  const to = flag(args, '--to')
  const base = flag(args, '--base')
  const out = flag(args, '--out')
  const force = bool(args, '--force')
  const noTypes = bool(args, '--no-types')
  finish(add({ names: args, registry: reg, to, base, out, force, types: !noTypes }))
} else if (command === 'mcp') {
  // stdout é do protocolo: nada de console.log aqui.
  serveMcp(process.stdin, process.stdout, { registry: flag(args, '--registry'), version: version() })
} else if (command === 'doctor') {
  doctorCli(args).then((code) => (process.exitCode = code), falhou)
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
