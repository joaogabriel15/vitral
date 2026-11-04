/**
 * Última tela do remote na visita de volta. Ligue uma vez no host e marque
 * os remotes com `snapshot`:
 *
 *   import { snapshots } from 'vitral/snapshot'
 *   snapshots()
 *
 *   <Remote name="delivery" snapshot />            // vitral/react
 *   <vitral-remote name="delivery" snapshot>       // elemento
 *
 * Ao sair da página (ou desmontar), o HTML que o remote mostrava fica no
 * `sessionStorage`. Na próxima montagem com as mesmas props, ele aparece na
 * hora, inerte, enquanto o JS baixa, e sai quando o remote monta.
 */
import { ctxHooks } from './core/hooks'
import { attach } from './core/snapshot'

/** Liga o snapshot nesta página. */
export function snapshots(): void {
  ctxHooks.snapshot = attach
}

/** Apaga os snapshots guardados (no logout, por exemplo). */
export function clearSnapshots(): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('vitral:snap:')) sessionStorage.removeItem(k)
  } catch {}
}
