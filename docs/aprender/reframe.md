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

Não precisa de `enable…()`. O código do modo é um chunk à parte (~2,8 kB brotli), baixado só na primeira montagem com `reframe`.

## O que acontece

- Cada montagem cria um `<iframe data-vitral-reframe>` com `display:none` no `body`. O unmount remove o iframe, e com ele os timers e os globais do remote.
- O JS passa pela mesma allowlist, manifesto, contrato e canal dos outros modos. Com `integrity`, a página confere os bytes do arquivo único e o iframe executa esses bytes via `blob:`.
- O CSS do remote entra no shadow root, igual a `isolate="shadow"` (inclusive `styles.inherit` e o tema).
- Cada remote tem o próprio registro de custom elements (Chrome 146+, Safari 26+). `customElements` e `HTMLElement` do iframe são os da página, então `class X extends HTMLElement` e `customElements.define` funcionam.

O `document` do iframe é corrigido:

| No remote | Vai para |
| --- | --- |
| `querySelector`, `querySelectorAll`, `getElementById`, `getElementsBy*` | shadow root |
| `createElement`, `createElementNS`, `createTextNode`… | documento da página |
| `document.head` | um `<div hidden>` no shadow root (`<style>` vale ali) |
| `document.body` | `ctx.portalContainer` (popovers e modais) |
| `document.documentElement` | `<html>` da página |
| `document.activeElement` | `shadowRoot.activeElement` |
| `addEventListener` | `document` da página |

E o `window` do iframe:

| No remote | Vai para |
| --- | --- |
| `addEventListener` (`resize`, `keydown`, `scroll`…) | `window` da página. Saem todos no unmount |
| `addEventListener` de `popstate`, `hashchange`, `message`, `error`, `unhandledrejection` | `window` do iframe |
| `innerWidth`, `innerHeight`, `devicePixelRatio`, `scrollX/Y`, `visualViewport` | `window` da página |
| `matchMedia`, `getComputedStyle`, `scrollTo`, `getSelection` | `window` da página |
| `setTimeout`, `setInterval`, `requestAnimationFrame` | iframe (param no unmount) |
| erros sem tratamento | `ctx.reportError` → `onError` |

## Rotas

O iframe nasce com a URL da página. Os dois históricos ficam em sincronia:

- `history.pushState`/`replaceState` do remote mudam a URL da página e disparam `popstate` nela (o mesmo efeito de `ctx.navigate`).
- Navegação da página (`popstate`, e qualquer `pushState` onde há Navigation API) atualiza a URL do iframe e dispara `popstate` (e `hashchange`) no iframe.

`location.href = '…'` e `location.assign()` no remote navegam o próprio iframe e derrubam o remote. Use `history.pushState` ou `ctx.navigate`.

## O que não é isolado

- **Mesma origem.** O remote alcança `parent`, `top`, os cookies, `localStorage`, `sessionStorage` e IndexedDB da página.
- **`instanceof` entre realms.** Elementos e eventos são da página; `Node`, `Element`, `Event`, `Array`, `Promise` são do iframe. `el instanceof Element` e `e instanceof MouseEvent` dão `false`. `HTMLElement` é exceção (é o da página). Use `nodeType`, `tagName`, `Array.isArray`.
- **`HTMLElement.prototype`** é o da página: o que o remote acrescentar ali vale para a página toda.
- **`document.documentElement` e `document.body` reais.** `document.documentElement.classList.add('dark')` muda o `<html>` da página. `document.body.style` muda o portal, não o `body` da página.
- **`<script>`** criado com `document.createElement('script')` e posto no `head` ou no `body` do remote roda no iframe. Um script posto direto em outro elemento do shadow root roda na página.
- **`getElementsBy*`** devolve uma `NodeList` estática, não uma `HTMLCollection` viva.
- **`dedupe`** não vale: o remote usa a própria cópia das dependências (o arquivo único). Uma dependência de outro realm quebraria `instanceof` e o estado do framework.
- **Build dividido e import map com `integrity`** não são usados: só o arquivo único, conferido byte a byte.
- **`prefetch` e `preload()`** executam o JS na página. Não use com remotes `reframe` (vale também para `iframe`).
- **`embed.js`** não tem este modo.
- **`devOverrides`** (`?vitral=`) não troca remotes `reframe`.

## CSP

A página põe um script inline no iframe. Sem `'unsafe-inline'`, libere o hash dele, ou ponha um `<script nonce>` na página (o vitral copia o nonce):

```
script-src 'sha256-zE2PiEdQK14jaNrBB8KHlUBNpc8NevOjcdUgA9xR0VQ=' blob:
```

`blob:` é necessário quando há `integrity`. Sem o script, a montagem falha com `LOAD_FAILED`.
