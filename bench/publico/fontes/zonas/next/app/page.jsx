// Página da zona: o mesmo Cartao do benchmark público e um link para a outra
// zona. Entre zonas o link é <a>, como manda a documentação do Multi-Zones.
import Cartao from './Cartao.jsx'
import Pronto from './Pronto.jsx'

export default function Page() {
  return (
    <main id="app">
      <Cartao nome={process.env.ZONA} mensagem="olá" />
      <a id="ir" href={`/${process.env.OUTRA}/`}>Ir para {process.env.OUTRA}</a>
      <Pronto />
    </main>
  )
}
