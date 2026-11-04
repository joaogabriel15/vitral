---
'vitral': minor
---

Política adaptativa por rede e aparelho (`configure({ policy })`, `policy()`, `choose()`, `signalsFrom()`). Com 2G ou economia de dados (`'lazy'`), só baixa o que a página usa e o `<vitral-remote>` com HTML do servidor hidrata ao aparecer na tela. Com 3G ou até 2 GB de memória (`'critical'`), corta o preload ocioso dos outros remotes e o `warmRoutes`; o prefetch previsto continua.
