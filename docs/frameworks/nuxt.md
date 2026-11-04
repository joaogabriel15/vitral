# Nuxt

Nuxt 3 e 4. Import: `vitral/vue`.

## Hoje e com vitral

Exemplo: uma loja em Nuxt com a área "Catálogo", feita por outra equipe.

### Hoje, com dois apps Nuxt

A loja repassa as URLs de `/catalogo` para o app do catálogo.

```
loja/       app Nuxt principal
catalogo/   segundo app Nuxt
```

```ts
// catalogo/nuxt.config.ts
export default defineNuxtConfig({
  app: { baseURL: '/catalogo/' },
})
```

```vue
<!-- catalogo/app/pages/index.vue -->
<template><h1>Catálogo</h1></template>
```

```ts
// loja/nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    '/catalogo/**': { proxy: `${process.env.CATALOGO_URL}/catalogo/**` },
  },
})
```

```vue
<!-- loja/app/components/Menu.vue -->
<!-- <a>, não <NuxtLink>: a página recarrega e baixa Nuxt e Vue de novo. -->
<a href="/catalogo">Catálogo</a>
```

### O mesmo app com vitral

A loja continua sendo o único app Nuxt. O catálogo vira um remote: um projeto Vite com o mesmo componente.

```
loja/       app Nuxt (o host)
catalogo/   projeto Vite (o remote)
```

```js
// catalogo/vite.config.js (no lugar do app Nuxt do catálogo)
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral({ name: 'catalogo', dedupe: ['vue'] })] }
```

```vue
<!-- catalogo/src/App.vue (o mesmo componente da página) -->
<template><h1>Catálogo</h1></template>
```

```ts
// loja/app/plugins/vitral.client.ts (no lugar do proxy)
import * as Vue from 'vue'
import { configure } from 'vitral'

export default defineNuxtPlugin(() => {
  configure({
    remotes: { catalogo: 'https://cdn.empresa.com/catalogo/vitral.json' },
    dedupe: { vue: { version: Vue.version, modules: { vue: Vue } } }, // o catálogo usa este Vue
  })
})
```

```vue
<!-- loja/app/pages/catalogo.vue (arquivo novo: a página que mostra o catálogo) -->
<script setup lang="ts">
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="catalogo">
    <template #fallback><p>Carregando…</p></template>
  </VitralRemote>
</template>
```

```vue
<!-- loja/app/components/Menu.vue -->
<!-- <NuxtLink> normal: a troca é sem recarregar. -->
<NuxtLink to="/catalogo">Catálogo</NuxtLink>
```

O servidor renderiza o `fallback` e o catálogo monta no navegador. Não precisa de `<ClientOnly>`.

### O que muda

| | Dois apps Nuxt | vitral |
|---|---|---|
| Apps Nuxt | Um por área | Só a loja |
| Configuração | `baseURL` no catálogo, `proxy` na loja | Plugin no catálogo, `configure()` na loja |
| Trocar de área | Recarrega a página | Sem recarregar |
| Vue e Nuxt | Baixados de novo em cada área | Uma cópia do Vue para a página toda |
| Layout da loja | Cada app repete o seu | O catálogo fica dentro do layout da loja |

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
