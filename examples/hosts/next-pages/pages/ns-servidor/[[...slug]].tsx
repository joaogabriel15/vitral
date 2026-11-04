import type { RemoteManifest } from 'vitral'
import { NextRemote } from 'vitral/next-host'
import { remoteProps } from 'vitral/next-server'

// O manifesto vem do servidor, com cache curto: o HTML já pré-carrega a versão
// publicada agora, e o navegador não pede o vitral.json.
export const getServerSideProps = async () => ({ props: await remoteProps('ns-servidor', { origin: process.env.VITRAL_ORIGIN ?? 'http://127.0.0.1:4211' }) })

export default function NsServidor({ vitral }: { vitral: Record<string, RemoteManifest | null> }) {
  return (
    <main>
      <h1>Remote com o manifesto do servidor</h1>
      <NextRemote name="ns-servidor" manifest={vitral['ns-servidor']} fallback={<p className="carregando">carregando</p>} />
    </main>
  )
}
