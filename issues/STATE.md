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
| 020 | Verificação final §12 + a11y + README | verify | 009, 010, 016–019, 021–027 | done | 6ca5bea |
| 021 | Fix — achados da revisão da issue 013 (bakes) | fix | 013 | done | e0b2b41 |
| 022 | Fix — achados da revisão da issue 014 (tabela) | fix | 014 | done | 66076d2 |
| 023 | Fix — achados da revisão da issue 015 (fermento UI) | fix | 015 | done | 15dc19a |
| 024 | Fix — achados da revisão da issue 016 (escala/preço UI) | fix | 016 | done | 05fba78 |
| 025 | Fix — achados da revisão da issue 017 (tela receitas) | fix | 017 | done | b3f33de |
| 026 | Fix — achados da revisão da issue 018 (histórico UI) | fix | 018 | done | 62b3826 |
| 027 | Fix — achados da revisão da issue 019 (export) | fix | 019 | done | f567a9c |
| 028 | Refactor — estilo dos PDFs (visual tipo tela) + split Receita/Custos | export | 019, 027 | done | 708372c |
| 029 | Fix — achados da revisão da issue 028 (refactor PDF) | fix | 028 | done | 69ee142 |
| 030 | Eliminar unidades de volume (mL/L) — todo ingrediente em peso (g/kg) | mista | 002, 006, 010, 011, 014, 015 | done | 979d639 |
| 031 | Fix — achados da revisão da issue 030 (eliminação de volume) | fix | 030 | done | PENDING |
| 032 | Rota inicial do site deve ser receitas.html | ui | 017 | done | 8c67f6c |
| 033 | Renomear receita vira edição inline (sem prompt/modal) | ui | 017 | done | 72e443a |
| 034 | Refactor impressão Receita/Custos v2 — cards, fermento, coluna custo | export | 019, 028, 030 | done | 6486296 |
| 035 | "+ Nova receita" abre modal de nome antes de criar; seed sem Azeite | ui | 017 | todo | — |
| 036 | Calculadora exibe e permite editar o nome da receita carregada | ui | 014, 033 | todo | — |
| 037 | Fix — achado da revisão da issue 029 (nota de reatividade do PDF Financeiro) | fix | 029 | todo | — |
| 038 | Fix — resíduo de doc da issue 031/030 (Água "1 L" → "1 kg" no guia vivo) | fix | 031 | todo | — |
