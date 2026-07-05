---
id: "012"
titulo: Backup/restauração em arquivo JSON (obrigatório v1)
tipo: storage
deps: ["011"]
status: todo
---

## Contexto
Proteção contra perda do localStorage (spec §10, decisão 11): exportar TODOS os dados (receitas + histórico de fornadas) para JSON; importar/restaurar do arquivo. Formato também é a futura migração SaaS (§11.2).

## O que fazer
- `src/storage/backup.ts`:
  - `exportBackup(): string` — JSON com envelope `{ app, schemaVersion: 1, exportedAt, recipes, bakeHistory }`. Histórico incluído quando existir (issue 013 pluga aqui; até lá, array vazio).
  - `importBackup(json: string)` — valida envelope (app/schemaVersion/shape); inválido → erro claro pt-BR, estado atual INTACTO (não zera nada em falha).
  - Estratégia de importação: substituição total documentada no código (leitura literal de "restaurar" §10); registrar em PROGRESS.md.
- Download/upload do arquivo: Blob + `URL.createObjectURL` + `<a download>`; `<input type="file">` + FileReader (MDN; sem lib — plataforma cobre).
- UI mínima: botões nas telas ficam com issues de UI (017); aqui só as funções + wiring básico exportável.

## Testes exigidos (TDD)
- Round-trip: export com 2 receitas + 1 fornada → import em storage limpo → deep-equal.
- Import de JSON inválido ("{oops", schemaVersion 99, sem envelope) → throw com mensagem pt-BR; storage anterior intacto.
- Export sem dados → envelope válido com arrays vazios.
- exportedAt em formato ISO.

## Critérios de aceite
- [ ] Backup cobre receitas + histórico (§10).
- [ ] Falha de import nunca corrompe/perde dados atuais.
- [ ] Zero rede; arquivo local apenas.

## Referências
- spec §10, §11.2, decisão 11 · MDN Blob/FileReader
