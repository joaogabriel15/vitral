# ORIGIN_BLOCKED

A URL do remote (ou o `entry` do `vitral.json`) está numa origem que o host não permite.

## Regra

- Sem `allowedOrigins`, são permitidas a origem da página e as origens das URLs registradas pelo host (`configure({ remotes })`, `register`, `src` de componente). O `src` em atributo do `<vitral-remote>` não libera a própria origem.
- Com `allowedOrigins`, só as origens da lista. `'*'` libera todas.
- O `entry` do manifesto também é conferido. Um `vitral.json` em `cdn.empresa.com` não pode apontar o JS para outra origem.

## Como corrigir

Adicione a origem (protocolo + domínio + porta, sem caminho):

```ts
configure({
  allowedOrigins: ['https://cdn.empresa.com', 'https://static.parceiro.com'],
})
```
