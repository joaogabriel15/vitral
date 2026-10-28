// Tipos mínimos do que `vitral/next-host` usa. O app tem o `next` de verdade.
declare module 'next/router' {
  interface Router {
    asPath: string
    isReady: boolean
    push(url: string, as?: string, options?: { scroll?: boolean; shallow?: boolean }): Promise<boolean>
    replace(url: string, as?: string, options?: { scroll?: boolean; shallow?: boolean }): Promise<boolean>
    events: { on(type: string, fn: (...args: any[]) => void): void; off(type: string, fn: (...args: any[]) => void): void; emit(type: string, ...args: any[]): void }
  }
  export function useRouter(): Router
  const router: Router
  export default router
}

declare module 'vitral-next-host-config' {
  export const remotes: Record<
    string,
    { url: string; basePath: string; routes?: { public: string; zone: string }[]; preload?: 'idle' | 'route' | false; warmRoutes?: boolean; integrity?: false; devUrl?: string }
  >
  export const shared: Record<string, { version: string; modules: () => Promise<Record<string, unknown>> }>
}
