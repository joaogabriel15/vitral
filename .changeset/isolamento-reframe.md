---
'vitral': minor
---

Novo `isolate: 'reframe'`: o JS do remote roda num iframe oculto de mesma origem (globais, timers e ouvintes somem no unmount) e o DOM fica num shadow root na página, com layout, foco e eventos normais. Passa pelo mesmo SRI, allowlist e contrato; `history` do remote sincroniza com o do host. Não é fronteira de segurança: veja a lista do que não é isolado em /aprender/reframe.
