---
"vitral": patch
---

Dedupe: um remote com `import * as React` num host Next de produção não usa mais a cópia própria do React. O `uses` do manifesto vinha com os nomes do React de desenvolvimento (`act`, `captureOwnerStack`), que o React de produção do host não tem, e o boot trocava a oferta do host pela cópia própria. Agora os nomes são lidos num processo à parte com `NODE_ENV=production`, e em CommonJS só contam os que existem no `module.exports`. No grupo do React, um nome que falta na oferta só gera aviso: o remote fica com o React do host.

Host Next: na página de um remote, o chunk do webpack de cada oferta de `share` que o remote vai pedir começa a baixar quando o `_app` é avaliado, antes da hidratação, e não quando o remote pede a oferta.
