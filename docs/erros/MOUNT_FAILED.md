# MOUNT_FAILED

O remote carregou, mas a função `mount()` dele lançou erro. O vitral remove o elemento criado e cancela as assinaturas de eventos do remote.

## Como corrigir

O erro original fica em `error.cause`. Causas comuns:

- Prop obrigatória que o host não mandou.
- O remote espera um elemento ou variável global que não existe no host.

Para mostrar uma mensagem no lugar do remote, use o estado de erro do componente de host (ex.: slot `error` no Vue) ou `onStatus` em `createSlot`.
