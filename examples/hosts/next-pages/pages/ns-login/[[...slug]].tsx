import { useEffect, useState } from 'react'
import { NextRemote } from 'vitral/next-host'

// O remote só aparece depois do login, no navegador: o HTML do servidor não tem o NextRemote.
export default function NsLogin() {
  const [logado, setLogado] = useState(false)
  useEffect(() => setLogado(true), [])
  return (
    <main>
      <h1>Remote no host Next</h1>
      {logado ? <NextRemote name="ns-login" fallback={<p className="carregando">carregando</p>} /> : <p className="entrando">entrando</p>}
    </main>
  )
}
