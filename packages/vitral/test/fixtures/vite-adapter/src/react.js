// Componente React puro, sem reactRemote(): o plugin embrulha.
import { createElement as h } from 'react'

export default function App({ nome }) {
  return h('p', null, `oi ${nome}`)
}
