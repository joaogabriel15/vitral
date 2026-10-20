// Remote React do benchmark público. O mesmo componente entra no build do
// vitral e no do Module Federation; só a entrada muda.
import { useState } from 'react'

export default function Cartao({ nome, mensagem }) {
  const [cliques, setCliques] = useState(0)
  return (
    <div className="cartao" data-nome={nome}>
      <h3>React {nome}</h3>
      <p>{mensagem}</p>
      <button onClick={() => setCliques((c) => c + 1)}>cliques: {cliques}</button>
    </div>
  )
}
