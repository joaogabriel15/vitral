import { readFileSync } from 'node:fs'
import { keygen, signDir } from '../sign'

/** `vitral sign --keygen` e `vitral sign <dist>`. */
export function signCli(dir: string | undefined, o: { keygen?: boolean; keyFile?: string; base?: string; noHeaders?: boolean }, log = console.log): void {
  if (o.keygen) {
    const k = keygen()
    log(`Chave pública (vai no host, em configure({ remotes: { nome: { url, keys: [...] } } })):\n  ${k.publicKey}\n`)
    log(`Chave privada (segredo do CI do remote, em VITRAL_SIGNING_KEY ou num arquivo para --key-file):\n${k.privateKey}`)
    return
  }
  if (!dir) throw new Error('[vitral] sign precisa da pasta do build: vitral sign dist')
  const key = o.keyFile ? readFileSync(o.keyFile, 'utf8') : process.env.VITRAL_SIGNING_KEY
  if (!key) throw new Error('[vitral] sign precisa da chave privada: --key-file arquivo.pem ou VITRAL_SIGNING_KEY')
  const out = signDir(dir, key.replace(/\\n/g, '\n'), { base: o.base, headersFile: !o.noHeaders })
  log(`${Object.keys(out).length} arquivos assinados. Headers em vitral-signatures.json${o.noHeaders ? '' : ' e _headers'}.`)
}
