import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Channel } from '../core/types'

export interface ChannelEdit {
  /** Nova versão estável. */
  stable?: string
  /** Nova versão canary, ou `'off'` para tirar a canary. */
  canary?: string
  /** Parte dos usuários na canary, de 0 a 100. */
  percent?: number
}

/**
 * Aplica as mudanças a um canal (`canal.json`, veja `core/channel.ts`).
 * Campos próprios do canal (`"interno": "1.6.0-rc.1"`) ficam como estão.
 */
export function editChannel(current: Channel | undefined, edit: ChannelEdit): Channel {
  const stable = edit.stable ?? current?.stable
  if (!stable) throw new Error('[vitral] o canal ainda não existe: use --stable')
  const { canary: old, ...rest } = current ?? ({} as Partial<Channel>)
  const out: Channel = { ...rest, stable }
  if (edit.percent !== undefined && !(edit.percent >= 0 && edit.percent <= 100)) throw new Error('[vitral] --percent vai de 0 a 100')
  if (edit.canary === 'off') {
    if (edit.percent !== undefined) throw new Error('[vitral] --percent não vale com --canary off')
    return out
  }
  const version = edit.canary ?? old?.version
  const percent = edit.percent ?? old?.percent
  if (version === undefined) {
    if (edit.percent !== undefined) throw new Error('[vitral] o canal não tem canary: use --canary')
    return out
  }
  if (percent === undefined) throw new Error('[vitral] canary nova precisa de --percent')
  out.canary = { version, percent }
  return out
}

export interface CanalOptions extends ChannelEdit {
  /** Arquivo do canal. Criado se não existir (aí `stable` é obrigatório). */
  file: string
  log?: (text: string) => void
}

/** `npx vitral canal`: cria ou edita o `canal.json` e mostra como ficou. Sem mudanças, só mostra. */
export function canal(o: CanalOptions): Channel {
  const current: Channel | undefined = existsSync(o.file) ? JSON.parse(readFileSync(o.file, 'utf8')) : undefined
  const changes = o.stable !== undefined || o.canary !== undefined || o.percent !== undefined
  if (!changes && !current) throw new Error(`[vitral] ${o.file} não existe: use --stable para criar`)
  const next = changes ? editChannel(current, o) : current!
  const text = JSON.stringify(next, null, 2) + '\n'
  if (changes) {
    mkdirSync(dirname(o.file), { recursive: true })
    writeFileSync(o.file, text)
  }
  ;(o.log ?? console.log)(text.trimEnd())
  return next
}
