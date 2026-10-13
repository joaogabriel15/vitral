import { useState } from 'preact/hooks'
import { preactRemote } from 'arquipelago/preact'

function Cartao({ mensagem, ilha }) {
  const [cliques, setCliques] = useState(0)
  return (
    <div class="cartao">
      <h3 class="fw">Preact</h3>
      <p class="msg">{mensagem}</p>
      <button class="ping" onClick={() => { setCliques((c) => c + 1); ilha.events.emit('ping', 'Preact') }}>
        ping <span class="cliques">{cliques}</span>
      </button>
    </div>
  )
}

export default preactRemote(Cartao)
