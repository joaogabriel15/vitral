// Empacota o vitral (dist já buildado) uma vez para todos os workers.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export default function setup() {
  const tmp = mkdtempSync(join(tmpdir(), 'vitral-create-'))
  execFileSync('pnpm', ['pack', '--pack-destination', tmp], { cwd: fileURLToPath(new URL('../packages/vitral', import.meta.url)), stdio: 'ignore' })
  process.env.VITRAL_TGZ = join(tmp, readdirSync(tmp).find((f) => f.endsWith('.tgz'))!)
  return () => rmSync(tmp, { recursive: true, force: true })
}
