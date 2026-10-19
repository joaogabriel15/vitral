# Exposes e loadModule

Um remote pode publicar vários componentes e módulos sem UI.

## Quando usar

Quando o mesmo time publica partes relacionadas (carrinho completo, mini carrinho, API do carrinho) e quer um deploy só.

## Código

```js
// vite.config.js do remote
vitral({
  entry: 'src/remote.tsx',
  exposes: {
    './MiniCarrinho': 'src/MiniCarrinho.tsx',
    './api': 'src/api.ts',
  },
})
```

```tsx
// src/MiniCarrinho.tsx
export default reactRemote(MiniCarrinho)
```

No host, use `remote/parte`:

```tsx
<Remote name="carrinho/MiniCarrinho" props={{ compacto: true }} />
<vitral-remote name="carrinho/MiniCarrinho"></vitral-remote>
```

Módulos sem UI:

```ts
import { loadModule } from 'vitral'

const api = await loadModule<typeof import('./tipos/carrinho-api')>('carrinho/api')
api.adicionar(item)

const tudo = await loadModule('carrinho') // exports do arquivo principal
```

- As partes dividem as mesmas instâncias: um store usado em `carrinho` e em `carrinho/api` é o mesmo.
- `loadModule` passa pela mesma checagem de origem e SRI.
- Parte que não existe gera [`NOT_EXPOSED`](/erros/NOT_EXPOSED).

| Função | O que faz |
| --- | --- |
| `exposes` (plugin) | Mapa `'./nome' → arquivo` |
| `loadModule(nome)` | Devolve os exports de um módulo |
| `loadRemote(nome)` | Devolve o objeto com `mount` de um remote, sem montar |

Sem o plugin, exporte o mapa você mesmo:

```ts
export default defineRemote({ mount })
export const exposes = {
  './MiniCarrinho': () => import('./MiniCarrinho'),
  './api': () => import('./api'),
}
```
