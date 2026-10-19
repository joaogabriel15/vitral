# vitral/svelte

Host e remote em Svelte 5 e SvelteKit.

```ts
import { remote, svelteRemote } from 'vitral/svelte'
```

## use:remote

```ts
remote(node: HTMLElement, params: RemoteActionParams): { update, destroy }
```

```svelte
<script>
  import { remote } from 'vitral/svelte'

  let userId = $state(42)
  let status = $state('loading')
</script>

<div use:remote={{ name: 'carrinho', props: { userId }, onStatus: (s) => (status = s) }}></div>

{#if status === 'error'}<p>Indisponível</p>{/if}
```

| Parâmetro | Tipo | O que faz |
| --- | --- | --- |
| `name` | `string` | Nome registrado em `configure` |
| `src` | `string` | URL do `vitral.json` |
| `props` | `object` | Props do remote |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolamento |
| `onStatus` | `(status, erro) => void` | `'loading'`, `'ready'` ou `'error'` |
| `loading` | `'lazy' \| 'idle'` | Quando montar |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Baixar antes de montar |
| `priority` | `'high'` | Prioridade alta |
| `keepAlive` | `boolean \| number` | Guarda o remote montado |

No SvelteKit a action só roda no cliente.

## svelteRemote

```ts
svelteRemote<P>(component: Component): RemoteModule<P>
```

```js
import { svelteRemote } from 'vitral/svelte'
import Carrinho from './Carrinho.svelte'

export default svelteRemote(Carrinho)
```

O componente recebe as props e o `ctx` na prop `vitral`. Com o plugin `vitral/vite`, o `export default` basta.

## Estado compartilhado

`shared()` de `vitral` funciona como store: `$tema` com `const tema = shared('tema')`.
