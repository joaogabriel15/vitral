<script setup>
import { withBase } from 'vitepress'
</script>

# SRI e origens permitidas

Antes de executar o JS de um remote, a lib confere a origem. Se o remote tem hash (`integrity`), confere também os bytes. A checagem de origem vem ligada; a de hash depende de existir um hash.

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/seguranca.png')" alt="O host configura allowedOrigins e integrity. Antes de rodar, a lib confere a origem e o SHA-384. Se um dos dois falha, nada executa e o erro aparece no lugar do remote.">
  <img class="so-escuro" :src="withBase('/marca/seguranca-escuro.png')" alt="">
</picture>

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

Ou embuta o manifesto inteiro com `{ url, manifest }`, ou fixe a chave do remote (abaixo).

| Opção | Onde | O que faz |
| --- | --- | --- |
| `allowedOrigins` | `configure` | Origens de onde é permitido carregar código |
| `integrity` | entrada do remote | Hash do JS. Vence o do `vitral.json` |
| `manifest` | entrada do remote | `vitral.json` embutido no host |
| `keys` | entrada do remote | Chaves públicas Ed25519 do remote. Veja [Assinatura](#assinatura) |

Aceita `sha256`, `sha384` e `sha512`.

### Como o navegador confere

A lib usa o melhor caminho que o navegador tem: import map com `integrity` (Chrome 133+, Safari 18.4+), `<link rel="modulepreload" integrity>` (Firefox) ou, nos outros, baixa o arquivo, confere os bytes e executa exatamente o que conferiu. Em todos, chunks e `import()` do remote também são conferidos. Na primeira visita, o Chrome pode mostrar uma linha `Failed to find a valid digest` no console: é o teste que a lib faz para saber se o navegador confere o hash, e não é um erro do seu remote.

## Assinatura

Fixar o hash no host obriga a mudar o host a cada deploy do remote. Com a assinatura, o host fixa a chave pública do remote, e o remote continua publicando sozinho. Quem troca o JS e o `vitral.json` no CDN sem a chave privada não consegue fazer o arquivo rodar.

No remote, crie o par de chaves uma vez e guarde a privada como segredo do CI:

```bash
npx vitral sign --keygen
```

No CI, depois do build (e de `vitral dict`, se usar):

```bash
VITRAL_SIGNING_KEY="$(cat chave.pem)" npx vitral sign dist --base /carrinho/
```

O comando grava, para o `vitral.json`, cada `.js` e cada `.css`, os headers `Unencoded-Digest`, `Signature-Input` e `Signature`, em dois formatos:

- `dist/_headers`, que o Netlify e o Cloudflare Pages já leem. Se o arquivo existir, o resto dele fica como estava.
- `dist/vitral-signatures.json`, caminho público → headers, para outro servidor:

```ts
import signatures from './dist/vitral-signatures.json' with { type: 'json' }
app.use((req, res, next) => {
  const h = signatures[req.path]
  if (h) res.set(h)
  next()
})
```

`--base` é o caminho público da pasta no servidor (padrão: `/`). A assinatura cobre o hash do conteúdo sem compressão: gzip, brotli e os dicionários do `vitral dict` não a invalidam. Qualquer mudança no arquivo depois de `vitral sign` invalida.

No host:

```ts
configure({
  remotes: {
    carrinho: { url: 'https://cdn.empresa.com/carrinho/vitral.json', keys: ['<chave pública do vitral sign --keygen>'] },
  },
})
```

No Next, a mesma `keys` vai na entrada do remote no `withVitral`; o `remoteProps` de `vitral/next-server` também confere a assinatura do manifesto no servidor e, se não conferir, devolve `null`.

O Chrome 141+ só roda o arquivo se o hash bater e a assinatura for de uma das chaves. Os outros navegadores conferem só o hash. Para trocar de chave sem parar o remote, ponha as duas em `keys`, assine com a nova e depois tire a velha.

## CSP

Inclua a origem dos remotes em `script-src` e `connect-src`, e `blob:` em `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.empresa.com blob:; connect-src 'self' https://cdn.empresa.com
```

Se a página tem um `<script nonce>`, a lib usa o mesmo `nonce` no import map do SRI. Sem `nonce`, a CSP bloqueia esse mapa e a lib usa os outros caminhos.

Com `script-src 'self'` e o remote na mesma origem, o SRI também funciona sem `blob:`.

## Overrides de desenvolvimento

`?vitral=nome@http://localhost:5174` troca a URL de um remote e descarta a `integrity` do host. Só funciona com a página em `localhost` ou com `configure({ devOverrides })`. Não ligue `devOverrides` em produção, nem na forma `{ preview }`: qualquer link com `?vitral=` executaria código de outra origem.

## SBOM

Com `sbom: true`, o plugin grava `sbom.cdx.json` ao lado do `vitral.json`: um SBOM [CycloneDX 1.6](https://cyclonedx.org/docs/1.6/json/) com os pacotes npm que entraram no bundle do remote.

```js
// vite.config.js do remote
plugins: [react(), vitral({ sbom: true })]
```

O Cyber Resilience Act (CRA) da UE exige que o fabricante de produtos com software vendidos na UE mantenha um SBOM deles a partir de 11 de dezembro de 2027. Cada remote é publicado sozinho, então cada um tem o seu.

O SBOM lista os pacotes que de fato entraram no bundle, com versão, licença e quem importa quem. O `vitral.json` aponta para ele com o hash. Para um build reproduzível, defina `SOURCE_DATE_EPOCH`.

## O que não é isolado

O remote roda com os privilégios da página. Shadow DOM isola o CSS, não o JS. Para código em que você não confia, use [iframe](./iframe).
