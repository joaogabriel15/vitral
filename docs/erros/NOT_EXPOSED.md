# NOT_EXPOSED

O host pediu uma parte do remote (`carrinho/MiniCarrinho` ou `loadModule('carrinho/api')`) que o remote não expõe.

## Causas

- O nome da parte está errado. A mensagem lista as partes que o remote expõe.
- O remote não declara `exposes` no plugin, ou o deploy novo ainda não chegou ao CDN.
- O arquivo do remote não exporta o mapa `exposes` (build sem o plugin).

## Como corrigir

No `vite.config` do remote:

```ts
vitral({
  entry: 'src/remote.tsx',
  exposes: { './MiniCarrinho': 'src/MiniCarrinho.tsx', './api': 'src/api.ts' },
})
```

Sem o plugin, exporte o mapa no arquivo do remote:

```ts
export default reactRemote(Carrinho)
export const exposes = {
  './MiniCarrinho': () => import('./MiniCarrinho'),
  './api': () => import('./api'),
}
```

No host, use o nome do remote, uma barra e a chave sem `./`:

```ts
<Remote name="carrinho/MiniCarrinho" />
const api = await loadModule('carrinho/api')
```
