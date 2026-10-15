import { protocol } from './state'
import type { EventBus } from './types'

export { createEventBus } from './bus'

/** Barramento global. É o mesmo objeto que os remotes recebem em `ctx.events`. */
export const events: EventBus = {
  emit: (t, p) => protocol().events.emit(t, p),
  on: (t, h) => protocol().events.on(t, h),
  last: (t) => protocol().events.last(t),
}

/**
 * Visão do barramento que cancela todas as assinaturas de uma vez. `track`
 * registra outros cancelamentos (ex.: `ctx.shared`) para o mesmo `dispose`.
 */
export function scopedEvents(): { bus: EventBus; track(off: () => void): () => void; dispose(): void } {
  const offs = new Set<() => void>()
  const track = (off: () => void) => {
    const wrapped = () => (offs.delete(wrapped), off())
    offs.add(wrapped)
    return wrapped
  }
  return {
    bus: {
      emit: (t, p) => events.emit(t, p),
      last: (t) => events.last(t),
      on: (t, h) => track(events.on(t, h)),
    },
    track,
    dispose() {
      for (const off of [...offs]) off()
    },
  }
}
