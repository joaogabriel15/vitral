# loadModule

Downloads a remote or a part of it and returns the exports, without mounting.

```ts
loadModule<T>(name: string): Promise<T>
loadRemote<P>(name: string): Promise<RemoteModule<P>>
preload(name: string): void
```

## Usage

```ts
import { loadModule, preload } from 'vitral'

const api = await loadModule<typeof import('./types/cart-api')>('cart/api')
api.add(item)

link.addEventListener('pointerenter', () => preload('checkout'), { once: true })
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `name` | Registered name, or `remote/part` for a part in [`exposes`](/en/aprender/exposes) |

## Returns

| Function | Returns |
| --- | --- |
| `loadModule` | The module's exports |
| `loadRemote` | The object with `mount` |
| `preload` | Nothing. It only downloads |

## Notes

- Goes through the same origin and SRI checks.
- Each remote is downloaded once per page.
- A part that doesn't exist throws [`NOT_EXPOSED`](/en/erros/NOT_EXPOSED).
