# Publicar

O host e cada remote têm seu próprio deploy. O host conhece a URL do manifesto; você não precisa copiar o código dos remotes para o repositório principal.

## 1. Publique o remote

No projeto gerado pelo `create-vitral`:

```bash
npm run build
```

Publique **toda** a pasta `dist`, preservando arquivos e subpastas. Se você seguiu [Conectar projetos existentes](./repositorios), use o build com `vite.remote.config.js` e publique `dist-remote`.

O endereço público terá este formato:

```text
https://cdn.empresa.com/produtos/vitral.json
```

## 2. Configure a entrega dos arquivos

No servidor ou CDN do remote:

| Configuração | Valor |
| --- | --- |
| CORS | `Access-Control-Allow-Origin: https://app.empresa.com` (a origem do host) |
| Cache de `vitral.json` | `Cache-Control: no-cache` |
| Cache dos arquivos com hash | `Cache-Control: public, max-age=31536000, immutable` |

Sirva JavaScript e CSS com os tipos de conteúdo corretos. Aplique CORS também aos arquivos referenciados pelo manifesto.

Envie os arquivos com hash antes de atualizar o manifesto. Preserve os arquivos de versões anteriores durante a janela de uso e rollback: abas abertas ainda podem precisar deles.

## 3. Aponte o host para produção

```js
import { configure } from 'vitral'

configure({
  remotes: {
    produtos: 'https://cdn.empresa.com/produtos/vitral.json',
    employee: 'https://cdn.empresa.com/employee/vitral.json',
  },
})
```

Publique o host pelo processo normal do framework. Depois, novos deploys compatíveis de produtos mantêm a mesma URL do manifesto e não exigem rebuild do host.

Uma aba que já carregou um remote não troca de versão automaticamente. Para atualização durante a sessão, consulte [Atualizar remotes](/formas-de-usar).

## Confira antes de liberar

- Abra o host e confirme que os remotes carregam sem erros de rede ou CORS.
- Acesse uma rota interna diretamente, como `/produtos/123`. O servidor do host deve entregar a aplicação para esse caminho.
- Confira login, logout e a navegação entre áreas.
- Combine mudanças de props e serviços entre equipes; deploy independente não elimina o contrato entre host e remote.

Se a aplicação usa CSP ou hashes fixados no host, veja [Segurança](./seguranca).
