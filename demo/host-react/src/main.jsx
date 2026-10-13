import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configure } from 'ilha'
import { Remote, useEventValue } from 'ilha/react'

// As URLs vêm de um JSON em runtime: trocar a versão de um remote não exige rebuild do host.
configure({ remotes: '/remotes.json' })

function App() {
  const total = useEventValue('carrinho:total') ?? 0
  const [moeda, setMoeda] = useState('BRL')
  const [mostrarCarrinho, setMostrarCarrinho] = useState(true)

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '24px auto', display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <h1 style={{ margin: 0, flex: 1 }}>Host React</h1>
        <span id="badge">🛒 {total}</span>
        <select value={moeda} onChange={(e) => setMoeda(e.target.value)}>
          <option>BRL</option><option>USD</option><option>EUR</option>
        </select>
        <button id="toggle" onClick={() => setMostrarCarrinho((v) => !v)}>
          {mostrarCarrinho ? 'Esconder' : 'Mostrar'} carrinho
        </button>
      </header>

      <Remote name="catalogo" props={{ moeda }} isolate="shadow" fallback={<p>Carregando catálogo…</p>} />
      {mostrarCarrinho && <Remote name="carrinho" props={{ titulo: 'Seu carrinho' }} fallback={<p>Carregando carrinho…</p>} />}
      <Remote
        name="quebrado"
        error={(err, retry) => (
          <p id="erro" style={{ color: 'crimson' }}>
            Remote indisponível ({err.code}). <button onClick={retry}>Tentar de novo</button>
          </p>
        )}
        onError={() => {}}
      />
      <p><button>Botão do host (não deve ficar verde)</button></p>
    </main>
  )
}

createRoot(document.getElementById('app')).render(<StrictMode><App /></StrictMode>)
