---
"vitral": minor
---

SRI sem `blob:` onde o navegador confere o hash: import map com `integrity` (Chrome 133+, Safari 18.4+) ou `<link rel="modulepreload" integrity>` (Firefox, Chromium antigo), escolhidos pelo comportamento do navegador. Nos outros casos, e para um remote que já falhou, continua o `blob:` com os bytes conferidos. O manifesto aceita `files` (hash de cada arquivo) e `split` (build dividido), o CSS do manifesto passa a ser conferido, e `configure({ remotes })` aceita o manifesto embutido (`{ url, manifest }`).
