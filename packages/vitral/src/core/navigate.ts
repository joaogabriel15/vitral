import { events } from './events'

/**
 * Navega mantendo todos os roteadores em sincronia (React Router, Vue Router,
 * Next, Nuxt…): atualiza o histórico e dispara `popstate`, que todos escutam.
 */
export function navigate(url: string, options: { replace?: boolean } = {}): void {
  const target = new URL(url, location.href)
  if (target.origin !== location.origin) {
    location.assign(target.href)
    return
  }
  if (options.replace) history.replaceState(history.state, '', target.href)
  else history.pushState(history.state, '', target.href)
  dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  events.emit('vitral:navigate', target.pathname + target.search + target.hash)
}
