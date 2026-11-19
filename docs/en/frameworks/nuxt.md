# Nuxt

Nuxt 3 and 4. Import: `vitral/vue`.

## Today and with vitral

Example: a Nuxt shop with the "Catalog" area, built by another team. Both sides below have the same files, in the same order. With vitral, the shop gets two new files at the end.

### Today, with two Nuxt apps

```
shop/      main Nuxt app
catalog/   second Nuxt app
```

```vue
<!-- catalog/app/pages/index.vue -->
<template>
  <h1>Catalog</h1>
</template>
```

```ts
// catalog/nuxt.config.ts
export default defineNuxtConfig({
  app: { baseURL: '/catalog/' },
})
```

```ts
// shop/nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/catalog/**': { proxy: `${process.env.CATALOG_URL}/catalog/**` },
  },
})
```

```vue
<!-- shop/app/components/Menu.vue -->
<!-- <a>, not <NuxtLink>: the page reloads and downloads Nuxt and Vue again. -->
<a href="/catalog">Catalog</a>
```

### The same app with vitral

```
shop/      Nuxt app (the host)
catalog/   the same component, built with Vite (the remote)
```

```vue
<!-- catalog/app/pages/index.vue (same) -->
<template>
  <h1>Catalog</h1>
</template>
```

```js
// catalog/vite.config.js (instead of nuxt.config.ts)
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default {
  plugins: [
    vue(),
    vitral({ name: 'catalog', entry: 'app/pages/index.vue', dedupe: ['vue'] }),
  ],
}
```

```ts
// shop/nuxt.config.ts (without the proxy)
export default defineNuxtConfig({})
```

```vue
<!-- shop/app/components/Menu.vue -->
<!-- <NuxtLink>: switching has no reload. -->
<NuxtLink to="/catalog">Catalog</NuxtLink>
```

```ts
// shop/app/plugins/vitral.client.ts (new file: registers the catalog)
import * as Vue from 'vue'
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({
    remotes: { catalog: 'https://cdn.example.com/catalog/vitral.json' },
    dedupe: { vue: { version: Vue.version, modules: { vue: Vue } } }, // the catalog uses this Vue
  })
})
```

```vue
<!-- shop/app/pages/catalog/[...slug].vue (new file: the shop page that shows the catalog) -->
<script setup lang="ts">
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="catalog">
    <template #fallback><p>Loading…</p></template>
  </VitralRemote>
</template>
```

The server renders the `fallback` and the catalog mounts in the browser. No need for `<ClientOnly>`.

### What changes

| | Two Nuxt apps | vitral |
|---|---|---|
| Nuxt apps | One per area | Only the shop |
| Configuration | `baseURL` in the catalog, `proxy` in the shop | Plugin in the catalog, `configure()` in the shop |
| Switching areas | Full page reload | No reload |
| Vue and Nuxt | Downloaded again in each area | One copy of Vue for the whole page |
| Shop layout | Each app repeats its own | The catalog sits inside the shop's layout |

## Host

Call `configure` in a client-only plugin:

```ts
// app/plugins/vitral.client.ts
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({ remotes: '/remotes.json' })
})
```

```json
// public/remotes.json
{ "catalog": "https://cdn.example.com/catalog/vitral.json" }
```

Use the component on any page:

```vue
<script setup lang="ts">
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="catalog" :props="{ userId: 42 }">
    <template #fallback><p>Loading…</p></template>
    <template #error="{ retry }"><button @click="retry">Try again</button></template>
  </VitralRemote>
</template>
```

On the server the component renders the `fallback` slot. The remote mounts on the client. Props, slots and events are the same as in [Vue](./vue#host).

## Remote

A remote is not a Nuxt app. Create the remote as a [Vue](./vue#remote) project with Vite and use it in the Nuxt host.
