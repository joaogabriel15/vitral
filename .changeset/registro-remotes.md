---
'vitral': minor
---

Registro de remotes para hosts e agentes. `npx vitral registry` gera um `vitral-registry.json` (nome, URL do manifesto, versão, tipo das props, dono, hash e framework de cada remote) a partir dos manifestos, com JSON Schema publicado em `https://joaogabriel15.github.io/vitral/schema/vitral-registry.json`. `npx vitral add <remote>` copia um remote do registro (URL ou arquivo) para o `remotes.json` do host e roda `vitral types`. `npx vitral mcp` abre um servidor MCP por stdio, sem dependências, com as ferramentas `list_remotes`, `get_remote` e `add_remote`. O repositório ganha uma skill para agentes em `skills/vitral/SKILL.md`.
