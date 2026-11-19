# Set up host and remote

Two sides. The **remote** (child) publishes a component. The **host** (parent) shows the component. The host uses no build plugin.

<div class="vt-split">
<div>

### Remote (child)

```jsx
// src/App.jsx
export default function Cart({ userId }) {
  return <p>Cart for {userId}</p>
}
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral()] }
```

`vite build` writes `dist/vitral.json`.

</div>
<div>

### Host (parent)

```jsx
// main.jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: {
    cart: 'https://cdn.example.com/cart/vitral.json',
  },
})

export const App = () => <Remote name="cart" props={{ userId: 42 }} />
```

No change to the host's `vite.config`.

</div>
</div>

## Remote

1. Export the component as `default`.
2. Add `vitral()` from `vitral/vite` to the plugins.
3. Run `vite build` and deploy `dist`.

The plugin detects the framework from the other Vite plugins and wraps the `export default`. An export that already has `mount` is used as is. That is why calling `reactRemote(App)` by hand is optional.

The default entry is `src/remote.*` or `src/App.*`. For another file:

```js
vitral({ entry: 'src/Cart.jsx' })
```

| Plugin option | What it does |
| --- | --- |
| `entry` | File whose `export default` is the remote |
| `dedupe` | Uses the page's React or Vue. See [Dedupe](./dedupe) |
| `exposes` | Publishes more parts. See [Exposes](./exposes) |
| `theme` | `'host'`: uses the host's CSS variables. See [Styles](./estilos) |
| `adapter` | `false`: uses the `export default` without wrapping it |

All options: [`vitral/vite`](/en/referencia/vite).

## Host

1. Call `configure` once, before rendering.
2. Use your framework's host component.

| Host framework | Component |
| --- | --- |
| React, Next | `<Remote name props>` from `vitral/react` |
| Vue, Nuxt | `<VitralRemote name :props>` from `vitral/vue` |
| Others | `<vitral-remote name props>` from `vitral/element` |

### `configure` options

| Option | Default | What it does |
| --- | --- | --- |
| `remotes` | none | Map of `name → vitral.json URL` (or a full entry), or the URL of a JSON file with that map |
| `allowedOrigins` | page and registered URLs | Origins code may be loaded from. `['*']` allows everything |
| `timeout` | `15000` | Maximum time for each download, in ms |
| `retries` | `1` | Extra attempts if a download fails |
| `isolate` | `'none'` | `'shadow'` or `'iframe'` for every remote |

Manifest cache, metrics, styles and the other options: [`configure`](/en/referencia/vitral/configure).

::: tip Note
Host and remote don't need to use the same framework. A React host shows a Vue remote.
:::
