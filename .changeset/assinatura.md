---
'vitral': minor
---

Assinatura dos arquivos do remote com Ed25519: `vitral sign` grava os headers de assinatura (`_headers` e `vitral-signatures.json`), e o host fixa a chave pública em `keys`. O Chrome 141+ só roda o `vitral.json`, o JS e o CSS assinados por ela; os outros navegadores continuam conferindo o hash. `vitral/sign` exporta `keygen`, `signBody`, `verifyBody` e `signDir`, e o `remoteProps` do Next confere a assinatura do manifesto no servidor.
