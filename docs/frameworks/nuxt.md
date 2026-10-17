# Nuxt

Nuxt 3 e 4. Import: `vitral/vue`.

## Host

Chame `configure` num plugin só do cliente:

```ts
// app/plugins/vitral.client.ts
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({ remotes: '/remotes.json' })
})
```

```json
// public/remotes.json
{ "catalogo": "https://cdn.empresa.com/catalogo/vitral.json" }
```

Use o componente em qualquer página:

```vue
<script setup lang="ts">
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="catalogo" :props="{ userId: 42 }">
    <template #fallback><p>Carregando…</p></template>
    <template #error="{ retry }"><button @click="retry">Tentar de novo</button></template>
  </VitralRemote>
</template>
```

No servidor o componente renderiza o slot `fallback`. O remote monta no cliente. As props, slots e eventos são os mesmos do [Vue](./vue#host).

## Remote

Um remote não é um app Nuxt. Crie o remote como um projeto [Vue](./vue#remote) com Vite e use-o no host Nuxt.
