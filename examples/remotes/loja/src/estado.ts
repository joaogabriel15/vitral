// Estado do carrinho. As partes do remote (default, MiniCarrinho e api)
// importam este mesmo módulo, então enxergam o mesmo objeto.
import { events } from 'vitral'

export const estado = { itens: 0 }

export function mudou(): void {
  events.emit('loja:itens', estado.itens)
}
