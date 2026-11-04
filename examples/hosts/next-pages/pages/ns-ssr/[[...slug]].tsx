import type { RemoteManifest } from 'vitral'
import { NextRemote } from 'vitral/next-host'
import { remoteProps } from 'vitral/next-server'
// @ts-expect-error JSX do remote, sem tipos.
import { render } from 'remote-react-ns/server'

// O servidor renderiza o remote: o HTML sai pronto, com o estado inicial, e o
// navegador só hidrata.
export const getServerSideProps = async () => ({
  props: await remoteProps('ns-ssr', { origin: process.env.VITRAL_ORIGIN ?? 'http://127.0.0.1:4211', ssr: { 'ns-ssr': { render } } }),
})

export default function NsSsr({ vitral, vitralSsr }: { vitral: Record<string, RemoteManifest | null>; vitralSsr?: Record<string, string | null> }) {
  return (
    <main>
      <h1>Remote com SSR</h1>
      <NextRemote name="ns-ssr" manifest={vitral['ns-ssr']} ssr={vitralSsr?.['ns-ssr']} fallback={<p className="carregando">carregando</p>} />
    </main>
  )
}
