# Estado do Backlog — gerado em 2026-07-05

| id | título | tipo | deps | status | commit |
|----|--------|------|------|--------|--------|
| 001 | Scaffold Vite + TS strict + Vitest (MPA 3 páginas) | infra | — | done | 7a61979 |
| 002 | Tipos §6 + parsing/formatação pt-BR | core | 001 | done | a837621 |
| 003 | Baker's percentage — F_total âncora | core | 002 | done | 17dd16e |
| 004 | Fermento por Partes + hidratação derivada | core | 003 | done | 3de585e |
| 005 | Hidratação nominal/real + Farinha Real | core | 003, 004 | done | 5e2bca9 |
| 006 | Custos — custo/g, receita, fermento (isca zero) | core | 002, 004 | done | 22cd6a7 |
| 007 | Precificação 3 modos + margem ≤99,9% + faixas | core | 006 | done | 396a442 |
| 008 | Recálculo central + modos + transição | core | 005, 006, 007 | done | 9068c1a |
| 009 | Escalonamento por alvo + fornada por unidade | core | 008 | done | 931f5ed |
| 010 | Validações §5 consolidadas | core | 008 | done | 7e1fcfd |
| 011 | Storage receitas CRUD + toggle custos | storage | 002 | done | b2fbaf4 |
| 012 | Backup/restauração JSON | storage | 011 | done | f0f9bba |
| 013 | Fornadas — cálculos, agregações, persistência | core | 002, 011 | done | 9c6b58a |
| 014 | UI calculadora — tabela de insumos | ui | 008, 010, 011 | done | df3e956 |
| 015 | UI calculadora — fermento + hidratação | ui | 014 | done | 898b287 |
| 016 | UI calculadora — escala, precificação, banner | ui | 009, 015 | done | 9a08803 |
| 017 | UI receitas + backup | ui | 011, 012, 014 | done | 0106863 |
| 018 | UI histórico — dashboard fornadas | ui | 013, 014 | done | 9dd2cde |
| 019 | Export XLSX + impressão | export | 008, 013 | done | 3838177 |
| 020 | Verificação final §12 + a11y + README | verify | 009, 010, 016–019, 021–027 | todo | |
| 021 | Fix — achados da revisão da issue 013 (bakes) | fix | 013 | done | e0b2b41 |
| 022 | Fix — achados da revisão da issue 014 (tabela) | fix | 014 | done | 66076d2 |
| 023 | Fix — achados da revisão da issue 015 (fermento UI) | fix | 015 | done | 15dc19a |
| 024 | Fix — achados da revisão da issue 016 (escala/preço UI) | fix | 016 | done | 05fba78 |
| 025 | Fix — achados da revisão da issue 017 (tela receitas) | fix | 017 | done | b3f33de |
| 026 | Fix — achados da revisão da issue 018 (histórico UI) | fix | 018 | done | 62b3826 |
| 027 | Fix — achados da revisão da issue 019 (export) | fix | 019 | doing | |
