# Quando não usar o vitral

Casos em que outra ferramenta resolve melhor hoje. As referências são da documentação oficial de cada uma, consultada em 14/10/2026.

## Um time, um framework, um deploy

Se todas as partes são do mesmo time e saem juntas, um monorepo com pacotes comuns é mais simples. Micro-frontends servem para times com deploys independentes.

## SSR dos remotes

No vitral, o servidor do host renderiza só o `fallback`. O remote monta no cliente. Se o HTML do remote precisa vir pronto do servidor (SEO, primeira pintura), use:

- [Native Federation](https://native-federation.com/docs/v4/angular-adapter/), com o SSR do Angular;
- [Piral](https://github.com/smapiot/piral/blob/develop/docs/questions/general.md), com servidor próprio;
- [Podium](https://podium-lib.io/), que monta fragmentos de HTML no servidor.

## Código legado que altera `window`

O vitral não tem sandbox de JS. O remote roda direto na página. Se o código mexe em globais, polyfills ou listeners de `window` e você não pode mudar isso, use uma ferramenta com sandbox:

- [wujie](https://wujie-micro.github.io/doc/guide/communication.html), que roda o JS num iframe;
- [micro-app](https://github.com/jd-opensource/micro-app), com sandbox de `Proxy` ou iframe;
- [qiankun](https://qiankun.umijs.org/api), com sandbox de `Proxy`.

## Uma aplicação por rota, na plataforma

Se cada parte é uma página inteira e a divisão é por caminho (`/loja` num app, `/conta` em outro), o roteamento pode ficar na plataforma de deploy, sem código no cliente. Exemplo: [Vercel Microfrontends](https://vercel.com/changelog/microfrontends-now-generally-available).

## Tipos das props conferidos entre deploys, hoje

O vitral ainda não gera os tipos das props de um remote para o host. O Module Federation gera com o [dts-plugin](https://module-federation.io/guide/runtime/index.html).

::: info Em breve
Tipos entre deploys e isolamento por iframe estão no plano do vitral. Esta página muda quando eles saírem.
:::
