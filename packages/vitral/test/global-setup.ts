// Alguns testes usam o pacote publicado (`vitral/element`, os `.d.ts` de
// `dist/`): sem build, ou com build mais velho que `src/`, eles falhariam com
// erros que não dizem isso. Aqui o build roda antes, só quando precisa.
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')

function newest(dir: string): number {
  let t = 0
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs)
  }
  return t
}

export default function setup() {
  const built = join(root, 'dist/index.js')
  if (existsSync(built) && statSync(built).mtimeMs >= newest(join(root, 'src'))) return
  console.log('[vitral] dist/ ausente ou mais velho que src/: rodando o build antes dos testes')
  execSync('pnpm build', { cwd: root, stdio: 'inherit' })
}
