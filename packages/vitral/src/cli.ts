#!/usr/bin/env node
import { createRequire } from 'node:module'
import { canal } from './cli/canal'
import { serveMcp } from './cli/mcp'
import { add, registry } from './cli/registry'
import { dict } from './cli/dict'
import { doctorCli } from './cli/doctor'
import { migrate, type MigrateSource } from './cli/migrate'
import { test } from './cli/test'
import { flag, types } from './cli/types'

const AJUDA = `Uso:
  vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
  vitral registry [remotes.json | nome=url ...] [--base url] [--out arquivo] [--name nome]
  vitral add <remote ...> [--registry url|arquivo] [--to remotes.json] [--base url] [--out arquivo] [--force] [--no-types]
  vitral mcp [--registry url|arquivo]
  vitral doctor [remotes.json | url | nome=url ...] [--host url] [--origin url] [--base url]
                [--contract faixa] [--max-kb n] [--json]
  vitral migrate [pasta] [--from single-spa|module-federation] [--dry-run]
  vitral canal <canal.json> [--stable x.y.z] [--canary x.y.z | off] [--percent n]
  vitral test [--contract arquivo|pasta ...] [--since url|arquivo] [--dir dist] [--entry arquivo]
              [--types vitral.d.ts]
  vitral dict <dist> --from <dist-anterior> [--from ...] [--level n] [--no-dcb]

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
            Sai com erro se alguma conferência falhar (útil no CI).
  migrate   Converte um app do single-spa ou um remote do Module Federation num
            remote vitral. Mostra o diff de cada arquivo.
            --dry-run só mostra o que mudaria, sem escrever.
  canal     Cria ou edita o canal de um remote (canary e rollback) e mostra
            como ficou. --stable é obrigatória ao criar; --canary off tira a
            canary; --percent vai de 0 a 100.
  test      No CI do remote. --contract monta o build em happy-dom com cada
            caso gravado pelo host (record() de vitral/testing) e falha se o
            mount quebrar, se um evento que o host escuta sumir ou se as props
            gravadas não baterem com o Props local. --since compara o Props
            do vitral.d.ts publicado com o local e falha nas mudanças que
            quebram o host.
  dict      Pré-comprime cada arquivo do dist com a versão anterior dele
            como dicionário (.dcz e, com o binário brotli, .dcb) e grava
            vitral-dict.json para o middleware vitral/dict.`

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
} else if (command === 'canal' && args.length) {
  const stable = flag(args, '--stable')
  const canary = flag(args, '--canary')
  const percent = flag(args, '--percent')
  try {
    canal({ file: args[0], stable, canary, percent: percent === undefined ? undefined : Number(percent) })
  } catch (err) {
    falhou(err as Error)
  }
} else if (command === 'test') {
  const contracts: string[] = []
  for (let c = flag(args, '--contract'); c !== undefined; c = flag(args, '--contract')) contracts.push(c)
  finish(test({ contracts, since: flag(args, '--since'), dir: flag(args, '--dir'), entry: flag(args, '--entry'), types: flag(args, '--types') }))
} else if (command === 'dict' && args.length) {
  const from: string[] = []
  for (let f = flag(args, '--from'); f !== undefined; f = flag(args, '--from')) from.push(f)
  const level = flag(args, '--level')
  const noDcb = bool(args, '--no-dcb')
  try {
    if (!from.length) throw new Error('[vitral] dict precisa de --from <dist-anterior>')
    dict({ dist: args[0], from, level: level === undefined ? undefined : Number(level), brotli: noDcb ? false : undefined })
  } catch (err) {
    falhou(err as Error)
  }
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
