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

Fase de spec e design. Sem código de produção ainda — próximo passo natural é quebrar a spec v5 em issues (`/break`) e iniciar a implementação.

## Segurança

Nenhuma integração externa (ex: Google Docs — ver Seção 11.1 da spec) deve expor API keys/secrets no front-end nem em commits. Ver `.gitignore`.
