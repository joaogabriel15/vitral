# TIMEOUT

O remote não terminou de baixar ou de carregar dentro do tempo limite (padrão: 15000 ms). Vale para o manifesto, para o JS e para o `remotes.json`.

## Causas

- CDN lento ou fora do ar.
- Arquivo muito grande para a conexão do usuário.
- Um `import` de nível superior no remote que nunca termina.

## Como corrigir

Confira a URL na aba Network do navegador. Se o tempo for normal para o seu caso, aumente o limite:

```ts
configure({ timeout: 30000 })
```

Erros de `TIMEOUT` são repetidos `retries` vezes (padrão: 1), com espera de 200 ms, 400 ms, 800 ms…
