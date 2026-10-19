---
'vitral': minor
---

Nova entrada `vitral/vitals`: `vitals({ onReport })` relata LCP, CLS e INP de cada remote (pelo `data-vitral-root` que contém o elemento) e por rota, com `remote`, `version`, `route`, `navigationId` (Chromium com Soft Navigations), `value` e `rating`. FCP e TTFB saem para a página. `vitral/otel` ganha `otelVitals(meter)`, que grava cada vital num histograma do OpenTelemetry.
