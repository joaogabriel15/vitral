---
'vitral': patch
---

Troca de língua sem mostrar as chaves: com o adaptador `i18next()`, o `changeLanguage` baixa antes a nova língua de cada remote aberto, e a tela troca tudo junto (host e remotes) quando os textos chegam. Para outras bibliotecas, `languageReady(lng)` de `vitral/i18n` faz o mesmo antes da troca.
