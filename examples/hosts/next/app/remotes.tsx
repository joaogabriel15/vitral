'use client'
import { useState } from 'react'
import { configure } from 'vitral'
import { Remote, useEventValue } from 'vitral/react'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
if (typeof window !== 'undefined') configure({ remotes: '/remotes.json' })

export function Remotes() {
  const [mensagem, setMensagem] = useState('olá')
  const ping = useEventValue<string>('ping') ?? '-'
  return (
    <>
      <input id="mensagem" aria-label="Mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
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
