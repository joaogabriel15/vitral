/**
 * Uso sem build: importar este arquivo define o `<vitral-remote>`.
 *
 *   <script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
 *   <vitral-remote src="https://cdn.exemplo.com/carrinho/vitral.json"></vitral-remote>
 *
 * Num projeto com bundler: `import 'vitral/auto'`.
 */
import { defineVitralElement } from './element'

defineVitralElement()
