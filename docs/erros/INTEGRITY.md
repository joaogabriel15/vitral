# INTEGRITY

O hash dos bytes baixados não confere com o `integrity` declarado. O código não é executado.

## Causas

- O JS foi alterado depois do build (CDN, proxy ou ataque).
- O `integrity` registrado no host é de um build antigo.
- O servidor muda os bytes (minificação, troca de quebras de linha, inserção de BOM).
- O valor não está no formato SRI: `sha256-...`, `sha384-...` ou `sha512-...`.

## Como o hash é conferido

- O hash é calculado sobre os bytes exatos da resposta, como no navegador.
- Com vários hashes (`sha256-A sha384-B`), vale o algoritmo mais forte. O arquivo precisa bater com um dos hashes desse algoritmo.
- A mensagem do erro mostra o hash esperado e o obtido.

## Como corrigir

Use o `vitral.json` gerado pelo plugin `vitral/vite`: ele traz o hash do build e muda a cada deploy. Se você declara `integrity` no host, atualize o valor junto com o deploy do remote.
