import { useState } from 'react'

// O plugin vitral embrulha o export default: não precisa de adaptador.
export default function App({ nome = 'mundo' }) {
  const [cliques, setCliques] = useState(0)
  return (
    <section>
      <h2>Olá, {nome}</h2>
      <button onClick={() => setCliques(cliques + 1)}>Cliques: {cliques}</button>
    </section>
  )
}
