'use client'
// Marca o fim quando a página hidratou: daí em diante o botão responde.
import { useEffect } from 'react'

export default function Pronto() {
  useEffect(() => {
    window.__ready = performance.now()
  }, [])
  return null
}
