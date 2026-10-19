import { useVitral } from 'vitral/react'
import './style.css'

// As props vêm do host MCP: toolInput (argumentos da tool), toolResult
// (o CallToolResult) e hostContext (tema, idioma, tamanho...).
function Clima({ toolInput, toolResult }) {
  const vitral = useVitral()
  const dados = toolResult?.structuredContent
  return (
    <div className="clima">
      <h1 className="cidade">{toolInput?.cidade ?? '…'}</h1>
      <p className="temp">{dados ? `${dados.temperatura} °C` : 'carregando'}</p>
      {/* Evento comum: vai para o contexto do modelo (ui/update-model-context). */}
      <button className="favoritar" onClick={() => vitral.events.emit('favorito', { cidade: toolInput?.cidade })}>
        favoritar
      </button>
      {/* mcp:message vira uma mensagem do usuário na conversa (ui/message). */}
      <button className="perguntar" onClick={() => vitral.events.emit('mcp:message', `Vai chover em ${toolInput?.cidade}?`)}>
        perguntar
      </button>
    </div>
  )
}

// Sem reactRemote(): o plugin vitral embrulha o export default.
export default Clima
