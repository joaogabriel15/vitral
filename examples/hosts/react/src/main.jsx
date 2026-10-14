import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configure } from 'vitral'
import { Remote, useEventValue } from 'vitral/react'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
configure({ remotes: '/remotes.json' })

function App() {
  const [mensagem, setMensagem] = useState('olá')
  const ping = useEventValue('ping') ?? '-'
  return (
    <>
      <h1>Host React</h1>
      <input id="mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      <p>Último ping: <span id="ultimo-ping">{ping}</span></p>
      {REMOTES.map((n) => (
        <section key={n} data-remote={n}>
          <Remote name={n} props={{ mensagem }} fallback={<p>carregando {n}…</p>} />
        </section>
      ))}
      <section data-remote="quebrado">
        <Remote name="quebrado" onError={() => {}} error={(e, retry) => <p className="erro">indisponível <button onClick={retry}>tentar de novo</button></p>} />
      </section>
    </>
  )
}

createRoot(document.getElementById('app')).render(<StrictMode><App /></StrictMode>)
