import { CUSTOM_ELEMENTS_SCHEMA, Component } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import 'vitral/auto'

@Component({
  selector: 'app-root',
  // <vitral-remote> é um Web Component: o Angular só precisa deixar passar.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <main>
      <h1>Host Angular</h1>
      <vitral-remote src="__SRC__" [props]="{ nome: 'host' }"></vitral-remote>
    </main>
  `,
})
class App {}

document.getElementById('app')!.append(document.createElement('app-root'))
bootstrapApplication(App)
