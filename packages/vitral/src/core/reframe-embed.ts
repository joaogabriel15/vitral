/**
 * `./reframe` no `embed.js`: o arquivo único não leva os modos reframe e
 * iframe (o widget usa Shadow DOM). O tsup troca um pelo outro só nesse build.
 */
import { RemoteError } from './errors'

export function load(name: string): never {
  throw new RemoteError('MOUNT_FAILED', name, 'isolate sem suporte no embed.js')
}

export const noFrames = (_target: HTMLElement, name: string): never => load(name)
