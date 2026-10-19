---
"vitral": patch
---

SRI pelo import map: antes de usar o mapa com `integrity`, a lib confere que o hash dele vale, carregando dois módulos de teste (o errado tem de falhar). Um navegador que recusa o mapa sem disparar `error` (Safari 18.0 a 18.3) ou que aceita sem conferir passa a usar o `modulepreload` com `integrity` ou o `blob:`, em vez de rodar o remote sem conferência. O CSS saiu do import map (o hash dele continua no `<link integrity>`), e navegadores sem import map nem tentam o mapa.
