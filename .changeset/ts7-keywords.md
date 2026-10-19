---
'vitral': patch
'create-vitral': patch
---

O build do remote não quebra mais com o TypeScript 7 (o que o `create-vite` instala hoje): sem API em JavaScript, o plugin procura outro TypeScript e, sem nenhum, segue sem gerar `vitral.d.ts`. Palavras-chave do npm ampliadas para o pacote ser encontrado na busca.
