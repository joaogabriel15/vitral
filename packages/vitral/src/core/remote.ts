import type { Props, RemoteModule } from './types'

/** Declara um remote. É só uma função identidade com tipos. */
export function defineRemote<P extends Props = Props>(remote: RemoteModule<P>): RemoteModule<P> {
  return remote
}
