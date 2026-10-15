# vitral

**Feito de partes. Visto como um todo.**

Conecte aplicações de repositórios diferentes na mesma página, com deploys independentes e sem plugin de build no host.

O **host** é a aplicação principal. Cada **remote** é uma área publicada separadamente: produtos, employee, checkout ou um widget. Uma entrada pode representar a aplicação inteira, com várias páginas.

## Experimente

Use Node.js 22.12+ ou 24 LTS. Em um terminal:

```bash
npm create vitral@latest produtos -- --remote --framework react
cd produtos
npm install
npm run dev
```

Em outro terminal, na pasta onde criou `produtos`:

```bash
npm create vitral@latest principal -- --host --framework react
cd principal
npm install
npm run dev
```

Abra o endereço do host, normalmente `http://localhost:5173`. Ele carrega o remote da porta `5174`. Edite `produtos/src/App.jsx` para ver a alteração.

Já tem os projetos? Veja [Conectar projetos existentes](https://joaogabriel15.github.io/vitral/guia/repositorios).

## Como funciona

No remote React com Vite:

```jsx
// src/remote.jsx
import { reactRemote } from 'vitral/react'
import ProdutosApp from './ProdutosApp'

export default reactRemote(ProdutosApp)
```

```js
// vite.config.js
import react from '@vitejs/plugin-react'
import vitral from 'vitral/vite'

export default {
  plugins: [react(), vitral({ entry: 'src/remote.jsx' })],
}
```

O build gera o JavaScript, o CSS importado pela aplicação e o `vitral.json`. Publique os arquivos em um servidor ou CDN com CORS.

No host React:

```jsx
import { Remote } from 'vitral/react'

export function AreaProdutos({ usuario }) {
  return (
    <Remote
      src="https://cdn.empresa.com/produtos/vitral.json"
      props={{ usuario }}
      fallback={<p>Carregando…</p>}
      error={(erro, retry) => <button onClick={retry}>Tentar novamente</button>}
    />
  )
}
```

O host também pode registrar URLs por nome com `configure()`. Atualizar as props atualiza o remote sem remontar.

## Onde usar

- Áreas mantidas por equipes com deploys independentes.
- Migração gradual entre aplicações ou frameworks.
- Widgets usados em vários produtos.

React, Vue, Angular, Svelte, Solid, Preact, Lit e JavaScript puro têm adaptadores. Next e Nuxt podem hospedar remotes no cliente; o servidor renderiza o fallback, não o conteúdo do remote.

Se uma equipe publica tudo junto, pacotes compartilhados costumam ser mais simples. Veja [Quando não usar](https://joaogabriel15.github.io/vitral/quando-nao-usar).

## Documentação

- [Começo rápido](https://joaogabriel15.github.io/vitral/guia/)
- [Conectar repositórios](https://joaogabriel15.github.io/vitral/guia/repositorios)
- [Rotas e navegação sem reload](https://joaogabriel15.github.io/vitral/receitas/rotas)
- [Login e usuário](https://joaogabriel15.github.io/vitral/receitas/autenticacao)
- [Publicação](https://joaogabriel15.github.io/vitral/guia/publicacao)
- [Estilos](https://joaogabriel15.github.io/vitral/guia/estilos), [performance](https://joaogabriel15.github.io/vitral/guia/performance) e [segurança](https://joaogabriel15.github.io/vitral/guia/seguranca)
- [Referência da API](https://joaogabriel15.github.io/vitral/api/) e [erros](https://joaogabriel15.github.io/vitral/erros/)

O carregamento inclui verificação de origem e confere integridade quando há hash. Shadow DOM isola estilos, não JavaScript; carregue código confiável. Os limites estão no guia de segurança.

## Desenvolvimento

[Exemplos](examples/) · [Como contribuir](CONTRIBUTING.md) · [Benchmarks](bench/) · [Licença MIT](LICENSE)
