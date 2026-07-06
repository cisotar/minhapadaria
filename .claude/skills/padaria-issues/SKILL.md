---
name: padaria-issues
description: Quebra a spec vigente (specs/) da Calculadora de Pão em issues locais (issues/NNN-slug.md) ordenadas por dependência, com tipos, critérios de aceite e testes exigidos, e gera o issues/STATE.md. Autônomo — sem confirmação. Normalmente invocado pelo bootstrap do /padaria-loop.
---

# /padaria-issues — gerar backlog local a partir da spec

Leia `specs/Calculadora_Pao_Fermento_Natural_v5.md` por inteiro (é a origem do projeto) mais qualquer outro doc em `specs/` que a sobreponha (cabeçalho `Supera:`), e gere o backlog completo em `issues/`. Sem pedir confirmação: arquivos locais, commitáveis, prontos para o loop noturno consumir. `gh` está liberado no projeto, mas este fluxo continua local (não cria issues no GitHub).

## Formato de cada issue — `issues/NNN-slug.md`

```markdown
---
id: "NNN"
titulo: Título curto imperativo
tipo: infra | core | storage | export | ui | fix | verify
deps: ["001", "002"]
status: todo
---

## Contexto
Por que existe (1–2 frases, com as seções da spec: §X.Y).

## O que fazer
- Passos concretos extraídos da spec, com as fórmulas copiadas (LaTeX ou texto).

## Testes exigidos (TDD) — apenas tipos core/storage/export
- Um caso por comportamento, com entrada e saída esperada.
- Issues de cálculo DEVEM incluir os números do exemplo validado (Seção 12) como casos de teste.

## Critérios de aceite
- [ ] Um checkbox por comportamento verificável.

## Referências
- spec §X.Y · mockup correspondente · brandbook §Z (issues de UI)
```

## STATE — `issues/STATE.md`

Tabela-índice que o loop lê e atualiza:

```markdown
# Estado do Backlog — gerado em <data aaaa-mm-dd>

| id | título | tipo | deps | status | commit |
|----|--------|------|------|--------|--------|
| 001 | ... | infra | — | todo | |
```

Status possíveis: `todo` · `doing` · `blocked` · `done`.

## Roteiro sugerido (ajuste apenas se a spec exigir — não invente escopo)

| id | tipo | escopo |
|----|------|--------|
| 001 | infra | Scaffold Vite + TypeScript strict + Vitest; 3 páginas MPA (index=calculadora, receitas, historico) importando `references/design-system.css`; scripts npm; teste dourado da Seção 12 como placeholder falhando |
| 002 | core | Tipos da spec §6 + parsing/formatação pt-BR (vírgula/ponto na entrada, vírgula na exibição, arredondamento só na exibição §9) |
| 003 | core | Baker's percentage: F_total âncora, pesos derivados, múltiplas farinhas somando 100% (§1, §3.A) |
| 004 | core | Fermento por Partes: W_ferm, rateio Isca/Farinha/Água, hidratação derivada, farinhas do fermento (§2.B, §3.B) |
| 005 | core | Hidratação nominal/real (fat fora §2.C) + Farinha Real Consumida (§2.D) |
| 006 | core | Custos: custo/g derivado (§2.A.1), custo na receita, custo do fermento com isca zero (§3.E) |
| 007 | core | Precificação 3 modos sincronizados + margem ≤99,9% + totais de produção + faixas de status 30/15 (§3.E, §4) |
| 008 | core | Função central de recálculo em lote (§1.6); modos %→peso e peso→% + transição de volta (§1.3–1.5) |
| 009 | core | Escalonamento por peso alvo (fermento na soma, §3.D) + fornada por unidade (§2.E.1) |
| 010 | core | Validações da Seção 5 consolidadas (blur, bloqueios, avisos) |
| 011 | storage | Receitas em localStorage: CRUD + duplicar + estado completo (§2.F) + persistência do toggle de custos (§2.A.2) |
| 012 | storage | Backup/restauração em arquivo JSON — obrigatório v1 (§10) |
| 013 | core | Fornadas: cálculos por fornada, agregações dia/semana/mês, planned fora dos totais, comparação de períodos, melhor/pior (§14) |
| 014 | ui | Calculadora: tabela de insumos com edição inline, toggle custos, alternador g/mL, linha do fermento (§2.A, §4; mockup calculadora.html) |
| 015 | ui | Calculadora: bloco do fermento (tabela vertical de Partes) + painéis hidratação e farinha real (§2.B–2.D) |
| 016 | ui | Calculadora: painel escala/produção, precificação, escalonamento, banner modo peso→% (§2.E, §1.3) |
| 017 | ui | Tela de receitas: criar, abrir, renomear, duplicar, excluir (§2.F; mockup receitas.html) |
| 018 | ui | Tela de histórico: registro de fornada, filtros, KPIs, gráfico de tendência, melhor/pior, órfãs (§14; mockup historico.html) |
| 019 | export | XLSX com/sem custos + página de impressão "PDF" (§8) — decidir lib client-side na issue |
| 020 | verify | Verificação final: exemplo da Seção 12 ponta a ponta na UI real, a11y, atualização do README |

## Regras

- Só requisitos da spec — não invente. Toda fórmula citada com a seção (§).
- `deps` mínimas e reais: core antes da UI que o consome; 001 antes de tudo.
- **Regras de ouro do cliente em cada issue**: aponte o que reusar (código/design system existente); funcionalidade não-trivial → indicar lib consolidada candidata + doc oficial a consultar; issues com renderização de dado do usuário → critério de aceite de escape/XSS.
- Issues podem ser escritas em inglês (decisão do cliente 2026-07-05); strings de UI citadas nelas permanecem pt-BR.
- Ao final: `git add issues/ && git commit -m "chore: backlog inicial gerado a partir da spec v5"` e imprima a tabela do STATE.
