# Performance

## O que já acontece

- O host mínimo (`configure` + `createSlot`) tem orçamento de 4 kB com brotli. O CI mede a cada PR e falha se passar.
- Cada remote é baixado uma vez por página, mesmo com várias instâncias ou cópias da lib.
- O `vitral.json` é pedido com `cache: 'no-cache'`: o navegador revalida a cada carga e nunca usa um deploy velho.
- O JS e o CSS têm hash no nome. O cache deles pode ser eterno.
- Falha de rede ou `TIMEOUT` ao baixar o JS tenta de novo `retries` vezes (padrão 1), com espera de 200 ms, 400 ms, 800 ms…

## Cabeçalhos de cache no CDN

| Arquivo | `Cache-Control` |
| --- | --- |
| `vitral.json` | `no-cache` (com `ETag` ou `Last-Modified`) |
| `remote-*.js`, `remote-*.css` | `public, max-age=31536000, immutable` |

O remote também precisa de CORS: `Access-Control-Allow-Origin` com a origem do host ou `*`.

## Baixar antes

```ts
import { preload } from 'vitral'

preload('checkout') // baixa o manifesto e o JS, sem montar
```

Use no hover de um link ou logo depois da primeira tela.

## Tempo limite

```ts
configure({ timeout: 15000, retries: 1 })
```

`timeout` vale para cada download: `remotes.json`, `vitral.json` e o JS.

## Dependências compartilhadas

Por padrão cada remote leva o próprio React ou Vue, na própria root. Nunca há conflito de versão. Para baixar o framework uma vez só, tire-o do bundle e sirva por um import map no host:

```js
// vite.config.js do remote
vitral({ entry: 'src/remote.jsx', shared: ['react', 'react-dom', 'react-dom/client'] })
```

```html
<!-- host -->
<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.2.0",
      "react-dom/client": "https://esm.sh/react-dom@19.2.0/client"
    }
  }
</script>
```

A versão do import map vale para todos os remotes que usam `shared`. Todos precisam funcionar com ela.

::: info Em breve
Downloads de JS e CSS em paralelo, carregamento só quando o remote aparece na tela, keep-alive entre rotas, framework compartilhado com fallback por versão e métricas de carregamento para RUM.
:::
