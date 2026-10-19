---
'vitral': minor
---

Novo `dist/embed.js`: loader de uma linha para widget em site de terceiros, sem bundler. `<script src=".../vitral@x/dist/embed.js" data-remote="https://cdn/chat/canal.json" data-target="#chat" data-props='{"lang":"pt"}' async>` monta o widget com Shadow DOM por padrão (o CSS não vaza no site) e libera só a origem do widget, para HTML injetado no site não carregar JS de outra origem. É um arquivo só (IIFE, cerca de 11 kB com brotli) e já lê o `canal.json`: voltar uma versão em todos os sites é editar o canal.

Novo comando `npx vitral canal <canal.json>`: cria e edita o canal sem abrir o JSON (`--stable 1.4.0`, `--canary 1.5.0 --percent 10`, `--percent 50`, `--canary off`).

Doc nova: "Widget em site de terceiros", com receitas de CSP (com nonce e com lista de origens) e de cache.
