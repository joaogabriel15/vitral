// Plugin do TypeDoc: nomeia cada módulo pelo import (`index` vira `vitral`,
// `react` vira `vitral/react`).
import { Converter, ReflectionKind } from 'typedoc'

export function load(app) {
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const mod of context.project.getReflectionsByKind(ReflectionKind.Module)) {
      mod.name = mod.name === 'index' ? 'vitral' : `vitral/${mod.name}`
    }
  })
}
