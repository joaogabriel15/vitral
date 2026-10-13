import { useEffect, useState } from 'react'
import { useEvent, useIlha } from 'arquipelago/react'

export default function Carrinho({ titulo = 'Carrinho' }) {
  const ilha = useIlha()
  const [itens, setItens] = useState([])
  const [quebrado, setQuebrado] = useState(false)
  if (quebrado) throw new Error('bug de propósito no carrinho')

  useEvent('carrinho:adicionar', (produto) => setItens((xs) => [...xs, produto]))
  useEffect(() => ilha?.events.emit('carrinho:total', itens.length), [itens])

  const total = itens.reduce((s, p) => s + p.preco, 0)
  return (
    <section className="carrinho">
      <h2>{titulo} <small>(React {`${itens.length}`} itens)</small></h2>
      {itens.length === 0 ? <p className="vazio">Vazio. Clique em um produto.</p> : (
        <ul>{itens.map((p, i) => <li key={i}>{p.nome} <span>R$ {p.preco.toFixed(2)}</span></li>)}</ul>
      )}
      <p className="total">Total: R$ {total.toFixed(2)}</p>
      <button disabled={!itens.length} onClick={() => setItens([])}>Limpar</button>
      <button id="quebrar" onClick={() => setQuebrado(true)}>Simular bug</button>
      {/* Tailwind: valores arbitrários e utilitários que dependem de @property */}
      <div id="tw-arbitrario" className="mt-2 h-[37px] w-[123px] rounded-lg bg-sky-500 shadow-lg ring-2 ring-pink-500" />
      <div id="tw-sem-unidade" className="h-[10]" />
    </section>
  )
}
