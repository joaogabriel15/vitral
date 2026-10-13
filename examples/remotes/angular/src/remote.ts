import { Component, input, signal } from '@angular/core'
import { angularRemote, injectIlha } from 'ilha/angular'

@Component({
  selector: 'app-cartao',
  template: `
    <div class="cartao">
      <h3 class="fw">Angular</h3>
      <p class="msg">{{ mensagem() }}</p>
      <button class="ping" (click)="ping()">ping <span class="cliques">{{ cliques() }}</span></button>
    </div>
  `,
})
class Cartao {
  mensagem = input('')
  cliques = signal(0)
  ilha = injectIlha()

  ping() {
    this.cliques.update((c) => c + 1)
    this.ilha?.events.emit('ping', 'Angular')
  }
}

export default angularRemote(Cartao)
