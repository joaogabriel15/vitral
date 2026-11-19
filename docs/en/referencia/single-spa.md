# vitral/single-spa

Wraps a single-spa app's lifecycles in the `mount(el, props, ctx)` contract. The app doesn't change and keeps working in single-spa hosts.

```ts
singleSpaRemote<P>(lifecycles: SingleSpaLifecycles | { default: SingleSpaLifecycles }): RemoteModule<P>
```

## Usage

```js
// src/vitral-remote.js
import { singleSpaRemote } from 'vitral/single-spa'
import * as lifecycles from './main' // exports bootstrap, mount and unmount

export default singleSpaRemote(lifecycles)
```

```js
// vite.vitral.config.mjs
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default { plugins: [react(), vitral({ entry: 'src/vitral-remote.js' })] }
```

`npx vitral migrate` generates these two files. See [CLI](./cli#vitral-migrate).

Works with the lifecycles from `single-spa-react`, `single-spa-vue`, `single-spa-angular`, `single-spa-svelte` and with hand-written lifecycles. Each lifecycle can be a function or a list of functions.

## Behavior

| single-spa | `singleSpaRemote` |
| --- | --- |
| `bootstrap` | Runs once, before the first `mount`. If it fails, it runs again on the next mount |
| `mount(props)` | The host's `props` plus `name` (the remote's name) and `domElement` (the remote's element) |
| `unmount(props)` | Called by vitral's `unmount`. An error goes to the host's `onError` |
| `update(props)` (parcels) | Called by vitral's `update`. Without `update`, the app is unmounted and mounted with the new props |
| Lifecycles in sequence | A `mount` waits for the previous `unmount` to finish |

Two instances mounted at the same time get different `name`s (`account`, `account-2`), because single-spa adapters keep state by `name`.

## Limits

- `props.singleSpa`, `props.mountParcel` and `navigateToUrl` only exist in a single-spa host. Use `ctx.navigate` and `<Remote>`.
- To drop single-spa from the bundle, replace the wrapper with the framework adapter (`reactRemote(Root)`, `vueRemote(App)`). See [Migrate from single-spa](/en/migracao/single-spa).
