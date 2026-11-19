# mountRemote

Mounts a remote inside an element, without a framework component.

```ts
mountRemote<P>(target: HTMLElement, name: string, props: P, options?: MountOptions): Promise<MountedRemote<P>>
```

## Usage

```ts
import { mountRemote } from 'vitral'

const cart = await mountRemote(document.getElementById('cart')!, 'cart', { userId: 42 })
cart.update?.({ userId: 43 })
cart.unmount()
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `target` | Element that receives the remote |
| `name` | Registered name |
| `props` | Initial props |
| `options.isolate` | `'none'`, `'shadow'`, `'iframe'` or `'reframe'` |
| `options.priority` | `'high'` to download with priority |
| `options.styles` | Host styles in the Shadow DOM |
| `options.onError` | Called when the remote breaks after mounting |
| `options.signal` | `AbortSignal` that cancels the mount. Aborted before the remote's `mount()`, it never runs and the Promise rejects with `signal.reason`. Aborted during `mount()`, the remote unmounts as soon as it finishes |

## Returns

A Promise with `{ update?, unmount }`. Rejects with [`RemoteError`](./remote-error) if the remote doesn't load.

## Notes

- With [`refresh(name)`](./updates), the same object starts pointing to the new version.
- For fallback, error and retry, use [`createSlot`](./create-slot).
