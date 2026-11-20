---
'vitral': minor
---

Correções de segurança e de rede, faixas de versão do npm, cancelamento de montagem e textos em inglês.

- `<vitral-remote src>` (e `registerSrc(url, nome, false)`) não libera mais a própria origem quando o host não define `allowedOrigins`. Um `src` injetado no HTML só carrega se a origem estiver em `allowedOrigins` ou já tiver sido registrada pelo host. Sem build, liste as origens no script: `<script type="module" src=".../auto.js" data-origins="https://cdn.empresa.com">`. Com bundler, use `configure({ allowedOrigins: [...] })`. Em `localhost` continua sem precisar.
- `retries` agora vale também para o `vitral.json` e o `remotes.json`. Um `remotes.json` que falhou baixa de novo na próxima montagem (ou no "Tentar de novo"), em vez de travar a página até recarregar.
- `configure({ contract })` aceita a sintaxe do npm: `'^2 || ^3'`, `'>=2 <4'`, `'2.x'`, `'1.2 - 2'`. Uma faixa que não é versão dá um `CONTRACT_MISMATCH` que diz isso.
- `mountRemote(el, nome, props, { signal })`: cancela a montagem. Os componentes de host já cancelam sozinhos quando saem da tela antes de o remote chegar, e o `mount()` do remote não roda à toa.
- `devOverrides: { preview }` só aceita apelidos, `localhost` e URLs do modelo. URL de outra origem é ignorada com aviso. `devOverrides: true` continua aceitando qualquer URL.
- Os textos da lib (carregando, erro padrão, mensagens de `RemoteError` e link da documentação do erro) seguem a língua da página: português quando o `<html lang>` é `pt`, inglês nos outros casos. Troque com `configure({ language: 'pt' })` e `configure({ messages: { loading, error, retry } })`.
