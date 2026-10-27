/**
 * `vitral({ next: true })`: os imports `next/*` de um código escrito para
 * Next.js viram módulos virtuais que reexportam `vitral/next`, e as variáveis
 * `NEXT_PUBLIC_*` do `.env` entram em `process.env`, como no `next build`.
 */
export interface NextOptions {
  /** `basePath` do `next.config`: `router.push('/x')` vai para `<basePath>/x`. */
  basePath?: string
  /** Resolve os `paths` do tsconfig mais próximo de cada arquivo. Padrão: true. */
  tsconfigPaths?: boolean
  /** `.svg` importado vira componente React, como com `@svgr/webpack`. Padrão: true (se o SVGR estiver instalado). */
  svgr?: boolean
}

const MODULES: Record<string, string> = {
  'next/link': 'export { Link as default } from "vitral/next"',
  'next/image': 'export { Image as default } from "vitral/next"',
  'next/head': 'export { Head as default } from "vitral/next"',
  'next/dynamic': 'export { dynamic as default } from "vitral/next"',
  'next/router': 'export { useRouter, withRouter, Router as default } from "vitral/next"',
  'next/navigation':
    'export { useAppRouter as useRouter, usePathname, useSearchParams, useParams, redirect, notFound } from "vitral/next"',
  'next/dist/shared/lib/router-context.shared-runtime': 'export { RouterContext } from "vitral/next"',
}

export const NEXT_IDS = /^next\/(link|image|head|dynamic|router|navigation|dist\/shared\/lib\/router-context\.shared-runtime)(\.js)?$/
const PREFIX = '\0vitral-next:'

export function resolveNextId(id: string): string | undefined {
  const name = id.replace(/\.js$/, '')
  return MODULES[name] ? PREFIX + name : undefined
}

export function loadNext(id: string, options: NextOptions): string | undefined {
  if (!id.startsWith(PREFIX)) return
  const code = MODULES[id.slice(PREFIX.length)]
  return code && `import { setBasePath } from "vitral/next"\nsetBasePath(${JSON.stringify(options.basePath ?? '')})\n${code}\n`
}

/** `process.env` do código Next: `NODE_ENV` e as `NEXT_PUBLIC_*` do ambiente e do `.env`. */
export function nextDefine(env: Record<string, string>, mode: string): Record<string, string> {
  const vars: Record<string, string> = { NODE_ENV: mode === 'development' ? 'development' : 'production' }
  for (const [k, v] of Object.entries(env)) if (k.startsWith('NEXT_PUBLIC_')) vars[k] = v
  return {
    'process.env': JSON.stringify(vars),
    ...Object.fromEntries(Object.entries(vars).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])),
  }
}

