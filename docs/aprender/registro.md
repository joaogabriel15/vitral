# Registro e agentes

Um registro lista os remotes que a empresa publica, num arquivo `vitral-registry.json`. Com ele, um host adiciona um remote pelo nome, sem copiar URL de manifesto à mão. Um agente de código faz o mesmo pelo servidor MCP.

## O arquivo

```json
{
  "$schema": "https://joaogabriel15.github.io/vitral/schema/vitral-registry.json",
  "name": "loja",
  "remotes": [
    {
      "name": "carrinho",
      "url": "https://cdn.empresa.com/carrinho/vitral.json",
      "version": "1.4.0",
      "props": "{ userId: number; cupom?: string }",
      "owner": "time-checkout",
      "integrity": "sha384-…",
      "framework": "react",
      "description": "Carrinho com cupom"
    }
  ]
}
```

| Campo | O que é |
| --- | --- |
| `name` | Nome usado no host (`<Remote name="carrinho">`). Obrigatório e único |
| `url` | URL do `vitral.json`. Obrigatório. Relativa vale a partir do endereço do registro |
| `version` | `version` do manifesto |
| `props` | Tipo das props, lido do `vitral.d.ts` |
| `owner` | Time ou pessoa responsável |
| `integrity` | `integrity` do manifesto quando o registro foi gerado |
| `framework` | `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `element`… |
| `description` | Uma frase sobre o remote |

O JSON Schema está em [`/schema/vitral-registry.json`](https://joaogabriel15.github.io/vitral/schema/vitral-registry.json). Com o `$schema`, o editor completa e valida os campos.

## Gerar o registro

Liste os remotes num `remotes.json` e rode:

```bash
npx vitral registry remotes.json --name loja
```

O comando baixa o `vitral.json` e o `vitral.d.ts` de cada remote e preenche `version`, `props` e `integrity`. `owner`, `framework` e `description` não estão no manifesto: escreva no arquivo, e as próximas execuções mantêm o que estiver lá.

Publique o `vitral-registry.json` numa URL que os hosts consigam ler, junto dos remotes ou num repositório à parte.

## Adicionar um remote ao host

```bash
npx vitral add carrinho --registry https://cdn.empresa.com/vitral-registry.json
```

O comando:

1. Lê o registro (URL ou arquivo).
2. Escreve o remote no `remotes.json` do host: `public/remotes.json` ou `remotes.json`, o que existir.
3. Roda `vitral types` para gerar `vitral-env.d.ts` com o tipo das props.

Sem `--registry`, usa a variável `VITRAL_REGISTRY` ou o `vitral-registry.json` do projeto. Se o manifesto publicado mudou desde que o registro foi gerado, o comando avisa. Veja as opções em [CLI](/referencia/cli#vitral-add).

O host continua carregando os remotes do `remotes.json` com `configure({ remotes: '/remotes.json' })`.

## Servidor MCP

`npx vitral mcp` abre um servidor [MCP](https://modelcontextprotocol.io) por stdio. Um agente (Claude Code, Cursor, VS Code) usa as ferramentas:

| Ferramenta | O que faz |
| --- | --- |
| `list_remotes` | Lista os remotes do registro. `query` filtra por nome, dono, framework ou descrição |
| `get_remote` | Mostra um remote: URL, versão, hash, tipo das props e um exemplo de uso |
| `add_remote` | Faz o mesmo que `npx vitral add` no diretório do projeto |

Configuração do cliente, no `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "vitral": {
      "command": "npx",
      "args": ["vitral", "mcp", "--registry", "https://cdn.empresa.com/vitral-registry.json"]
    }
  }
}
```

O servidor não tem dependências além do Node.

## Skill para agentes

O repositório tem uma skill em [`skills/vitral/SKILL.md`](https://github.com/joaogabriel15/vitral/blob/main/skills/vitral/SKILL.md). Ela explica a um agente como criar um remote, mostrar um remote no host e usar o registro. Copie a pasta para `.claude/skills/` (ou para a pasta de skills do seu agente).
