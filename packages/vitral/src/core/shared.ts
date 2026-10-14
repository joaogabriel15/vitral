/**
 * Contexto compartilhado: quem cria o valor usa `provide`, quem consome usa
 * `shared`. Todas as cópias da lib na página falam com o mesmo store, que
 * fica no protocolo global (veja `store.ts`).
 *
 *   const usuario = provide('usuario', { id: 42, nome: 'Ana' })
 *   provide('tema', 'claro', { writable: false })
 *   shared('tema').subscribe((t) => console.log(t))
 *   usuario.set({ id: 7, nome: 'Bia' })
 */
import { RemoteError } from './errors'
import { ctxHooks } from './hooks'
import { pageStore as store, type SharedStore } from './store'

/**
 * Tipos das chaves compartilhadas. Declare uma vez no projeto:
 *
 *   declare module 'vitral' {
 *     interface Shared { usuario: { id: number; nome: string } | null; tema: 'claro' | 'escuro' }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Shared {}

/** Tipo do valor de `K`: o declarado em `Shared`, ou `unknown`. */
export type SharedType<K extends string> = K extends keyof Shared ? Shared[K] : unknown

/**
 * Acesso a uma chave. Segue o contrato de store do Svelte (`$tema` funciona).
 * O valor é tratado como imutável: para mudar, passe um valor novo.
 */
export interface SharedValue<T> {
  /** Valor atual, ou `undefined` se ninguém deu valor ainda. */
  get(): T | undefined
  /** Troca o valor. Numa chave com `writable: false`, só o dono pode. */
  set(value: T): void
  /** `set(fn(get()))`. */
  update(fn: (value: T | undefined) => T): void
  /** Chama `fn` agora, com o valor atual, e a cada mudança. Devolve a função que cancela. */
  subscribe(fn: (value: T | undefined) => void): () => void
}

/** O que `provide` devolve. Quando é o dono, `set` sempre passa. */
export interface ProvidedValue<T> extends SharedValue<T> {
  get(): T
  update(fn: (value: T) => T): void
  subscribe(fn: (value: T) => void): () => void
}

export interface ProvideOptions {
  /** `false`: só quem chamou `provide` altera. Padrão `true`. */
  writable?: boolean
}

/** `shared`, com `provide` e `batch`. É também o tipo de `ctx.shared`. */
export interface SharedApi {
  <K extends keyof Shared>(key: K): SharedValue<Shared[K]>
  <T = unknown>(key: string): SharedValue<T>
  /**
   * Cria a chave e vira dono dela. Quem chama primeiro é o dono; depois disso,
   * `provide` só devolve um acesso comum e não grava o valor.
   */
  provide<K extends keyof Shared>(key: K, value: Shared[K], options?: ProvideOptions): ProvidedValue<Shared[K]>
  provide<T>(key: string, value: T, options?: ProvideOptions): ProvidedValue<T>
  /** Várias mudanças, uma notificação por chave no fim. */
  batch<R>(fn: () => R): R
}

declare const process: { env: Record<string, string | undefined> }

/** Modo de desenvolvimento, pelo `process.env.NODE_ENV` que o bundler troca. Sem bundler, produção. */
export function isDev(): boolean {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

type Track = (off: () => void) => () => void

/** Store da página. Na primeira vez, liga `ctx.shared` nos remotes que esta cópia montar. */
function pageStore(): SharedStore {
  ctxHooks.shared ??= scopedShared
  return store()
}

function handle(store: SharedStore, key: string, by?: string, track: Track = (off) => off, token?: object): SharedValue<any> {
  const get = () => store.get(key)
  const set = (value: unknown) => {
    if (store.set(key, value, token, by)) return
    const e = new RemoteError('SHARED_READONLY', by || 'shared', `só o dono altera "${key}"`)
    if (isDev()) throw e
    console.warn(e.message)
  }
  return {
    get,
    set,
    update: (fn) => set(fn(get())),
    subscribe(fn) {
      fn(get())
      return track(store.subscribe(key, fn))
    },
  }
}

function own(key: string, value: unknown, options: ProvideOptions = {}, by?: string, track?: Track): ProvidedValue<any> {
  const store = pageStore()
  const token = store.own(key, value, options.writable !== false, by)
  if (token) track?.(() => store.release(key, token))
  return handle(store, key, by, track, token) as ProvidedValue<any>
}

/** Acesso a uma chave compartilhada: `get()`, `set()`, `update()` e `subscribe()`. */
export function shared<K extends keyof Shared>(key: K): SharedValue<Shared[K]>
export function shared<T = unknown>(key: string): SharedValue<T>
export function shared(key: string): SharedValue<unknown> {
  return handle(pageStore(), key)
}

/**
 * Cria uma chave compartilhada e vira dono dela. Quem chama primeiro é o
 * dono; depois disso, `provide` só devolve um acesso comum e não grava o valor.
 */
export function provide<K extends keyof Shared>(key: K, value: Shared[K], options?: ProvideOptions): ProvidedValue<Shared[K]>
export function provide<T>(key: string, value: T, options?: ProvideOptions): ProvidedValue<T>
export function provide(key: string, value: unknown, options?: ProvideOptions): ProvidedValue<unknown> {
  return own(key, value, options)
}

/** Várias mudanças, uma notificação por chave no fim. */
export function batch<R>(fn: () => R): R {
  return pageStore().batch(fn)
}

/**
 * `shared` de um remote montado (`ctx.shared`): `by` é o nome do remote (para
 * o devtools) e `track` recebe cada cancelamento, para o unmount limpar as
 * assinaturas e soltar as chaves de que o remote é dono.
 */
export function scopedShared(by: string, track: Track): SharedApi {
  const api = ((key: string) => handle(pageStore(), key, by, track)) as SharedApi
  api.provide = (key: string, value: unknown, options?: ProvideOptions) => own(key, value, options, by, track)
  api.batch = batch
  return api
}
