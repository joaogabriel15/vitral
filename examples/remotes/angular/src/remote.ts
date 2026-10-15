import { Component, input, signal } from '@angular/core'
import { shared } from 'vitral'
import { angularRemote, injectShared, injectVitral } from 'vitral/angular'

@Component({
  selector: 'app-cartao',
  template: `
    <div class="cartao">
      <h3 class="fw">Angular</h3>
      <p class="msg">{{ mensagem() }}</p>
      <button class="ping" (click)="ping()">ping <span class="cliques">{{ cliques() }}</span></button>
      <p>Usuário: <span class="usuario">{{ usuario() }}</span> · carrinho: <span class="carrinho">{{ itens() }}</span></p>
      <button class="comprar" (click)="comprar()">comprar</button>
    </div>
  `,
})
class Cartao {
  mensagem = input('')
  cliques = signal(0)
  vitral = injectVitral()
  usuario = injectShared<{ nome: string }, string>('usuario', (u) => u?.nome ?? '-')
  itens = injectShared<{ itens: string[] }, number>('carrinho', (c) => c?.itens.length ?? 0)

  ping() {
    this.cliques.update((c) => c + 1)
    this.vitral?.events.emit('ping', 'Angular')
  }

  comprar() {
    shared<{ adicionar(item: string): void }>('carrinho').get()?.adicionar('Angular')
  }
}

export default angularRemote(Cartao)
