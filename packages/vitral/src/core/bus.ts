import type { EventBus, Handler } from './types'

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Handler<any>>>()
  const lastValues = new Map<string, unknown>()
  return {
    emit(type, payload) {
      lastValues.set(type, payload)
      for (const h of [...(handlers.get(type) ?? [])]) {
        try {
          h(payload)
        } catch (e) {
          console.error(`[vitral] handler de "${type}" falhou`, e)
        }
      }
    },
    on(type, handler) {
      let set = handlers.get(type)
      if (!set) handlers.set(type, (set = new Set()))
      set.add(handler)
      return () => set!.delete(handler)
    },
    last<T>(type: string) {
      return lastValues.get(type) as T | undefined
    },
  }
}
