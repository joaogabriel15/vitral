# Deploy

Cada remote tem o próprio deploy. O host vê a versão nova sem novo build.

## Publicar o remote

```bash
npx vite build
```

Envie a pasta `dist` para um CDN. O host precisa conseguir baixar os arquivos de outra origem: libere CORS.

```
Access-Control-Allow-Origin: https://www.empresa.com
```

## Cache no CDN

| Arquivo | `Cache-Control` |
| --- | --- |
| `vitral.json` | `no-cache` |
| `remote-*.js`, `remote-*.css` | `public, max-age=31536000, immutable` |

O `vitral.json` muda a cada deploy. Os outros arquivos têm hash no nome e nunca mudam.

## Origens e hash

O host só executa JS de origens permitidas e confere o hash de cada arquivo:

```ts
configure({
  allowedOrigins: ['https://cdn.empresa.com'],
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})
```

Detalhes em [SRI e origens](./seguranca).

## CSP

Inclua a origem dos remotes em `script-src` e `connect-src`, e `blob:` em `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.empresa.com blob:; connect-src 'self' https://cdn.empresa.com
```

## Versão nova sem recarregar

Para SPAs que ficam abertas por horas:

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates()
events.on('vitral:update-available', ({ name }) => refresh(name))
```

Veja [Atualização sem reload](./atualizacoes).

## Voltar uma versão

Publique a versão anterior do `vitral.json`. O host baixa o JS antigo na próxima carga.
