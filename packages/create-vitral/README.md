<p align="center">
  <img src="https://raw.githubusercontent.com/joaogabriel15/vitral/main/docs/public/marca/banner.png" width="640" alt="vitral. Feito de partes. Visto como um todo.">
</p>

# create-vitral

Cria um host ou um remote [vitral](https://joaogabriel15.github.io/vitral/) pronto para rodar.

```bash
npm create vitral@latest
```

Sem opções, o comando pergunta o que criar. Com opções:

```bash
npm create vitral@latest carrinho -- --remote --framework react
npm create vitral@latest loja -- --host --framework vue --src https://cdn.empresa.com/carrinho/vitral.json
```

| Opção | Valores |
| --- | --- |
| `--host`, `--remote` | O que criar |
| `--framework`, `-f` | Hosts: react, next, vue, nuxt, angular, sveltekit, solid, preact, lit, vanilla. Remotes: react, vue, svelte, solid, preact, angular, lit, vanilla |
| `--src` | URL do `vitral.json` que o host carrega |

Depois, siga [Configurar host e remote](https://joaogabriel15.github.io/vitral/aprender/configurar).

Licença MIT.
