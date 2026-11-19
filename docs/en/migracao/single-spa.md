# Migrate from single-spa

single-spa and vitral use the same model: the remote exports lifecycle functions and the host mounts it. The difference is who picks the remote: in single-spa it's the root config, by route; in vitral it's the host component.

## With the command

```bash
npx vitral migrate --dry-run
npx vitral migrate
```

The command finds the file that exports the lifecycles and generates `src/vitral-remote.js`, `vite.vitral.config.mjs` and the `build:vitral` script. With `singleSpaReact` using only `rootComponent`, the remote uses `reactRemote(Root)`. In other cases, it uses [`singleSpaRemote`](/en/referencia/single-spa), which calls the app's lifecycles without changing it. The current build stays the same, for single-spa hosts. See what the command doesn't convert in [CLI](/en/referencia/cli#what-doesn-t-migrate).

## Equivalents

| single-spa | vitral |
| --- | --- |
| `registerApplication({ name, app })` | `configure({ remotes: { name: url } })` |
| Import map and SystemJS | `vitral.json` |
| `bootstrap`, `mount`, `unmount` | `mount(el, props, ctx)` returning `{ update, unmount }` |
| Parcel `update` | `update(props)`, always available |
| `customProps` | `props` |
| `activeWhen` | The host's router renders `<Remote>` in the route. See [Routes](/en/aprender/rotas) |
| `single-spa-react`, `single-spa-vue`… | `reactRemote`, `vueRemote`… |
| `mountRootParcel` | `<Remote>`, `<vitral-remote>` or `createSlot` |
| `navigateToUrl` | `navigate` |
| Root config without a framework | `<vitral-remote>` |
| Per-route layout without a framework | `routes()` and `<vitral-outlet>` |

## Step by step: a React app

### Before, in the remote

```jsx
import React from 'react'
import ReactDOMClient from 'react-dom/client'
import singleSpaReact from 'single-spa-react'
import Root from './Root'

const lifecycles = singleSpaReact({ React, ReactDOMClient, rootComponent: Root })
export const { bootstrap, mount, unmount } = lifecycles
```

### After, in the remote

```jsx
import { reactRemote } from 'vitral/react'
import Root from './Root'

export default reactRemote(Root)
```

With the `vitral/vite` plugin, the build writes `vitral.json`. With another bundler, output an ES module (not SystemJS) and register the JS URL.

### Before, in the root config

```js
import { registerApplication, start } from 'single-spa'

registerApplication({
  name: '@company/account',
  app: () => System.import('@company/account'),
  activeWhen: ['/account'],
  customProps: { authToken },
})
start()
```

### After, in the host

With a router:

```jsx
configure({ remotes: { account: 'https://cdn.example.com/account/vitral.json' } })

{ path: '/account/*', element: <Remote name="account" props={{ authToken }} /> }
```

Without a framework, use `vitral/routes`:

```html
<vitral-outlet></vitral-outlet>

<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({
    remotes: {
      account: 'https://cdn.example.com/account/vitral.json',
      checkout: 'https://cdn.example.com/checkout/vitral.json',
    },
  })
  routes({ '/account/*': 'account', '/checkout/*': 'checkout' })
</script>
```

See [Routes](/en/aprender/rotas).

## What changes in behavior

- There's no separate `bootstrap`. What ran there goes to the start of `mount` or to the top of the module.
- `update(props)` exists in every remote: changing props doesn't remount.
- A remote's failure stays in it. The component's `error` shows the error screen, and `retry` tries again.
