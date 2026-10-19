# Seu primeiro host

O host é a página que mostra os remotes. Ele não muda o build: só chama `configure()` com as URLs.

## 1. Registre os remotes

```js
import { configure } from 'vitral'

configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})
```

Chame uma vez, antes de renderizar. As URLs também podem vir de um JSON: `configure({ remotes: '/remotes.json' })`.

## 2. Mostre o remote

```jsx
import { Remote } from 'vitral/react'

export function App() {
  return (
    <Remote
      name="carrinho"
      props={{ userId: 42 }}
      fallback={<p>Carregando…</p>}
      error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
    />
  )
}
```

- `fallback` aparece enquanto o remote baixa.
- `error` aparece se o remote falhar. O resto da página continua funcionando.
- Mudar `props` atualiza o remote sem remontar.

## 3. Aponte para o remote local

Em desenvolvimento, use a URL do `vite dev` do remote:

```js
configure({ remotes: { carrinho: 'http://localhost:5174/vitral.json' } })
```

## Outros frameworks

| Host | Componente |
| --- | --- |
| React, Next | `<Remote>` de `vitral/react` |
| Vue, Nuxt | `<VitralRemote>` de `vitral/vue` |
| Angular | `provideVitral()` e `<vitral-remote>` |
| Svelte | `use:remote` de `vitral/svelte` |
| Solid | `<Remote>` de `vitral/solid` |
| Preact | `<Remote>` de `vitral/preact` |
| HTML, Lit, outros | `<vitral-remote>` de `vitral/element` |

## Sem `configure`

Passe a URL direto no componente:

```jsx
<Remote src="https://cdn.empresa.com/carrinho/vitral.json" />
```
