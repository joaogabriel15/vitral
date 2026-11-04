# Reframe

O JS do remote roda num iframe oculto, de mesma origem. O DOM fica num shadow root na página.

## Quando usar

Para remote que suja `window` (globais, timers, ouvintes esquecidos) e precisa de layout, foco e eventos normais da página. Para código de terceiros, use [Iframe](./iframe): o reframe não é fronteira de segurança.

| | `shadow` | `reframe` | `iframe` |
| --- | --- | --- | --- |
| Globais (`window.x`) | da página | do iframe | do iframe |
| Timers e ouvintes esquecidos | ficam | somem no unmount | somem no unmount |
| DOM | shadow root na página | shadow root na página | dentro do iframe |
| Layout, foco, popovers | normais | normais | presos no iframe |
| Props com funções | sim | sim | não (só dados serializáveis) |
| Lê `parent.document`, cookies, storage | sim | sim | não |

## Código

```html
<vitral-remote name="painel-legado" isolate="reframe"></vitral-remote>
```

```jsx
<Remote name="painel-legado" isolate="reframe" props={{ onSalvar }} />
```

```ts
register('painel-legado', { url: 'https://cdn.empresa.com/painel/vitral.json', isolate: 'reframe' })
await mountRemote(el, 'painel-legado', props, { isolate: 'reframe' })
```

O código desse modo só baixa na primeira montagem com `reframe`.

## O que acontece

Cada montagem cria um iframe oculto, e o unmount remove o iframe com os timers e os globais do remote. O CSS e o DOM ficam num shadow root na página, como em `isolate="shadow"`. Dentro do remote, `document` e `window` continuam funcionando: buscas no DOM vão para o shadow root, e `resize`, `scroll`, `matchMedia` e afins são os da página.

## Rotas

O iframe nasce com a URL da página. Os dois históricos ficam em sincronia:

- `history.pushState`/`replaceState` do remote mudam a URL da página e disparam `popstate` nela (o mesmo efeito de `ctx.navigate`).
- Navegação da página atualiza a URL do iframe e dispara `popstate` nele.

`location.href = '…'` e `location.assign()` no remote navegam o próprio iframe e derrubam o remote. Use `history.pushState` ou `ctx.navigate`.

## O que não é isolado

- **Mesma origem.** O remote alcança `parent`, `top`, os cookies, `localStorage`, `sessionStorage` e IndexedDB da página.
- **`instanceof` entre realms.** Elementos e eventos são da página; `Node`, `Element`, `Event`, `Array`, `Promise` são do iframe. `el instanceof Element` e `e instanceof MouseEvent` dão `false`. `HTMLElement` é exceção (é o da página). Use `nodeType`, `tagName`, `Array.isArray`.
- **`dedupe`** não vale: o remote usa a própria cópia das dependências (o arquivo único). Uma dependência de outro realm quebraria `instanceof` e o estado do framework.
- **`prefetch` e `preload()`** executam o JS na página. Não use com remotes `reframe` (vale também para `iframe`).
- **`embed.js`** não tem este modo.
- **`devOverrides`** (`?vitral=`) não troca remotes `reframe`.

## CSP

A página põe um script inline no iframe. Sem `'unsafe-inline'`, libere o hash dele, ou ponha um `<script nonce>` na página (o vitral copia o nonce):

```
script-src 'sha256-zE2PiEdQK14jaNrBB8KHlUBNpc8NevOjcdUgA9xR0VQ=' blob:
```

`blob:` é necessário quando há `integrity`. Sem o script, a montagem falha com `LOAD_FAILED`.
