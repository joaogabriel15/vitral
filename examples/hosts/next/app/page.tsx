// Página do App Router renderizada no servidor; os remotes montam no cliente.
import { Remotes } from './remotes'

export default function Page() {
  return (
    <main>
      <h1>Host Next</h1>
      <Remotes />
    </main>
  )
}
