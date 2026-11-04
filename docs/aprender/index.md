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

## Hoje, com Module Federation

Exemplo: uma loja que mostra o carrinho de outra equipe. Com Module Federation, loja e carrinho combinam a configuração no build dos dois, e os dois precisam usar o mesmo framework:

```js
// carrinho/webpack.config.js
new ModuleFederationPlugin({
  name: 'carrinho',
  filename: 'remoteEntry.js',
  exposes: { './Carrinho': './src/Carrinho' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```js
// loja/webpack.config.js
new ModuleFederationPlugin({
  name: 'loja',
  remotes: { carrinho: 'carrinho@https://cdn.empresa.com/carrinho/remoteEntry.js' },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```jsx
// loja/src/App.jsx
const Carrinho = React.lazy(() => import('carrinho/Carrinho'))

<ErrorBoundary fallback={<p>Erro</p>}>
  <Suspense fallback={<p>Carregando…</p>}>
    <Carrinho userId={42} />
  </Suspense>
</ErrorBoundary>
```

Com vitral, o mesmo carrinho fica como nas duas seções abaixo. Só o carrinho tem plugin, a loja não muda o build, e o carrinho pode até ser de outro framework: aqui ele é Vue.

## O remote, com vitral

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

## O host, com vitral

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
