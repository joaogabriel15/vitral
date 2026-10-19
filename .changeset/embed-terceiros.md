---
'vitral': minor
---

Novo `dist/embed.js`: loader de uma linha para widget em site de terceiros, sem bundler. `<script src=".../vitral@x/dist/embed.js" data-remote="https://cdn/chat/stable/vitral.json" data-target="#chat" data-props='{"lang":"pt"}' async>` monta o widget com Shadow DOM por padrão (o CSS não vaza no site) e libera só a origem do widget, para HTML injetado no site não carregar JS de outra origem. É um arquivo só (IIFE, cerca de 10 kB com brotli).

Novo comando `npx vitral canal <vitral.json | url>`: gera o `vitral.json` de um canal (`stable`, `beta`) que aponta para os arquivos de uma versão publicada em `../<versão>/`, para publicar cada versão numa pasta que nunca muda e trocar de versão só mudando o manifesto do canal.

Doc nova: "Widget em site de terceiros", com receitas de CSP (com nonce e com lista de origens) e de cache.
