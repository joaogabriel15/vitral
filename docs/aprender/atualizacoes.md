# Atualização sem reload

Troca um remote montado pela versão nova quando sai um deploy, sem recarregar a página.

## Quando usar

Em SPAs que ficam abertas por horas.

## Código

```ts
import { events, refresh, watchUpdates } from 'vitral'

watchUpdates() // confere os manifestos a cada navegação

events.on('vitral:update-available', ({ name }) => {
  refresh(name) // ou mostre um aviso e chame quando o usuário quiser
})
```

| Função | O que faz |
| --- | --- |
| `watchUpdates()` | Confere os `vitral.json` dos remotes montados a cada navegação. Devolve a função que desliga |
| `checkUpdates()` | Confere agora. Devolve os nomes com versão nova |
| `refresh(nome)` | Baixa a versão nova e troca todas as montagens, com as props atuais |

- `vitral:update-available` sai uma vez por deploy, com `{ name, entry }`.
- Se a versão nova falhar, a antiga continua na tela.
- Só remotes registrados pela URL do `vitral.json` (ou de um [canal](./canary)) são conferidos.
