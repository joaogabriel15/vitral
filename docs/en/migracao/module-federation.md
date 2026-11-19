# Migrate from Module Federation

Module Federation shares modules between builds: host and remote agree on `remotes`, `exposes` and `shared` at build time. In vitral, the remote publishes a component with `mount`, and the host only knows the URL of `vitral.json`.

## With the command

```bash
npx vitral migrate --dry-run
npx vitral migrate
```

The command reads `name` and `exposes` from `ModuleFederationPlugin` (webpack, Rspack, Rsbuild) or from `federation()` (Vite). It generates one file in `src/vitral/` per exposed component, with the framework adapter, and a `vite.vitral.config.mjs` with the same `exposes`. The host asks for `cart/Cart`, as in Module Federation. The current build keeps generating `remoteEntry.js`. See what the command doesn't convert in [CLI](/en/referencia/cli#what-doesn-t-migrate).

## Equivalents

| Module Federation | vitral |
| --- | --- |
| `remotes` in the host plugin | `configure({ remotes })` at runtime, no plugin on the host |
| `remoteEntry.js` | `vitral.json` |
| `exposes: { './Cart': … }` | `export default reactRemote(Cart)` and `exposes` in the plugin. See [Exposes](/en/aprender/exposes) |
| `React.lazy(() => import('cart/Cart'))` | `<Remote name="cart" />` |
| `shared` with `singleton` | Each remote ships its own framework. Optional: [`dedupe`](/en/aprender/dedupe) |
| React component props | `props`, the same in any framework |
| `ErrorBoundary` around the lazy | `<Remote>`'s `error`, with `retry` |
| `dts-plugin` (types) | `npx vitral types`. See [Development](/en/aprender/desenvolvimento#props-types) |
| Modules without UI (functions, stores) | `loadModule('cart/api')` |

## Step by step: a React cart

### Before, in the remote

```js
// webpack.config.js (or rspack.config.js)
new ModuleFederationPlugin({
  name: 'cart',
  filename: 'remoteEntry.js',
  exposes: { './Cart': './src/Cart' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

### After, in the remote

Switch the remote's bundler to Vite, or keep the current bundler and output an ES module (see [Other bundlers](/en/referencia/vitral/configure#other-bundlers)).

```jsx
// src/remote.jsx
import { reactRemote } from 'vitral/react'
import Cart from './Cart'

export default reactRemote(Cart)
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/remote.jsx' })] }
```

The `Cart` component doesn't change.

### Before, in the host

```js
new ModuleFederationPlugin({
  name: 'shop',
  remotes: { cart: 'cart@https://cdn.example.com/cart/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```jsx
const Cart = React.lazy(() => import('cart/Cart'))

<ErrorBoundary fallback={<Failure />}>
  <Suspense fallback={<Loading />}>
    <Cart userId={42} />
  </Suspense>
</ErrorBoundary>
```

### After, in the host

Remove the federation plugin from the host build.

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { cart: 'https://cdn.example.com/cart/vitral.json' } })

<Remote
  name="cart"
  props={{ userId: 42 }}
  fallback={<Loading />}
  error={(error, retry) => <Failure onRetry={retry} />}
/>
```

### Migrate step by step

Migrate one remote at a time. There are two paths:

- The host keeps the federation plugin for the remotes that haven't migrated yet and uses `<Remote>` for those that have. When the last one leaves, remove the plugin.
- The host drops the federation plugin right away and mounts the remotes that haven't migrated with [`federationRemote`](/en/referencia/federation), which reads their `mf-manifest.json`:

```jsx
import { federationRemote } from 'vitral/federation'

configure({
  remotes: {
    cart: 'https://cdn.example.com/cart/vitral.json', // already migrated
    catalog: federationRemote('https://cdn.example.com/catalog/mf-manifest.json', {
      adapt: (m) => reactRemote(m.default),
      shared: { react: { version: React.version, modules: { react: React, 'react-dom': ReactDOM } } },
    }),
  },
})

<Remote name="catalog/Showcase" />
```

## What changes in behavior

- Each remote mounts in its own React root. The host's React context (`useContext`) doesn't cross into the remote; pass the value through props.
- Without `shared`, each remote downloads its own React. See [Dedupe](/en/aprender/dedupe).
- The host doesn't need a new build when a remote changes version: `vitral.json` is revalidated on every load.
