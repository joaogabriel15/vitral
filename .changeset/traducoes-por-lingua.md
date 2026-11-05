---
'vitral': minor
---

Traduções por remote e por língua (`vitral/i18n`). Com `i18n: 'src/locales/{lng}.json'` no plugin, cada língua sai num arquivo com hash, listado no `vitral.json`. Com `configure({ i18n: i18next(i18n) })` no host, o remote baixa só a língua aberta, junto com o JS, e as traduções entram no i18next do host antes de montar. Numa troca de língua, os remotes já carregados baixam a nova. No host Next, `<VitralNext lang>` e `<NextRemote lang>` pré-carregam no HTML a tradução da língua aberta.

As dicas que só o `VitralNext` põe no HTML (o remote ainda não está na página) saem em prioridade baixa, para não tirar banda do JS do host. Os preloads `as=fetch` saem sem `integrity` (o navegador não confere e avisava no console); o `fetch` do vitral continua conferindo.

Dedupe: quando a cópia própria de um pacote usa outro pacote do dedupe (`react-i18next` usa `react`), ela só roda depois que o outro entrou. Antes, o arquivo único quebrava ao montar.
