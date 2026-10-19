# Widget em site de terceiros

Um widget (chat, checkout, avaliações) que outras empresas colocam no site delas, sem bundler e sem instalar nada. O site cola uma tag:

```html
<div id="chat"></div>
<script
  src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js"
  data-remote="https://cdn.empresa.com/chat/canal.json"
  data-target="#chat"
  data-props='{"lang":"pt"}'
  async
></script>
```

O `embed.js` é um arquivo só, sem chunks, que roda como `<script>` clássico (com `async` ou `defer`). Ele monta um [`<vitral-remote>`](/referencia/element) dentro de `data-target`.

## Atributos

| Atributo | O que faz |
| --- | --- |
| `data-remote` | URL do canal do widget (`canal.json`) ou de um `vitral.json`. Obrigatório |
| `data-target` | Seletor do elemento onde o widget entra. Sem ele, entra logo depois do script (no fim do `<body>`, se o script está no `<head>`) |
| `data-props` | Props em JSON |
| `data-isolate` | `shadow` (padrão) ou `none` |
| `data-loading` | `lazy` ou `idle` |
| `data-name` | Nome do remote, em vez da URL |
| `data-origins` | Origens extras do JS e do CSS, separadas por espaço, quando não são a do manifesto |

Com `async`, o script pode rodar antes de o `data-target` existir. Nesse caso o loader espera o HTML terminar de carregar.

## Shadow DOM por padrão

O CSS do widget fica dentro de um shadow root: um `p { color: green }` do widget não pinta os parágrafos do site, e o CSS do site não quebra o widget.

Propriedades herdadas (`font-family`, `color`, `line-height`) atravessam o Shadow DOM. Defina-as no elemento raiz do widget se ele precisa de uma aparência fixa.

`data-isolate="none"` monta sem Shadow DOM, com o CSS no `<head>` do site. Use só se o CSS do widget tem escopo próprio.

## Origens permitidas

O loader libera só a origem do `data-remote` (e as de `data-origins`). Um `<vitral-remote src>` com outra origem, injetado no site por HTML de usuário (um comentário, um campo de perfil), falha com [`ORIGIN_BLOCKED`](/erros/ORIGIN_BLOCKED) e não executa nada.

Se o manifesto aponta o JS ou o CSS para outra origem, declare-a:

```html
<script src="…/embed.js" data-remote="https://api.empresa.com/chat/canal.json"
  data-origins="https://static.empresa.com" async></script>
```

## Falar com o widget

O site pode trocar as props e ouvir os eventos do elemento:

```js
const chat = document.querySelector('#chat vitral-remote')
chat.addEventListener('vitral-ready', () => console.log('chat pronto'))
chat.addEventListener('vitral-error', (e) => console.log(e.detail.error.code))
chat.props = { lang: 'en' }
```

Várias tags na mesma página funcionam. A primeira cópia do `embed.js` que roda atende as outras.

## Versões e canal

Cada versão do widget fica numa pasta que nunca muda. O canal (`canal.json`) diz qual versão os sites recebem. É o mesmo canal de [Canary e rollback](./canary): o `embed.js` já traz o código que o lê.

```
https://cdn.empresa.com/chat/
  canal.json                       { "stable": "1.4.2" }
  1.4.2/vitral.json, remote-[hash].js, remote.css
  1.5.0/vitral.json, …
```

Os sites apontam `data-remote` para o `canal.json` e nunca mais mudam a tag. Quem precisa de uma versão fixa aponta para a pasta dela (`/chat/1.4.2/vitral.json`).

Publicar uma versão sem mudar o que os sites recebem:

```js
// vite.config.js do widget
vitral({ versionDir: true }) // build em dist/<versão>/
```

```bash
npx vite build
aws s3 sync dist s3://cdn-empresa/chat/ --cache-control "public, max-age=31536000, immutable"
```

Depois, edite o canal com `vitral canal` e publique só ele:

```bash
npx vitral canal canal.json --stable 1.4.2                  # cria o canal
npx vitral canal canal.json --canary 1.5.0 --percent 10     # 10% dos visitantes recebem a 1.5.0
npx vitral canal canal.json --percent 50                    # 50%
npx vitral canal canal.json --stable 1.5.0 --canary off     # promove a 1.5.0
npx vitral canal canal.json --stable 1.4.2                  # volta para a 1.4.2

aws s3 cp canal.json s3://cdn-empresa/chat/canal.json --cache-control "no-cache"
```

