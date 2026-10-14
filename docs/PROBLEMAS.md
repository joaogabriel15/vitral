# Problemas das outras soluções e como o vitral trata cada um

Levantamento feito em 13/10/2026 a partir de documentação, issues e relatos de
quem usa Module Federation, single-spa e afins. "Testado" significa que há
teste automatizado ou verificação no navegador com a demo deste repositório.

## Já resolvidos

### 1. Classes do Tailwind que "não funcionam" no remote (o seu caso)

**O problema.** Cada app roda o Tailwind só nos próprios arquivos. Se o remote
não leva o CSS dele, só funcionam as classes que o host também usa. Por isso
`h-10` funcionava (o host tinha) e `h-[10px]` não (só existia no remote). A
doc do Nx confirma que isso é "comportamento esperado" e manda adicionar os
caminhos de todos os remotes no `@source`/`content` do host, o que acopla
tudo de novo.

**No vitral.** O plugin empacota o CSS do remote e o host carrega junto, sempre.
O host não precisa saber nada do Tailwind do remote. Testado com
`h-[37px] w-[123px]` e com `h-[10]` (o Tailwind v4 gera `10px`).

### 2. O preflight do Tailwind do remote quebra o host

**O problema.** Quando o remote leva o próprio Tailwind, o reset dele
(`*`, `html`, `h1 { font-size: inherit }`…) vale para a página inteira.
Na demo, sem correção, o `<h1>` do host caía de 32px para 16px e perdia o
negrito.

**No vitral.** O plugin prefixa todo o CSS do remote com
`[data-vitral-scope="nome"]` e transforma `:root`, `:host`, `html` e `body` na
raiz do remote. O tema e o preflight passam a valer só dentro dele. Testado:
o `<h1>` do host fica intacto. Dá para desligar com `scopeCss: false`.

### 3. Sombras, rings e gradientes do Tailwind v4 somem dentro de Shadow DOM

**O problema.** O Tailwind v4 usa `@property`, e o navegador ignora
`@property` dentro de shadow roots. Resultado: `shadow-lg`, `ring-*`,
gradientes e transforms ficam sem efeito. Na demo, `box-shadow` virava `none`.

**No vitral.** Com `isolate="shadow"`, as regras `@property` sobem para o
documento (uma vez só) e o resto do CSS entra no shadow root como stylesheet
adotado. Testado: a sombra e o ring aparecem.

### 4. Versões e singletons de React/Vue/Angular

