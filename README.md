# Minha Padaria — Calculadora de Pão com Fermento Natural

Aplicação web para formular receitas de pão artesanal com fermento natural (baker's percentage), calcular custos e precificação, e acompanhar histórico de produção/vendas.

## Estrutura do repositório

| Pasta/Arquivo | Conteúdo |
|---|---|
| [spec/](spec/) | Especificações — [v5](spec/Calculadora_Pao_Fermento_Natural_v5.md) é a fonte da verdade; [v4](spec/Calculadora_Pao_Fermento_Natural_v4_FINAL.md) mantida para histórico |
| [issues/](issues/) | Issues geradas a partir da spec (quebra em tarefas de implementação) |
| [brand/brandbook.md](brand/brandbook.md) | Paleta oficial, tipografia e diretrizes de design |
| [references/](references/) | Design system: [style guide vivo](references/design-system.html) + [tokens e componentes CSS](references/design-system.css) |
| [mockups/](mockups/) | Protótipos HTML das telas |

Toda decisão de spec fica registrada na Seção 15 do documento v5, com o motivo por trás de cada uma.

## Protótipos (`mockups/`)

Abrir direto no navegador — sem build, sem servidor:

| Arquivo | Tela |
|---|---|
| [mockups/calculadora.html](mockups/calculadora.html) | Tela principal: ingredientes, fermento (sub-receita em partes), hidratação, precificação |
| [mockups/receitas.html](mockups/receitas.html) | Gerenciamento de receitas (criar, abrir, duplicar, renomear, excluir) |
| [mockups/historico.html](mockups/historico.html) | Histórico de fornadas: filtros, KPIs, gráfico de tendência, melhor/pior dia |
| [references/design-system.html](references/design-system.html) | Style guide vivo — todos os componentes e tokens isolados |

Todos importam [references/design-system.css](references/design-system.css) — fonte única de tokens e componentes.

## Status

**v1 completa e backlog concluído — 3 telas funcionais, core testado por TDD, exportação/backup/refactores (issues 004–039)**

A v1 entrega a aplicação inteira do fluxo da spec v5, 100% client-side (sem
backend, sem rede em runtime): formular receitas em baker's percentage, calcular
custo e precificação, gerenciar receitas salvas e acompanhar o histórico de
fornadas — com exportação (XLSX/PDF) e backup local (JSON).

Todas as issues do backlog implementadas (029–039): modal "+ Nova receita",
edição inline de nomes (Calculadora + Cards), refactor PDF v2, eliminação volume,
rota inicial receitas.html. **409 testes, 100% pass; build ok.**

### Scaffold (✓ Concluído)
- [x] Vite + TypeScript strict + Vitest
- [x] Design system live (tokens + componentes CSS)
- [x] Core calculation engine (baker's percentage, custo, precificação, fermento natural, hidratação)

### Tela Calculadora (✓ Funcional)
- [x] Tabela de ingredientes (edição inline, %, peso, custo)
- [x] Sub-receita do fermento (partes, peso, custo, hidratação derivada)
- [x] Painel de Hidratação (nominal/real, farinha consumida)
- [x] Modo de cálculo (peso→%, %), toggle com banner
- [x] Escalonamento por peso alvo
- [x] Painel de Precificação (preço/margem/lucro sincronizados, status cores)
- [x] Auto-save debounced + flush ao fechar aba

### Tela Minhas Receitas (✓ Funcional)
- [x] Grid de receitas com cards (custo/margem/datas)
- [x] Busca/filtro de nomes
- [x] Criar nova receita (golden seed)
- [x] Abrir/renomear/duplicar/excluir
- [x] Alerta de fornadas órfãs (§14.7)
- [x] Backup/restauração JSON (exportar/importar com validação pré-escrita)
- [x] Estado vazio + status region (aria-live pt-BR)

### Tela Histórico de Fornadas (✓ Funcional)
- [x] Registro rápido de fornada (receita, data, produzida/vendida, custo/preço, observações)
- [x] Filtros por período e receita
- [x] KPIs do período (produzido, vendido, custo, receita, lucro, desperdício)
- [x] Gráfico de tendência + melhor/pior dia
- [x] Listagem cronológica das fornadas

### Exportação e Backup (✓ Funcional)
- [x] Exportar receita em XLSX (ExcelJS, respeita o toggle "Exibir custos")
- [x] Imprimir / Salvar em PDF (via `window.print`)
- [x] Backup completo (receitas + fornadas) em JSON, exportar/importar com round-trip validado

### Testes (✓ Cobertura Alta)
- [x] Core: TDD, zero mock, teste dourado permanente do exemplo §12
- [x] UI/Storage/Export: testes jsdom (XSS inerte, recálculo, wiring, persistência)
- [x] **Total: 295 testes, 100% pass** (29 arquivos)

## Como rodar

Requer Node 18+ (desenvolvido em Node 24). Sem serviços externos.

```bash
npm install      # instala dependências
npm run dev      # servidor de desenvolvimento (Vite, hot reload)
npm run build    # type-check (tsc --noEmit) + build de produção em dist/
npm run preview  # serve o build de produção localmente
```

Páginas: `index.html` (Calculadora), `receitas.html` (Minhas Receitas),
`historico.html` (Histórico de Fornadas). Abrir uma receita salva na
Calculadora: `index.html?recipe=<id>`.

## Como testar

```bash
npm test            # Vitest em modo watch
npm test -- --run   # execução única (CI), todos os testes uma vez
```

## Segurança

Aplicação 100% client-side: nenhuma chamada de rede em runtime, nenhum `eval`,
todos os dados no `localStorage` do navegador. Nenhuma integração externa (ex:
Google Docs — ver Seção 11.1 da spec) deve expor API keys/secrets no front-end
nem em commits. Ver `.gitignore`.