Voltar uma versão é editar o canal: a próxima carga de página em cada site já usa a versão do canal, sem build e sem mexer na tag.

Quem recebe a canary é sorteado por um id guardado no `localStorage` do site, então o visitante não troca de versão a cada carga. Se a canary der erro, aquele navegador volta sozinho para a estável. Detalhes em [Canary e rollback](./canary).

## Cache

| Caminho | `Cache-Control` |
| --- | --- |
| `embed.js` com versão na URL (`vitral@0.4.0`) | `public, max-age=31536000, immutable` (o jsDelivr já manda) |
| `/chat/<versão>/*`, inclusive o `vitral.json` | `public, max-age=31536000, immutable` |
| `/chat/canal.json` | `no-cache` |

O loader sempre revalida o canal (com `ETag`, a resposta é um `304` pequeno). Por isso, uma edição do canal chega em todos os sites na próxima carga de página. Para poupar a origem, o CDN pode guardar o canal por pouco tempo (`s-maxage=60`): a edição leva até um minuto para chegar.

O CDN do widget precisa liberar CORS para qualquer site:

```
Access-Control-Allow-Origin: *
```

Não use `embed.js` sem versão na URL (`vitral/dist/embed.js`): uma versão nova da lib mudaria o widget em todos os sites sem aviso.

## CSP

Passe para o site uma das duas receitas. As duas foram testadas com o `embed.js`.

### Com nonce (recomendada)

O site já gera um `nonce` por resposta e o coloca na tag:

```
Content-Security-Policy:
  script-src 'nonce-{nonce}' 'strict-dynamic';
  connect-src 'self' https://cdn.empresa.com;
  style-src 'self' https://cdn.empresa.com
```

```html
<script nonce="{nonce}" src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js" data-remote="…" async></script>
```

Com `'strict-dynamic'`, o JS que o `embed.js` importa herda a confiança da tag. A lib usa o mesmo `nonce` no import map que confere o hash de cada módulo.

### Com a lista de origens

```
Content-Security-Policy:
  script-src 'self' https://cdn.jsdelivr.net https://cdn.empresa.com blob:;
  connect-src 'self' https://cdn.empresa.com;
  style-src 'self' https://cdn.empresa.com
```

Sem nonce, a CSP recusa os testes que a lib faz no navegador (um import map e dois módulos `data:`). O widget monta mesmo assim: o hash é conferido nos bytes, que rodam por `blob:`. As recusas aparecem no console e no `report-uri` do site, se houver.

### O que cada diretiva libera

| Diretiva | Para quê |
| --- | --- |
| `script-src` | O `embed.js` e o JS do widget. `blob:` só na receita sem nonce |
| `connect-src` | O canal, o `vitral.json` e o CSS do widget (no Shadow DOM, o CSS é baixado com `fetch`) |
| `style-src` | `@font-face` e `@property` do widget, que entram num `<link>` no documento |

## Fixar o hash do loader

A URL com versão nunca muda, então o site pode fixar o hash do `embed.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js"
  integrity="sha384-…" crossorigin="anonymous" data-remote="…" async></script>
```

```bash
curl -s https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/embed.js | openssl dgst -sha384 -binary | openssl base64 -A
```

O hash do JS do widget vem no `vitral.json` (veja [SRI e origens](./seguranca)).

## Tamanho

O `embed.js` tem cerca de 11 kB com brotli: o `<vitral-remote>`, o Shadow DOM, a conferência de hash e o canal num arquivo só. É o mesmo que um site com bundler baixaria com `vitral/auto`, mas numa requisição só.

## Sem tag de script

Num site que já carrega módulos, `vitral/auto` registra o `<vitral-remote>` direto:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral@0.4.0/dist/auto.js"></script>
<vitral-remote src="https://cdn.empresa.com/chat/canal.json" isolate="shadow"></vitral-remote>
```

Nesse caso, o site configura `allowedOrigins` se precisar (veja [SRI e origens](./seguranca)).
