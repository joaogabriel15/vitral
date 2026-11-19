# Vue

Vue 3.3 or newer. Import: `vitral/vue`.

## Today and with vitral

Example: a Vue shop shows the catalog, built by another team. Both sides have the same files, in the same order.

### Today, with Module Federation

```vue
<!-- catalog/src/Catalog.vue -->
<script setup>
defineProps({ userId: Number })
</script>

<template>
  <p>Catalog for user {{ userId }}</p>
</template>
```

```js
// catalog/vite.config.js
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    vue(),
    federation({
      name: 'catalog',
      filename: 'remoteEntry.js',
      exposes: { './Catalog': './src/Catalog.vue' },
      shared: { vue: { singleton: true } },
    }),
  ],
}
```

```js
// shop/vite.config.js
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    vue(),
    federation({
      name: 'shop',
      remotes: {
        catalog: { type: 'module', name: 'catalog', entry: 'https://cdn.example.com/catalog/remoteEntry.js' },
      },
      shared: { vue: { singleton: true } },
    }),
  ],
}
```

```vue
<!-- shop/src/App.vue -->
<script setup>
import { defineAsyncComponent } from 'vue'

const Catalog = defineAsyncComponent(() => import('catalog/Catalog'))
</script>

<template>
  <Suspense>
    <Catalog :user-id="42" />
    <template #fallback>Loading…</template>
  </Suspense>
</template>
```

### With vitral

```vue
<!-- catalog/src/Catalog.vue (same) -->
<script setup>
defineProps({ userId: Number })
</script>

<template>
  <p>Catalog for user {{ userId }}</p>
</template>
```

```js
// catalog/vite.config.js (vitral instead of federation)
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default {
  plugins: [
    vue(),
    vitral({ name: 'catalog', entry: 'src/Catalog.vue' }),
  ],
}
```

```js
// shop/vite.config.js (without federation)
import vue from '@vitejs/plugin-vue'

export default {
  plugins: [vue()],
}
```

```vue
<!-- shop/src/App.vue -->
<script setup>
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalog: 'https://cdn.example.com/catalog/vitral.json' } })
</script>

<template>
  <VitralRemote name="catalog" :props="{ userId: 42 }">
    <template #fallback>Loading…</template>
  </VitralRemote>
</template>
```

Full guide: [Migrate from Module Federation](/en/migracao/module-federation).

## Host

```vue
<script setup>
import { ref } from 'vue'
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalog: 'https://cdn.example.com/catalog/vitral.json' } })
const userId = ref(42)
const ready = (timings) => console.log(timings)
const failed = (error) => console.error(error.code)
</script>

<template>
  <VitralRemote name="catalog" :props="{ userId }" @ready="ready" @error="failed">
    <template #fallback>Loading…</template>
    <template #error="{ error, retry }">
      <button @click="retry">Try again</button>
    </template>
  </VitralRemote>
</template>
```

| Prop | Type | What it does |
| --- | --- | --- |
| `name` | `string` | Name registered in `configure` |
| `src` | `string` | URL of `vitral.json`. No `configure` needed |
| `props` | `object` | Remote props |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation |
| `loading` | `'lazy' \| 'idle'` | When to mount |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority for the downloads |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted when leaving the page |

| Slot or event | What it is |
| --- | --- |
| `#fallback` | Shown while loading |
| `#error="{ error, retry }"` | Shown if it fails. Without it, a default message with a "try again" button (in Portuguese) |
| `@ready` | Remote mounted. Receives the load timings |
| `@error` | Remote error |

## Remote

With the plugin, the component is enough:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral({ entry: 'src/Catalog.vue' })] }
```

To install plugins (Pinia, Vue Router, i18n) in the remote's app, use the adapter with `setup`:

```js
// src/remote.js
import { createPinia } from 'pinia'
import { vueRemote } from 'vitral/vue'
import Catalog from './Catalog.vue'

export default vueRemote(Catalog, {
  setup(app, ctx) {
    app.use(createPinia())
  },
})
```

## Context, events and state in the remote

```vue
<script setup>
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/vue'

const ctx = useVitral()
const total = useEventValue('cart:total')        // ShallowRef
useEvent('cart:cleared', () => alert('Empty'))
const theme = useShared('theme')                 // writable ref: theme.value = 'dark'
const name = useShared('user', (u) => u?.name)   // read-only
</script>
```

| Function | What it does |
| --- | --- |
| `useVitral()` | Returns the remote's `ctx` |
| `usePortalContainer()` | Target for `<Teleport :to>`. See [Portals](/en/aprender/estilos#portals-radix-headless-ui-mui) |
| `useEvent(type, fn)` | Subscribes to an event while the component exists |
| `useEventValue(type)` | Latest value of an event, as a `ShallowRef` |
| `useShared(key, selector?)` | Value from the [shared context](/en/aprender/contexto). Without a selector, it accepts writes |
