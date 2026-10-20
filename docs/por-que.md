---
title: Por que o vitral
description: O que o vitral resolve, quando usar, quando não usar e como explicar para o seu time.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Por que o vitral

Em uma frase: **o vitral junta micro-frontends de qualquer framework numa página só, e o host não precisa de configuração de build.**

## O problema

Um micro-frontend é um pedaço da página (carrinho, busca, menu) que uma equipe constrói e publica sozinha. A página final, o host, junta esses pedaços.

As ferramentas mais usadas para isso cobram caro:

- **Module Federation:** o build do host e o de cada remote precisam combinar. Versões de React e Vue entram em `shared` e singletons, e uma versão errada quebra em produção. Um deploy novo com cache velho gera `ChunkLoadError`.
- **single-spa:** root config, import map, um adaptador e um ciclo de vida por framework, antes de mostrar o primeiro componente.
- **iframe:** isola tudo, mas cada pedaço baixa o próprio framework, e altura, rotas, foco e tema precisam ser sincronizados à mão.

Em todos eles, o CSS de uma equipe pode mudar a tela de outra, e um remote fora do ar pode derrubar a página inteira.

## Como o vitral resolve

<picture class="vt-diagrama">
  <img class="so-claro" :src="withBase('/marca/como-funciona.png')" alt="Três equipes (React, Vue, Angular) publicam um vitral.json cada uma num CDN. O host lê as URLs com configure e monta os três remotes na mesma página.">
  <img class="so-escuro" :src="withBase('/marca/como-funciona-escuro.png')" alt="">
</picture>

1. **Cada equipe** exporta o componente como `default` e adiciona `vitral()` ao `vite.config`. O build gera o JS, o CSS e um `vitral.json`.
2. **Cada equipe** publica a pasta `dist` em qualquer CDN, quando quiser.
3. **O host** registra a URL de cada `vitral.json` com `configure()` e renderiza `<Remote name="carrinho" />`.

Por baixo, um contrato só: o remote exporta `mount(el, props, ctx)` e devolve `{ update, unmount }`. Os adaptadores de React, Vue, Angular, Svelte, Solid, Preact e Lit escrevem esse contrato por você.

## O que você ganha

| | Como |
| --- | --- |
| Sem build no host | O host só precisa da URL. Funciona até com uma tag `<script>` em HTML puro |
| Qualquer framework | Host e remote não precisam combinar. Cada remote leva o próprio framework, e o `dedupe` evita baixar o mesmo duas vezes |
| CSS isolado | O plugin prefixa o CSS do remote. Tailwind funciona. Shadow DOM com uma prop |
| Erro isolado | Cada remote mostra o próprio erro, com código e link para a correção. `retry` monta só aquele remote |
| Segurança | Allowlist de origens e hash SHA-384 conferido antes de rodar o JS |
| Props tipadas | O build publica `vitral.d.ts`. Uma prop errada não compila no host |
| Deploy independente | Arquivos com hash; só o `vitral.json` revalida. Canary e rollback trocando um ponteiro |

## Os números

Do [benchmark público](/aprender/benchmark), no Chromium, com rede Slow 4G, mediana de 7 visitas:

<div class="vt-numeros">
  <div><b>3,4 kB</b><span>código de host mínimo, com brotli. O do Module Federation tem 19,4 kB.</span></div>
  <div><b>-57%</b><span>de tempo na primeira visita contra o Module Federation com React compartilhado.</span></div>
  <div><b>4,6x</b><span>mais rápido para trocar de área que o Next.js Multi-Zones.</span></div>
  <div><b>63%</b><span>menos bytes para abrir duas áreas que o Next.js Multi-Zones.</span></div>
</div>

A página do [benchmark](/aprender/benchmark) mostra o método e as versões.

## Quando usar

- Várias equipes publicam partes da mesma página, cada uma no seu ritmo.
- Partes da página usam frameworks diferentes, ou estão migrando de um para outro.
- Você quer trocar Module Federation, single-spa, qiankun ou Next.js Multi-Zones. Há um [guia de migração](/migracao/module-federation) para cada um.
- Você quer pôr um widget seu no site de outra empresa com uma tag `<script>`.

## Quando não usar

- **Uma equipe, um app:** um bundle só é mais simples. Use componentes e lazy loading do seu framework.
- **Código de terceiros em que você não confia:** o Shadow DOM isola o CSS, não o JS. Use [iframe](/aprender/iframe).
- **Primeira visita sem servidor na frente:** sem o gateway de SSR, o HTML do host chega vazio e a primeira pintura espera o JS. Com o [gateway](/aprender/ssr#rotas-com-ssr), a primeira pintura empata com o Next.

## Como explicar para o seu time

**Para quem programa:** "Cada time faz `vite build` do próprio componente e publica num CDN. O host chama `configure({ remotes })` e usa `<Remote name="carrinho" />`. Sem plugin no host e sem combinar versão de React."

**Para quem decide a arquitetura:** "Deploy independente por equipe, com CSS e erros isolados por remote, hash conferido antes de executar e props tipadas entre host e remote. O host mínimo tem 3,4 kB."

**Para quem gerencia:** "Cada equipe publica a sua parte do site sem esperar as outras. Se uma parte quebra, só ela some, e o resto do site continua no ar."

## Próximo passo

<div class="vt-actions">
  <a class="vt-btn primary" :href="withBase('/aprender/configurar')">Configurar host e remote</a>
  <a class="vt-btn" :href="withBase('/aprender/benchmark')">Ver o benchmark</a>
</div>

Ou gere host e remote prontos com `npm create vitral@latest`.
