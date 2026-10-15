---
layout: home

hero:
  name: vitral
  text: Feito de partes. Visto como um todo.
  tagline: Conecte aplicações de repositórios diferentes, com deploys independentes e sem plugin de build no host.
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
  - title: Controle do carregamento
    details: Verifica a origem e confere integridade quando há hash. Consulte os limites no guia de segurança.
  - title: Falha isolada
    details: Fallback e tentativa de novo por área para falhas de carregamento e erros reportados pelo remote.
---
