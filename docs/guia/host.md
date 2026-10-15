# Host

O host é a página que mostra os remotes. Ele registra o nome e a URL de cada remote e usa o componente do próprio framework.

## Registrar os remotes

```ts
import { configure } from 'vitral'

configure({
  remotes: {
    carrinho: 'https://cdn.empresa.com/carrinho/vitral.json',
    menu: 'https://cdn.empresa.com/menu/vitral.json',
  },
})
```

Ou aponte para um JSON com o mesmo mapa. Assim o host troca a URL de um remote sem novo deploy:

```ts
configure({ remotes: '/remotes.json' })
```

```json
{ "carrinho": "https://cdn.empresa.com/carrinho/vitral.json" }
```

URLs relativas no `remotes.json` são resolvidas a partir dele. `configure` pode ser chamado mais de uma vez; as opções são mescladas. Todas as opções estão em [Configuração](./configuracao).

## Mostrar um remote

Todos os componentes de host recebem as mesmas coisas: `name`, `props`, `isolate`, o que mostrar enquanto carrega e o que mostrar em erro. Mudar `props` chama `update` no remote, sem remontar. Mudar `name` ou `isolate` remonta.

### React e Next.js

```jsx
import { Remote } from 'vitral/react'

<Remote
  name="carrinho"
  props={{ userId: 42 }}
  fallback={<p>Carregando…</p>}
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
  onError={(erro) => log(erro)}
/>
```

`<Remote>` já tem `'use client'`. No Next ele renderiza o `fallback` no servidor e monta o remote no cliente, no App Router e no Pages Router, sem `dynamic(..., { ssr: false })`.

### Vue e Nuxt

```vue
<script setup>
import { VitralRemote } from 'vitral/vue'
</script>

<template>
  <VitralRemote name="carrinho" :props="{ userId: 42 }" @error="log" @ready="pronto">
    <template #fallback>Carregando…</template>
    <template #error="{ error, retry }">
      <button @click="retry">Tentar de novo</button>
    </template>
  </VitralRemote>
</template>
```

No Nuxt, chame `configure()` num plugin `.client.ts`. No servidor o componente renderiza só o `fallback`.

### Angular

```ts
// main.ts
import { provideVitral } from 'vitral/angular'

bootstrapApplication(App, {
  providers: [provideVitral({ remotes: '/remotes.json' })],
})
```

```ts
@Component({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<vitral-remote name="carrinho" [props]="{ userId: id() }" (vitral-error)="falhou($event)"></vitral-remote>`,
})
export class Pagina {}
```

`provideVitral` chama `configure` e registra `<vitral-remote>`. No SSR do Angular ele não faz nada; o remote monta no cliente.

### Svelte e SvelteKit

```svelte
<script>
  import { remote } from 'vitral/svelte'
  let userId = $state(42)
</script>

<div use:remote={{ name: 'carrinho', props: { userId }, onStatus: (status, erro) => {} }}></div>
```

### Solid e Preact

```jsx
import { Remote } from 'vitral/solid' // ou 'vitral/preact'

<Remote
  name="carrinho"
  props={{ userId: id() }}
  fallback={<p>Carregando…</p>}
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
/>
```

### HTML puro e qualquer outro lugar

`<vitral-remote>` funciona em qualquer página: HTML puro, Astro, Qwik, Lit ou HTML gerado no servidor.

```html
<script type="module">
  import { configure } from 'vitral'
  import { defineVitralElement } from 'vitral/element'

  configure({ remotes: '/remotes.json' })
  defineVitralElement()
</script>

<vitral-remote name="carrinho" props='{"userId": 42}' isolate="shadow">
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
</vitral-remote>
```

```js
const el = document.querySelector('vitral-remote')
el.props = { userId: 43 }                  // atualiza sem remontar
el.retry()                                 // remonta
el.addEventListener('vitral-ready', () => {})
el.addEventListener('vitral-error', (e) => console.log(e.detail.error.code))
el.status                                  // 'loading' | 'ready' | 'error'
```

O atributo `props` precisa ser JSON. Para passar funções ou objetos grandes, use a propriedade `el.props`.

### Sem componente

`createSlot` é a base de todos os componentes de host. Use quando integrar o vitral em algo próprio:

```ts
import { createSlot } from 'vitral'

const slot = createSlot(document.querySelector('#carrinho'), {
  name: 'carrinho',
  props: { userId: 42 },
  onStatus(status, erro) {
    if (erro) console.log(erro.code, erro.docs)
  },
})

slot.update({ userId: 43 })
slot.set({ name: 'carrinho-v2' }) // remonta
slot.retry()
slot.destroy()
```

## Erros

Falhas de carregamento e erros reportados pelo remote aparecem no `error` do componente. Isso não isola JavaScript nem captura toda exceção possível. `retry` monta só aquele remote de novo. Todo erro é um `RemoteError` com `code`, `remote` e `docs`, o link da página do código. A lista está em [Erros](/erros/).

## Baixar antes de mostrar

`preload` começa o download sem montar. Use no hover de um link ou quando o usuário vai precisar do remote logo:

```ts
import { preload } from 'vitral'

link.addEventListener('mouseenter', () => preload('checkout'), { once: true })
```

O remote é baixado uma vez só por página, mesmo com várias instâncias.

Também pode usar a URL direto: `<Remote src="https://cdn.empresa.com/produtos/vitral.json" />`. Para vários repositórios, veja [Conectar projetos existentes](./repositorios).
