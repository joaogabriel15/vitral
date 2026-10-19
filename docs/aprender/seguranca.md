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

### Como o navegador confere

Quando o remote tem `import()`, o plugin publica também um build dividido, e o `vitral.json` traz o hash de cada arquivo em `files`. A lib usa o primeiro caminho que funciona no navegador:

| Caminho | Onde | Como |
| --- | --- | --- |
| Import map com `integrity` | Chrome 133+, Safari 18.4+ | Um import map com o hash de todo o JS do remote: entrada, chunks, `import()` e cópias de `dedupe`. O navegador confere cada arquivo, inclusive os `import()` feitos depois |
| `modulepreload` com `integrity` | Firefox, Chrome 127 a 132 | Cada arquivo entra por um `<link rel="modulepreload" integrity>` antes do `import()` |
| `blob:` | Os outros, e depois de uma falha | A lib baixa o arquivo único, confere os bytes e executa por `blob:` |

Antes de usar o import map, a lib confere que o hash dele vale: no primeiro mapa vão dois módulos `blob:` de teste com o mesmo hash, e o errado tem de falhar. Um navegador que recusa o mapa sem avisar, ou que aceita sem conferir, cai para o caminho seguinte. O CSS fica fora do mapa: o hash dele vai no `<link integrity>` ou no `fetch` do Shadow DOM.

## CSP

Inclua a origem dos remotes em `script-src` e `connect-src`, e `blob:` em `script-src`:

```
Content-Security-Policy: script-src 'self' https://cdn.empresa.com blob:; connect-src 'self' https://cdn.empresa.com
```

Se a página tem um `<script nonce>`, a lib usa o mesmo `nonce` no import map do SRI. Sem `nonce`, a CSP bloqueia esse mapa e a lib usa os outros caminhos.

## Overrides de desenvolvimento

`?vitral=nome@http://localhost:5174` troca a URL de um remote e descarta a `integrity` do host. Só funciona com a página em `localhost` ou com `configure({ devOverrides })`. Não ligue `devOverrides` em produção, nem na forma `{ preview }`: qualquer link com `?vitral=` executaria código de outra origem. O modelo `preview` não restringe as URLs aceitas, só resolve apelidos.

## SBOM

Com `sbom: true`, o plugin grava `sbom.cdx.json` ao lado do `vitral.json`: um SBOM [CycloneDX 1.6](https://cyclonedx.org/docs/1.6/json/) com os pacotes npm que entraram no bundle do remote.

```js
// vite.config.js do remote
plugins: [react(), vitral({ sbom: true })]
```

O Cyber Resilience Act (CRA) da UE exige que o fabricante de produtos com software vendidos na UE mantenha um SBOM deles a partir de 11 de dezembro de 2027. Cada remote é publicado sozinho, então cada um tem o seu.

O que entra:

| Campo | Conteúdo |
| --- | --- |
| `metadata.component` | O remote: nome, versão, purl e hash SHA-512 do JS publicado |
| `components` | Cada pacote com código no bundle: nome, versão, licença e purl (`pkg:npm/...`) |
| `dependencies` | Quem importa quem, entre o remote e esses pacotes |

A lista sai dos módulos do build, não do `package.json`: um pacote instalado que o tree-shaking removeu não aparece, e uma dependência transitiva que entrou aparece. Pacotes do workspace (fora de `node_modules`) entram pelo `package.json` mais próximo. Dependências que vêm do host (`shared`) não entram: estão no SBOM do host. As de `dedupe` entram, porque a cópia própria é publicada com o remote.

O `vitral.json` aponta para o arquivo, com o hash:

```json
"sbom": { "file": "sbom.cdx.json", "integrity": "sha384-…" }
```

O runtime não lê o SBOM. Para um build reproduzível, defina `SOURCE_DATE_EPOCH`: o `timestamp` sai dele e o número de série é derivado do conteúdo.

## O que não é isolado

O remote roda com os privilégios da página. Shadow DOM isola o CSS, não o JS. Para código em que você não confia, use [iframe](./iframe).
