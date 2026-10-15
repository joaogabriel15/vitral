---
"vitral": minor
---

Downloads em paralelo: com o manifesto em mãos, o CSS do remote baixa junto com o JS (antes só começava na montagem). `preload()` também baixa o CSS, e `configure()`/`register()` adicionam `<link rel="preconnect" crossorigin>` para a origem de cada remote.
