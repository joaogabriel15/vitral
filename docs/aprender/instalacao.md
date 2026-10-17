# Instalação

## Projeto novo

```bash
npm create vitral@latest
```

Gera um host e um remote prontos para rodar.

## Projeto existente

Instale no host e em cada remote:

::: code-group

```bash [npm]
npm install vitral
```

```bash [pnpm]
pnpm add vitral
```

```bash [yarn]
yarn add vitral
```

:::

Os adaptadores usam o React, Vue, Angular, Svelte, Solid ou Preact que já está no projeto. O host só baixa o código do adaptador que importa.

## Pontos de entrada

| Import | Para |
| --- | --- |
| `vitral` | Núcleo: `configure`, `events`, `provide`, `shared` |
| `vitral/vite` | Plugin de build do remote |
| `vitral/react`, `vitral/vue`, `vitral/angular`, `vitral/svelte`, `vitral/solid`, `vitral/preact` | Host e remote em cada framework |
| `vitral/element` | `<vitral-remote>` e remotes em Web Components |
| `vitral/auto` | Registra `<vitral-remote>` ao importar |
| `vitral/routes` | Rotas sem framework |
| `vitral/iframe` | Isolamento em iframe |
| `vitral/testing` | Remotes falsos para testes |
| `vitral/devtools` | Painel para trocar URLs em desenvolvimento |

A lista completa está na [Referência](/referencia/).

## Sem bundler

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/vitral/dist/auto.js"></script>
```

## Requisitos

- Navegadores com ES modules.
- Vite 5 ou mais novo no remote, para usar o plugin. Sem o plugin, veja [Outros bundlers](/referencia/vitral/configure#outros-bundlers).
