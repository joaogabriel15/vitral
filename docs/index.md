---
layout: home

hero:
  name: vitral
  text: Feito de partes. Visto como um todo.
  tagline: Micro-frontends de qualquer framework numa página só, sem configuração de build no host.
  image:
    src: /logo.svg
    alt: vitral
  actions:
    - theme: brand
      text: Começo rápido
      link: /guia/
    - theme: alt
      text: GitHub
      link: https://github.com/joaogabriel15/vitral

features:
  - title: Só a URL no host
    details: O host carrega cada remote em runtime pelo vitral.json. Nenhum plugin de build no host.
  - title: Qualquer framework
    details: React, Next, Vue, Nuxt, Angular, Svelte, Solid, Preact, Lit e JS puro na mesma página.
  - title: Seguro por padrão
    details: Confere o hash do JS (SRI) e a origem antes de executar.
  - title: Falha isolada
    details: Um remote que quebra mostra o próprio erro. O resto da página continua funcionando.
---
