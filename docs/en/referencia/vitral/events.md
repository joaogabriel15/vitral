# events

The page's event bus. The host and every remote use the same one.

```ts
events.emit<T>(type: string, payload?: T): void
events.on<T>(type: string, handler: (payload: T) => void): () => void
events.last<T>(type: string): T | undefined
createEventBus(): EventBus
```

## Usage

```ts
import { events } from 'vitral'

events.emit('cart:total', 120)
const stop = events.on('cart:total', (total) => console.log(total))
events.last('cart:total') // 120
stop()
```

## Methods

| Method | What it does |
| --- | --- |
| `emit(type, value)` | Sends the event |
| `on(type, fn)` | Subscribes. Returns the function that cancels |
| `last(type)` | Latest value emitted, even for subscribers that came later |

## Returns

`on` returns the function that cancels. `createEventBus()` returns a separate bus, with the same methods.

## Notes

- Inside the remote, use `ctx.events`. Subscriptions are cancelled on unmount.
- A handler that throws doesn't stop the others.
- Use a prefix in the name (`cart:`) to know who emits it.
- The library emits `vitral:update-available`. See [`watchUpdates`](./updates).
