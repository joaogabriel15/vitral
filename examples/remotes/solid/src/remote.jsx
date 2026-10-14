import { createSignal } from 'solid-js'
import { solidRemote } from 'vitral/solid'

function Cartao(props) {
  const [cliques, setCliques] = createSignal(0)
  const ping = () => {
    setCliques((c) => c + 1)
    props.vitral.events.emit('ping', 'Solid')
  }
  return (
    <div class="cartao">
      <h3 class="fw">Solid</h3>
      <p class="msg">{props.mensagem}</p>
      <button class="ping" onClick={ping}>ping <span class="cliques">{cliques()}</span></button>
    </div>
  )
}

export default solidRemote(Cartao)
