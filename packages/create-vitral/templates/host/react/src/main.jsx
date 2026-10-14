import { createRoot } from 'react-dom/client'
import { Remote } from 'vitral/react'

createRoot(document.getElementById('app')).render(
  <main>
    <h1>Host React</h1>
    <Remote src="__SRC__" props={{ nome: 'host' }} fallback={<p>Carregando…</p>} />
  </main>,
)
