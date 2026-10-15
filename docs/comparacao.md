# Comparação

Toda afirmação desta página tem uma prova: uma medição nossa com data, um teste do repositório ou a documentação oficial da outra ferramenta, consultada em 14/10/2026.

## O que o vitral afirma

| Afirmação | Prova | Contexto |
| --- | --- | --- |
| O código de host é o menor entre as ferramentas medidas | [Benchmarks](/benchmarks#tamanho-do-codigo-de-host), medido em 14/10/2026 | Runtime do Module Federation e qiankun ficam acima de 19 kB e 37 kB |
| Nenhum plugin de build no host | `configure()` em runtime: [Host](/guia/host) | O Module Federation configura `remotes` no [plugin de build](https://module-federation.io/integrations/build-tool/vite.html) |
| Confere o hash (SRI) e a origem antes de executar | Testes "recusa código cujo hash não confere" e "bloqueia origem fora da allowlist" em [`core.test.ts`](https://github.com/joaogabriel15/vitral/blob/main/packages/vitral/test/core.test.ts) | Nenhuma das alternativas sem build na tabela abaixo documenta as duas checagens |
| Tailwind v4 funciona dentro de Shadow DOM | e2e "valores arbitrários e sombras funcionam" em [`demo.spec.ts`](https://github.com/joaogabriel15/vitral/blob/main/e2e/demo.spec.ts) | Issue do Tailwind aberta em 14/10/2026: [#15005](https://github.com/tailwindlabs/tailwindcss/issues/15005) |
| Remote fora do ar não derruba a página | e2e "remote fora do ar mostra erro sem afetar os outros", nos 9 hosts de [`matriz.spec.ts`](https://github.com/joaogabriel15/vitral/blob/main/e2e/matriz.spec.ts) | No Nx com Module Federation, um remote com falha derruba o host: [nx #10404](https://github.com/nrwl/nx/issues/10404) |
| Next.js com App Router | Host Next 16 com App Router no e2e de [`matriz.spec.ts`](https://github.com/joaogabriel15/vitral/blob/main/e2e/matriz.spec.ts) | O plugin de Module Federation para Next não suporta App Router: [documentação](https://module-federation.io/integrations/framework/nextjs) |
| Sem React duplicado forçado nem "unsatisfied version" | Cada remote monta na própria root; nada é compartilhado por padrão: [Performance](/guia/performance#dependencias-compartilhadas) | Erros de versão no escopo compartilhado do Module Federation: [module-federation/core #4071](https://github.com/module-federation/core/issues/4071) |

Ainda não afirmamos nada sobre tempo de carregamento comparado. O benchmark com as outras ferramentas está [em breve](/benchmarks#carregamento-do-vitral).

## Recursos, em outubro de 2026

"Não" quer dizer que não está na documentação oficial em 14/10/2026. Versões e datas vêm do registro do npm.

| Ferramenta | Situação | Build no host | Isolamento (CSS / JS) | Estado compartilhado | SSR | Tipos entre deploys | SRI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **vitral** | 0.1 | Não | Escopo no build ou Shadow DOM / nenhum | `events` | Fallback no servidor | Não | Sim, com allowlist |
| [Module Federation 2.0](https://module-federation.io/guide/runtime/index.html) | Ativo, 2.9.2 em 26/09 | Plugin (só runtime é limitado) | Nenhum / nenhum | `shared` com singletons | Via Modern.js | Sim (dts-plugin) | Não |
| [MF para Vite](https://module-federation.io/integrations/build-tool/vite.html) | Ativo, 1.23.5 em 13/10 | Plugin | Nenhum / nenhum | `shared` | No roadmap | Sim | Não |
| [Native Federation](https://native-federation.com/docs/v4/orchestrator/security/) | Ativo, 4.7.1 em 01/10 | Builder e import map | Nenhum / nenhum | Registro com eventos | SSR do Angular | Não verificado | Opcional |
| [single-spa](https://single-spa.js.org/docs/configuration) | 6.0.3 de set/2024; beta da 7.0 parada desde set/2025 | Não (import map ou SystemJS) | Só orientação / nenhum | `customProps` | single-spa-layout | Não | Não |
| [qiankun](https://qiankun.umijs.org/api) | 2.10.16 de nov/2023; 3.0 em RC | Não (entrada HTML) | Shadow DOM ou prefixo / Proxy | `initGlobalState`, que sai na 3.0 | Não documentado | Não | Não |
| [wujie](https://wujie-micro.github.io/doc/guide/communication.html) | Ativo, 2.1.0 em jun/2026 | Não | Shadow DOM / iframe | `props` e `bus` | Não documentado | Não | Não |
| [micro-app](https://github.com/jd-opensource/micro-app) | 1.0.0-rc.32 em jun/2026 | Não | Prefixo ou Shadow DOM / Proxy ou iframe | `setData` e `setGlobalData` | Sub-apps Next e Nuxt | Não | Não |
| [Garfish](https://www.garfishjs.org/api/run) | 1.19.12 em ago/2026 | Não | Shadow DOM fechado opcional / Proxy | `channel` | Não documentado | Não | Não |
| [Piral](https://github.com/smapiot/piral/blob/develop/docs/questions/general.md) | Ativo, 1.12.4 | Shell em React | Nenhum / nenhum | `setData` e `getData` | Com servidor próprio | Só a API do shell | Campo existe, verificação não especificada |
| [Vercel Microfrontends](https://vercel.com/changelog/microfrontends-now-generally-available) | GA em out/2025 | Plataforma, divide por rota | Página inteira por app | Nenhum | Por app | Não se aplica | Não se aplica |

Onde o vitral perde hoje: estado compartilhado, modo dev, tipos entre deploys, sandbox de JS e SSR dos remotes. Veja [Quando não usar o vitral](/quando-nao-usar).
