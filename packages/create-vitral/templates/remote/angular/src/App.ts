import { Component, input, signal } from '@angular/core'

// O plugin vitral embrulha o export default: não precisa de adaptador.
@Component({
  selector: 'app-remote',
  template: `
    <section>
      <h2>Olá, {{ nome() }}</h2>
      <button (click)="cliques.set(cliques() + 1)">Cliques: {{ cliques() }}</button>
    </section>
  `,
})
export default class App {
  nome = input('mundo')
  cliques = signal(0)
}
