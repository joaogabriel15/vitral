import { useState } from 'react'
import './carrinho.css'

export default function Carrinho({ usuario }) {
  const [itens, setItens] = useState(0)
  return (
    <div className="carrinho">
      <p>Carrinho de {usuario}: {itens} itens</p>
      <button onClick={() => setItens(itens + 1)}>Adicionar</button>
    </div>
  )
}
