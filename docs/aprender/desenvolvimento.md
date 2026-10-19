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

Troca a URL de um remote sem mexer no host. Os outros remotes continuam vindo das URLs que o host registrou (homologação, por exemplo). Vale em `localhost`. Fora dele, só com `configure({ devOverrides })`. Nunca ligue em produção.

Para trocar mais de um, separe por vírgula: `?vitral=carrinho@http://localhost:5174,conta@http://localhost:5175`.

A troca fica guardada na aba (`sessionStorage`). Ela continua valendo depois de recarregar ou de navegar para uma URL sem o `?vitral=`. Fechar a aba descarta a troca.

## Link para o preview de um PR

Com um modelo de URL, a troca aceita um apelido no lugar da URL:

```ts
configure({
  remotes: '/remotes.json',
  devOverrides: { preview: 'https://{name}-{ref}.preview.empresa.com' },
})
```

```
https://homolog.empresa.com/?vitral=checkout@pr-123
```

`checkout` passa a vir de `https://checkout-pr-123.preview.empresa.com/vitral.json`. `{name}` é o nome do remote e `{ref}` é o apelido. Sem `/vitral.json` no fim, o vitral completa. O apelido é qualquer texto só com letras, números, `.`, `-` e `_` (`pr-123`, `main`, `1.4.0`). Qualquer outra coisa é tratada como URL.

Mande esse link no PR para quem vai revisar. O resto da página continua vindo de homologação.

O objeto em `devOverrides` liga as trocas, como `true`. Passe o objeto só nos ambientes que não são produção:

```ts
devOverrides: import.meta.env.VITE_AMBIENTE !== 'producao' && { preview: 'https://{name}-{ref}.preview.empresa.com' },
```

Sem `preview`, o apelido é ignorado com um aviso no console.

## Ver e limpar as trocas ativas

Cada troca escreve um aviso no console na primeira vez que o remote carrega:

```
[vitral] override ativo: checkout → https://checkout-pr-123.preview.empresa.com/vitral.json (aba). Para limpar: ?vitral=off
```

| Na URL | O que faz |
| --- | --- |
| `?vitral=nome@url` | Troca `nome` por `url` nesta aba |
| `?vitral=nome@pr-123` | Troca `nome` pelo preview (precisa de `preview`) |
| `?vitral=nome@off` | Remove a troca de `nome` |
| `?vitral=off` | Remove todas as trocas (da aba e do navegador) |

Para guardar trocas em todas as abas, use o painel:

```ts
import { devtools } from 'vitral/devtools'

devtools() // botão "vitral" no canto da página
```

O botão mostra quantas trocas estão ativas, por exemplo `vitral (2)`. O painel lista cada uma com a origem: `aba` (veio de `?vitral=`) ou `navegador` (guardada no `localStorage`). Dá para remover uma ou limpar todas.

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `devOverrides` (`configure`) | `false` | `true` aceita `?vitral=` fora de `localhost`. `{ preview }` faz o mesmo e resolve apelidos |
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

O TypeScript 7 (nativo, que o `create-vite` instala) ainda não tem API em JavaScript. Com ele, o plugin procura outro TypeScript (5 ou 6) instalado; sem nenhum, o build segue sem `vitral.d.ts`. Para ter os tipos, instale `typescript@5` como dependência de desenvolvimento do remote.

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
