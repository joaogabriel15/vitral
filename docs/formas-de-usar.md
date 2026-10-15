# Mais formas de usar

Recursos opcionais sobre o mesmo contrato `mount(el, props, ctx)`.

## Vários componentes por remote

No remote, liste as partes no plugin. O `entry` continua sendo o remote inteiro.

```ts
// vite.config.ts do remote
vitral({
  entry: 'src/remote.tsx',
  exposes: {
    './MiniCarrinho': 'src/MiniCarrinho.tsx', // componente
    './api': 'src/api.ts',                    // módulo sem UI
  },
})
```

Um componente exposto exporta `default` com `mount`, como o remote:

```tsx
// src/MiniCarrinho.tsx
export default reactRemote(MiniCarrinho)
```

No host, use o nome do remote, uma barra e a chave sem `./`:

```tsx
<Remote name="carrinho/MiniCarrinho" props={{ compacto: true }} />
<vitral-remote name="carrinho/MiniCarrinho"></vitral-remote>
```

Funciona em todos os componentes de host, em `mountRemote`, `loadRemote` e `preload`.

## Módulos sem UI

```ts
import { loadModule } from 'vitral'

const api = await loadModule<typeof import('./tipos/carrinho-api')>('carrinho/api')
api.adicionar(item)

const tudo = await loadModule('carrinho') // exports do arquivo principal
```

`loadModule` passa pela mesma allowlist e pelo mesmo SRI dos componentes.

Como funciona:

- O plugin gera um arquivo só, com um `import()` por parte, e o manifesto ganha `exposes: ["./MiniCarrinho", "./api"]`.
- Um hash SRI cobre o arquivo inteiro.
- As partes dividem as mesmas instâncias de módulo: um store usado por `carrinho` e por `carrinho/api` é o mesmo objeto.
- Sem o plugin, exporte o mapa você mesmo:

```ts
export default defineRemote({ mount })
export const exposes = {
  './MiniCarrinho': () => import('./MiniCarrinho'),
  './api': () => import('./api'),
}
```

Erros: parte que não existe é [`NOT_EXPOSED`](erros/NOT_EXPOSED.md); módulo sem `mount` usado como componente é [`INVALID_MODULE`](erros/INVALID_MODULE.md).

## Atualização sem reload

Uma SPA aberta por horas vê o deploy novo de um remote:

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates() // revalida os manifestos a cada navegação

events.on<{ name: string; entry: string }>('vitral:update-available', ({ name }) => {
  refresh(name) // ou mostre um aviso e chame refresh quando o usuário quiser
})
```

- `watchUpdates()` revalida os manifestos dos remotes montados a cada `popstate` (o `navigate()` dispara um) e a cada navegação da Navigation API, onde ela existe. Devolve a função que desliga.
- Em navegadores sem Navigation API e com um roteador próprio, chame `checkUpdates()` na troca de rota. Ela devolve os nomes com versão nova.
- `vitral:update-available` sai uma vez por deploy novo, com `{ name, entry }`.
- `refresh('carrinho')` baixa a versão nova e troca cada montagem de `carrinho` (e de `carrinho/…`) pela nova, com as props atuais. Funciona em todos os componentes de host e em `mountRemote`.
- Se a versão nova não carregar, `refresh` rejeita e a antiga continua na tela. Se o `mount()` da nova falhar, a antiga também fica, e o erro vai para o console.
- Só remotes registrados pela URL do `vitral.json` são revalidados.

## Composição por rota

App shell sem framework: cada rota monta um remote.

```html
<script type="module">
  import { configure } from 'vitral'
  import { routes } from 'vitral/routes'

  configure({ remotes: '/remotes.json' })
  routes({
    '/checkout/*': 'checkout',     // /checkout e tudo abaixo
    '/conta': 'conta',             // só /conta
    '/produto/:id': 'produto',
    '/': 'inicio',
    '*': 'nao-encontrado',         // qualquer outra
  })
</script>

<nav><a href="/conta">Conta</a> <a href="/checkout">Checkout</a></nav>

<vitral-outlet isolate="shadow">
  <p slot="fallback">Carregando…</p>
  <p slot="error">Indisponível</p>
  <p slot="empty">Página não encontrada</p>
</vitral-outlet>
```

- A primeira rota que bate vence.
- O `<vitral-outlet>` troca de remote em `navigate()`, voltar e avançar, e nas navegações da Navigation API.
- Navegar dentro do mesmo remote (`/checkout/pagamento`) não remonta: o roteador do remote cuida da subrota.
- Links `<a href>` da mesma origem que batem com uma rota navegam sem recarregar, inclusive dentro de Shadow DOM. Desligue com `routes(mapa, { links: false })`.
- `outlet.props = {...}` passa props ao remote da rota. `outlet.route` diz qual está montado.
- `routes()` devolve a função que desfaz as rotas e a interceptação de links.
- `matchRoute('/produto/42')` devolve `{ name, pattern, params: { id: '42' } }`, para quem tem roteador próprio.

## Isolamento por iframe

Para código de terceiros ou legado que suja `window`. Não é o padrão.

```ts
import { enableIframe } from 'vitral/iframe'
enableIframe() // uma vez, no host
```

```html
<vitral-remote name="widget-parceiro" isolate="iframe" props='{"cor":"azul"}'></vitral-remote>
```

Também vale `<Remote isolate="iframe">`, `register('x', { url, isolate: 'iframe' })` e `configure({ isolate: 'iframe' })`.

- O remote roda num iframe `sandbox="allow-scripts"`, com origem opaca: não lê `parent.document`, cookies nem o storage do host.
- A página baixa o JS, confere origem e SRI, e manda os bytes verificados para o iframe. O JS do remote nunca roda na página.
- Props, `ctx.events` (`emit`, `on`, `last`) e `ctx.navigate` passam por `postMessage`. Só dados serializáveis: funções nas props somem, com um aviso no console.
- `ctx.navigate` só navega dentro da origem da página.
- A altura do iframe acompanha o conteúdo.
- O CSS do remote entra dentro do iframe, isolado de vez.
- `import { events } from 'vitral'` dentro do remote fala com uma cópia da lib que fica no iframe. Use `ctx.events`.
- Mais permissões: `enableIframe({ sandbox: 'allow-scripts allow-forms allow-popups' })`. Com `allow-same-origin` o iframe deixa de isolar (a lib avisa).
- Estado compartilhado (`provide`/`shared`) ainda não atravessa o iframe.

CSP: o iframe usa `srcdoc` e herda o CSP da página. Libere o hash do script do iframe e, com SRI, `blob:`:

```ts
import { createHash } from 'node:crypto'
import { FRAME_SCRIPT } from 'vitral/iframe'
console.log(`'sha256-${createHash('sha256').update(FRAME_SCRIPT).digest('base64')}'`)
// Content-Security-Policy: script-src 'self' blob: 'sha256-…' https://cdn.parceiro.com
```

O texto de `FRAME_SCRIPT` só muda entre versões da lib, então o hash vale para todo build.
