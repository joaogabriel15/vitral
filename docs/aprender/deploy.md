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

## Contrato entre host e remote

Remote e host têm deploys separados. Um deploy do remote pode quebrar o host, por exemplo quando muda as props ou os eventos que usa. O contrato faz o host recusar um remote incompatível em vez de montá-lo.

No remote, declare a versão do contrato. Suba o primeiro número quando a mudança quebra o host:

```js
// vite.config.js do remote
vitral({ contract: { version: '2.1.0' } })
```

O `vitral.json` passa a ter:

```json
"contract": { "version": "2.1.0", "peers": { "react": "^19.0.0" } }
```

`peers` entra sozinho com `dedupe`: é a faixa de cada dependência que o remote espera receber do host.

No host, declare a faixa aceita, para todos os remotes ou para um só:

```ts
configure({
  contract: '^2',
  remotes: {
    carrinho: 'https://cdn.empresa.com/carrinho/vitral.json',
    busca: { url: 'https://cdn.empresa.com/busca/vitral.json', contract: '^1' },
  },
})
```

Antes de executar o remote, o host confere:

- se `contract.version` está na faixa;
- se cada dependência em `peers` que o host oferece com `dedupe` está na faixa do remote.

Se algo não serve, o remote não monta e o erro é [`CONTRACT_MISMATCH`](/erros/CONTRACT_MISMATCH). O `fallback` e o `error` do componente aparecem como em qualquer outro erro.

Sem `contract` em um dos lados, nada é conferido: manifestos antigos continuam funcionando. Use `contract: '*'` no host para conferir só as dependências.

## Voltar uma versão

Publique a versão anterior do `vitral.json`. O host baixa o JS antigo na próxima carga.

Para não depender de republicar, use um canal: cada versão fica na própria pasta e um `canal.json` diz qual vale. O canal também libera a versão nova para uma parte dos usuários e volta sozinho para a estável quando a nova dá erro. Veja [Canary e rollback](./canary).

Para um widget que outras empresas colam no site delas, com uma tag `<script>` só, veja [Widget em site de terceiros](./terceiros).
