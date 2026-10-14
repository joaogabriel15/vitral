import { render } from 'solid-js/web'
import { Remote } from 'vitral/solid'

render(
  () => (
    <main>
      <h1>Host Solid</h1>
      <Remote src="__SRC__" props={{ nome: 'host' }} fallback={<p>Carregando…</p>} />
    </main>
  ),
  document.getElementById('app'),
)
