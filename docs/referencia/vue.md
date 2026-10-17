# vitral/vue

Host e remote em Vue 3.3 ou mais novo.

```ts
import { VitralRemote, vueRemote, useVitral, useEvent, useEventValue, useShared } from 'vitral/vue'
```

## &lt;VitralRemote&gt;

```vue
<script setup>
import { ref } from 'vue'
import { VitralRemote } from 'vitral/vue'

const userId = ref(42)
</script>

<template>
  <VitralRemote name="catalogo" :props="{ userId }" @error="(e) => console.error(e.code)">
    <template #fallback>Carregando…</template>
    <template #error="{ error, retry }">
      <button @click="retry">Tentar de novo</button>
    </template>
  </VitralRemote>
</template>
```

| Prop | Tipo | O que faz |
| --- | --- | --- |
| `name` | `string` | Nome registrado em `configure` |
| `src` | `string` | URL do `vitral.json`. Dispensa `configure` |
| `props` | `object` | Props do remote |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolamento |
| `loading` | `'lazy' \| 'idle'` | Quando montar |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Baixar antes de montar |
| `priority` | `'high'` | Prioridade alta nos downloads |
| `keepAlive` | `boolean \| number` | Guarda o remote montado ao sair da página |

| Slot ou evento | O que é |
| --- | --- |
| `#fallback` | Mostrado enquanto carrega |
| `#error="{ error, retry }"` | Mostrado se falhar |
| `@ready` | Remote montado. Recebe os tempos de carregamento |
| `@error` | Erro do remote |

No servidor (Nuxt), renderiza só o `#fallback`.

## vueRemote

```ts
vueRemote<P>(component: Component, options?: { setup?: (app, ctx) => void }): RemoteModule<P>
```

```js
import { createPinia } from 'pinia'
import { vueRemote } from 'vitral/vue'
import Catalogo from './Catalogo.vue'

export default vueRemote(Catalogo, {
  setup(app, ctx) {
    app.use(createPinia())
  },
})
```

`setup` instala plugins (Pinia, Vue Router, i18n) no app do remote. Com o plugin `vitral/vite` e sem plugins, o `export default` do componente basta.

## Composables

| Função | Retorno |
| --- | --- |
| `useVitral()` | O `ctx` do remote, ou `null` |
| `useEvent(tipo, fn)` | Nada. Assina enquanto o componente existe |
| `useEventValue(tipo)` | `ShallowRef` com o último valor |
| `useShared(chave)` | Ref gravável: `tema.value = 'escuro'` |
| `useShared(chave, seletor)` | `ComputedRef` só leitura |
