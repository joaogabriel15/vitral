import { CUSTOM_ELEMENTS_SCHEMA, Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { events } from 'ilha'
import { provideIlha } from 'ilha/angular'

@Component({
  selector: 'app-root',
  // <ilha-remote> é um Web Component: o Angular só precisa deixar passar.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <h1>Host Angular</h1>
    <input id="mensagem" [value]="mensagem()" (input)="mensagem.set($any($event.target).value)" />
    <p>Último ping: <span id="ultimo-ping">{{ ping() }}</span></p>
    @for (n of remotes; track n) {
      <section [attr.data-remote]="n">
        <ilha-remote [attr.name]="n" [props]="{ mensagem: mensagem() }">
          <p slot="fallback">carregando {{ n }}…</p>
        </ilha-remote>
      </section>
    }
    <section data-remote="quebrado">
      @if (erro()) {
        <p class="erro">indisponível <button (click)="quebrado.retry()">tentar de novo</button></p>
      }
      <ilha-remote #quebrado name="quebrado" (ilha-error)="erro.set(true)"></ilha-remote>
    </section>
  `,
})
class App {
  remotes = ['react', 'vue', 'svelte', 'solid', 'preact', 'angular', 'lit', 'vanilla']
  mensagem = signal('olá')
  ping = signal('-')
  erro = signal(false)
  constructor() {
    events.on<string>('ping', (fw) => this.ping.set(fw))
  }
}

bootstrapApplication(App, { providers: [provideIlha({ remotes: '/remotes.json' })] })
