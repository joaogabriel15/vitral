import * as React from 'react'
import { useInitialState } from 'vitral/react'

// O namespace usado como valor (como faz uma lib que recebe o React): o
// build mantém todos os nomes do pacote no manifesto.
const api = { ...React }

function Contador() {
  // Com SSR (examples/hosts/next-pages, página ns-ssr), começa do estado que o servidor buscou.
  const [n, setN] = api.useState(useInitialState()?.inicio ?? 0)
  return (
    <div className="ns">
      <p className="versao">React {React.version}</p>
      <button className="ping" onClick={() => setN((c) => c + 1)}>
        ping <span className="cliques">{n}</span>
      </button>
    </div>
  )
}

export default Contador
