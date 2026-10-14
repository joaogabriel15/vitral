import { useState } from 'preact/hooks'
import { preactRemote } from 'vitral/preact'

function Cartao({ mensagem, vitral }) {
  const [cliques, setCliques] = useState(0)
  return (
    <div class="cartao">
      <h3 class="fw">Preact</h3>
      <p class="msg">{mensagem}</p>
      <button class="ping" onClick={() => { setCliques((c) => c + 1); vitral.events.emit('ping', 'Preact') }}>
        ping <span class="cliques">{cliques}</span>
      </button>
    </div>
  )
}

export default preactRemote(Cartao)
