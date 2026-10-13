import { createSignal, For, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { configure, events } from 'ilha'
import { Remote } from 'ilha/solid'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
configure({ remotes: '/remotes.json' })

function App() {
  const [mensagem, setMensagem] = createSignal('olá')
  const [ping, setPing] = createSignal('-')
  onCleanup(events.on('ping', setPing))
  return (
    <>
      <h1>Host Solid</h1>
      <input id="mensagem" value={mensagem()} onInput={(e) => setMensagem(e.currentTarget.value)} />
      <p>Último ping: <span id="ultimo-ping">{ping()}</span></p>
      <For each={REMOTES}>
        {(n) => (
          <section data-remote={n}>
            <Remote name={n} props={{ mensagem: mensagem() }} fallback={<p>carregando {n}…</p>} />
          </section>
        )}
      </For>
      <section data-remote="quebrado">
        <Remote name="quebrado" error={(e, retry) => <p class="erro">indisponível <button onClick={retry}>tentar de novo</button></p>} />
      </section>
    </>
  )
}

render(() => <App />, document.getElementById('app'))
