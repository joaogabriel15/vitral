---
"vitral": patch
---

`await refresh(nome)` agora resolve só depois que as montagens já mostram a versão nova, e rejeita se o `mount` da versão nova falhar (antes o erro ia só para o console). Dois `refresh` seguidos não terminam fora de ordem: fica a versão do último. Props passadas com `update` durante a troca chegam na versão nova.
