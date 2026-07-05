# Estado do Backlog — gerado em 2026-07-05

| id | título | tipo | deps | status | commit |
|----|--------|------|------|--------|--------|
| 001 | Scaffold Vite + TS strict + Vitest (MPA 3 páginas) | infra | — | done | 7a61979 |
| 002 | Tipos §6 + parsing/formatação pt-BR | core | 001 | done | a837621 |
| 003 | Baker's percentage — F_total âncora | core | 002 | done | 17dd16e |
| 004 | Fermento por Partes + hidratação derivada | core | 003 | todo | |
| 005 | Hidratação nominal/real + Farinha Real | core | 003, 004 | todo | |
| 006 | Custos — custo/g, receita, fermento (isca zero) | core | 002, 004 | todo | |
| 007 | Precificação 3 modos + margem ≤99,9% + faixas | core | 006 | todo | |
| 008 | Recálculo central + modos + transição | core | 005, 006, 007 | todo | |
| 009 | Escalonamento por alvo + fornada por unidade | core | 008 | todo | |
| 010 | Validações §5 consolidadas | core | 008 | todo | |
| 011 | Storage receitas CRUD + toggle custos | storage | 002 | todo | |
| 012 | Backup/restauração JSON | storage | 011 | todo | |
| 013 | Fornadas — cálculos, agregações, persistência | core | 002, 011 | todo | |
| 014 | UI calculadora — tabela de insumos | ui | 008, 010, 011 | todo | |
| 015 | UI calculadora — fermento + hidratação | ui | 014 | todo | |
| 016 | UI calculadora — escala, precificação, banner | ui | 009, 015 | todo | |
| 017 | UI receitas + backup | ui | 011, 012, 014 | todo | |
| 018 | UI histórico — dashboard fornadas | ui | 013, 014 | todo | |
| 019 | Export XLSX + impressão | export | 008, 013 | todo | |
| 020 | Verificação final §12 + a11y + README | verify | 009, 010, 016–019 | todo | |
