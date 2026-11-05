import { NextRemote } from 'vitral/next-host'

// O mesmo remote, com a tela de erro do host e o botão de tentar de novo.
export default function NsErro() {
  return (
    <main>
      <h1>Remote no host Next</h1>
      <NextRemote
        name="ns-erro"
        fallback={<p className="carregando">carregando</p>}
        error={(e, retry) => (
          <p className="erro">
            {e.message} <button onClick={retry}>Tentar de novo</button>
          </p>
        )}
      />
    </main>
  )
}
