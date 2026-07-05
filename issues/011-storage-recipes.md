---
id: "011"
titulo: Receitas em localStorage — CRUD, duplicar, estado completo + toggle custos persistido
tipo: storage
deps: ["002"]
status: todo
---

## Contexto
Persistência local (spec §10): receitas com estado completo (§2.F); preferência do toggle "Exibir custos" persistida entre sessões (§2.A.2).

## O que fazer
- `src/storage/recipes.ts`:
  - CRUD sobre `Recipe[]` em localStorage (chave versionada, ex `mp.recipes.v1`): `list`, `get`, `create`, `update`, `rename`, `duplicate`, `remove`.
  - Duplicar = cópia integral (ingredientes, fermento, precificação, modos) com novo `id`, novo nome ("Cópia de X"), datas novas (§2.F).
  - Estado completo por receita: ingredientes, sourdough, calculationMode, batchPlanningMode, pricing (§2.F).
  - `Date` serializada ISO; revive no load. IDs: `crypto.randomUUID()` (plataforma; MDN).
  - JSON corrompido/ausente → lista vazia, sem crash.
- `src/storage/prefs.ts`: get/set do toggle "Exibir custos" (default: oculto §2.A.2).
- Injetar storage (interface mínima) para testabilidade — Vitest sem browser usa stub/`happy-dom`.

## Testes exigidos (TDD)
- create → list contém 1; get por id retorna igual (deep, com datas revividas).
- duplicate → id diferente, nome "Cópia de X", conteúdo deep-equal exceto id/nome/datas.
- rename/update → updatedAt muda.
- remove → some da lista; get → undefined.
- localStorage com lixo (`"{oops"`) → list() = [] sem throw.
- Toggle custos: default false; set true → persiste.

## Critérios de aceite
- [ ] Round-trip sem perda: save→load deep-equal (datas incluídas).
- [ ] Duplicação integral (§2.F).
- [ ] Toggle custos persistido, default oculto (§2.A.2).
- [ ] Zero rede; dados 100% locais (regra de ouro 3).

## Referências
- spec §2.A.2, §2.F, §6, §10 · MDN localStorage, crypto.randomUUID
