# vitral

## 0.2.0

### Minor Changes

- [#5](https://github.com/joaogabriel15/vitral/pull/5) [`8fb08cf`](https://github.com/joaogabriel15/vitral/commit/8fb08cf80a2a31fc5c584c9d44c5ce058620eac2) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Base para a 1.0, sem mudança na API:

  - `integrity` aceita o formato SRI completo (`sha256`, `sha384`, `sha512`, vários hashes; vale o mais forte) e o hash é conferido sobre os bytes baixados. O erro mostra o hash esperado e o obtido.
  - Todo `RemoteError` tem `docs`, o link da página do código de erro.
  - Cópias diferentes da lib na mesma página compartilham o estado por um protocolo versionado em `Symbol.for('vitral')`. O remote recebe `ctx.protocol`.
  - Node 20.19 ou mais novo.

- [#32](https://github.com/joaogabriel15/vitral/pull/32) [`ca76294`](https://github.com/joaogabriel15/vitral/commit/ca7629486cac97d9734e446342d3b8246028cb50) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Remote sem adaptador: com `vitral()` no `vite.config`, basta `export default App`. O plugin descobre o framework pelos plugins do Vite (React, Vue, Svelte, Solid, Preact, Angular) e embrulha o export com o adaptador certo. Sem plugin de framework, uma classe de Web Component vira `elementRemote` e uma função vira `component`. Um export com `mount` é usado como está.

  - `entry` ficou opcional: o padrão é `src/remote.*` ou `src/App.*`.
  - Opção `adapter` para forçar um adaptador (`'react'`, `'vue'`…) ou desligar (`false`).

- [#33](https://github.com/joaogabriel15/vitral/pull/33) [`a746087`](https://github.com/joaogabriel15/vitral/commit/a746087ecff4751f5c3862f51cee88922cabe6ef) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Modo dev com HMR: em `vite dev`, o plugin serve `/vitral.json` apontando para um módulo de desenvolvimento, com CORS e sem SRI. O módulo carrega o cliente HMR do Vite e, em React, o preâmbulo do Fast Refresh pela origem do remote. Editar o remote atualiza o host sem recarregar a página; onde o framework não tem HMR, só aquele remote é remontado. O CSS de dev sai com o mesmo escopo do build, e `server.origin` passa a apontar para o remote.

- [#34](https://github.com/joaogabriel15/vitral/pull/34) [`85301b3`](https://github.com/joaogabriel15/vitral/commit/85301b3054a849a7eb4f57d1c8cf30a8a8143aa9) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Overrides para desenvolver contra outro ambiente: `?vitral=carrinho@http://localhost:5174` ou `localStorage['vitral:overrides']` troca a URL de um remote. Só valem com a página em localhost ou com `configure({ devOverrides: true })`. O código fica num módulo à parte, baixado só quando há um override pedido.

  Nova entrada `vitral/devtools`: `devtools()` mostra um painel para salvar e remover overrides, e `getOverrides()` / `setOverride(nome, url)` fazem o mesmo por código.

- [#31](https://github.com/joaogabriel15/vitral/pull/31) [`307b859`](https://github.com/joaogabriel15/vitral/commit/307b8595667fb1a6f04c08543d8205ae189290da) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Host sem `configure()`:

  - `src` no `<vitral-remote>` e em todos os componentes de host (`<Remote src>`, `<VitralRemote src>`, `use:remote={{ src }}`). O remote fica registrado com o nome do manifesto, que chega em `ctx.name`.
  - A origem de um `src` passado a um componente entra na allowlist, mesmo com `allowedOrigins`. O `src` em atributo do `<vitral-remote>` continua passando pela allowlist.
  - `registerSrc(src, name?)` para registrar uma URL e receber o nome.
  - `vitral/auto`: importar define o `<vitral-remote>`. Serve para HTML sem build: `<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js">`.
  - Sem os slots `fallback` e `error`, o `<vitral-remote>` mostra um carregando com `role="status"` e um erro com "Tentar de novo".

- [#35](https://github.com/joaogabriel15/vitral/pull/35) [`95304de`](https://github.com/joaogabriel15/vitral/commit/95304defe5c6e5ee071932c913be8ddf6520fcc8) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Tipos das props entre deploys. O build do remote publica `vitral.d.ts` com o tipo das props do `export default` (desligue com `vitral({ types: false })`). No host, `npx vitral types` baixa esses arquivos e gera `vitral-env.d.ts`; com ele, `<Remote name="carrinho" props={…}>` (React, Preact, Solid) e `PropsOf<'carrinho'>` acusam prop errada na compilação.

- [#14](https://github.com/joaogabriel15/vitral/pull/14) [`9677411`](https://github.com/joaogabriel15/vitral/commit/96774116d9934812bf68508a6bc888821a1a0c0f) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Extras do contexto compartilhado, todos opcionais e fora do store:

  - `persist(valor, { storage, version })` guarda o valor em `localStorage` ou `sessionStorage`, com chave versionada.
  - `syncTabs(valor)` espelha as mudanças entre abas com `BroadcastChannel`.
  - `serializeShared(valores)` gera o JSON do `<script type="application/json" data-vitral-shared>` no SSR.
  - `shared(chave).key` devolve a chave.
  - Guia em `docs/contexto.md`, com quando usar props, `shared` ou `events`.

- [#13](https://github.com/joaogabriel15/vitral/pull/13) [`86ea4e2`](https://github.com/joaogabriel15/vitral/commit/86ea4e2775392d2f1887c89d9b15f29089c12c05) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Hooks do contexto compartilhado em cada framework. Todos re-renderizam só quando o valor muda; com seletor, só quando o resultado do seletor muda (`Object.is`). A assinatura acaba junto com o componente.

  ```ts
  const nome = useShared("usuario", (u) => u?.nome); // React e Preact: o valor
  const usuario = useShared("usuario"); // Vue: ref (escreve com .value); Solid: accessor
  usuario = injectShared("usuario"); // Angular: Signal
  const tema = shared("tema"); // Svelte: $tema (contrato de store)
  usuario = new SharedController(this, "usuario"); // Lit (vitral/element): this.usuario.value
  ```

- [#12](https://github.com/joaogabriel15/vitral/pull/12) [`e2c5970`](https://github.com/joaogabriel15/vitral/commit/e2c597042344dbc3cf7746eeb637f57d4a82c3b4) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Contexto compartilhado: `provide` cria uma chave e vira dono dela, `shared` lê, altera e assina, e `batch` agrupa mudanças numa notificação. Host e remotes veem o mesmo valor, mesmo com cópias diferentes da lib na página.

  ```ts
  import { provide, shared } from "vitral";

  const usuario = provide("usuario", { id: 42, nome: "Ana" });
  provide("tema", "claro", { writable: false }); // só o dono altera
  shared("tema").subscribe((tema) => console.log(tema));
  usuario.set({ id: 7, nome: "Bia" });
  ```

  - Tipos por chave com `declare module 'vitral' { interface Shared { … } }`.
  - `set` numa chave com `writable: false` sem ser o dono lança `SHARED_READONLY` em desenvolvimento e é ignorado com aviso em produção.
  - `ctx.shared` no remote: as assinaturas são canceladas e as chaves soltas no unmount.
  - No servidor nada fica em variável global. No cliente, o store lê os valores do `<script type="application/json" data-vitral-shared>`.
  - O store fica fora do host mínimo: só entra no bundle de quem usa.

- [#17](https://github.com/joaogabriel15/vitral/pull/17) [`1aa29a1`](https://github.com/joaogabriel15/vitral/commit/1aa29a13718cd9f109031dbf55e0dfa09da1fce4) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Duas opções novas no plugin Vite para o CSS do remote conviver com o CSS do host no modo escopo:

  - `layers: 'flatten'` tira os `@layer` do CSS do remote mantendo a ordem. Assim o CSS sem camada do host (Tailwind v3, CSS legado) não vence mais os utilitários do Tailwind v4 do remote.
  - `renameRegisteredProperties: true` renomeia as propriedades `--tw-*` registradas com `@property` para `--tw-<escopo>-*`. Assim um host com Tailwind v3 mantém os gradientes com um remote v4 na página.

  ```ts
  vitral({
    entry: "src/remote.tsx",
    layers: "flatten",
    renameRegisteredProperties: true,
  });
  ```

  As duas ficam desligadas por padrão.

- [#18](https://github.com/joaogabriel15/vitral/pull/18) [`809ffb2`](https://github.com/joaogabriel15/vitral/commit/809ffb231868269d8b0b2b7d797ce1fb3d6e9122) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Estilos do host no Shadow DOM (`isolate: 'shadow'`):

  - `@font-face` do remote sobe para o documento, sem duplicar. Antes a fonte própria do remote não carregava no Chrome nem no Firefox.
  - `@import` no CSS do remote vira outra folha adotada no shadow root, antes da que importa. Antes era ignorado. A URL importada precisa de CORS (o Google Fonts tem).
  - CSS base do host no shadow root, um `CSSStyleSheet` por arquivo compartilhado entre todos os remotes:

    ```ts
    configure({ styles: { inherit: ["/assets/base.css"] } });
    ```

    ```html
    <vitral-remote
      name="carrinho"
      isolate="shadow"
      inherit-styles="/assets/base.css"
    ></vitral-remote>
    ```

  - `class` e `data-theme` do `<html>` são copiados para a raiz do remote, então `dark:` e `[data-theme]` funcionam no Shadow DOM. Para desligar: `configure({ styles: { mirrorTheme: false } })`.

  O código do Shadow DOM saiu do núcleo para um módulo carregado só quando um remote usa `isolate: 'shadow'`. O host mínimo ficou menor (3,38 kB para 3,26 kB).

- [#16](https://github.com/joaogabriel15/vitral/pull/16) [`4d3ea46`](https://github.com/joaogabriel15/vitral/commit/4d3ea46648a754bf8dd89f8c2f18bd33933ea5c2) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Opção `theme: 'host'` no plugin Vite: o remote usa as variáveis do tema do host quando elas existem e as próprias quando não existem.

  ```ts
  vitral({ entry: "src/remote.tsx", theme: "host" });
  ```

  O plugin tira as variáveis de `:root`/`:host` do CSS do remote e troca cada `var(--x)` por `var(--x, <valor do build>)`, o mesmo resultado do `theme(reference)` do Tailwind v4. Desligado por padrão.

- [#43](https://github.com/joaogabriel15/vitral/pull/43) [`f84cb0f`](https://github.com/joaogabriel15/vitral/commit/f84cb0f7ea0df33a4a032a866886210d8007ac85) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `dedupe` no plugin Vite (`vitral({ dedupe: ['react'] })`): o remote usa o framework que já está na página, se a versão estiver na faixa (padrão `^` da versão instalada; exata para Svelte e Angular), ou a própria cópia, que vira um chunk separado. O `<Remote>` de `vitral/react` oferece o React do host sem configuração, e `configure({ dedupe })` cobre os outros casos. Sem nada na página, o primeiro remote oferece a própria cópia aos outros desde o início do download, então três remotes React baixam o React uma vez. O protocolo ganha o método `dedupe`, instalado sob demanda. A opção `shared` (import map) continua funcionando e passa a ser obsoleta.

- [#40](https://github.com/joaogabriel15/vitral/pull/40) [`7ea039d`](https://github.com/joaogabriel15/vitral/commit/7ea039dbb2588f693c39352671bdf4d0007f4d91) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Carregamento sob demanda e keep-alive nos componentes de host (React, Vue, Preact, Solid, Svelte) e no `<vitral-remote>`: `loading="lazy|idle"`, `prefetch="hover|visible|idle"`, `priority="high"` (vira `fetchpriority`) e `keepAlive` (LRU, padrão 5; o remote sai da página sem desmontar e volta só com `update`). O remote recebe `ctx.onActivate` e `ctx.onDeactivate`. Os componentes de host de React e Vue passam a usar o mesmo controlador de slot dos outros, então o remote monta num `<div data-vitral-slot>` dentro do `div` do componente.

- [#42](https://github.com/joaogabriel15/vitral/pull/42) [`bcb99c7`](https://github.com/joaogabriel15/vitral/commit/bcb99c7ebdfa014ad502ad8d29759c232b42979f) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Manifesto v2 no plugin Vite: o `vitral.json` ganha `files`, com o hash `sha384` de cada arquivo (CSS incluído). Quando o remote tem `import()`, o plugin gera também o build dividido em `dist/split/` e o campo `split`; `entry` e `integrity` continuam apontando para o arquivo único, então hosts antigos não mudam. No build dividido, os `import()` do remote passam por um helper que confere o hash também onde a lib usa `modulepreload` com `integrity`.

- [#41](https://github.com/joaogabriel15/vitral/pull/41) [`fb8ec06`](https://github.com/joaogabriel15/vitral/commit/fb8ec0613299236f84ec494edf66219d7365a34c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Métricas de carregamento: cada etapa (`manifest`, `js`, `css`, `mount`) vira um `performance.measure` chamado `vitral:<remote>:<etapa>` e chega no novo `configure({ onMetric })`. O evento `vitral-ready` e o `ready` do componente Vue passam a trazer os tempos em `detail.timings`.

- [#38](https://github.com/joaogabriel15/vitral/pull/38) [`ddd07e9`](https://github.com/joaogabriel15/vitral/commit/ddd07e9ff9d7ba65555fd1f50eee16dfe56a421c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Downloads em paralelo: com o manifesto em mãos, o CSS do remote baixa junto com o JS (antes só começava na montagem). `preload()` também baixa o CSS, e `configure()`/`register()` adicionam `<link rel="preconnect" crossorigin>` para a origem de cada remote.

- [#39](https://github.com/joaogabriel15/vitral/pull/39) [`aa2f26c`](https://github.com/joaogabriel15/vitral/commit/aa2f26c53df8f695c1aaf48809a3aaa076dde845) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - SRI sem `blob:` onde o navegador confere o hash: import map com `integrity` (Chrome 133+, Safari 18.4+) ou `<link rel="modulepreload" integrity>` (Firefox, Chromium antigo), escolhidos pelo comportamento do navegador. Nos outros casos, e para um remote que já falhou, continua o `blob:` com os bytes conferidos. O manifesto aceita `files` (hash de cada arquivo) e `split` (build dividido), o CSS do manifesto passa a ser conferido, e `configure({ remotes })` aceita o manifesto embutido (`{ url, manifest }`).

- [#20](https://github.com/joaogabriel15/vitral/pull/20) [`ae0690a`](https://github.com/joaogabriel15/vitral/commit/ae0690a82224f38aa9fcbcc48780334e74751625) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Vários componentes e módulos por remote:

  - Plugin: `vitral({ exposes: { './MiniCarrinho': 'src/MiniCarrinho.tsx', './api': 'src/api.ts' } })`. O manifesto ganha `exposes` e tudo continua num arquivo só, com um hash SRI.
  - Host: `<Remote name="carrinho/MiniCarrinho" />` (e `<vitral-remote>`, `mountRemote`, `loadRemote`, `preload`) monta uma parte do remote.
  - `loadModule('carrinho/api')` carrega um módulo sem UI com a mesma allowlist e o mesmo SRI.
  - Novo código de erro `NOT_EXPOSED`.

- [#23](https://github.com/joaogabriel15/vitral/pull/23) [`64e4225`](https://github.com/joaogabriel15/vitral/commit/64e4225e3b61744236ec9b51281ece8afd436193) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Isolamento por iframe, em `vitral/iframe`: depois de `enableIframe()`, `isolate="iframe"` roda o remote num iframe `sandbox="allow-scripts"` com origem opaca. A página confere origem e SRI e manda os bytes verificados para o iframe; props, `ctx.events` e `ctx.navigate` (só na mesma origem) passam por `postMessage`, e a altura acompanha o conteúdo. `FRAME_SCRIPT` permite liberar o script do iframe no CSP por hash.

- [#22](https://github.com/joaogabriel15/vitral/pull/22) [`b279e4e`](https://github.com/joaogabriel15/vitral/commit/b279e4e800cb8ca3883da76e26ec77aead36c65b) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Composição por rota, em `vitral/routes`: `routes({ '/checkout/*': 'checkout', '/conta': 'conta' })` e `<vitral-outlet>` montam o remote da URL atual e trocam de remote ao navegar, sem remontar dentro do mesmo remote. Links internos que batem com uma rota navegam sem recarregar. `matchRoute(path)` devolve o remote e os parâmetros da rota.

- [#21](https://github.com/joaogabriel15/vitral/pull/21) [`dc2e977`](https://github.com/joaogabriel15/vitral/commit/dc2e977f7b8336ba184948b9094b3fc5a7cd0f90) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Atualização sem reload:

  - `watchUpdates()` revalida os manifestos dos remotes montados a cada navegação e emite `vitral:update-available` com `{ name, entry }`. `checkUpdates()` faz a mesma checagem na hora.
  - `refresh('carrinho')` troca cada montagem do remote (e das partes `carrinho/…`) pela versão nova, com as props atuais, sem recarregar a página. Se a versão nova falhar, a antiga fica.

### Patch Changes

- [#43](https://github.com/joaogabriel15/vitral/pull/43) [`5267aed`](https://github.com/joaogabriel15/vitral/commit/5267aedfb8760a061ab9da4ff8e78e311ae95e68) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `dedupe`: na visita seguinte, a página prefere a cópia da dependência que já veio antes (e está no cache HTTP), em vez da cópia do remote que respondeu primeiro.

- [#7](https://github.com/joaogabriel15/vitral/pull/7) [`d429698`](https://github.com/joaogabriel15/vitral/commit/d429698bfbf5627d6304c5cc35041cc4bc09a47f) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O link das mensagens de erro (`RemoteError.docs`) aponta para a página do código no site da documentação: `https://joaogabriel15.github.io/vitral/erros/<CÓDIGO>`.

- [#37](https://github.com/joaogabriel15/vitral/pull/37) [`2acec0b`](https://github.com/joaogabriel15/vitral/commit/2acec0be86c2dcae04e8ea8e746c6e4945855259) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Modo dev: o plugin põe a entrada do remote e o adaptador do vitral na otimização inicial de dependências do Vite. Antes, o primeiro acesso do host fazia o Vite otimizar de novo e recarregar a página do host.

- [#19](https://github.com/joaogabriel15/vitral/pull/19) [`8cf0150`](https://github.com/joaogabriel15/vitral/commit/8cf01502f0f09c612d1ca68d68e83b82c118c5c3) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - No Shadow DOM, `url(/caminho)` no CSS do remote passa a valer a partir da origem do CSS do remote, como num `<link>`. Antes apontava para a origem da página.

- [#6](https://github.com/joaogabriel15/vitral/pull/6) [`8b5475c`](https://github.com/joaogabriel15/vitral/commit/8b5475c90cf301c2244c2f30db6edb749d0b9a13) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README novo na página do npm: começo rápido, links absolutos e sem seções internas do repositório.

- [#25](https://github.com/joaogabriel15/vitral/pull/25) [`fd97633`](https://github.com/joaogabriel15/vitral/commit/fd976334ac8b7637b65164c882476e17a9462a13) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - SRI: o `timeout` passa a cobrir também a espera pelos `modulepreload` (Firefox), e a nova tentativa depois de uma falha baixa o arquivo de novo em vez de esperar a requisição presa.
