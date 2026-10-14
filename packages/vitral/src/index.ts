/**
 * vitral: micro-frontends com um único contrato.
 *
 * Um remote é um módulo ES que exporta `mount(el, props, ctx)` e devolve
 * `{ update?, unmount }`. O host só precisa saber a URL. Nada de config
 * compartilhada em tempo de build, nada de container global de dependências.
 *
 * Cada parte mora em `src/core/`; este arquivo só reexporta a API pública.
 */
export type {
  EventBus,
  Handler,
  Isolation,
  MountedRemote,
  Props,
  RemoteContext,
  RemoteEntry,
  RemoteManifest,
  RemoteModule,
  StyleOptions,
  VitralConfig,
} from './core/types'
export { RemoteError, type RemoteErrorCode } from './core/errors'
export { configure, register } from './core/registry'
export { loadRemote, preload } from './core/loader'
export { mountRemote, type MountOptions } from './core/mount'
export { createSlot, type RemoteSlot, type SlotOptions, type SlotStatus } from './core/slot'
export { defineRemote } from './core/remote'
export { createEventBus, events } from './core/events'
export { navigate } from './core/navigate'
export { resetProtocol as __reset } from './core/state'

// Remote em JS/TS puro com template HTML
export { component, html, render, unsafeHTML } from './component'
export type { ComponentOptions, RenderFn, Template, View } from './component'
