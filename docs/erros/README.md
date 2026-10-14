# Erros do vitral

Todo erro da lib é um `RemoteError` com `code`, `remote` (nome do remote) e `docs` (link para a página do código). A mensagem também traz o link.

```ts
createSlot(el, {
  name: 'carrinho',
  onStatus(status, error) {
    if (error) console.log(error.code, error.remote, error.docs)
  },
})
```

| Código | Quando acontece |
| --- | --- |
| [NOT_REGISTERED](NOT_REGISTERED.md) | O nome não foi registrado em `configure({ remotes })` |
| [ORIGIN_BLOCKED](ORIGIN_BLOCKED.md) | A URL do remote está fora de `allowedOrigins` |
| [TIMEOUT](TIMEOUT.md) | O remote não respondeu dentro de `timeout` |
| [INTEGRITY](INTEGRITY.md) | O hash do JS não confere com o `integrity` |
| [INVALID_MODULE](INVALID_MODULE.md) | O arquivo não exporta `mount()` ou o JSON é inválido |
| [LOAD_FAILED](LOAD_FAILED.md) | Erro de rede, HTTP ou erro ao executar o JS |
| [MOUNT_FAILED](MOUNT_FAILED.md) | `mount()` do remote lançou erro |
| [RENDER_FAILED](RENDER_FAILED.md) | O remote quebrou depois de montado |
