# vitral/svelte

Host and remote in Svelte 5 and SvelteKit.

```ts
import { remote, svelteRemote } from 'vitral/svelte'
```

## use:remote

```ts
remote(node: HTMLElement, params: RemoteActionParams): { update, destroy }
```

```svelte
<script>
  import { remote } from 'vitral/svelte'

  let userId = $state(42)
  let status = $state('loading')
</script>

<div use:remote={{ name: 'cart', props: { userId }, onStatus: (s) => (status = s) }}></div>

{#if status === 'error'}<p>Unavailable</p>{/if}
```

| Parameter | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Name registered in `configure` |
| `src` | `string` | URL of `vitral.json` |
| `props` | `object` | The remote's props |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation |
| `onStatus` | `(status, error) => void` | `'loading'`, `'ready'` or `'error'` |
| `loading` | `'lazy' \| 'idle'` | When to mount |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted |
| `waitFor` | `string \| string[]` | `provide` keys that must have a value before mounting |

In SvelteKit the action only runs on the client.

## svelteRemote

```ts
svelteRemote<P>(component: Component): RemoteModule<P>
```

```js
import { svelteRemote } from 'vitral/svelte'
import Cart from './Cart.svelte'

export default svelteRemote(Cart)
```

The component receives the props, and the `ctx` in the `vitral` prop. With the `vitral/vite` plugin, the `export default` is enough.

## Shared state

`shared()` from `vitral` works as a store: `$theme` with `const theme = shared('theme')`.