**O problema.** "Unsatisfied version", "Shared module is not available for
eager consumption", duas cópias do framework, `inject() must be called from an
injection context`, peer deps desencontradas. É a maior fonte de bug do Module
Federation.

**No vitral.** Por padrão nada é compartilhado: cada remote leva o próprio
framework e roda na própria root. Compartilhar via import map é opcional, para
quem quer economizar bytes e aceita alinhar versões.

### 5. Cache velho depois do deploy (`ChunkLoadError`)

**O problema.** `remoteEntry.js` com nome fixo fica em cache e aponta para
chunks que não existem mais, ou o usuário fica com a versão antiga.

**No vitral.** JS e CSS saem com hash no nome (cache eterno no CDN), o
`vitral.json` é o único arquivo de nome fixo e é sempre revalidado
(`cache: 'no-cache'`). Download com timeout e nova tentativa.

### 6. Remote fora do ar deixa a tela branca

**O problema.** Falha ao baixar o remote acontece fora do ciclo de render, então
error boundaries não pegam; falha no carregamento estático derruba o host antes
de montar.

**No vitral.** Cada `<Remote>` tem estado próprio de carregando, erro e "tentar
de novo". Nada é carregado no boot do host. Testado com um remote que dá 404.

### 7. Erro de render dentro do remote derruba a página

**No vitral.** Os adaptadores capturam (error boundary no React,
`app.config.errorHandler` no Vue) e o host mostra o slot de erro daquele remote,
com botão para recarregar só ele. Testado: o botão "Simular bug" do carrinho.

### 8. Erros genéricos, difíceis de rastrear

**O problema.** Relatos de debug que passam de 10 minutos para 2 horas porque o
erro é um "chunk load error" sem contexto.

**No vitral.** Todo erro é um `RemoteError` com `code` (`NOT_REGISTERED`,
`ORIGIN_BLOCKED`, `TIMEOUT`, `INTEGRITY`, `LOAD_FAILED`, `MOUNT_FAILED`,
`RENDER_FAILED`), o nome do remote e um link (`error.docs`) para a página do
código em [docs/erros](erros/README.md), com causas e correção. O erro de
integridade mostra o hash esperado e o obtido.

### 9. Barramento de eventos com vazamento de memória

**O problema.** Times acabam criando event bus próprio e sofrem com listeners
que nunca saem e com um handler que lança erro e quebra os outros.

**No vitral.** O `ctx.events` do remote cancela todas as assinaturas sozinho no
unmount, e um handler com erro não impede os outros (testado).

### 10. Roteadores brigando (React Router x Vue Router)

**No vitral.** `navigate(url)` (também em `ctx.navigate`) atualiza o histórico e
dispara `popstate`, que todos os roteadores escutam, então host e remotes ficam
na mesma URL. Testado em unidade.

### 11. Next.js App Router sem suporte

**O problema.** O plugin de Module Federation para Next está em modo de
manutenção, com intenção de ser descontinuado, e o App Router não é suportado.

**No vitral.** `<Remote>` já é `'use client'`, renderiza o fallback no servidor e
monta no cliente. Testado com `renderToString` (React) e SSR do Vue.

### 12. Testes de integração lentos e frágeis

**No vitral.** `vitral/testing` tem `mockRemote()` e `failingRemote()` para testar
o host sem subir remote nenhum, e `{ module: () => import(...) }` registra um
remote local. O próprio repositório roda e2e de 9 hosts × 8 remotes.

### 13. Suporte limitado a frameworks

**No vitral.** Adaptadores para React, Next, Vue, Nuxt, Angular, Svelte, Solid,
Preact, Lit/Web Components e JS/TS puro, mais o `<vitral-remote>` que serve de
host em qualquer lugar que renderize HTML.

### 14. Remote só funciona buildado em dev

**O problema.** O plugin de federation para Vite só serve o remote depois do
build: cada edição pede um build novo e um reload do host.

**No vitral.** `vite dev` no remote serve um `vitral.json` de desenvolvimento
com o cliente HMR do Vite e o preâmbulo do React Fast Refresh. Editar o remote
atualiza o host sem recarregar. Testado com os 8 remotes de exemplo e com cada
template do `create-vitral` (React e Vue mantêm o estado; Svelte 5 perde o
`$state` local). Limite: em dev o CSS não entra em shadow roots.

### 15. Tipos das props divergem entre deploys

**No vitral.** O build publica `vitral.d.ts` com o tipo das props do
`export default`, e `npx vitral types` gera `vitral-env.d.ts` no host. Com ele,
`<Remote name="carrinho" props={…}>` (React, Preact, Solid) e `PropsOf` acusam
prop errada. Entradas `.vue` e `.svelte` ainda não geram tipos.

### 16. Começar do zero exige montar host e remote na mão

**No vitral.** `npm create vitral@latest` gera host ou remote em 10 frameworks,
com o plugin configurado, exemplo, `dev` e e2e. O host não precisa de
`configure()`: `<vitral-remote src="…/vitral.json">` ou `<Remote src>` bastam.

## Ainda não resolvidos (próximos passos sugeridos)

| Problema | Ideia |
|---|---|
| Host com Tailwind v3 e remote em Shadow DOM com Tailwind v4 (`@property` com o mesmo nome) | Opção para renomear `--tw-*` do remote no build. |
| `html.dark` no host não chega no remote com escopo | Repassar o tema por prop/evento, ou mapear `.dark` do `<html>`. |

## Fontes

- [Nx: Using Tailwind CSS with Module Federation](https://nx.dev/docs/kb/using-tailwind-css-with-module-federation)
- [WXT #1955: conflito de `@property` entre Tailwind v4 e v3](https://github.com/wxt-dev/wxt/issues/1955)
- [Ben Frain: `@property` dentro de shadow root](https://benfrain.com/using-css-property-inside-shadowroot-web-components-workaround/)
- [Angular Architects: Pitfalls with Module Federation](https://www.angulararchitects.io/en/?p=5187)
- [Nutrient: micro frontends com single-spa](https://www.nutrient.io/blog/micro-frontends-that-actually-work/)
- [Discussão sobre o custo de complexidade do Module Federation](https://tianpan.co/forum/t/micro-frontends-grew-up-module-federation-works-across-vite-webpack-and-rollup-now-but-is-the-complexity-tax-still-too-high/595)
- [Steve Kinney: error boundaries e federation](https://stevekinney.com/courses/enterprise-ui/error-boundaries-and-federation)
- [webpack #18177: cache dos remotes](https://github.com/orgs/webpack/discussions/18177)
- [originjs/vite-plugin-federation (limitações de dev mode)](https://github.com/originjs/vite-plugin-federation)
- [Vercel Community: Module Federation e App Router](https://community.vercel.com/t/microfront-end-alternatives-for-next-js-app-router/1938)
