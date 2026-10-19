# Vue

Vue 3.3 ou mais novo. Import: `vitral/vue`.

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
| `#error="{ error, retry }"` | Mostrado se falhar |
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
| `useEvent(tipo, fn)` | Assina um evento enquanto o componente existe |
| `useEventValue(tipo)` | Último valor de um evento, como `ShallowRef` |
| `useShared(chave, seletor?)` | Valor do [contexto compartilhado](/aprender/contexto). Sem seletor, aceita escrita |
