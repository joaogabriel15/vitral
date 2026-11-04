# Svelte

Svelte 5 e SvelteKit. Import: `vitral/svelte`.

## Hoje e com vitral

Exemplo: uma loja em Svelte que mostra o carrinho de outra equipe.

### Hoje, com Module Federation

O Module Federation não tem adaptador para Svelte. O carrinho expõe uma função que monta o componente, e a loja chama essa função.

```js
// carrinho/src/montar.js
import { mount, unmount } from 'svelte'
import Carrinho from './Carrinho.svelte'

export function montar(el, props) {
  const app = mount(Carrinho, { target: el, props })
  return () => unmount(app)
}
```

```js
// carrinho/vite.config.js
federation({
  name: 'carrinho',
  filename: 'remoteEntry.js',
  exposes: { './montar': './src/montar.js' },
  shared: { svelte: { singleton: true } },
})
```

```svelte
<!-- loja/src/Pagina.svelte (a loja também tem o federation() com remotes) -->
<script>
  import { onMount } from 'svelte'
  let el

  onMount(() => {
    let desmontar
    import('carrinho/montar').then(({ montar }) => (desmontar = montar(el, { userId: 42 })))
    return () => desmontar?.()
  })
</script>

<div bind:this={el}></div>
```

### Com vitral

```js
// carrinho/vite.config.js (sem montar.js e sem federation)
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vitral from 'vitral/vite'

export default { plugins: [svelte(), vitral({ entry: 'src/Carrinho.svelte' })] }
```

```svelte
<!-- loja/src/Pagina.svelte (sem plugin no build da loja) -->
<script>
  import { configure } from 'vitral'
  import { remote } from 'vitral/svelte'

  configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })
</script>

<div use:remote={{ name: 'carrinho', props: { userId: 42 } }}></div>
```

Mudar `props` atualiza o carrinho sem remontar. Carregando e erro em [Host](#host).

## Host

Use a action `remote`:

```svelte
<script>
  import { configure } from 'vitral'
  import { remote } from 'vitral/svelte'

  configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

  let userId = $state(42)
  let status = $state('loading')
</script>

<div use:remote={{ name: 'carrinho', props: { userId }, onStatus: (s) => (status = s) }}></div>

{#if status === 'loading'}<p>Carregando…</p>{/if}
{#if status === 'error'}<p>Indisponível</p>{/if}
```

No SvelteKit a action só roda no cliente.

| Parâmetro | Tipo | O que faz |
| --- | --- | --- |
| `name` | `string` | Nome registrado em `configure` |
| `src` | `string` | URL do `vitral.json`. Dispensa `configure` |
| `props` | `object` | Props do remote |
| `isolate` | `'none' \| 'shadow' \| 'iframe'` | Isolamento |
| `onStatus` | `(status, erro) => void` | `'loading'`, `'ready'` ou `'error'` |
| `loading` | `'lazy' \| 'idle'` | Quando montar |
| `prefetch` | `'hover' \| 'visible' \| 'idle'` | Baixar antes de montar |
| `priority` | `'high'` | Prioridade alta nos downloads |
| `keepAlive` | `boolean \| number` | Guarda o remote montado ao sair da página |

## Remote

```svelte
<!-- src/Carrinho.svelte -->
<script>
  let { userId, vitral } = $props()
</script>

<button onclick={() => vitral.events.emit('carrinho:abrir', userId)}>Carrinho de {userId}</button>
```

```js
// vite.config.js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vitral from 'vitral/vite'

export default { plugins: [svelte(), vitral({ entry: 'src/Carrinho.svelte' })] }
```

Ou com o adaptador explícito: `export default svelteRemote(Carrinho)`.

O `ctx` chega na prop `vitral`.

## Estado compartilhado

`shared()` segue o contrato de store do Svelte:

```svelte
<script>
  import { shared } from 'vitral'
  const tema = shared('tema')
</script>

<p>{$tema}</p>
<button onclick={() => tema.set('escuro')}>Escuro</button>
```

Veja [Contexto compartilhado](/aprender/contexto).
