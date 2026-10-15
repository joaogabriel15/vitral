---
"vitral": minor
---

Isolamento por iframe, em `vitral/iframe`: depois de `enableIframe()`, `isolate="iframe"` roda o remote num iframe `sandbox="allow-scripts"` com origem opaca. A página confere origem e SRI e manda os bytes verificados para o iframe; props, `ctx.events` e `ctx.navigate` (só na mesma origem) passam por `postMessage`, e a altura acompanha o conteúdo. `FRAME_SCRIPT` permite liberar o script do iframe no CSP por hash.
