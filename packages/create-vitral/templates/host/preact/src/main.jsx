import { render } from 'preact'
import { Remote } from 'vitral/preact'

render(
  <main>
    <h1>Host Preact</h1>
    <Remote src="__SRC__" props={{ nome: 'host' }} fallback={<p>Carregando…</p>} />
  </main>,
  document.getElementById('app'),
)
