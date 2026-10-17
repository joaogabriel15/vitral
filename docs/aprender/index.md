# Início rápido

Esta página mostra o vitral inteiro em poucos minutos. As próximas páginas explicam cada parte.

## O que você vai aprender

- O que é um remote e o que é um host
- Como publicar um remote
- Como mostrar um remote no host
- Como passar props e ouvir eventos

## Remote e host

Um **remote** é um componente publicado num CDN. O **host** é a página que mostra os remotes. O host só precisa da URL do `vitral.json` de cada remote.

```
host (React)              remote (Vue)
configure({ remotes })    vite build → dist/vitral.json
<Remote name="carrinho">  ← baixa e monta o remote
```

## O remote

Um componente comum, exportado como `default`:

```vue
<!-- src/App.vue -->
<script setup>
defineProps({ userId: Number })
</script>

<template>
  <p>Carrinho do usuário {{ userId }}</p>
</template>
```

O plugin do Vite gera o `vitral.json`:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral()] }
```

## O host

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export function App() {
  return <Remote name="carrinho" props={{ userId: 42 }} fallback={<p>Carregando…</p>} />
}
```

O host em React mostra um remote em Vue. Mudar `props` atualiza o remote sem remontar.

## Sem build no host

Numa página HTML qualquer:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

## O contrato

Todo remote, em qualquer framework, é um módulo com `mount`:

```ts
export default {
  mount(el, props, ctx) {
    el.textContent = `Olá, ${props.nome}`
    return {
      update(next) { el.textContent = `Olá, ${next.nome}` },
      unmount() { el.textContent = '' },
    }
  },
}
```

Os adaptadores de cada framework geram esse objeto para você.
