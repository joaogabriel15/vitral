# Migrar do qiankun

O qiankun carrega o HTML de um sub-app e roda o JS dele numa sandbox de `Proxy`. O vitral carrega um ES module e monta um componente. Para isolar o JS, use `isolate="iframe"`.

## Equivalências

| qiankun | vitral |
| --- | --- |
| `registerMicroApps([{ name, entry }])` | `configure({ remotes: { nome: url } })` |
| `entry` com HTML | `vitral.json` ou URL de um ES module |
| `container` | O elemento onde o componente do host renderiza |
| `activeRule` | O roteador do host renderiza `<Remote>` na rota. Veja [Rotas](/aprender/rotas) |
| `loadMicroApp({ name, entry, container, props })` | `createSlot(el, { name, props })` |
| `bootstrap`, `mount`, `unmount`, `update` | `mount(el, props, ctx)` devolvendo `{ update, unmount }` |
| `props` | `props` |
| `strictStyleIsolation` (Shadow DOM) | `isolate="shadow"` |
| `experimentalStyleIsolation` (prefixo) | Escopo do plugin, ligado por padrão |
| `initGlobalState` | [`provide` e `shared`](/aprender/contexto) |
| Sandbox de JS (`Proxy`) | `isolate="iframe"`. Veja [Iframe](/aprender/iframe) |
| `window.__POWERED_BY_QIANKUN__` | Não precisa: o remote só roda pelo `mount` |
| `public-path.js` | `ctx.baseUrl` para montar URLs de arquivos |

## Passo a passo: um sub-app Vue

### Antes, no sub-app

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

E o build em UMD (`output.libraryTarget: 'umd'`) no webpack.

### Depois, no remote

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

Para rodar o sub-app sozinho em desenvolvimento, mantenha o `main.js` com `createApp(App).mount('#app')`. Ele não entra no build do remote.

### Antes, no host

```js
import { registerMicroApps, start } from 'qiankun'

registerMicroApps([
  { name: 'catalogo', entry: '//cdn.empresa.com/catalogo/', container: '#sub-app', activeRule: '/catalogo', props: { usuario } },
])
start()
```

### Depois, no host

```vue
<script setup>
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalogo: 'https://cdn.empresa.com/catalogo/vitral.json' } })
</script>

<template>
  <VitralRemote name="catalogo" :props="{ usuario }" />
</template>
```

Renderize o componente na rota `/catalogo` do roteador do host.

## O que muda no comportamento

- O JS do remote roda direto na página, sem `Proxy`. Código que altera `window` (globais, polyfills, listeners) continua alterado depois do unmount. Limpe no `unmount` ou use `isolate="iframe"`.
- O remote precisa ser um ES module. Builds UMD não funcionam.
- A integridade (SRI) e a lista de origens permitidas valem para todos os remotes. Veja [Segurança](/aprender/seguranca).
