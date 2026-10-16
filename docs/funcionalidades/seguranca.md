# SRI e origens permitidas

Antes de executar o JS de um remote, a lib confere a origem e o hash. As duas checagens vêm ligadas.

## Quando usar

Sempre. Ajuste `allowedOrigins` quando os remotes vêm de mais de um CDN. Fixe `integrity` no host para remotes de terceiros.

## Origens permitidas

```ts
configure({
  allowedOrigins: ['https://cdn.empresa.com', 'https://static.parceiro.com'],
})
```

Sem `allowedOrigins`, valem a origem da página e as origens das URLs em `configure({ remotes })`. Um `vitral.json` não consegue apontar o JS para outra origem. URL fora da lista gera [`ORIGIN_BLOCKED`](/erros/ORIGIN_BLOCKED). `['*']` libera tudo: use só em desenvolvimento.

## Integridade (SRI)

O plugin grava o hash `sha384` do JS no `vitral.json`. Se o arquivo baixado não bater, o remote não roda e o erro é [`INTEGRITY`](/erros/INTEGRITY). O CSS do manifesto também é conferido.

O manifesto vem do mesmo CDN que o JS. Para proteger contra um CDN comprometido, fixe o hash no host:

```ts
configure({
  remotes: {
    pagamento: { url: 'https://cdn.parceiro.com/pagamento/vitral.json', integrity: 'sha384-…' },
  },
})
```

Ou embuta o manifesto inteiro com `{ url, manifest }`.

| Opção | Onde | O que faz |
| --- | --- | --- |
| `allowedOrigins` | `configure` | Origens de onde é permitido carregar código |
| `integrity` | entrada do remote | Hash do JS. Vence o do `vitral.json` |
| `manifest` | entrada do remote | `vitral.json` embutido no host |

Aceita `sha256`, `sha384` e `sha512`.

## CSP

Inclua a origem dos remotes em `script-src` e `connect-src`, e `blob:` em `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.empresa.com blob:; connect-src 'self' https://cdn.empresa.com
```

Se a página tem um `<script nonce>`, a lib usa o mesmo `nonce`.

## O que não é isolado

O remote roda com os privilégios da página. Shadow DOM isola o CSS, não o JS. Para código em que você não confia, use [iframe](./iframe).
