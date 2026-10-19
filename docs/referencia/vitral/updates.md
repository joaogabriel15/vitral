# watchUpdates

Troca um remote montado pela versão nova quando sai um deploy.

```ts
watchUpdates(): () => void
checkUpdates(): Promise<string[]>
refresh(name: string): Promise<void>
```

## Uso

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates()

events.on('vitral:update-available', ({ name }) => refresh(name))
```

## Funções

| Função | O que faz | Retorno |
| --- | --- | --- |
| `watchUpdates()` | Confere os `vitral.json` dos remotes montados a cada navegação | Função que desliga |
| `checkUpdates()` | Confere agora | Nomes com versão nova |
| `refresh(nome)` | Baixa a versão nova e troca todas as montagens, com as props atuais | Promise |

## Observações

- `vitral:update-available` sai uma vez por deploy, com `{ name, entry }`.
- `await refresh(nome)` resolve quando todas as montagens já mostram a versão nova.
- Se a versão nova não carregar ou o `mount` dela falhar, a antiga continua na tela e `refresh` rejeita com o `RemoteError`.
- Dois `refresh` seguidos do mesmo remote: fica a versão do último, mesmo que o primeiro termine depois.
- Só remotes registrados pela URL do `vitral.json` são conferidos.
