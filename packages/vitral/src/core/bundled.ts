import type * as Dedupe from './dedupe'
import type * as Sri from './sri'

/**
 * Código de SRI e de dedupe que o host já traz no bundle (`vitral/next-host`).
 * Com ele, nenhum `import()` à parte espera a rede depois da hidratação.
 */
export const bundled: { sri?: typeof Sri; dedupe?: typeof Dedupe } = {}

export const dedupeModule = (): Promise<typeof Dedupe> => (bundled.dedupe ? Promise.resolve(bundled.dedupe) : import('./dedupe'))
export const sriModule = (): Promise<typeof Sri> => (bundled.sri ? Promise.resolve(bundled.sri) : import('./sri'))
