# LOAD_FAILED

O remote não pôde ser baixado ou executado.

## Causas

- Resposta HTTP com erro (404, 500…). A mensagem mostra o status e a URL.
- Erro de rede ou de CORS. O servidor do remote precisa responder com `Access-Control-Allow-Origin`.
- O JS lançou erro ao ser importado. O erro original fica em `error.cause`.

## Como corrigir

1. Abra a URL da mensagem no navegador.
2. Confira o CORS na aba Network.
3. Veja `error.cause` para o erro original do JS.

Erros de `LOAD_FAILED` são repetidos `retries` vezes (padrão: 1) e não ficam em cache: a próxima montagem tenta de novo.
