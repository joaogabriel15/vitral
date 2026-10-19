# RemoteError

Todo erro da lib é um `RemoteError`.

```ts
class RemoteError extends Error {
  code: RemoteErrorCode
  remote: string
  docs: string
  cause?: unknown
}
```

## Uso

```jsx
<Remote name="carrinho" onError={(erro) => log(erro.code, erro.remote)} />
```

## Campos

| Campo | O que é |
| --- | --- |
| `code` | Código do erro |
| `remote` | Nome do remote |
| `docs` | Link da página do código, com causa e correção |
| `cause` | Erro original, quando há |

## Códigos

| Código | Quando |
| --- | --- |
| [`NOT_REGISTERED`](/erros/NOT_REGISTERED) | Nome sem URL registrada |
| [`NOT_EXPOSED`](/erros/NOT_EXPOSED) | Parte não publicada em `exposes` |
| [`ORIGIN_BLOCKED`](/erros/ORIGIN_BLOCKED) | Origem fora de `allowedOrigins` |
| [`TIMEOUT`](/erros/TIMEOUT) | Download passou do tempo limite |
| [`INTEGRITY`](/erros/INTEGRITY) | Hash não bate |
| [`INVALID_MODULE`](/erros/INVALID_MODULE) | Módulo sem `mount` |
| [`LOAD_FAILED`](/erros/LOAD_FAILED) | Falha de rede |
| [`MOUNT_FAILED`](/erros/MOUNT_FAILED) | `mount` lançou erro |
| [`RENDER_FAILED`](/erros/RENDER_FAILED) | Erro depois de montado |
| [`SHARED_READONLY`](/erros/SHARED_READONLY) | `set` numa chave só leitura |
| [`CONTRACT_MISMATCH`](/erros/CONTRACT_MISMATCH) | Contrato do remote fora da faixa do host |

## Observações

::: warning Atenção
Com duas cópias da lib na página, `instanceof RemoteError` pode falhar. Compare `erro.name === 'RemoteError'`.
:::
