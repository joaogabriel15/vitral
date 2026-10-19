---
'vitral': minor
---

Canary e rollback por um arquivo-ponteiro, sem serviço externo. Registre a URL de um `canal.json` (`{ "stable": "1.4.0", "canary": { "version": "1.5.0", "percent": 10 } }`) no lugar do `vitral.json`: o host escolhe a versão de cada usuário por um número estável (`canaryKey` ou um id do navegador), aceita uma regra própria em `resolve` (cookie, grupo de teste) e, quando a canary passa de `rollback.errors` erros numa janela de `rollback.mounts` montagens, volta para a estável naquela sessão, troca as montagens na tela e chama `onRollback`. O plugin ganhou `versionDir: true`, que grava o build em `dist/<versão>/`. O código do canal é baixado só quando o host encontra um canal.
