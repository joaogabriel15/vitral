---
title: Marca
description: Logo, cores, nome e textos do vitral para usar em posts, palestras e documentação.
---

<script setup>
import { withBase } from 'vitepress'
</script>

# Marca

Tudo o que você precisa para falar do vitral num post, numa palestra ou no README do seu projeto. Os arquivos estão em [`docs/public/marca`](https://github.com/joaogabriel15/vitral/tree/main/docs/public/marca) e são livres para usar.

## Nome

**vitral**, sempre em minúsculas, inclusive no começo da frase. O pacote no npm tem o mesmo nome: `vitral`.

## Lema e descrição

| Uso | Texto |
| --- | --- |
| Lema | Feito de partes. Visto como um todo. |
| Uma linha | Micro-frontends de qualquer framework numa página só, sem configuração de build no host. |
| Um parágrafo | Cada equipe publica o próprio pedaço da página com `vite build`. O host recebe a URL de cada pedaço e monta tudo no navegador. Não há plugin no host, não há versão de React para combinar entre equipes e um pedaço fora do ar não derruba a página. |
| Em inglês | Micro-frontends from any framework on one page. No build config on the host. |

Ao citar números, use os do [benchmark](/aprender/benchmark) com a condição em que foram medidos (Chromium, Slow 4G, mediana de 7 visitas) e o link para a página.

## Logo

<div class="vt-marca-logos">
  <div class="claro"><img :src="withBase('/logo.svg')" alt="Logo do vitral sobre fundo claro" width="120" height="120"></div>
  <div class="escuro"><img :src="withBase('/logo.svg')" alt="Logo do vitral sobre fundo escuro" width="120" height="120"></div>
</div>

- Arquivo: [`logo.svg`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/logo.svg).
- Deixe em volta um espaço livre de pelo menos 1/4 da largura do logo.
- Tamanho mínimo: 24 px.
- Não mude as cores, não gire, não aplique sombra nem contorno.

## Cores

<div class="vt-marca-cores">
  <div style="--c:#2563eb"><b>Cobalto</b><code>#2563eb</code></div>
  <div style="--c:#059669"><b>Esmeralda</b><code>#059669</code></div>
  <div style="--c:#d97706"><b>Âmbar</b><code>#d97706</code></div>
  <div style="--c:#e11d48"><b>Rubi</b><code>#e11d48</code></div>
  <div style="--c:#161b26"><b>Chumbo</b><code>#161b26</code></div>
</div>

As quatro cores aparecem juntas, nesta ordem, na faixa sob a barra do site e no topo das imagens. O chumbo é o fundo do tema escuro e da imagem de compartilhamento. No logo, os vidros usam tons mais claros das mesmas cores (`#3b82f6`, `#10b981`, `#f59e0b`, `#f43f5e`) e o centro é violeta (`#8b5cf6`).

## Tipografia

[Inter](https://rsms.me/inter/) para texto, peso 800 no nome e 600 no lema. [JetBrains Mono](https://www.jetbrains.com/lp/mono/) para código.

## Imagens prontas

| Arquivo | Tamanho | Uso |
| --- | --- | --- |
| [`og.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/og.png) | 1200x630 | Prévia de links (site, GitHub, redes sociais) |
| [`banner.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/banner.png) e [`banner-escuro.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/banner-escuro.png) | 2560x640 | Topo de README e de posts |
| [`como-funciona.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/como-funciona.png) e [`como-funciona-escuro.png`](https://github.com/joaogabriel15/vitral/blob/main/docs/public/marca/como-funciona-escuro.png) | 2400x986 | Diagrama de equipes, CDN e host |

<img :src="withBase('/marca/og.png')" alt="Imagem de compartilhamento do vitral" style="border-radius:8px;margin-top:16px">

As imagens saem de [`docs/scripts/marca/pecas.html`](https://github.com/joaogabriel15/vitral/blob/main/docs/scripts/marca/pecas.html). Para mudar um texto, edite o HTML e rode `pnpm --dir docs marca`.
