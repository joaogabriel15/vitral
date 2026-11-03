// O app tem o next de verdade; nos testes, o <Head> põe os filhos no lugar.
import { createElement, type ReactNode } from 'react'
export default function Head({ children }: { children?: ReactNode }) {
  return createElement('next-head', null, children)
}
