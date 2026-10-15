// Versões da lib usadas na bateria de versões cruzadas.
//
//   atual      packages/vitral (este repositório)
//   publicada  a última versão no npm: devDependency vitral-publicada.
//              Depois de cada release, suba para a nova:
//              pnpm --dir e2e add -D vitral-publicada@npm:vitral@<versão>
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Pacote de cada versão. */
export const VERSOES = { atual: 'vitral', publicada: 'vitral-publicada' }

/** Pasta dist/ de uma versão (o host de teste serve em /libs/<versão>/). */
export const distDe = (versao) => dirname(fileURLToPath(import.meta.resolve(VERSOES[versao])))

/** Nome para os títulos dos testes: "atual" ou "publicada 0.1.0". */
export const rotulo = (versao) =>
  versao === 'atual' ? versao : `${versao} ${JSON.parse(readFileSync(join(distDe(versao), '../package.json'), 'utf8')).version}`

/** Se a versão fala o protocolo global em Symbol.for('vitral') (da 0.2 em diante). */
export function temProtocolo(versao) {
  const dist = distDe(versao)
  return readdirSync(dist).some((f) => f.endsWith('.js') && readFileSync(join(dist, f), 'utf8').includes('Symbol.for("vitral")'))
}
