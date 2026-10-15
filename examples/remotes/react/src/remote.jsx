import { useState } from 'react'
import { useVitral } from 'vitral/react'

function Cartao({ mensagem }) {
  const vitral = useVitral()
  const [cliques, setCliques] = useState(0)
  return (
    <div className="cartao">
      <h3 className="fw">React</h3>
      <p className="msg">{mensagem}</p>
      <button className="ping" onClick={() => { setCliques((c) => c + 1); vitral.events.emit('ping', 'React') }}>
        ping <span className="cliques">{cliques}</span>
      </button>
    </div>
  )
}

// Sem reactRemote(): o plugin vitral embrulha o export default.
export default Cartao
