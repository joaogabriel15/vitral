# NOT_REGISTERED

O host pediu um remote pelo nome, mas esse nome não está registrado.

## Causas

- O nome em `<vitral-remote name="...">`, `<Remote name="...">` ou `mountRemote(el, '...')` está diferente do nome em `configure({ remotes })`.
- `configure()` ainda não rodou quando o remote foi montado.
- `register(name, {})` foi chamado sem `url` nem `module`.

## Como corrigir

Registre o remote antes de montar:

```ts
configure({
  remotes: {
    carrinho: 'https://cdn.empresa.com/carrinho/vitral.json',
  },
})
```

Com `remotes: 'https://.../remotes.json'`, confira se o arquivo tem a chave com esse nome.
