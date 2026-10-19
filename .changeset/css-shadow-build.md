---
"vitral": minor
---

Shadow DOM: o plugin prepara o CSS no build. O `vitral.json` ganha o campo `shadow`, com o CSS sem `@import`, `@property` e `@font-face` e um arquivo à parte com `@property` e `@font-face`, que entra num `<link>` no documento. A página só adota o CSS pronto, sem reescrever o texto, e o módulo do Shadow DOM passa a baixar junto com o JS do remote. O `css` continua igual: hosts antigos e manifestos antigos funcionam como antes.
