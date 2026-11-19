# reactRemote

Turns a React component into a remote.

```ts
reactRemote<P>(Component: ComponentType<P>): RemoteModule<P>
```

## Usage

```jsx
import { reactRemote } from 'vitral/react'
import Cart from './Cart'

export default reactRemote(Cart)
```

## Parameters

| Parameter | What it is |
| --- | --- |
| `Component` | Component that receives the host's props |

## Returns

A remote with `mount` and `hydrate`. `hydrate` takes over the HTML that [`reactRender`](#reactrender) generated on the server (with `hydrateRoot`), without recreating the DOM.

## Notes

- With the `vitral/vite` plugin, the component's `export default` is enough. The plugin calls `reactRemote`.
- Render errors go to the host's `error`.
- To read the `ctx`, use [`useVitral`](./hooks#usevitral).

## reactRender

The remote's `render` for gateway SSR (`vitral/edge`). Runs on the server.

```ts
import { reactRender } from 'vitral/react-server'

reactRender<P>(Component: ComponentType<P>): (props: P) => string
```

```ts
// cart/src/server.ts
import { reactRender } from 'vitral/react-server'
import Cart from './Cart'

export const render = reactRender(Cart)
```

- The tree around the component is the same as in `reactRemote`, so `hydrate` reports no mismatch, not even with `useId`.
- On the server, [`useVitral`](./hooks#usevitral) returns `null`.
- See [Routes with SSR](/en/aprender/ssr#routes-with-ssr).
