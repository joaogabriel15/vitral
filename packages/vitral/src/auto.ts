/**
 * Uso sem build: importar este arquivo define o `<vitral-remote>`.
 *
 *   <script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js" data-origins="https://cdn.exemplo.com"></script>
 *   <vitral-remote src="https://cdn.exemplo.com/carrinho/vitral.json"></vitral-remote>
 *
 * `data-origins` (separadas por espaço) diz de onde os `src` podem vir: um
 * `<vitral-remote src>` injetado no HTML com outra origem não executa nada.
 * Num projeto com bundler: `import 'vitral/auto'` e `configure({ allowedOrigins })`.
 */
import { defineVitralElement } from './element'
import { protocol } from './core/state'

const me = typeof document != 'undefined' ? [...document.querySelectorAll<HTMLScriptElement>('script[data-origins]')].find((s) => s.src === import.meta.url) : undefined
const origins = me?.dataset.origins?.split(/\s+/).filter(Boolean).map((o) => new URL(o, location.href).origin)
if (origins?.length) protocol().configure({ trusted: [...(protocol().settings().trusted ?? []), ...origins] })

defineVitralElement()
