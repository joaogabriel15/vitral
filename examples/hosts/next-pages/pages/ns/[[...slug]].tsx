import { NextRemote } from 'vitral/next-host'

export default function Ns() {
  return (
    <main>
      <h1>Remote no host Next</h1>
      <NextRemote name="ns" fallback={<p className="carregando">carregando</p>} />
    </main>
  )
}
