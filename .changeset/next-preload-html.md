---
"vitral": minor
---

Host Next: o remote baixa junto com o JS do host. No build, o `withVitral` lê o `vitral.json` do remote (em `public/` ou na nova opção `manifestFile`) e o `NextRemote` põe no `<head>` um `<link rel="preload">` para o manifesto, o CSS e o JS da primeira tela, com o hash no `integrity`. `htmlPreload: false` desliga. O `vitral/next-host` traz o código de SRI e de `dedupe` no bundle do host, e o loader pede o manifesto sem esperar as ofertas de `dedupe` (vale para todo host). O manifesto passa a ser pedido com `credentials: 'same-origin'`, o modo do preload: de outra origem continua sem cookies. Num modelo com Slow 4G e CPU 4x, abrir a página do remote direto caiu de 4,8 s para 3,2 s sem cache e de 2,0 s para 1,4 s com cache.

Ofertas de `dedupe` só com os nomes usados: o manifesto do remote ganha `uses`, com os nomes que ele lê de cada especificador. O `withVitral` gera cada oferta de `share` com `webpackExports` e só esses nomes, quando acha o manifesto de todos os remotes no build. Antes, o `import()` do pacote inteiro fazia o webpack levar para as páginas do host o que elas não usam de uma biblioteca de componentes (gráficos de um barrel, por exemplo). Se a oferta não tem um nome que o remote usa, o boot do remote usa a cópia própria daquele grupo e avisa no console.
