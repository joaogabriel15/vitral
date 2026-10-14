// <Remote> já é 'use client': renderiza o fallback no servidor e monta no cliente.
import { Remote } from 'vitral/react'

export default function Page() {
  return (
    <main>
      <h1>Host Next</h1>
      <Remote src="__SRC__" props={{ nome: 'host' }} fallback={<p>Carregando…</p>} />
    </main>
  )
}
