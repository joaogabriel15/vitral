import React, { createContext } from 'react'
import { jsx } from 'react/jsx-runtime'
import { createRoot } from 'react-dom/client'

// Uso do React no topo do módulo: só funciona se o React já estiver resolvido.
const Tema = createContext('claro')

export default {
  react: React,
  tema: Tema,
  mount(el) {
    const root = createRoot(el)
    root.render(jsx('p', { children: 'loja' }))
    return { unmount: () => root.unmount() }
  },
}
