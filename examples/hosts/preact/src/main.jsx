import { render } from 'preact'
import { useEffect, useState } from 'preact/hooks'
import { configure, events } from 'arquipelago'
import { Remote } from 'arquipelago/preact'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
configure({ remotes: '/remotes.json' })

function App() {
  const [mensagem, setMensagem] = useState('olá')
  const [ping, setPing] = useState('-')
  useEffect(() => events.on('ping', setPing), [])
  return (
    <>
      <h1>Host Preact</h1>
      <input id="mensagem" value={mensagem} onInput={(e) => setMensagem(e.currentTarget.value)} />
      <p>Último ping: <span id="ultimo-ping">{ping}</span></p>
      {REMOTES.map((n) => (
        <section key={n} data-remote={n}>
          <Remote name={n} props={{ mensagem }} fallback={<p>carregando {n}…</p>} />
        </section>
      ))}
      <section data-remote="quebrado">
        <Remote name="quebrado" error={(e, retry) => <p class="erro">indisponível <button onClick={retry}>tentar de novo</button></p>} />
      </section>
    </>
  )
}

render(<App />, document.getElementById('app'))
