# Exposes and loadModule

A remote can publish several components and modules without UI.

## When to use it

When the same team publishes related parts (full cart, mini cart, cart API) and wants a single deploy.

## Code

```js
// remote's vite.config.js
vitral({
  entry: 'src/remote.tsx',
  exposes: {
    './MiniCart': 'src/MiniCart.tsx',
    './api': 'src/api.ts',
  },
})
```

```tsx
// src/MiniCart.tsx
export default reactRemote(MiniCart)
```

In the host, use `remote/part`:

```tsx
<Remote name="cart/MiniCart" props={{ compact: true }} />
<vitral-remote name="cart/MiniCart"></vitral-remote>
```

Modules without UI:

```ts
import { loadModule } from 'vitral'

const api = await loadModule<typeof import('./types/cart-api')>('cart/api')
api.add(item)

const all = await loadModule('cart') // exports of the main file
```

- The parts share the same instances: a store used in `cart` and in `cart/api` is the same.
- `loadModule` goes through the same origin and SRI checks.
- A part that doesn't exist throws [`NOT_EXPOSED`](/en/erros/NOT_EXPOSED).

| Function | What it does |
| --- | --- |
| `exposes` (plugin) | Map of `'./name' → file` |
| `loadModule(name)` | Returns a module's exports |
| `loadRemote(name)` | Returns a remote's object with `mount`, without mounting |

Without the plugin, export the map yourself:

```ts
export default defineRemote({ mount })
export const exposes = {
  './MiniCart': () => import('./MiniCart'),
  './api': () => import('./api'),
}
```
