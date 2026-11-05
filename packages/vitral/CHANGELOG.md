# vitral

## 0.13.1

### Patch Changes

- [#127](https://github.com/joaogabriel15/vitral/pull/127) [`a26c415`](https://github.com/joaogabriel15/vitral/commit/a26c41585a100be6f6afdfed2c1698c766d4b056) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Troca de língua sem mostrar as chaves: com o adaptador `i18next()`, o `changeLanguage` baixa antes a nova língua de cada remote aberto, e a tela troca tudo junto (host e remotes) quando os textos chegam. Para outras bibliotecas, `languageReady(lng)` de `vitral/i18n` faz o mesmo antes da troca.

## 0.13.0

### Minor Changes

- [#125](https://github.com/joaogabriel15/vitral/pull/125) [`183d334`](https://github.com/joaogabriel15/vitral/commit/183d3346155236ea2e7db895d82b3861759e8c51) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Traduções por remote e por língua (`vitral/i18n`). Com `i18n: 'src/locales/{lng}.json'` no plugin, cada língua sai num arquivo com hash, listado no `vitral.json`. Com `configure({ i18n: i18next(i18n) })` no host, o remote baixa só a língua aberta, junto com o JS, e as traduções entram no i18next do host antes de montar. Numa troca de língua, os remotes já carregados baixam a nova. No host Next, `<VitralNext lang>` e `<NextRemote lang>` pré-carregam no HTML a tradução da língua aberta.

  As dicas que só o `VitralNext` põe no HTML (o remote ainda não está na página) saem em prioridade baixa, para não tirar banda do JS do host. Os preloads `as=fetch` saem sem `integrity` (o navegador não confere e avisava no console); o vitral continua conferindo o hash.

  Dedupe: quando a cópia própria de um pacote usa outro pacote do dedupe (`react-i18next` usa `react`), ela só roda depois que o outro entrou. Antes, o arquivo único quebrava ao montar.

## 0.12.1

### Patch Changes

- [#123](https://github.com/joaogabriel15/vitral/pull/123) [`f775b20`](https://github.com/joaogabriel15/vitral/commit/f775b20861a2c08f22855a82fbd83f481d5fe1d0) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `dedupe` com `pacote/*`: num import de um arquivo interno do pacote, os nomes que o pacote não exporta vêm do arquivo que os define, e não do barrel. Antes, o reexport do barrel punha no código principal do remote todos os arquivos que ele reexporta, com os efeitos colaterais deles, mesmo com o pacote oferecido pelo host. O aviso do build diz de qual arquivo vem a cópia própria, e um aviso novo, depois do build, conta os arquivos do pacote que entram no código principal, com um caminho até eles.

## 0.12.0

### Minor Changes

- [#121](https://github.com/joaogabriel15/vitral/pull/121) [`071f7d9`](https://github.com/joaogabriel15/vitral/commit/071f7d9aaf5ec3c3ef081e350abe0b8faf312236) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Correções de um teste com host Next.js e remote com `dedupe`:

  - `retry()` e "Tentar de novo" baixam o remote de novo depois de uma falha de rede, também com a CSP sem `blob:`: a nova tentativa usa uma URL nova (`?vitral-retry=1`) e o navegador confere o hash. Antes, o navegador repetia o erro guardado sem fazer requisição.
  - Sem a prop `error`, `<Remote>` (React, Preact, Solid) e `<VitralRemote>` (Vue) mostram "Não foi possível carregar." com o botão "Tentar de novo", como o `<vitral-remote>`. `error={null}` não mostra nada.
  - `<VitralNext />` põe no HTML as dicas de preload do remote da rota aberta. Vale também na página que só desenha o `NextRemote` no navegador (depois do login). Com `pageProps`, usa o manifesto lido no servidor.
  - `build.rollupOptions.output` do remote não cria mais uma terceira saída: as opções valem nas duas, e `manualChunks` vale só no build dividido, sem juntar a cópia própria do `dedupe` com o código do app.
  - `vitral/sw` lista só o que a página usa: sem o arquivo único quando há build dividido (`single: true` inclui) e, com `offered`, sem a cópia própria dos grupos que o host oferece.
  - `vitral doctor`: com build dividido, o tamanho é o JS da montagem; as cópias próprias e o arquivo único aparecem à parte. `--stats` avisa quando os stats não têm os módulos da maior parte da rota.

## 0.11.5

### Patch Changes

- [#119](https://github.com/joaogabriel15/vitral/pull/119) [`37f37e3`](https://github.com/joaogabriel15/vitral/commit/37f37e37c7c5b1a030861e66b6ef295f48a73fe8) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README e documentação: nos exemplos "hoje" e "com vitral", os dois lados têm os mesmos arquivos, na mesma ordem, e cada arquivo do vitral diz o que mudou.

## 0.11.4

### Patch Changes

- [#117](https://github.com/joaogabriel15/vitral/pull/117) [`bc4f058`](https://github.com/joaogabriel15/vitral/commit/bc4f0583066ed0cbcf32ae42d573e2710f0d1578) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README e documentação: cada exemplo mostra primeiro como é hoje (Module Federation, Multi-Zones, dois apps Nuxt, iframe) e logo embaixo o mesmo app com vitral.

## 0.11.3

### Patch Changes

- [#114](https://github.com/joaogabriel15/vitral/pull/114) [`d6821b7`](https://github.com/joaogabriel15/vitral/commit/d6821b78eabe8fa48cad2da8746ece88cfc16846) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README mais curto e direto: o que é, por que usar, comparação e começo rápido no topo, e os detalhes na documentação. Documentação sem detalhes internos que não ajudam a usar.

- [#115](https://github.com/joaogabriel15/vitral/pull/115) [`8ed9cf8`](https://github.com/joaogabriel15/vitral/commit/8ed9cf8e2fad273c73d54e2afac2e647f68b07b5) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README: exemplo do Multi-Zones em duas partes, primeiro o app de hoje com Multi-Zones e depois o mesmo app com vitral, arquivo por arquivo.

## 0.11.2

### Patch Changes

- [#112](https://github.com/joaogabriel15/vitral/pull/112) [`7b9bb00`](https://github.com/joaogabriel15/vitral/commit/7b9bb00fc31cff943bd3d299acc8348287115b85) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README com exemplos de host Next.js e Nuxt, a configuração do Multi-Zones lado a lado com a do vitral e diagramas de Multi-Zones, dependências compartilhadas, comunicação e segurança. README em inglês com as mesmas seções e imagens em inglês.

## 0.11.1

### Patch Changes

- [#110](https://github.com/joaogabriel15/vitral/pull/110) [`038dcf4`](https://github.com/joaogabriel15/vitral/commit/038dcf417b1cdaefe17d55b61ac717571c26898d) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Remotes menores e com menos pedidos:

  - Remotes Vue, Lit, Web Component e JS puro não levam mais o código do host (o `<vitral-remote>`, o loader e os chunks sob demanda dele). No remote de exemplo em JS puro, o código que o navegador baixa caiu de cerca de 26 kB em 7 arquivos para 2,8 kB num só, sem compressão.
  - Remotes React não baixam mais o escopo dos portais num arquivo à parte: são menos de 400 bytes no próprio remote, um pedido a menos por remote.

  Rebuilde os remotes para ter a mudança.

## 0.11.0

### Minor Changes

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`0ecb3da`](https://github.com/joaogabriel15/vitral/commit/0ecb3da897d28917c8f9e09a0911675cbc2c14b3) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Assinatura dos arquivos do remote com Ed25519: `vitral sign` grava os headers de assinatura (`_headers` e `vitral-signatures.json`), e o host fixa a chave pública em `keys`. O Chrome 141+ só roda o `vitral.json`, o JS e o CSS assinados por ela; os outros navegadores continuam conferindo o hash. `vitral/sign` exporta `keygen`, `signBody`, `verifyBody` e `signDir`, e o `remoteProps` do Next confere a assinatura do manifesto no servidor.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`fa57a2b`](https://github.com/joaogabriel15/vitral/commit/fa57a2b79ad97a159a9ae166c1d81519838e23fb) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `planDedupe` e `configure({ dedupePlan })`: com os manifestos de todos os remotes, cada grupo de `dedupe` fica com o menor conjunto de versões que atende todas as faixas (a oferta do host primeiro, depois as mais novas), e cada remote usa essa cópia, mesmo que venha de outro remote. Conflitos saem explicados em texto. O `withVitral` do host Next calcula o plano no build.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`cab5008`](https://github.com/joaogabriel15/vitral/commit/cab50080fc5d996bc8e390edc1b0d80d86e50a99) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral doctor --stats <stats.json> --route <rota>`: bytes do host numa rota do Next, por pacote e por módulo, com avisos (traduções grandes, módulos sem uso, ofertas de pacote inteiro). Com `--remote <vitral.json>`, mostra os pacotes que o host e o remote baixam em dobro.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`cab5008`](https://github.com/joaogabriel15/vitral/commit/cab50080fc5d996bc8e390edc1b0d80d86e50a99) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/next-server`: `remoteProps(nome)` lê o `vitral.json` do remote no servidor a cada requisição, com cache curto. Passado ao `NextRemote` em `manifest`, o HTML já sai com o preload da versão publicada agora e o navegador não pede o manifesto.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`91f25b3`](https://github.com/joaogabriel15/vitral/commit/91f25b3a1987142facb34d595eb3fd0a25e87d07) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O build do remote grava em `split.order` a ordem de download do que roda ao montar, pelo caminho mais longo em bytes, e em `split.critical` os arquivos desse caminho. O `NextRemote`, o `vitral/next-server` e o `vitral/edge` pré-carregam nessa ordem, com `fetchpriority="high"` no caminho crítico.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`2de6185`](https://github.com/joaogabriel15/vitral/commit/2de6185b6d3540703f17605a2336008065ae9dde) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Política adaptativa por rede e aparelho (`configure({ policy })`, `policy()`, `choose()`, `signalsFrom()`). Com 2G ou economia de dados (`'lazy'`), só baixa o que a página usa e o `<vitral-remote>` com HTML do servidor hidrata ao aparecer na tela. Com 3G ou até 2 GB de memória (`'critical'`), corta o preload ocioso dos outros remotes e o `warmRoutes`; o prefetch previsto continua.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`5cf14d6`](https://github.com/joaogabriel15/vitral/commit/5cf14d6413fff784cd2fdf746ddb6d27e0357825) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/prefetch`: cadeia de Markov de ordens 1 a 3 (usa o contexto mais longo com suporte e confiança); `prior` com as transições da população para a primeira visita (`vitral prior` gera de sessões agregadas); prefetch só quando probabilidade × tempo poupado passa o custo dos bytes na rede de agora (`byteCost`); `pointerdown` em link baixa os remotes da rota na hora; `speculate` põe Speculation Rules na rota prevista sem remote. O `threshold` padrão passa de 0.4 para 0.1, porque a conta de custo decide.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`6cb1ecf`](https://github.com/joaogabriel15/vitral/commit/6cb1ecf19dcc793346468eaf40b6a0a6f2dea78c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral({ scopeCss: 'native' })`: o CSS do remote vai num `@scope ([data-vitral-scope="nome"])` em vez de prefixar cada seletor. O CSS fica menor; em troca, os seletores não ganham a especificidade do prefixo.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`b42a838`](https://github.com/joaogabriel15/vitral/commit/b42a83889345b42338dfc8f5b63a80ab339624c3) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/snapshot`: com `snapshots()` e `snapshot` no `<Remote>` ou no `<vitral-remote>`, a última tela do remote fica no `sessionStorage` e aparece na hora na visita de volta, inerte, até o remote montar.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`5ace019`](https://github.com/joaogabriel15/vitral/commit/5ace019be84144f1652d1b5db9edf23ead9f5e40) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - SSR do remote dentro do `NextRemote`: `remoteProps(nome, { ssr: { nome: { render, props } } })` devolve `vitralSsr[nome]`, que vai no `ssr` do `NextRemote` (e do `<Remote>` de `vitral/react`). O HTML aparece antes do JS e o remote hidrata. `reactRender(C, { state })` busca o estado no servidor; ele vai com o HTML e chega em `useInitialState()` e em `ctx.initialState`, também no `vitral/edge`.

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`cab5008`](https://github.com/joaogabriel15/vitral/commit/cab50080fc5d996bc8e390edc1b0d80d86e50a99) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `remoteWorker` em `vitral/sw`: service worker pronto que guarda os remotes no cache durante o `install` (o Chrome gera o cache de código completo), usa a Static Routing API para `split/*` no Chrome 123+, busca o manifesto na rede primeiro e tira do cache as versões antigas. `filesOf(manifesto, url)` lista os arquivos de um manifesto já lido.

### Patch Changes

- [#108](https://github.com/joaogabriel15/vitral/pull/108) [`c5b9b9d`](https://github.com/joaogabriel15/vitral/commit/c5b9b9d0ab754f3b5993326b6f21bfaf85906584) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/edge` no Node: o rewriter de HTML ficou cerca de 1,8 vez mais rápido (de 27 para 50 MB/s numa página de 358 kB), com a mesma saída.

## 0.10.1

### Patch Changes

- [#105](https://github.com/joaogabriel15/vitral/pull/105) [`beca5e5`](https://github.com/joaogabriel15/vitral/commit/beca5e5f1dbffa4fee50a70a8a7ba71d33c511e5) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Dedupe: um remote com `import * as React` num host Next de produção não usa mais a cópia própria do React. O `uses` do manifesto vinha com os nomes do React de desenvolvimento (`act`, `captureOwnerStack`), que o React de produção do host não tem, e o boot trocava a oferta do host pela cópia própria. Agora os nomes são lidos num processo à parte com `NODE_ENV=production`, e em CommonJS só contam os que existem no `module.exports`. No grupo do React, um nome que falta na oferta só gera aviso: o remote fica com o React do host.

  Host Next: na página de um remote, o chunk do webpack de cada oferta de `share` que o remote vai pedir começa a baixar quando o `_app` é avaliado, antes da hidratação, e não quando o remote pede a oferta.

## 0.10.0

### Minor Changes

- [#103](https://github.com/joaogabriel15/vitral/pull/103) [`bbad250`](https://github.com/joaogabriel15/vitral/commit/bbad250c22d8a1ed7a6879187778b00a2fc8b8f3) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Host Next: o remote baixa junto com o JS do host. No build, o `withVitral` lê o `vitral.json` do remote (em `public/` ou na nova opção `manifestFile`) e o `NextRemote` põe no `<head>` um `<link rel="preload">` para o manifesto, o CSS e o JS da primeira tela, com o hash no `integrity`. `htmlPreload: false` desliga. O `vitral/next-host` traz o código de SRI e de `dedupe` no bundle do host, e o loader pede o manifesto sem esperar as ofertas de `dedupe` (vale para todo host). O manifesto passa a ser pedido com `credentials: 'same-origin'`, o modo do preload: de outra origem continua sem cookies. Num modelo com Slow 4G e CPU 4x, abrir a página do remote direto caiu de 4,8 s para 3,2 s sem cache e de 2,0 s para 1,4 s com cache.

  Ofertas de `dedupe` só com os nomes usados: o manifesto do remote ganha `uses`, com os nomes que ele lê de cada especificador. O `withVitral` gera cada oferta de `share` com `webpackExports` e só esses nomes, quando acha o manifesto de todos os remotes no build. Antes, o `import()` do pacote inteiro fazia o webpack levar para as páginas do host o que elas não usam de uma biblioteca de componentes (gráficos de um barrel, por exemplo). Se a oferta não tem um nome que o remote usa, o boot do remote usa a cópia própria daquele grupo e avisa no console.

## 0.9.0

### Minor Changes

- [#101](https://github.com/joaogabriel15/vitral/pull/101) [`73f27bc`](https://github.com/joaogabriel15/vitral/commit/73f27bcda157ec2b1c7d3e84c5b21f1361a61543) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `dedupe` de pacotes CommonJS como o axios: os nomes do `module.exports` saem também quando ele é uma função, nomes reservados como `delete` não quebram mais o build, e o `require()` de um pacote CommonJS recebe os métodos que só existem no `default` (`axios.get`). Com CSS escopado, os portais que o React do remote coloca no `document.body` (dialogs e popovers do Radix, por exemplo) ganham o escopo do remote sozinhos, sem mudar a biblioteca de UI. Sem Navigation API, o `VitralNext` troca os cliques em `<a>` comuns para rota de remote por `Router.push`.

## 0.8.0

### Minor Changes

- [#96](https://github.com/joaogabriel15/vitral/pull/96) [`65abc65`](https://github.com/joaogabriel15/vitral/commit/65abc658586f745ee2aa956fe82e5161996c9bfb) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Next.js sem Multi-Zones: `vitral/next-config` (`withVitral`) gera rewrites, headers de cache e as ofertas de `dedupe` do host; `vitral/next-host` traz `VitralNext` (registro, preload e navegação sem reload para rotas de remote) e `NextRemote` (o roteador do host no remote); `devUrl` liga o dev server do remote em `next dev`, com HMR. O modo `next` do plugin lê os `paths` do tsconfig de cada pacote (também no pré-bundle de dev), importa `.svg` como componente e builda em produção com `NODE_ENV=development` no `.env`. `dedupe: ['pacote/*']` compartilha um pacote publicado como código-fonte, inclusive arquivos internos que ele reexporta. O build dividido publica módulos de teste do SRI (CSP sem `data:`/`blob:`) e a lista `split.lazy`, usada por `preload(nome, { routes: true })`. Novos: `vitral/sw` (`remoteFiles`), `sideEffectFree`, `integrity: false` no registro e `dedupe` com módulos carregados sob demanda.

### Patch Changes

- [#98](https://github.com/joaogabriel15/vitral/pull/98) [`c1d51ce`](https://github.com/joaogabriel15/vitral/commit/c1d51cea03b80400a344362044df1df1d368264e) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Correções do host Next: a navegação de página inteira que o próprio Next pede depois de falhar ao carregar uma rota não entra mais em laço; o `Router` padrão de `next/router`, `redirect()` e `router.events` usam o roteador do host dentro do `NextRemote`; `useParams()` devolve sempre o mesmo objeto. `withVitral` só regrava `.vitral/host-config.mjs` quando muda e não quebra o `next start` em disco só de leitura. Dedupe de `pacote/*`: `export default X` conta como o mesmo valor de `X`, um arquivo interno com nomes privados reexporta do host os públicos, e a cópia própria inteira por falta de um subpath avisa no console. `preload({ routes: true })` baixa no máximo 3 chunks por vez e nada com economia de dados. Os módulos de teste de SRI do remote só valem na mesma origem da página.

## 0.7.2

### Patch Changes

- [#89](https://github.com/joaogabriel15/vitral/pull/89) [`a66441d`](https://github.com/joaogabriel15/vitral/commit/a66441df1baa490495b9c20a9ef02672c4d7160b) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README no npm com as vantagens no topo, comparação com Next.js Multi-Zones e seções de como rodar local e com Docker.

## 0.7.1

### Patch Changes

- [#87](https://github.com/joaogabriel15/vitral/pull/87) [`c0d3ebf`](https://github.com/joaogabriel15/vitral/commit/c0d3ebf711751abe02040ed0253104c9e40bb62b) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - README novo no npm: banner, diagrama de como funciona, comparação e números do benchmark. `create-vitral` ganha README com as opções do comando. Descrição e homepage dos pacotes apontam para o site.

## 0.7.0

### Minor Changes

- [#84](https://github.com/joaogabriel15/vitral/pull/84) [`c06dbd3`](https://github.com/joaogabriel15/vitral/commit/c06dbd3662dd69dead5be7a8d44b4c595d59bc48) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Carregamento mais rápido. O código de dedupe baixa junto com o primeiro manifesto, e não depois dele: a cópia do framework começa uma ida e volta antes. Uma query com a palavra `vitral` (ex.: `?utm_source=vitral`) não baixa mais o módulo de overrides antes do manifesto: só `?vitral=` liga os overrides. Opção nova `configure({ maxStale })`: na visita de volta, usa o `vitral.json` salvo há até N segundos sem esperar a rede e baixa o novo por trás. Opção nova `vitral({ compileHints: true })` no plugin: o compile hint do V8 nos arquivos que rodam ao montar, para CPU lenta.

## 0.6.0

### Minor Changes

- [#82](https://github.com/joaogabriel15/vitral/pull/82) [`52a4a2d`](https://github.com/joaogabriel15/vitral/commit/52a4a2d166ab277706d73938d8cb5c96b68cf0b3) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Rotas com SSR, no lugar do Next.js Multi-Zones: `gateway({ routes })` renderiza o remote da rota dentro do `<vitral-outlet>` e manda os `Link` dele já na primeira visita (com a cópia própria do dedupe); o outlet hidrata esse HTML e troca de rota sem recarregar. O manifesto usado no SSR vai no HTML, e a hidratação não busca o `vitral.json` de novo. `reactRemote` agora exporta `hydrate`, e `vitral/react-server` traz `reactRender` para o `render` do gateway.

## 0.5.0

### Minor Changes

- [#76](https://github.com/joaogabriel15/vitral/pull/76) [`60bae7d`](https://github.com/joaogabriel15/vitral/commit/60bae7d9e60265155905fe20582b454e3988e121) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Dicionários de compressão (RFC 9842) para os remotes: quem já tem a versão anterior em cache baixa só a diferença. Nos remotes de exemplo, o delta entre a 0.3 e a 0.4 ficou 89% menor que o brotli 11 em média.

  - `npx vitral dict dist --from ../dist-anterior` pré-comprime cada `.js` e `.css` com a versão anterior como dicionário (`.dcz`, e `.dcb` com o binário `brotli`) e grava `vitral-dict.json`.
  - `vitral/dict`: `createDict({ index, read })` responde `Available-Dictionary` com `Content-Encoding: dcz`/`dcb` e põe `Use-As-Dictionary` nas respostas normais. Só usa `Request`/`Response` da Web (edge, Deno, Bun) e tem `node(req, res, next)` para Node e Express.

- [#80](https://github.com/joaogabriel15/vitral/pull/80) [`6cd9bda`](https://github.com/joaogabriel15/vitral/commit/6cd9bda5a7cd523be60e8121c42e59c9c801c4ac) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/edge`: gateway de edge que serve host e remotes de uma origem só (`/_vitral/<nome>/…`, com o `vitral.json` reescrito e os mesmos hashes), manda `Link` para Early Hints e faz SSR opcional dos remotes em Declarative Shadow DOM. Roda em Cloudflare Workers (com `HTMLRewriter`) e em Node, Deno e Bun (`toNodeListener` para o Node). Contrato novo e opcional no remote: `render(props)` no servidor e `hydrate(el, props, ctx)` no navegador; o `<vitral-remote>` hidrata o HTML do servidor em vez de montar de novo. Sem `hydrate`, nada muda.

- [#79](https://github.com/joaogabriel15/vitral/pull/79) [`ad1fb64`](https://github.com/joaogabriel15/vitral/commit/ad1fb648a3bf65cbf196380099b20071fd812f0c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Novo `isolate: 'reframe'`: o JS do remote roda num iframe oculto de mesma origem (globais, timers e ouvintes somem no unmount) e o DOM fica num shadow root na página, com layout, foco e eventos normais. Passa pelo mesmo SRI, allowlist e contrato; `history` do remote sincroniza com o do host. Não é fronteira de segurança: veja a lista do que não é isolado em /aprender/reframe.

- [#78](https://github.com/joaogabriel15/vitral/pull/78) [`fbb0c4f`](https://github.com/joaogabriel15/vitral/commit/fbb0c4ff28bd55988b75277719741ce1c4f5e321) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral/prefetch`: prefetch preditivo de remotes. `prefetch()` conta as transições entre rotas no navegador do usuário (cadeia de Markov de primeira ordem, no `localStorage`) e quais remotes cada rota monta. No tempo ocioso, baixa o `vitral.json` e o JS dos remotes da rota seguinte mais provável, sem executar e pelo mesmo caminho de SRI da montagem (import map com `integrity`, `modulepreload` com `integrity` onde o hash é conferido, ou `fetch`). Não baixa nada com `saveData` nem em 2G. `warm(nome)` faz o mesmo para um remote na hora.

  Um import map novo não repete mais URLs que já estão num mapa anterior (o Chromium escrevia um aviso no console).

- [#74](https://github.com/joaogabriel15/vitral/pull/74) [`9c7d3aa`](https://github.com/joaogabriel15/vitral/commit/9c7d3aa7da5a24d60c6849a387c2b9f4dc459c95) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Nova entrada `vitral/vitals`: `vitals({ onReport })` relata LCP, CLS e INP de cada remote (pelo `data-vitral-root` que contém o elemento) e por rota, com `remote`, `version`, `route`, `navigationId` (Chromium com Soft Navigations), `value` e `rating`. FCP e TTFB saem para a página. `vitral/otel` ganha `otelVitals(meter)`, que grava cada vital num histograma do OpenTelemetry.

- [#75](https://github.com/joaogabriel15/vitral/pull/75) [`8892638`](https://github.com/joaogabriel15/vitral/commit/8892638df25931aad2487fe7aa755984d8a94625) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral test` e contratos do consumidor. `harness` (em `vitral/testing`) monta um remote com `ctx` simulado. `record()` grava no host as props, os updates e os eventos de cada remote em `<remote>.contract.json`. `npx vitral test --contract` reproduz esses casos no CI do remote, em happy-dom, e falha se o mount quebrar, se um evento que o host escuta sumir ou se as props não baterem com o `Props` local. `npx vitral test --since <url>` compara o `vitral.d.ts` publicado com o local e lista as mudanças que quebram o host.

## 0.4.0

### Minor Changes

- [#66](https://github.com/joaogabriel15/vitral/pull/66) [`d0e6f7d`](https://github.com/joaogabriel15/vitral/commit/d0e6f7d14ddca578306e624b82627200985ed4cb) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Canary e rollback por um arquivo-ponteiro, sem serviço externo. Registre a URL de um `canal.json` (`{ "stable": "1.4.0", "canary": { "version": "1.5.0", "percent": 10 } }`) no lugar do `vitral.json`: o host escolhe a versão de cada usuário por um número estável (`canaryKey` ou um id do navegador), aceita uma regra própria em `resolve` (cookie, grupo de teste) e, quando a canary passa de `rollback.errors` erros numa janela de `rollback.mounts` montagens, volta para a estável naquela sessão, troca as montagens na tela e chama `onRollback`. O plugin ganhou `versionDir: true`, que grava o build em `dist/<versão>/`. O código do canal é baixado só quando o host encontra um canal.

- [#71](https://github.com/joaogabriel15/vitral/pull/71) [`a7116ed`](https://github.com/joaogabriel15/vitral/commit/a7116edd8be24716f9feb7b6e88d42cae12de757) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Novo `dist/embed.js`: loader de uma linha para widget em site de terceiros, sem bundler. `<script src=".../vitral@x/dist/embed.js" data-remote="https://cdn/chat/canal.json" data-target="#chat" data-props='{"lang":"pt"}' async>` monta o widget com Shadow DOM por padrão (o CSS não vaza no site) e libera só a origem do widget, para HTML injetado no site não carregar JS de outra origem. É um arquivo só (IIFE, cerca de 11 kB com brotli) e já lê o `canal.json`: voltar uma versão em todos os sites é editar o canal.

  Novo comando `npx vitral canal <canal.json>`: cria e edita o canal sem abrir o JSON (`--stable 1.4.0`, `--canary 1.5.0 --percent 10`, `--percent 50`, `--canary off`).

  Doc nova: "Widget em site de terceiros", com receitas de CSP (com nonce e com lista de origens) e de cache.

- [#65](https://github.com/joaogabriel15/vitral/pull/65) [`9044839`](https://github.com/joaogabriel15/vitral/commit/9044839b2eee2545a576faa847b4b015d8937dcd) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `vitral({ target: 'mcp-app' })` empacota o remote como MCP App: o build gera `dist/mcp-app.html`, um HTML único com JS e CSS inline, para um servidor MCP registrar como recurso `ui://` (`text/html;profile=mcp-app`). Dentro do host MCP, a entrada e o resultado da tool e o `hostContext` chegam como props, e `ctx.events.emit` vira mensagem para o host (`ui/message`, `ui/open-link` ou `ui/update-model-context`). `ctx.mcp` fala JSON-RPC direto com o host para o resto do protocolo.

- [#68](https://github.com/joaogabriel15/vitral/pull/68) [`6496c48`](https://github.com/joaogabriel15/vitral/commit/6496c483e8b48d1afbf0cb289faa67ee5f822a51) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Overrides de desenvolvimento para polyrepo:

  - `configure({ devOverrides: { preview: 'https://{name}-{ref}.preview.empresa.com' } })` resolve apelidos: `?vitral=checkout@pr-123` carrega `https://checkout-pr-123.preview.empresa.com/vitral.json`. Dá para mandar o link do preview de um PR com o resto da página vindo de homologação.
  - A troca feita por `?vitral=` fica guardada na aba (`sessionStorage`) e continua valendo depois de recarregar ou navegar sem o parâmetro.
  - `?vitral=off` remove todas as trocas e `?vitral=nome@off` remove uma. O aviso no console diz a origem da troca e como limpar.
  - `vitral/devtools`: o botão mostra quantas trocas estão ativas, o painel lista as da aba e as do navegador e tem "Limpar todos". Novas funções `activeOverrides()` e `clearOverrides()`. `setOverride` aceita apelido.
  - Correção: um override salvo à mão no `localStorage` com URL base (`{"carrinho":"http://localhost:5174"}`) era ignorado quando a página não tinha `?vitral=`.

- [#69](https://github.com/joaogabriel15/vitral/pull/69) [`bf9350c`](https://github.com/joaogabriel15/vitral/commit/bf9350c25139d38877da6ad855c8757b82c24cdc) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `ctx.customElements`: no Shadow DOM, cada remote recebe um `CustomElementRegistry` próprio quando o navegador tem Scoped Custom Element Registries (Chrome e Edge 146+, Safari 26+). O shadow root e o elemento do mount são criados com ele, então dois remotes podem definir `<ds-button>` de versões diferentes. Sem suporte, e fora do Shadow DOM, é o registro global: um `define` de tag que outro remote já definiu não lança mais, fica a primeira definição, com aviso em dev. `elementRemote(tag, setup)` passa o registro para `setup`, cria o elemento com ele e aceita uma tag devolvida por `setup`; o plugin define a classe exportada no registro do remote.

- [#63](https://github.com/joaogabriel15/vitral/pull/63) [`ac04933`](https://github.com/joaogabriel15/vitral/commit/ac04933b2c2d5dd70be0786009061a4f0a4c6fda) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Registro de remotes para hosts e agentes. `npx vitral registry` gera um `vitral-registry.json` (nome, URL do manifesto, versão, tipo das props, dono, hash e framework de cada remote) a partir dos manifestos, com JSON Schema publicado em `https://joaogabriel15.github.io/vitral/schema/vitral-registry.json`. `npx vitral add <remote>` copia um remote do registro (URL ou arquivo) para o `remotes.json` do host e roda `vitral types`. `npx vitral mcp` abre um servidor MCP por stdio, sem dependências, com as ferramentas `list_remotes`, `get_remote` e `add_remote`. O repositório ganha uma skill para agentes em `skills/vitral/SKILL.md`.

- [#62](https://github.com/joaogabriel15/vitral/pull/62) [`eccd4ea`](https://github.com/joaogabriel15/vitral/commit/eccd4ea74db3ffa62853d64ce6ec0eb4b736375c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Plugin Vite: opção `sbom`. Com `vitral({ sbom: true })`, o build grava `sbom.cdx.json` (CycloneDX 1.6, JSON) com os pacotes npm que entraram no bundle do remote: nome, versão, licença, purl e quem depende de quem, com o remote como componente principal e o hash do JS publicado. O `vitral.json` ganha `sbom: { file, integrity }`. Pacotes removidos pelo tree-shaking não aparecem. Desligado por padrão; sem a opção, o build não muda. Ajuda a cumprir o Cyber Resilience Act da UE, que exige SBOM a partir de dezembro de 2027.

- [#64](https://github.com/joaogabriel15/vitral/pull/64) [`e8bb70b`](https://github.com/joaogabriel15/vitral/commit/e8bb70b1093b594d5ee7376bd55892651754a3cc) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Novo comando `npx vitral doctor`: baixa o manifesto e o JS de cada remote, como o host faria, e explica em pt-BR a causa e o que fazer quando algo impede o carregamento: CORS do manifesto e do JS, CSP do host (header ou `<meta>`), `Content-Type` do JS, falta do export `mount`, manifesto inválido (HTML no lugar do JSON, sem `entry`), `integrity` que não confere, contrato fora da faixa, React ou Vue duplicado, versões divergentes de `dedupe` e tamanho do bundle. Sai com código 1 se houver erro (para o CI) e aceita `--json`.

- [#70](https://github.com/joaogabriel15/vitral/pull/70) [`0912775`](https://github.com/joaogabriel15/vitral/commit/0912775cf628f0942ad2de445808eaa79bfc26ef) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `npx vitral migrate` converte um app do single-spa ou um remote do Module Federation num remote vitral, sem mexer no build atual. Gera o embrulho do app (ou um arquivo por componente de `exposes`), um `vite.vitral.config.mjs` e o script `build:vitral`, mostra o diff de cada arquivo e lista o que fazer à mão. Com `--dry-run`, não escreve nada.

  Duas entradas novas, fora do host mínimo:

  - `vitral/single-spa`: `singleSpaRemote(lifecycles)` monta um app do single-spa (`bootstrap`, `mount`, `unmount`, `update`) pelo contrato `mount(el, props, ctx)`.
  - `vitral/federation`: `federationRemote(url, options)` deixa o host vitral montar um remote do Module Federation a partir do `mf-manifest.json` (ou do `remoteEntry.js`), com `adapt` para embrulhar componentes e `shared` para oferecer as dependências do host. Serve para migrar um remote por vez.

### Patch Changes

- [#67](https://github.com/joaogabriel15/vitral/pull/67) [`35815ff`](https://github.com/joaogabriel15/vitral/commit/35815ffd40ca7a799d149d97dfb0b5cb8e32bcd1) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - SRI pelo import map: antes de usar o mapa com `integrity`, a lib confere que o hash dele vale, carregando dois módulos de teste (o errado tem de falhar). Um navegador que recusa o mapa sem disparar `error` (Safari 18.0 a 18.3) ou que aceita sem conferir passa a usar o `modulepreload` com `integrity` ou o `blob:`, em vez de rodar o remote sem conferência. O CSS saiu do import map (o hash dele continua no `<link integrity>`), e navegadores sem import map nem tentam o mapa.

- [#73](https://github.com/joaogabriel15/vitral/pull/73) [`94c5738`](https://github.com/joaogabriel15/vitral/commit/94c5738c4507b034c98092dc1a8b85e760c802ec) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O teste do import map com integrity roda uma vez por navegador. Antes, cada remote montado ao mesmo tempo fazia o próprio teste, e cada um deixava uma linha de erro no console. Agora os remotes que chegam juntos esperam o mesmo teste, e o resultado fica guardado no `localStorage` (chave `vitral:sri-map`).

## 0.3.0

### Minor Changes

- [#57](https://github.com/joaogabriel15/vitral/pull/57) [`c87d157`](https://github.com/joaogabriel15/vitral/commit/c87d1572e7db49e5935e73a93af114cf485ecf7d) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Atribuição de erros por remote. Todo `RemoteError` traz `entry` (URL do JS), `version` (do `vitral.json`) e `route` (`location.pathname` no momento do erro). `configure({ onError })` recebe cada erro de qualquer remote uma vez, além do `onError` de cada montagem. `configure({ captureGlobalErrors: true })` atribui a um remote os erros sem tratamento que saem do código dele. Novos imports `vitral/sentry` (`sentryOnError(Sentry)`) e `vitral/otel` (`otelOnError({ trace, tracer })`), sem dependência dos SDKs.

- [#56](https://github.com/joaogabriel15/vitral/pull/56) [`97570fe`](https://github.com/joaogabriel15/vitral/commit/97570fe488819b2cb18309c5a5776100e513ba85) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Contrato entre host e remote. O plugin `vitral/vite` grava `contract` no `vitral.json`: a versão da opção `contract: { version }` e, com `dedupe`, a faixa de cada dependência em `peers`. O host declara a faixa aceita com `contract: '^2'` no `configure` ou na entrada do remote. Antes de executar o remote, o host confere a versão e as dependências que ele mesmo oferece; se não servir, o remote não monta e o erro é `CONTRACT_MISMATCH`, mostrado pelo `fallback`/`error` como os outros. Sem contrato em um dos lados, nada muda. As faixas aceitam a forma curta (`^2`, `~2.1`), também no `dedupe`.

- [#58](https://github.com/joaogabriel15/vitral/pull/58) [`3d58aa4`](https://github.com/joaogabriel15/vitral/commit/3d58aa45a5d87f00f610c514943e04c95229c583) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Shadow DOM: o plugin prepara o CSS no build. O `vitral.json` ganha o campo `shadow`, com o CSS sem `@import`, `@property` e `@font-face` e um arquivo à parte com `@property` e `@font-face`, que entra num `<link>` no documento. A página só adota o CSS pronto, sem reescrever o texto, e o módulo do Shadow DOM passa a baixar junto com o JS do remote. O `css` continua igual: hosts antigos e manifestos antigos funcionam como antes.

- [#59](https://github.com/joaogabriel15/vitral/pull/59) [`f6ce2cd`](https://github.com/joaogabriel15/vitral/commit/f6ce2cd6d4a77067784a189740e072e3e4acf0ad) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - Novo `ctx.portalContainer`: destino para popovers, menus e dialogs (Radix, MUI, `Teleport`). No Shadow DOM é um elemento dentro do shadow root, com o CSS e o tema do remote, e sai no unmount; sem Shadow DOM é o `document.body`. Em React e Vue, `usePortalContainer()`.

- [#55](https://github.com/joaogabriel15/vitral/pull/55) [`a723542`](https://github.com/joaogabriel15/vitral/commit/a7235423281feee3039c0e2d4e5b0a769fa7a654) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O plugin gera o `vitral.d.ts` com o Oxc (`isolatedDeclaration`) quando ele está disponível (Vite 8 ou `oxc-transform`) e os exports têm tipo explícito: as props saem em poucos milissegundos, sem montar um programa do TypeScript. Sem Oxc, ou se ele reclamar, usa o TypeScript como antes.

  `npx vitral types` registra no `vitral-env.d.ts` o hash do manifesto de onde veio o tipo de cada remote, e o novo `npx vitral types --check` sai com erro quando algum manifesto mudou (útil no CI).

### Patch Changes

- [#49](https://github.com/joaogabriel15/vitral/pull/49) [`09781cb`](https://github.com/joaogabriel15/vitral/commit/09781cbd01ec529ea243f615b1f603fabe65fee8) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - CSS que falha (HTTP de erro, rede, hash diferente) não fica mais preso no cache: a próxima montagem baixa de novo. O `timeout` do `configure` agora vale também para o CSS: um CSS que não responde não segura a montagem além desse prazo.

- [#54](https://github.com/joaogabriel15/vitral/pull/54) [`7ebeb29`](https://github.com/joaogabriel15/vitral/commit/7ebeb2999e081204f0c197cf0dc348a168a0a0bf) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O plugin Vite agora declara filtros nos hooks `resolveId`, `load` e `transform`. No Vite 8 (Rolldown) e no Vite 6.3+, os módulos que não são do vitral nem chegam ao plugin, e o build fica mais rápido em projetos grandes. Nas versões anteriores do Vite nada muda.

- [#52](https://github.com/joaogabriel15/vitral/pull/52) [`67a346a`](https://github.com/joaogabriel15/vitral/commit/67a346af5c5ba39b0f579b0a725a98950c2fa17b) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `checkUpdates` e `watchUpdates` deixam de revalidar remotes que já foram desmontados. Montar o mesmo remote várias vezes não acumula mais entradas `performance.measure` na página: fica a última de cada remote e etapa.

- [#50](https://github.com/joaogabriel15/vitral/pull/50) [`299750d`](https://github.com/joaogabriel15/vitral/commit/299750d60286ea973a71d73881850f754442d32c) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - `await refresh(nome)` agora resolve só depois que as montagens já mostram a versão nova, e rejeita se o `mount` da versão nova falhar (antes o erro ia só para o console). Dois `refresh` seguidos não terminam fora de ordem: fica a versão do último. Props passadas com `update` durante a troca chegam na versão nova.

- [#60](https://github.com/joaogabriel15/vitral/pull/60) [`27a7815`](https://github.com/joaogabriel15/vitral/commit/27a7815e294f2fdb0684e17eb5c30ed842180f0e) Thanks [@joaogabriel15](https://github.com/joaogabriel15)! - O build do remote não quebra mais com o TypeScript 7 (o que o `create-vite` instala hoje): sem API em JavaScript, o plugin procura outro TypeScript e, sem nenhum, segue sem gerar `vitral.d.ts`. Palavras-chave do npm ampliadas para o pacote ser encontrado na busca.

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
