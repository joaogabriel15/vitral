# Desenvolvimento e HMR

Rode o remote com `vite dev` e veja as mudanças no host sem recarregar.

## Quando usar

Sempre que estiver editando um remote.

## HMR

```bash
# no remote
npx vite --port 5174
```

```ts
// no host
configure({ remotes: { carrinho: 'http://localhost:5174/vitral.json' } })
```

`vite dev` serve um `vitral.json` de desenvolvimento, com CORS e sem SRI. Editar o remote atualiza o host.

## Trocar um remote pela URL

```
http://localhost:3000/?vitral=carrinho@http://localhost:5174
```

Troca a URL de um remote sem mexer no host. Vale em `localhost`. Fora dele, só com `configure({ devOverrides: true })`. Nunca ligue em produção.

Para guardar as trocas no navegador, use o painel:

```ts
import { devtools } from 'vitral/devtools'

devtools() // botão "vitral" no canto da página
```

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `devOverrides` (`configure`) | `false` | Aceita `?vitral=` fora de `localhost` |
| `reload` (`devtools`) | `true` | Recarrega a página ao mudar uma troca |

## Tipos das props

O build do remote publica `vitral.d.ts`. No host:

```bash
npx vitral types
```

Gera `vitral-env.d.ts` a partir do `remotes.json`. Uma prop errada em `<Remote name="carrinho">` passa a não compilar.

O plugin lê as props com o Oxc (`isolatedDeclaration`), que já vem no Vite 8. No Vite 5 a 7, instale `oxc-transform` para ter o mesmo ganho. O Oxc exige tipo explícito nos exports da entrada:

```tsx
export default function App(props: Props): JSX.Element { … }
```

Sem tipo explícito, ou sem Oxc, o plugin usa o TypeScript do projeto, como antes. O resultado é o mesmo, só mais lento.

O `vitral-env.d.ts` registra o hash do manifesto de onde veio o tipo de cada remote:

```ts
// vitral:hash "carrinho" sha384-…
```

No CI, `npx vitral types --check` sai com erro se algum manifesto mudou desde a última geração. Aí é rodar `npx vitral types` de novo.

| Opção | O que faz |
| --- | --- |
| `types` (plugin) | `false` não gera `vitral.d.ts`. Padrão `true` |
| `--base url` | Base das URLs relativas do `remotes.json` |
| `--out arquivo` | Arquivo gerado. Padrão `vitral-env.d.ts` |
| `--check` | Só confere os hashes, sem reescrever. Código `1` se algum mudou |
