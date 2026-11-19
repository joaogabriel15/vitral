# NOT_EXPOSED

The host asked for a part of the remote (`cart/MiniCart` or `loadModule('cart/api')`) that the remote doesn't expose.

## Causes

- The part's name is wrong. The message lists the parts the remote exposes.
- The remote doesn't declare `exposes` in the plugin, or the new deploy hasn't reached the CDN yet.
- The remote's file doesn't export the `exposes` map (build without the plugin).

## How to fix

In the remote's `vite.config`:

```ts
vitral({
  entry: 'src/remote.tsx',
  exposes: { './MiniCart': 'src/MiniCart.tsx', './api': 'src/api.ts' },
})
```

Without the plugin, export the map in the remote's file:

```ts
export default reactRemote(Cart)
export const exposes = {
  './MiniCart': () => import('./MiniCart'),
  './api': () => import('./api'),
}
```

In the host, use the remote's name, a slash and the key without `./`:

```ts
<Remote name="cart/MiniCart" />
const api = await loadModule('cart/api')
```
