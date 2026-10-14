---
"vitral": minor
---

Manifesto v2 no plugin Vite: o `vitral.json` ganha `files`, com o hash `sha384` de cada arquivo (CSS incluído). Quando o remote tem `import()`, o plugin gera também o build dividido em `dist/split/` e o campo `split`; `entry` e `integrity` continuam apontando para o arquivo único, então hosts antigos não mudam. No build dividido, os `import()` do remote passam por um helper que confere o hash também onde a lib usa `modulepreload` com `integrity`.
