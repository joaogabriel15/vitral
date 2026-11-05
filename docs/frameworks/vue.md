# Vue

Vue 3.3 ou mais novo. Import: `vitral/vue`.

## Hoje e com vitral

Exemplo: uma loja em Vue mostra o catálogo, feito por outra equipe. Os dois lados têm os mesmos arquivos, na mesma ordem.

### Hoje, com Module Federation

```vue
<!-- catalogo/src/Catalogo.vue -->
<script setup>
defineProps({ userId: Number })
</script>

<template>
  <p>Catálogo do usuário {{ userId }}</p>
</template>
```

```js
// catalogo/vite.config.js
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    vue(),
    federation({
      name: 'catalogo',
      filename: 'remoteEntry.js',
      exposes: { './Catalogo': './src/Catalogo.vue' },
      shared: { vue: { singleton: true } },
    }),
  ],
}
```

```js
// loja/vite.config.js
import vue from '@vitejs/plugin-vue'
import { federation } from '@module-federation/vite'

export default {
  plugins: [
    vue(),
    federation({
      name: 'loja',
      remotes: {
        catalogo: { type: 'module', name: 'catalogo', entry: 'https://cdn.empresa.com/catalogo/remoteEntry.js' },
      },
      shared: { vue: { singleton: true } },
    }),
  ],
}
```

```vue
<!-- loja/src/App.vue -->
<script setup>
import { defineAsyncComponent } from 'vue'

const Catalogo = defineAsyncComponent(() => import('catalogo/Catalogo'))
</script>

<template>
  <Suspense>
    <Catalogo :user-id="42" />
    <template #fallback>Carregando…</template>
  </Suspense>
</template>
```

### Com vitral

```vue
<!-- catalogo/src/Catalogo.vue (igual) -->
<script setup>
defineProps({ userId: Number })
</script>

<template>
  <p>Catálogo do usuário {{ userId }}</p>
</template>
```

```js
// catalogo/vite.config.js (vitral no lugar do federation)
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default {
  plugins: [
    vue(),
    vitral({ name: 'catalogo', entry: 'src/Catalogo.vue' }),
  ],
}
```

```js
// loja/vite.config.js (sem o federation)
import vue from '@vitejs/plugin-vue'

export default {
  plugins: [vue()],
}
```

```vue
<!-- loja/src/App.vue -->
<script setup>
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalogo: 'https://cdn.empresa.com/catalogo/vitral.json' } })
</script>

<template>
  <VitralRemote name="catalogo" :props="{ userId: 42 }">
    <template #fallback>Carregando…</template>
  </VitralRemote>
</template>
```

Guia completo: [Migrar do Module Federation](/migracao/module-federation).

## Host

```vue
<script setup>
import { ref } from 'vue'
import { configure } from 'vitral'
import { VitralRemote } from 'vitral/vue'

configure({ remotes: { catalogo: 'https://cdn.empresa.com/catalogo/vitral.json' } })
const userId = ref(42)
const pronto = (tempos) => console.log(tempos)
const falhou = (erro) => console.error(erro.code)
</script>

<template>
  <VitralRemote name="catalogo" :props="{ userId }" @ready="pronto" @error="falhou">
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
| `#error="{ error, retry }"` | Mostrado se falhar. Sem ele, "Não foi possível carregar." com o botão "Tentar de novo" |
| `@ready` | Remote montado. Recebe os tempos de carregamento |
| `@error` | Erro do remote |

## Remote

Com o plugin, basta o componente:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral({ entry: 'src/Catalogo.vue' })] }
```

Para instalar plugins (Pinia, Vue Router, i18n) no app do remote, use o adaptador com `setup`:

```js
// src/remote.js
import { createPinia } from 'pinia'
import { vueRemote } from 'vitral/vue'
import Catalogo from './Catalogo.vue'

export default vueRemote(Catalogo, {
  setup(app, ctx) {
    app.use(createPinia())
  },
})
```

## Contexto, eventos e estado no remote

```vue
<script setup>
import { useVitral, useEvent, useEventValue, useShared } from 'vitral/vue'

const ctx = useVitral()
const total = useEventValue('carrinho:total')     // ShallowRef
useEvent('carrinho:limpo', () => alert('Vazio'))
const tema = useShared('tema')                    // ref gravável: tema.value = 'escuro'
const nome = useShared('usuario', (u) => u?.nome) // só leitura
</script>
```

| Função | O que faz |
| --- | --- |
| `useVitral()` | Devolve o `ctx` do remote |
| `usePortalContainer()` | Destino para `<Teleport :to>`. Veja [Portais](/aprender/estilos#portais-radix-headless-ui-mui) |
| `useEvent(tipo, fn)` | Assina um evento enquanto o componente existe |
| `useEventValue(tipo)` | Último valor de um evento, como `ShallowRef` |
| `useShared(chave, seletor?)` | Valor do [contexto compartilhado](/aprender/contexto). Sem seletor, aceita escrita |
