# Migrate from qiankun

qiankun loads a sub-app's HTML and runs its JS in a `Proxy` sandbox. vitral loads an ES module and mounts a component. To isolate the JS, use `isolate="iframe"`.

## Equivalents

| qiankun | vitral |
| --- | --- |
| `registerMicroApps([{ name, entry }])` | `configure({ remotes: { name: url } })` |
| `entry` with HTML | `vitral.json` or the URL of an ES module |
| `container` | The element the host component renders into |
| `activeRule` | The host's router renders `<Remote>` in the route. See [Routes](/en/aprender/rotas) |
| `loadMicroApp({ name, entry, container, props })` | `createSlot(el, { name, props })` |
| `bootstrap`, `mount`, `unmount`, `update` | `mount(el, props, ctx)` returning `{ update, unmount }` |
| `props` | `props` |
| `strictStyleIsolation` (Shadow DOM) | `isolate="shadow"` |
| `experimentalStyleIsolation` (prefix) | The plugin's scope, on by default |
| `initGlobalState` | [`provide` and `shared`](/en/aprender/contexto) |
| JS sandbox (`Proxy`) | `isolate="iframe"`. See [Iframe](/en/aprender/iframe) |
| `window.__POWERED_BY_QIANKUN__` | Not needed: the remote only runs through `mount` |
| `public-path.js` | `ctx.baseUrl` to build file URLs |

## Step by step: a Vue sub-app

### Before, in the sub-app

```js
// main.js
import './public-path'
import { createApp } from 'vue'
import App from './App.vue'

let app
function render(props = {}) {
  app = createApp(App)
  app.mount(props.container ? props.container.querySelector('#app') : '#app')
}
if (!window.__POWERED_BY_QIANKUN__) render()

export async function bootstrap() {}
export async function mount(props) { render(props) }
export async function unmount() { app.unmount() }
```

Plus the UMD build (`output.libraryTarget: 'umd'`) in webpack.

### After, in the remote

```js
// src/remote.js
import { vueRemote } from 'vitral/vue'
import App from './App.vue'

export default vueRemote(App, { setup: (app) => app.use(router) })
```

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral({ entry: 'src/remote.js' })] }
```

To run the sub-app alone in development, keep `main.js` with `createApp(App).mount('#app')`. It doesn't go into the remote build.

### Before, in the host

```js
import { registerMicroApps, start } from 'qiankun'

registerMicroApps([
  { name: 'catalog', entry: '//cdn.example.com/catalog/', container: '#sub-app', activeRule: '/catalog', props: { user } },
])
start()
```

### After, in the host

```vue
<script setup>
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalog: 'https://cdn.example.com/catalog/vitral.json' } })
</script>

<template>
  <VitralRemote name="catalog" :props="{ user }" />
</template>
```

Render the component on the `/catalog` route of the host's router.

## What changes in behavior

- The remote's JS runs directly on the page, without a `Proxy`. Code that changes `window` (globals, polyfills, listeners) stays changed after unmount. Clean up in `unmount` or use `isolate="iframe"`.
- The remote must be an ES module. UMD builds don't work.
- Integrity (SRI) and the allowed origins list apply to every remote. See [Security](/en/aprender/seguranca).
