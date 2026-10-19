---
layout: page
title: vitral
titleTemplate: Micro-frontends de qualquer framework
---

<script setup>
import { withBase } from 'vitepress'
</script>

<div class="vp-doc vt-home">

<div class="vt-hero">
  <img :src="withBase('/logo.svg')" alt="" width="112" height="112">
  <h1>vitral</h1>
  <p class="vt-tagline">Feito de partes. Visto como um todo.</p>
  <p class="vt-desc">Junte micro-frontends de qualquer framework numa página só, sem configuração de build no host.</p>
  <div class="vt-actions">
    <a class="vt-btn primary" :href="withBase('/aprender/configurar')">Começar</a>
    <a class="vt-btn" :href="withBase('/referencia/')">Referência</a>
  </div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-cobalto)"></span>O host só precisa da URL

Registre a URL do `vitral.json` de cada remote e renderize. Nenhum plugin no build do host.

</div>
<div>

```jsx
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' },
})

export const App = () => <Remote name="carrinho" props={{ userId: 42 }} />
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-esmeralda)"></span>O remote é um componente comum

Exporte o componente como `default` e adicione o plugin. O build gera o `vitral.json`.

</div>
<div>

```js
// vite.config.js
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral()] }
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-ambar)"></span>Qualquer framework

React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit e JS puro. Host e remote não precisam combinar.

</div>
<div>

```vue
<template>
  <VitralRemote name="carrinho" :props="{ userId }">
    <template #fallback>Carregando…</template>
  </VitralRemote>
</template>
```

```html
<vitral-remote name="carrinho" props='{"userId": 42}'></vitral-remote>
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-rubi)"></span>CSS isolado

O CSS de cada remote vale só dentro dele. Tailwind funciona. Para isolar também o CSS do host, use Shadow DOM.

</div>
<div>

```css
/* CSS do remote */
.botao { color: red }

/* depois do build */
[data-vitral-scope="carrinho"] .botao { color: red }
```

```jsx
<Remote name="carrinho" isolate="shadow" />
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-cobalto)"></span>Um remote que falha não derruba a página

Cada remote mostra o próprio erro. `tentarDeNovo` monta só aquele remote de novo.

</div>
<div>

```jsx
<Remote
  name="carrinho"
  fallback={<p>Carregando…</p>}
  error={(erro, tentarDeNovo) => <button onClick={tentarDeNovo}>Tentar de novo</button>}
  onError={(erro) => log(erro.code)}
/>
```

</div>
</div>

<div class="vt-section">
<div>

## <span class="vt-dot" style="background:var(--vt-esmeralda)"></span>Pequeno

O código de host mínimo tem 3,4 kB com brotli. Sem build no host, uma tag de script basta.

</div>
<div>

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>

<vitral-remote src="https://cdn.empresa.com/carrinho/vitral.json"></vitral-remote>
```

</div>
</div>

<div class="vt-wide">

## Comparação

| | Module Federation | single-spa | qiankun | vitral |
| --- | --- | --- | --- | --- |
| Configuração no host | Plugin no build | Root config e import map | `registerMicroApps` e `start` | `configure({ remotes })` |
| Frameworks | Combinar dependências em `shared` | Um adaptador por framework | Qualquer, com entrada HTML | Qualquer |
| Isolamento de CSS | Nenhum | Nenhum | Shadow DOM ou prefixo | Escopo automático ou Shadow DOM |
| Código de host (brotli) | 19,4 kB | 5,8 kB | 37,9 kB | 3,4 kB |
| Confere o hash do JS (SRI) | Não, por padrão | Não, por padrão | Não, por padrão | Sim, quando o manifesto tem hash |

Comparação com a configuração padrão de cada ferramenta. Plugins e configuração extra podem mudar estes valores.

Vindo de uma dessas ferramentas? Veja [Migração](/migracao/module-federation).

</div>

<div class="vt-cta">

## Comece agora

<div class="vt-actions">
  <a class="vt-btn primary" :href="withBase('/aprender/configurar')">Configurar host e remote</a>
  <a class="vt-btn" href="https://github.com/joaogabriel15/vitral">GitHub</a>
</div>

</div>

</div>
