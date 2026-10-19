---
"vitral": minor
---

Plugin Vite: opção `sbom`. Com `vitral({ sbom: true })`, o build grava `sbom.cdx.json` (CycloneDX 1.6, JSON) com os pacotes npm que entraram no bundle do remote: nome, versão, licença, purl e quem depende de quem, com o remote como componente principal e o hash do JS publicado. O `vitral.json` ganha `sbom: { file, integrity }`. Pacotes removidos pelo tree-shaking não aparecem. Desligado por padrão; sem a opção, o build não muda. Ajuda a cumprir o Cyber Resilience Act da UE, que exige SBOM a partir de dezembro de 2027.
