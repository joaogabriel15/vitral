// Remote React com o adaptador da versão do build (sem JSX, para não precisar de plugin).
import { createElement as h, useEffect, useState } from 'react'
import { reactRemote, useVitral } from 'vitral/react'
import './remote.css'

function Remote({ texto }) {
  const vitral = useVitral()
  const [recebido, setRecebido] = useState('-')
  const [cliques, setCliques] = useState(0)
  useEffect(
    () =>
      vitral.events.on('host:diz', (v) => {
        window.__recebidos = (window.__recebidos ?? 0) + 1
        setRecebido(v)
      }),
    [vitral],
  )
  const emitir = () => {
    setCliques((c) => c + 1)
    vitral.events.emit('remote:diz', vitral.name)
  }
  return h(
    'div',
    { className: 'remote' },
    h('p', { className: 'texto' }, texto),
    h('p', { className: 'recebido' }, recebido),
    h('button', { className: 'emitir', onClick: emitir }, 'emitir ', h('span', { className: 'cliques' }, cliques)),
  )
}

export default reactRemote(Remote)
