---
"vitral": minor
---

Métricas de carregamento: cada etapa (`manifest`, `js`, `css`, `mount`) vira um `performance.measure` chamado `vitral:<remote>:<etapa>` e chega no novo `configure({ onMetric })`. O evento `vitral-ready` e o `ready` do componente Vue passam a trazer os tempos em `detail.timings`.
