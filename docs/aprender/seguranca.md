# SRI e origens permitidas

Antes de executar o JS de um remote, a lib confere a origem. Se o remote tem hash (`integrity`), confere também os bytes. A checagem de origem vem ligada; a de hash depende de existir um hash.

## Quando usar

Sempre. Ajuste `allowedOrigins` quando os remotes vêm de mais de um CDN. Fixe `integrity` no host para remotes de terceiros.

## Origens permitidas

```ts
configure({
  allowedOrigins: ['https://cdn.empresa.com', 'https://static.parceiro.com'],
})
```

Sem `allowedOrigins`, valem a origem da página e as origens das URLs em `configure({ remotes })`. Um `vitral.json` não consegue apontar o JS para outra origem. URL fora da lista gera [`ORIGIN_BLOCKED`](/erros/ORIGIN_BLOCKED). `['*']` libera tudo: use só em desenvolvimento.

### Origens que entram sozinhas na lista

Algumas URLs entram na lista mesmo com `allowedOrigins` definido, porque são escritas por quem desenvolve o host:

| De onde vem a URL | Entra na lista? |
| --- | --- |
| `src` em `<Remote>`, `createSlot` e nos componentes de framework | Sim |
| `registerSrc(url)` (o terceiro argumento, `trusted`, é `true` por padrão) | Sim |
| `registerSrc(url, nome, false)` | Não |
| `src` em `<vitral-remote>` (atributo do HTML) | Não |
| Override de desenvolvimento (`?vitral=` ou o painel do devtools) | Sim, só em `localhost` ou com `devOverrides: true` |

Nunca passe para `src` uma URL que vem de dados (API, query string, CMS). Para isso, use `registerSrc(url, nome, false)` ou o `<vitral-remote src>`, que respeitam `allowedOrigins`.

## Integridade (SRI)

O plugin `vitral/vite` grava o hash `sha384` do JS e do CSS no `vitral.json`. Se o arquivo baixado não bater, o remote não roda e o erro é [`INTEGRITY`](/erros/INTEGRITY).

A conferência só acontece quando existe um hash. Sem `integrity` no host e sem hash no `vitral.json` (um manifesto escrito à mão, ou um remote registrado direto pela URL do JS), o JS é importado sem conferência.

O hash do `vitral.json` protege contra arquivo corrompido ou trocado no caminho, mas não contra um CDN comprometido: quem troca o JS pode trocar o manifesto junto. Para isso, fixe o hash no host:

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

## Overrides de desenvolvimento

`?vitral=nome@http://localhost:5174` troca a URL de um remote e descarta a `integrity` do host. Só funciona com a página em `localhost` ou com `configure({ devOverrides })`. Não ligue `devOverrides` em produção, nem na forma `{ preview }`: qualquer link com `?vitral=` executaria código de outra origem. O modelo `preview` não restringe as URLs aceitas, só resolve apelidos.

## O que não é isolado

O remote roda com os privilégios da página. Shadow DOM isola o CSS, não o JS. Para código em que você não confia, use [iframe](./iframe).
