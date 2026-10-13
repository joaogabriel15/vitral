# Changesets

Toda mudança que afeta quem usa o pacote leva um changeset:

```bash
pnpm changeset
```

Escolha `patch` (correção), `minor` (novidade) ou `major` (quebra), escreva
uma linha do que mudou e faça commit do arquivo gerado. Quando o PR entra na
`main`, o GitHub Actions abre (ou atualiza) o PR "Versionar pacote"; ao fazer
merge dele, a versão nova é publicada no npm.
