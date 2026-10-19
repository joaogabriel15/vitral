---
"vitral": minor
---

Novo `ctx.portalContainer`: destino para popovers, menus e dialogs (Radix, MUI, `Teleport`). No Shadow DOM é um elemento dentro do shadow root, com o CSS e o tema do remote, e sai no unmount; sem Shadow DOM é o `document.body`. Em React e Vue, `usePortalContainer()`.
