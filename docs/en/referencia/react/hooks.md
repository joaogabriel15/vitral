# React hooks

Hooks to use inside a remote or a React host. They also exist in `vitral/preact` (`useShared`).

```ts
useVitral(): RemoteContext | null
usePortalContainer(): HTMLElement | undefined
useEvent<T>(type: string, handler: (payload: T) => void): void
useEventValue<T>(type: string): T | undefined
useShared<T, S>(key: string, select?: (value: T | undefined) => S): S
```

## Usage

```jsx
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/react'

function Cart() {
  const ctx = useVitral()
  const total = useEventValue('cart:total')
  useEvent('cart:cleared', () => alert('Empty'))
  const name = useShared('user', (u) => u?.name)
  return <button onClick={() => ctx?.navigate('/checkout')}>{name}: {total}</button>
}
```

## useVitral

Returns the remote's [`ctx`](/en/referencia/vitral/define-remote#ctx), or `null` outside a remote.

## usePortalContainer

The [`ctx.portalContainer`](/en/aprender/estilos#portals-radix-headless-ui-mui), for Radix's and MUI's `container`. Outside a remote, `undefined`, and the library uses `document.body`.

## useEvent

Subscribes to an [event](/en/referencia/vitral/events) while the component exists.

## useEventValue

Latest value of an event. Re-renders on every `emit`.

## useShared

Value of a [shared context](/en/referencia/vitral/shared) key. With a selector, it only re-renders when the result changes.

| Parameter | What it is |
| --- | --- |
| `key` | Key name |
| `select` | Optional. Function that picks part of the value |

To change it, use `shared(key).set(value)`.
