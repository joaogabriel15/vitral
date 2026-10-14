import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { configure, provide } from 'vitral'
import { Remote, useEventValue, useShared } from 'vitral/react'

const REMOTES = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
configure({ remotes: '/remotes.json' })

// Contexto compartilhado: o host é o dono. Os remotes Vue, Svelte e Angular
// leem e compram pela ação do carrinho; escrever direto no carrinho é bloqueado.
const usuario = provide('usuario', { nome: 'Ana' })
const carrinho = provide('carrinho', criarCarrinho([]), { writable: false })

function criarCarrinho(itens) {
  return { itens, adicionar: (item) => carrinho.set(criarCarrinho([...itens, item])) }
}

function App() {
  const [mensagem, setMensagem] = useState('olá')
  const [visiveis, setVisiveis] = useState(true)
  const ping = useEventValue('ping') ?? '-'
  const nome = useShared('usuario', (u) => u?.nome)
  const itens = useShared('carrinho', (c) => c?.itens.length ?? 0)
  return (
    <>
      <h1>Host React</h1>
      <input id="mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      <p>Último ping: <span id="ultimo-ping">{ping}</span></p>
      <p>
        Usuário: <span id="usuario">{nome}</span>{' '}
        <button id="trocar-usuario" onClick={() => usuario.set({ nome: nome === 'Ana' ? 'Bia' : 'Ana' })}>trocar</button>
      </p>
      <p>Carrinho: <span id="carrinho">{itens}</span></p>
      <button id="alternar-remotes" onClick={() => setVisiveis((v) => !v)}>mostrar/esconder remotes</button>
      {visiveis &&
        REMOTES.map((n) => (
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
