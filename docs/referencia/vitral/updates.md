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
- Se a versão nova falhar, a antiga continua na tela.
- Só remotes registrados pela URL do `vitral.json` são conferidos.
