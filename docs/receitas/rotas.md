# Rotas entre aplicações

Uma URL de manifesto pode representar todas as páginas de um repositório. O host escolhe a área; o remote escolhe a página dentro dela.

```text
/                       → home do host
/produtos/*             → repo de produtos
  /produtos             → listagem
  /produtos/123         → detalhes
/employee/*             → repo de employee
```

## Host: escolha a área

Exemplo com React Router, instalado nos projetos com `npm install react-router`. Importe a configuração de remotes na inicialização do cliente:

```jsx
// src/App.jsx do host
import { createBrowserRouter, RouterProvider } from 'react-router'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

configure({
  remotes: {
    produtos: 'http://localhost:5174/vitral.json',
    employee: 'http://localhost:5175/vitral.json',
  },
})

function Area({ name }) {
  return (
    <Remote
      name={name}
      fallback={<p>Carregando…</p>}
      error={(erro, retry) => <button onClick={retry}>Tentar novamente</button>}
    />
  )
}

const router = createBrowserRouter([
  { path: '/', element: <h1>Início</h1> },
  { path: '/produtos/*', element: <Area name="produtos" /> },
  { path: '/employee/*', element: <Area name="employee" /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
```

Em um projeto existente, adicione essas rotas ao roteador atual. O layout, menu e controle de sessão podem continuar acima delas.

## Remote: escolha a página

No repo de produtos, use o prefixo `/produtos` como `basename`:

```jsx
// src/remote.jsx do remote
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router'
import { reactRemote } from 'vitral/react'

function Lista() {
  return <Link to="/123">Abrir produto 123</Link>
}

function Detalhes() {
  const { id } = useParams()
  return <h1>Produto {id}</h1>
}

function ProdutosApp() {
  return (
    <BrowserRouter basename="/produtos">
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/:id" element={<Detalhes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default reactRemote(ProdutosApp)
```

Adicionar uma página aqui não exige cadastrar outro remote no host. Este exemplo monta uma instância da área por vez.

## Navegue para outro repositório

Dentro de produtos, para abrir employee:

```jsx
import { navigate } from 'vitral'

<button onClick={() => navigate('/employee/123')}>
  Ver funcionário
</button>
```

Para uma URL da mesma origem, `navigate` muda o histórico e dispara `popstate`. Com o roteador do host integrado, a área anterior desmonta e a nova monta **sem recarregar o documento**. O layout e a sessão do host permanecem; o estado local da área desmontada não é preservado por padrão.

Na primeira visita pode haver espera pelo download. Para antecipá-lo, use `preload('employee')`; para preservar uma área montada, veja [Performance](/guia/performance).

| Destino | Resultado |
| --- | --- |
| `/employee/123` no mesmo host | Navegação pelo roteador, sem reload do documento |
| URL de outra origem | Navegação completa do navegador |

As CDNs dos arquivos podem ser diferentes. O que importa aqui é a origem da URL de navegação.

::: tip Outros roteadores
`navigate` sinaliza a mudança de URL; não substitui o roteador. Valide a integração no seu framework, especialmente Next/Nuxt. Dentro da mesma área, use os links do próprio roteador; entre áreas, use o caminho absoluto do host.
:::

## Acesso direto e atualização da página

O servidor do host precisa entregar a aplicação para caminhos como `/produtos/123`. Sem esse fallback, abrir um link direto ou atualizar o navegador pode retornar 404. Veja [Publicar](/guia/publicacao).
