// Tipos da API pública, como quem instala o pacote vê (dist/*.d.ts).
// Roda no `pnpm test` (typecheck do Vitest); erro de tipo falha o teste.
//
// Casos que entram com outras fases:
// - Fase 1: interface Remotes (declare module 'vitral') checando as props de
//   <Remote name> e do src; tipos gerados por `npx vitral types`.
// - Fase 2: interface Shared tipando provide(), shared() e os hooks useShared.
import { describe, expectTypeOf, it } from 'vitest'
import {
  createSlot,
  defineRemote,
  events,
  loadRemote,
  mountRemote,
  RemoteError,
  type MountedRemote,
  type RemoteContext,
  type RemoteErrorCode,
  type RemoteManifest,
  type RemoteModule,
  type SlotStatus,
} from 'vitral'
import { defineVitralElement, elementRemote, VitralRemoteElement } from 'vitral/element'
import { Remote, reactRemote, useEventValue, type RemoteProps } from 'vitral/react'
import { mockRemote } from 'vitral/testing'
import vitral from 'vitral/vite'

type Carrinho = { itens: number; cupom?: string }

describe('contrato do remote', () => {
  it('mount(el, props, ctx) devolve { update?, unmount }, síncrono ou não', () => {
    type Mount = RemoteModule<Carrinho>['mount']
    expectTypeOf<Parameters<Mount>>().toEqualTypeOf<[HTMLElement, Carrinho, RemoteContext]>()
    expectTypeOf<ReturnType<Mount>>().toEqualTypeOf<MountedRemote<Carrinho> | Promise<MountedRemote<Carrinho>>>()
    expectTypeOf<MountedRemote<Carrinho>['update']>().toEqualTypeOf<((props: Carrinho) => void) | undefined>()
  })

  it('defineRemote infere e confere as props', () => {
    const remote = defineRemote<Carrinho>({
      mount(el, props, ctx) {
        expectTypeOf(props.itens).toBeNumber()
        expectTypeOf(ctx.protocol).toEqualTypeOf<number | undefined>()
        expectTypeOf(ctx.shadowRoot).toEqualTypeOf<ShadowRoot | null>()
        el.textContent = String(props.itens)
        return { unmount() {} }
      },
    })
    expectTypeOf(remote).toEqualTypeOf<RemoteModule<Carrinho>>()
    // @ts-expect-error unmount é obrigatório
    defineRemote({ mount: () => ({}) })
  })

  it('adaptadores tiram as props do componente', () => {
    const Lista = (_: Carrinho) => null
    expectTypeOf(reactRemote(Lista)).toEqualTypeOf<RemoteModule<Carrinho>>()
    expectTypeOf(elementRemote<Carrinho>('meu-carrinho')).toEqualTypeOf<RemoteModule<Carrinho>>()
  })
})

describe('host', () => {
  it('loadRemote e mountRemote levam o tipo das props', async () => {
    expectTypeOf(loadRemote<Carrinho>('carrinho')).toEqualTypeOf<Promise<RemoteModule<Carrinho>>>()
    const handle = await mountRemote(document.body, 'carrinho', { itens: 1 })
    expectTypeOf(handle).toEqualTypeOf<MountedRemote<{ itens: number }>>()
    // @ts-expect-error itens é número
    handle.update?.({ itens: 'dois' })
  })

  it('createSlot confere props e status', () => {
    const slot = createSlot<Carrinho>(document.body, { name: 'carrinho', props: { itens: 1 } })
    expectTypeOf(slot.status).toEqualTypeOf<SlotStatus>()
    expectTypeOf<SlotStatus>().toEqualTypeOf<'loading' | 'ready' | 'error'>()
    // @ts-expect-error cupom é string
    slot.update({ itens: 1, cupom: 10 })
    createSlot(document.body, {
      name: 'x',
      onStatus(status, error) {
        expectTypeOf(error).toEqualTypeOf<RemoteError | null>()
      },
    })
  })

  it('<Remote> do React aceita props tipadas', () => {
    expectTypeOf<RemoteProps<Carrinho>['props']>().toEqualTypeOf<Carrinho | undefined>()
    expectTypeOf(Remote<Carrinho>).parameter(0).toMatchTypeOf<{ name: string; props?: Carrinho }>()
    expectTypeOf(useEventValue<string>('ping')).toEqualTypeOf<string | undefined>()
  })

  it('<vitral-remote> está no mapa de tags do DOM', () => {
    expectTypeOf(defineVitralElement).toEqualTypeOf<(tag?: string) => void>()
    expectTypeOf(document.createElement('vitral-remote')).toEqualTypeOf<VitralRemoteElement>()
    expectTypeOf(document.createElement('vitral-remote').status).toEqualTypeOf<'loading' | 'ready' | 'error'>()
  })
})

describe('eventos e erros', () => {
  it('on e last levam o tipo do payload', () => {
    events.on<{ id: number }>('usuario', (u) => expectTypeOf(u.id).toBeNumber())
    expectTypeOf(events.last<string>('tema')).toEqualTypeOf<string | undefined>()
    expectTypeOf(events.on('x', () => {})).toEqualTypeOf<() => void>()
  })

  it('RemoteError tem código, remote e docs', () => {
    const e = new RemoteError('TIMEOUT', 'carrinho', 'demorou')
    expectTypeOf(e.code).toEqualTypeOf<RemoteErrorCode>()
    expectTypeOf(e.docs).toBeString()
    expectTypeOf<'TIMEOUT'>().toMatchTypeOf<RemoteErrorCode>()
    // @ts-expect-error código inexistente
    new RemoteError('OUTRO', 'x', 'y')
  })
})

describe('build', () => {
  it('manifesto e plugin', () => {
    expectTypeOf<RemoteManifest>().toMatchTypeOf<{ name: string; entry: string; integrity?: string; css?: string[]; scope?: string }>()
    expectTypeOf(vitral).parameter(0).toMatchTypeOf<{ entry: string; name?: string }>()
    expectTypeOf(mockRemote<Carrinho>('x').lastProps).toEqualTypeOf<Carrinho | undefined>()
  })
})
