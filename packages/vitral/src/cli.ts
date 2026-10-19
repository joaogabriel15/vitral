#!/usr/bin/env node
import { doctorCli } from './cli/doctor'
import { flag, types } from './cli/types'

const AJUDA = `Uso: vitral types [remotes.json | nome=url ...] [--base url] [--out arquivo] [--check]
     vitral doctor [remotes.json | url | nome=url ...] [--host url] [--origin url] [--base url]
                   [--contract faixa] [--max-kb n] [--json]

  types   Baixa o vitral.d.ts de cada remote e gera vitral-env.d.ts.
          --check  só confere se o hash de cada manifesto ainda é o registrado;
                   sai com erro se algum mudou (útil no CI).
  doctor  Confere cada remote como o host faria (manifesto, CORS, CSP, mount,
          integrity, contrato, dedupe, tamanho) e explica o que fazer.
          Sai com erro se alguma conferência falhar (útil no CI).`

const falhou = (err: Error) => {
  console.error(err.message)
  process.exitCode = 1
}

const [command, ...args] = process.argv.slice(2)
if (command === 'types') {
  const base = flag(args, '--base')
  const out = flag(args, '--out')
  const check = args.includes('--check')
  types({ args: args.filter((a) => a !== '--check'), base, out, check }).then((falhas) => (process.exitCode = falhas ? 1 : 0), falhou)
} else if (command === 'doctor') {
  doctorCli(args).then((code) => (process.exitCode = code), falhou)
} else {
  console.log(AJUDA)
  process.exitCode = command && command !== '--help' ? 1 : 0
}
