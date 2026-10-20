import { createRoot } from 'react-dom/client'
import { configure } from 'vitral'
import { Remote } from 'vitral/react'

// A lista de remotes vem do servidor: o mesmo build serve em qualquer ambiente.
configure({ remotes: '/remotes.json' })

const erro = (nome) => (_erro, tentarDeNovo) => <button onClick={tentarDeNovo}>{nome} indisponível. Tentar de novo</button>

function App() {
  return (
    <main>
      <h1>Loja</h1>
      <Remote name="busca" fallback={<p>Carregando a busca…</p>} error={erro('Busca')} />
      <Remote name="carrinho" props={{ usuario: 'Ana' }} fallback={<p>Carregando o carrinho…</p>} error={erro('Carrinho')} />
    </main>
  )
}

createRoot(document.getElementById('app')).render(<App />)
