import { protocol } from './state'
import type { EventBus } from './types'

export { createEventBus } from './bus'

/** Barramento global. É o mesmo objeto que os remotes recebem em `ctx.events`. */
export const events: EventBus = {
  emit: (t, p) => protocol().events.emit(t, p),
  on: (t, h) => protocol().events.on(t, h),
  last: (t) => protocol().events.last(t),
}

/** Visão do barramento que cancela todas as assinaturas de uma vez. */
export function scopedEvents(): { bus: EventBus; dispose(): void } {
  const offs = new Set<() => void>()
  return {
    bus: {
      ...events,
      on(t, h) {
        const off = events.on(t, h)
        const wrapped = () => (offs.delete(wrapped), off())
        offs.add(wrapped)
        return wrapped
      },
    },
    dispose() {
      for (const off of [...offs]) off()
    },
  }
}
