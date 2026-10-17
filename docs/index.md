---
layout: home

hero:
  name: vitral
  text: Feito de partes. Visto como um todo.
  tagline: Junte micro-frontends de qualquer framework numa página só, sem configuração de build no host.
  image:
    src: /logo.svg
    alt: vitral
  actions:
    - theme: brand
      text: Começo rápido
      link: /comecar
    - theme: alt
      text: Frameworks
      link: /frameworks/react
    - theme: alt
      text: GitHub
      link: https://github.com/joaogabriel15/vitral

features:
  - title: Só a URL no host
    details: O host registra a URL de cada remote em runtime. Nenhum plugin de build no host.
  - title: Qualquer framework
    details: React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit e JS puro na mesma página.
  - title: CSS isolado
    details: O CSS de cada remote vale só dentro dele. Tailwind funciona, inclusive em Shadow DOM.
  - title: Seguro por padrão
    details: Confere o hash do JS (SRI) e a origem antes de executar.
  - title: Falha isolada
    details: Um remote que quebra mostra o próprio erro. O resto da página continua funcionando.
  - title: Pequeno
    details: O código de host mínimo tem 3,4 kB com brotli.
---

## Vantagens

- O host não muda o build. Ele chama `configure()` com as URLs.
- Host e remote não precisam usar o mesmo framework.
- Cada remote tem o próprio deploy. O host vê a versão nova sem novo build.
- Mudar `props` atualiza o remote sem remontar.
- Um contrato só para todos os frameworks: `mount(el, props, ctx)` devolve `{ update, unmount }`.
- Estado compartilhado, eventos, rotas, iframe, SSR com fallback, HMR e mocks para testes já vêm na lib.

## Por que usar o vitral

| | Module Federation | single-spa | qiankun | vitral |
| --- | --- | --- | --- | --- |
| Configuração no host | Plugin no build do host | Root config e import map | `registerMicroApps` e `start` | `configure({ remotes })` |
| Framework do host e do remote | Precisam combinar dependências em `shared` | Um adaptador por framework | Qualquer, com entrada HTML | Qualquer, com um componente de host por framework |
| Isolamento de CSS | Nenhum | Nenhum | Shadow DOM ou prefixo | Escopo automático ou Shadow DOM |
| Tamanho do código de host (brotli) | 19,4 kB (runtime) | 5,8 kB | 37,9 kB | 3,4 kB |
| Confere o hash do JS (SRI) | Não | Não | Não | Sim, com lista de origens |

Tamanhos medidos com esbuild e brotli em `@module-federation/runtime@2.9.2`, `single-spa@6.0.3`, `qiankun@2.10.16` e `vitral@0.1.0`. Os dados estão em [`bench/tamanho.json`](https://github.com/joaogabriel15/vitral/blob/main/bench/tamanho.json).

Vindo de uma dessas ferramentas? Veja [Migração](/migracao/module-federation).

## Em 30 segundos

```jsx
// host
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({ remotes: { carrinho: 'https://cdn.empresa.com/carrinho/vitral.json' } })

export const App = () => <Remote name="carrinho" props={{ userId: 42 }} />
```

```js
// vite.config.js do remote
import vue from '@vitejs/plugin-vue'
import vitral from 'vitral/vite'

export default { plugins: [vue(), vitral()] }
```

O host em React mostra um remote em Vue. [Começo rápido](/comecar).
