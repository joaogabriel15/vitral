import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { canal, editChannel } from '../src/cli/canal'

const cache = resolve(__dirname, '../node_modules/.cache/vitral-test')
mkdirSync(cache, { recursive: true })
const dir = mkdtempSync(join(cache, 'canal-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const ler = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

describe('npx vitral canal', () => {
  it('cria, abre a canary, muda o percent, promove e volta: o ciclo de um lançamento', () => {
    const file = join(dir, 'chat/canal.json')
    const logs: string[] = []
    const log = (t: string) => logs.push(t)
    canal({ file, stable: '1.4.0', log })
    expect(ler(file)).toEqual({ stable: '1.4.0' })
    canal({ file, canary: '1.5.0', percent: 10, log })
    expect(ler(file)).toEqual({ stable: '1.4.0', canary: { version: '1.5.0', percent: 10 } })
    canal({ file, percent: 50, log })
    expect(ler(file)).toEqual({ stable: '1.4.0', canary: { version: '1.5.0', percent: 50 } })
    // Promover: a canary vira a estável.
    canal({ file, stable: '1.5.0', canary: 'off', log })
    expect(ler(file)).toEqual({ stable: '1.5.0' })
    // Voltar uma versão para todos: só editar o canal.
    canal({ file, stable: '1.4.0', log })
    expect(ler(file)).toEqual({ stable: '1.4.0' })
    expect(JSON.parse(logs.at(-1)!)).toEqual({ stable: '1.4.0' })
  })

  it('sem mudanças só mostra o canal, sem reescrever', () => {
    const file = join(dir, 'mostrar.json')
    writeFileSync(file, '{"stable":"1.0.0","interno":"2.0.0-rc.1"}')
    const logs: string[] = []
    expect(canal({ file, log: (t) => logs.push(t) })).toEqual({ stable: '1.0.0', interno: '2.0.0-rc.1' })
    expect(readFileSync(file, 'utf8')).toBe('{"stable":"1.0.0","interno":"2.0.0-rc.1"}')
    expect(logs).toHaveLength(1)
    expect(() => canal({ file: join(dir, 'nao-existe.json') })).toThrow('use --stable para criar')
    expect(existsSync(join(dir, 'nao-existe.json'))).toBe(false)
  })

  it('campos próprios do canal ficam; trocar a canary mantém o percent', () => {
    const atual = { stable: '1.4.0', interno: '1.6.0-rc.1', canary: { version: '1.5.0', percent: 10 } }
    expect(editChannel(atual, { canary: '1.5.1' })).toEqual({ stable: '1.4.0', interno: '1.6.0-rc.1', canary: { version: '1.5.1', percent: 10 } })
    expect(editChannel(atual, { canary: 'off' })).toEqual({ stable: '1.4.0', interno: '1.6.0-rc.1' })
  })

  it('recusa o que geraria um canal inválido', () => {
    expect(() => editChannel(undefined, { canary: '1.5.0', percent: 10 })).toThrow('use --stable')
    expect(() => editChannel({ stable: '1' }, { canary: '2' })).toThrow('precisa de --percent')
    expect(() => editChannel({ stable: '1' }, { percent: 5 })).toThrow('não tem canary')
    expect(() => editChannel({ stable: '1' }, { canary: '2', percent: 101 })).toThrow('de 0 a 100')
    expect(() => editChannel({ stable: '1' }, { canary: '2', percent: NaN })).toThrow('de 0 a 100')
    expect(() => editChannel({ stable: '1' }, { canary: 'off', percent: 5 })).toThrow('não vale com --canary off')
  })
})
