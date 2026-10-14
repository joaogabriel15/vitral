import { createSignal } from 'solid-js'

// O plugin vitral embrulha o export default: não precisa de adaptador.
export default function App(props) {
  const [cliques, setCliques] = createSignal(0)
  return (
    <section>
      <h2>Olá, {props.nome ?? 'mundo'}</h2>
      <button onClick={() => setCliques(cliques() + 1)}>Cliques: {cliques()}</button>
    </section>
  )
}
