# Registry and agents

A registry lists the remotes your company publishes, in a `vitral-registry.json` file. With it, a host adds a remote by name, without copying manifest URLs by hand. A coding agent does the same through the MCP server.

## The file

```json
{
  "$schema": "https://joaogabriel15.github.io/vitral/schema/vitral-registry.json",
  "name": "shop",
  "remotes": [
    {
      "name": "cart",
      "url": "https://cdn.example.com/cart/vitral.json",
      "version": "1.4.0",
      "props": "{ userId: number; coupon?: string }",
      "owner": "checkout-team",
      "integrity": "sha384-…",
      "framework": "react",
      "description": "Cart with coupon"
    }
  ]
}
```

| Field | What it is |
| --- | --- |
| `name` | Name used in the host (`<Remote name="cart">`). Required and unique |
| `url` | URL of `vitral.json`. Required. A relative URL is resolved from the registry's address |
| `version` | The manifest's `version` |
| `props` | Props type, read from `vitral.d.ts` |
| `owner` | Team or person responsible |
| `integrity` | The manifest's `integrity` when the registry was generated |
| `framework` | `react`, `vue`, `svelte`, `solid`, `preact`, `angular`, `element`… |
| `description` | One sentence about the remote |

The JSON Schema is at [`/schema/vitral-registry.json`](https://joaogabriel15.github.io/vitral/schema/vitral-registry.json). With `$schema`, the editor completes and validates the fields.

## Generate the registry

List the remotes in a `remotes.json` and run:

```bash
npx vitral registry remotes.json --name shop
```

The command downloads each remote's `vitral.json` and `vitral.d.ts` and fills `version`, `props` and `integrity`. `owner`, `framework` and `description` aren't in the manifest: write them in the file, and the next runs keep what is there.

Publish `vitral-registry.json` at a URL the hosts can read, next to the remotes or in a separate repository.

## Add a remote to the host

```bash
npx vitral add cart --registry https://cdn.example.com/vitral-registry.json
```

The command:

1. Reads the registry (URL or file).
2. Writes the remote to the host's `remotes.json`: `public/remotes.json` or `remotes.json`, whichever exists.
3. Runs `vitral types` to generate `vitral-env.d.ts` with the props type.

Without `--registry`, it uses the `VITRAL_REGISTRY` variable or the project's `vitral-registry.json`. If the published manifest changed since the registry was generated, the command warns. See the options in [CLI](/en/referencia/cli#vitral-add).

The host keeps loading the remotes from `remotes.json` with `configure({ remotes: '/remotes.json' })`.

## MCP server

`npx vitral mcp` opens an [MCP](https://modelcontextprotocol.io) server over stdio. An agent (Claude Code, Cursor, VS Code) uses the tools:

| Tool | What it does |
| --- | --- |
| `list_remotes` | Lists the registry's remotes. `query` filters by name, owner, framework or description |
| `get_remote` | Shows a remote: URL, version, hash, props type and a usage example |
| `add_remote` | Does the same as `npx vitral add` in the project directory |

Client configuration, in the project's `.mcp.json`:

```json
{
  "mcpServers": {
    "vitral": {
      "command": "npx",
      "args": ["vitral", "mcp", "--registry", "https://cdn.example.com/vitral-registry.json"]
    }
  }
}
```

The server has no dependencies besides Node.

## Skill for agents

The repository has a skill at [`skills/vitral/SKILL.md`](https://github.com/joaogabriel15/vitral/blob/main/skills/vitral/SKILL.md). It explains to an agent how to create a remote, show a remote in the host and use the registry. Copy the folder to `.claude/skills/` (or to your agent's skills folder).
