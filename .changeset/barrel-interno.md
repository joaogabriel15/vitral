---
"vitral": patch
---

`dedupe` com `pacote/*`: num import de um arquivo interno do pacote, os nomes que o pacote não exporta vêm do arquivo que os define, e não do barrel. Antes, o reexport do barrel punha no código principal do remote todos os arquivos que ele reexporta, com os efeitos colaterais deles, mesmo com o pacote oferecido pelo host. O aviso do build diz de qual arquivo vem a cópia própria, e um aviso novo, depois do build, conta os arquivos do pacote que entram no código principal, com um caminho até eles.
