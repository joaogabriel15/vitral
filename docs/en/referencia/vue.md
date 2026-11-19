# vitral/vue

Host and remote in Vue 3.3 or newer.

```ts
import { VitralRemote, vueRemote, useVitral, usePortalContainer, useEvent, useEventValue, useShared } from 'vitral/vue'
```

## &lt;VitralRemote&gt;

```vue
<script setup>
import { ref } from 'vue'
import { VitralRemote } from 'vitral/vue'

const userId = ref(42)
</script>

<template>
  <VitralRemote name="catalog" :props="{ userId }" @error="(e) => console.error(e.code)">
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
| `props` | `object` | The remote's props |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolation |
| `loading` | `'lazy' \| 'idle'` | When to mount |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Download before mounting |
| `priority` | `'high'` | High priority for downloads |
| `keepAlive` | `boolean \| number` | Keeps the remote mounted when leaving the page |

| Slot or event | What it is |
| --- | --- |
| `#fallback` | Shown while loading |
| `#error="{ error, retry }"` | Shown if it fails |
| `@ready` | Remote mounted. Receives the load timings |
| `@error` | The remote's error |

On the server (Nuxt), it renders only `#fallback`.

## vueRemote

```ts
vueRemote<P>(component: Component, options?: { setup?: (app, ctx) => void }): RemoteModule<P>
```

```js
import { createPinia } from 'pinia'
import { vueRemote } from 'vitral/vue'
import Catalog from './Catalog.vue'

export default vueRemote(Catalog, {
  setup(app, ctx) {
    app.use(createPinia())
  },
})
```

`setup` installs plugins (Pinia, Vue Router, i18n) in the remote's app. With the `vitral/vite` plugin and no plugins, the component's `export default` is enough.

## Composables

| Function | Returns |
| --- | --- |
| `useVitral()` | The remote's `ctx`, or `null` |
| `usePortalContainer()` | Target for `<Teleport :to>`: [`ctx.portalContainer`](/en/aprender/estilos#portals-radix-headless-ui-mui), or `'body'` |
| `useEvent(type, fn)` | Nothing. Subscribes while the component exists |
| `useEventValue(type)` | `ShallowRef` with the last value |
| `useShared(key)` | Writable ref: `theme.value = 'dark'` |
| `useShared(key, selector)` | Read-only `ComputedRef` |
