# Começo rápido

O vitral conecta aplicações de repositórios diferentes na mesma página. O **host** é a aplicação principal; cada **remote** é uma área que você publica separadamente.

Você configura uma entrada por aplicação, não uma por página. Por exemplo: o principal cuida do login e do menu; produtos e employee têm seus próprios repositórios e páginas.

## Experimente com dois projetos

Use Node.js 22.12+ ou 24 LTS e npm. Este exemplo cria um host React e um remote React; eles também podem usar frameworks diferentes.

### 1. Suba o remote

Em um terminal:

```bash
npm create vitral@latest produtos -- --remote --framework react
cd produtos
npm install
npm run dev
```

Deixe o terminal aberto. O remote serve seu manifesto em `http://localhost:5174/vitral.json`.

### 2. Suba o host

Em outro terminal, a partir da pasta onde você criou `produtos`:

```bash
npm create vitral@latest principal -- --host --framework react --src http://localhost:5174/vitral.json
cd principal
npm install
npm run dev
```

Abra o endereço que o Vite mostrar, normalmente `http://localhost:5173`. Você verá o componente do remote dentro do host. Edite `produtos/src/App.jsx` e veja a alteração no navegador.

::: tip Já tem os repositórios?
Não precisa gerar novos projetos. Siga [Conectar projetos existentes](./repositorios).
:::

## O que conecta os dois?

No remote, o plugin `vitral/vite` prepara a aplicação e gera o `vitral.json`. No host, o componente recebe essa URL:

```jsx
import { Remote } from 'vitral/react'

export default function App() {
  return (
    <Remote
      src="http://localhost:5174/vitral.json"
      props={{ nome: 'João' }}
      fallback={<p>Carregando…</p>}
      error={(erro, retry) => <button onClick={retry}>Tentar novamente</button>}
    />
  )
}
```

O remote pode ser um widget, uma página ou uma aplicação com várias rotas. O host não precisa de plugin de build do vitral.

## Próximos passos

- [Conectar projetos existentes](./repositorios): configure uma entrada por repositório.
- [Navegar entre áreas](/receitas/rotas): escolha o remote pela URL, sem recarregar o documento.
- [Compartilhar login e usuário](/receitas/autenticacao): mantenha a sessão no host.
- [Publicar](./publicacao): leve host e remotes para produção.

Para outros frameworks, veja os exemplos de [Host](./host) e [Remote](./remote). Antes de adotar a arquitetura, confira [Quando não usar](/quando-nao-usar).
