// Módulo sem UI: o host usa com loadModule('loja/api').
import { estado, mudou } from './estado'

export function adicionar(): number {
  estado.itens++
  mudou()
  return estado.itens
}

export function itens(): number {
  return estado.itens
}
