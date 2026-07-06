# Aba BALANÇO — visão financeira por fornada

**Status:** aprovada
**Data:** 2026-07-06
**Changelog:** 2026-07-06 — cliente respondeu P1–P3 e delegou defaults de P4–P6; proposta promovida a aprovada. Perguntas em aberto convertidas em decisões travadas: P1 seção do Histórico (§2.3), P2 só-leitura (§2.3), P3 linha de totais + Status agregado ΣF/ΣC (§2.4), P4 espelha o Histórico (§2.5), P5 cor por semântica contábil (§2.5), P6 data desc (§2.5).
**Changelog (arquiteto, 2026-07-06 — issue 046):** adicionada §2.6 (seletor de visualização Completa/Unidades/Fornadas) — feature puramente de EXIBIÇÃO pedida pelo cliente em 2026-07-06, aditiva e sem tocar dado, fórmula, filtro, ordenação ou os totais da §2.4. O mapa de colunas por visualização foi confirmado com o cliente e travado nesta seção. Não altera nenhuma decisão anterior (P1–P6 intactas).
**Changelog (arquiteto, 2026-07-06):** esclarecidas duas lacunas encontradas ao planejar a issue 045, sem mudar decisão do cliente: (a) §2.5 P5 — a paleta ON-SCREEN da marca não tem token de "azul crédito" (o azul-crédito de `--print-*`/issue 028 é exclusivo dos PDFs); na tela reusa-se só `.loss` (vermelho) em Saldo < 0, com Saldo ≥ 0 e demais monetários NEUTROS, espelhando a tabela irmã do Histórico (que já deixa lucro positivo neutro). (b) §2.5 P4 — fixada a lista exata de colunas com "—" nas linhas planejadas (Vendas, Preço unitário, Faturamento, Saldo, Status), mantendo Data/Receita/Produção/Custo unitário/Custo (C) preenchidos.
**Supera:** nenhuma — aditivo puro. Não altera nenhuma fórmula da v5 §14 (Histórico de Fornadas); adiciona uma visão nova sobre os mesmos dados + 1 métrica nova (Status).
**Relaciona:** v5 §14.1–14.3 (fornadas e fórmulas por fornada), §14.4 (agregações), §14.5–14.7 (funcionalidades, validações, relação com receitas), §5.D (validações do histórico), §6 (`BakeEntry`), §7.1 (formatos), §8 (exportação), §9 (precisão). Contexto de nomenclatura: issue 041 (precificação passou de margem-sobre-preço para markup-sobre-custo). Convenção de cor: memória `pdf-credit-debit-color-and-financial-debt` (issue 028). Telas reusadas: issues 018/044 (UI do Histórico, `src/ui/historyView.ts`).

---

## 1. Motivação

Pedido do cliente (2026-07-06): nova aba/seção **"BALANÇO"** no app, reproduzindo a planilha de referência que ele usa hoje (imagem enviada, colunas das linhas 13–14):

`Data | Receita | Produção | Custo unitário | Custo (C) | Vendas | Preço unitário | Faturamento (F) | Saldo | Status`

Todas as regras da §2 abaixo foram **confirmadas em pergunta-resposta direta com o cliente** (não inferência), inclusive a fórmula do Status.

---

## 2. Regra(s)

### 2.1. Origem dos dados — a linha do BALANÇO é a Fornada da v5 §14

**Cada linha do BALANÇO = uma fornada** (data + receita produzida naquele dia). Não existe entidade nova: a linha é uma projeção do `BakeEntry` já existente (v5 §6), registrado pelo fluxo da v5 §14.2. Mapeamento coluna → dado existente:

| Coluna (rótulo do cliente) | Origem (`BakeEntry`) | Fórmula |
|---|---|---|
| Data | `date` | — (formato `aaaa-mm-dd`, v5 §7.1) |
| Receita | `recipeName` (snapshot) | — |
| Produção | `quantityProduced` | qtd de pães produzidos na fornada |
| Custo unitário | `unitCost` (snapshot) | custo de produzir 1 pão daquela receita |
| **Custo (C)** | `totalCost` | $C = \text{Produção} \times \text{Custo unitário}$ |
| Vendas | `quantitySold` | qtd de pães vendidos da fornada |
| Preço unitário | `unitSalePrice` (snapshot) | preço de venda de 1 pão |
| **Faturamento (F)** | `totalRevenue` | $F = \text{Vendas} \times \text{Preço unitário}$ |
| **Saldo** | `totalProfit` | $\text{Saldo} = F - C$ |
| **Status** | **novo derivado** | ver §2.2 |

As fórmulas de C, F e Saldo são **idênticas** às da v5 §14.3 (Custo Total da Fornada, Receita da Fornada, Lucro da Fornada) — nenhuma fórmula existente muda. Em particular, mantém-se a regra de negócio central (v5 §14.1, reconfirmada pelo cliente agora):

- **Custo (C) incide sobre a produção inteira**, mesmo que não tenha sido toda vendida — pão não vendido conta como custo, não é descontado.
- **Faturamento (F) incide só sobre o efetivamente vendido**, nunca sobre a produção total.
- Consequência: **Saldo pode ser negativo** quando sobra pão sem vender.

### 2.2. Status ("MARGEM %") — única regra nova

$$\text{Status} = \frac{F}{C} \times 100\%$$

Exemplo confirmado pelo cliente: F = 120, C = 100 → Status = **120%**, lido por ele como "lucro de 20% sobre o custo".

- Exibição em % com 2 casas decimais (padrão v5 §9), rótulo da coluna: **"Status"** (com "MARGEM %" sendo o nome que o cliente usa na planilha — ver nota de nomenclatura abaixo).
- Leituras: Status > 100% → fornada lucrativa; = 100% → empate; < 100% → prejuízo (inclui o caso Vendas = 0 → Status = 0%).

> **⚠️ Nota de nomenclatura (registro obrigatório, não muda a fórmula):** F/C é conceitualmente um **markup sobre o custo**, não "margem" clássica sobre faturamento ($(F-C)/F$). O cliente confirmou **explicitamente** a fórmula F/C sob o rótulo "MARGEM %" que ele mesmo escolheu — esta spec registra a fórmula literal pedida. É a mesma ambiguidade já enfrentada no card de Precificação (issue 041: "% de lucro" = markup sobre custo, superando v5 §3.E/golden §12). Atenção: a métrica "Margem de lucro média do período (%)" das agregações da v5 §14.4 é **outra métrica** e permanece como está — o Status do BALANÇO não a substitui nem é substituído por ela.

### 2.3. Localização e natureza da aba (P1, P2 — travado)

- **P1 — mora dentro da tela Histórico.** BALANÇO é uma **seção/tabela dentro da página de Histórico existente** (issues 018/044, `src/ui/historyView.ts`), **não** uma página própria. Reusa o layout e os componentes da tela de Histórico (mesma fonte de dados `BakeEntry`, mesmos filtros de receita/intervalo da v5 §14.5 quando aplicável).
- **P2 — somente leitura.** O BALANÇO **exibe** fornadas já registradas; **não registra nem edita** dados. Registro/edição/exclusão de fornadas continuam nas telas de fornada existentes (v5 §14.2/14.5). Não é um segundo ponto de entrada de dados.
- **Granularidade: por fornada individual**, uma linha por fornada, como na planilha de referência — mais a linha de totais da §2.4. As agregações por período do dashboard (v5 §14.4) continuam existindo à parte e **não são reimplementadas aqui**; a linha de totais do BALANÇO é a soma do conjunto de fornadas atualmente exibido na tabela (respeitando os filtros ativos), não um novo motor de agregação por dia/semana/mês.
- **Snapshots preservam a história**: como `unitCost`/`unitSalePrice` são snapshots congelados no registro (v5 §14.2), o custo unitário **pode variar entre fornadas da mesma receita** — cada linha do BALANÇO usa o valor da sua própria fornada, nunca o custo atual da receita. Nenhuma regra nova necessária.
- **Exportação**: mesma regra geral da v5 §8/§14.5 (HTML→impressão e XLSX, com/sem custos), aplicada a esta visão.

### 2.4. Linha de totais no rodapé (P3 — travado)

O cliente confirmou (2026-07-06): **sim, há uma linha de totais no rodapé** (`tfoot`) da tabela BALANÇO, somando as colunas quantitativas e monetárias:

$$\Sigma\text{Produção} \quad \Sigma C \quad \Sigma\text{Vendas} \quad \Sigma F \quad \Sigma\text{Saldo}$$

- $\Sigma\text{Saldo} = \Sigma F - \Sigma C$ (equivale a somar os Saldos das linhas — consistente).
- **Status agregado (do rodapé)** usa a **razão dos totais**, explicitamente **não** a média dos Status das linhas:

$$\text{Status}_{\text{total}} = \frac{\Sigma F}{\Sigma C} \times 100\%$$

  Exemplo: fornada A (F=120, C=100) e fornada B (F=60, C=100) → $\Sigma F=180$, $\Sigma C=200$ → Status total = **90%**. (A média aritmética dos Status das linhas — 120% e 60% → 90% aqui por coincidência — **não** é a fórmula: com produções/custos diferentes os valores divergem; usar sempre ΣF/ΣC.)
- As colunas não-somáveis do rodapé (Data, Receita, Custo unitário, Preço unitário) ficam **vazias** ou com rótulo "Total" — não se somam custos/preços unitários.
- **Escopo da soma**: os totais refletem exatamente as fornadas exibidas na tabela sob os filtros ativos (receita/intervalo, v5 §14.5), **excluídas as fornadas planejadas** (§2.5) — mesma regra de "planejada fora dos totais" do Histórico (v5 §14.4/14.6).

### 2.5. Fornadas planejadas, cor e ordenação (P4, P5, P6 — travado por default alinhado ao projeto)

- **P4 — planejadas: espelha o Histórico.** A tabela do Histórico hoje (`historyView.ts`) **lista** as fornadas planejadas com o badge **"◌ Planejada — fora dos totais"** e exibe "—" nas colunas dependentes de venda, mantendo-as **fora dos totais**. O BALANÇO faz o **mesmo**: linha planejada aparece marcada, com Vendas/F/Saldo/Status exibidos como "—", e **não entra** em $\Sigma$ nem no Status agregado (§2.4). Escolhido para paridade total com a tela que hospeda o BALANÇO — evita duas verdades sobre a mesma fornada na mesma página.
  - **Esclarecimento (arquiteto 2026-07-06):** colunas exatas da linha planejada — exibem **"—"**: Vendas, Preço unitário, Faturamento (F), Saldo, Status (as cinco dependentes da venda). Exibem **valor real**: Data, Receita, Produção, Custo unitário, Custo (C) — pois independem de venda (C = Produção × Custo unitário é um custo projetado, informativo). Nenhum desses valores da linha planejada entra em qualquer $\Sigma$ do rodapé (§2.4).
- **P5 — cor por semântica contábil** (memória `pdf-credit-debit-color-and-financial-debt`, issue 028): cor só em **valor monetário**, com o sinal decidindo:
  - **Saldo < 0 → vermelho** (débito/prejuízo — reusa a classe `.loss` já aplicada pelo Histórico ao lucro negativo). Status é percentual → **neutro** (regra da memória: "nunca colorir título/label/métrica-percentual").
  - **Esclarecimento ON-SCREEN (arquiteto 2026-07-06):** a paleta da marca na tela (`references/design-system.css` `:root`) é quente e **não possui token de "azul crédito"** — o azul-crédito/vermelho-débito da issue 028 vive apenas nos tokens `--print-*`/classes `.pdf-credit`/`.pdf-debit`, exclusivos do contexto de impressão. Portanto, **na tela** o BALANÇO reusa **somente `.loss`** para Saldo < 0; **Saldo ≥ 0 e todos os demais monetários (Custo C, Faturamento F, os Σ) ficam neutros** — idêntico à tabela irmã "Fornadas registradas" do Histórico, que já deixa o lucro positivo neutro e só aplica `.loss` ao negativo. Isso honra o intento do cliente (perda visível em vermelho) sem introduzir cor fora da marca nem violar "só tokens". A convenção azul-crédito completa reaparece **se/quando** esta visão for exportada para PDF (follow-up de export), via `.pdf-credit`/`.pdf-debit` já existentes.
  - Isso resolve o P5 sem inventar semáforo de faixas (que a v5 §4 aplica só à precificação, não pedido aqui).
- **P6 — ordenação: data decrescente** (mais recentes primeiro), espelhando o Histórico (v5 §14.5 e o sort atual de `historyView.ts`). Diverge da planilha de referência (crescente), mas prioriza a consistência com a tela anfitriã.

### 2.6. Visualizações da tabela — seletor Completa / Unidades / Fornadas (issue 046 — travado com o cliente 2026-07-06)

A tabela do BALANÇO ganha um **seletor de visualização** (barra de pills acima da tabela) que alterna **quais colunas** ficam visíveis. É **puramente de exibição**: não toca dado, fórmula, filtro (§2.5 receita/intervalo), ordenação (§2.5 P6 data desc) nem a linha de totais (§2.4) — todas as células continuam no DOM; a visualização só esconde/mostra grupos de colunas (mesma mecânica do toggle "Exibir custos" da v5 §2.A.2). O rodapé de totais (§2.4) **está sempre visível** nas três visualizações e esconde/mostra as **mesmas** colunas que o corpo.

**Default:** **Completa** ativa ao abrir.

**Mapa de colunas** (confirmado com o cliente):

| Coluna (§2.1) | Completa | Unidades | Fornadas | Grupo |
|---|:--:|:--:|:--:|---|
| Data | ✓ | ✓ | ✓ | *sempre* (identidade da linha) |
| Receita | ✓ | ✓ | ✓ | *sempre* (identidade da linha) |
| Produção | ✓ | ✓ | ✓ | *sempre* (contagem de unidades) |
| Custo unitário | ✓ | ✓ | — | por-unidade |
| Custo (C) | ✓ | — | ✓ | agregado da fornada |
| Vendas | ✓ | ✓ | ✓ | *sempre* (contagem de unidades) |
| Preço unitário | ✓ | ✓ | — | por-unidade |
| Faturamento (F) | ✓ | — | ✓ | agregado da fornada |
| Saldo | ✓ | — | ✓ | agregado da fornada |
| Status | ✓ | ✓ | ✓ | *sempre* (§2.2, markup F/C) |

- **Completa** = as 10 colunas da §2.1 (comportamento da issue 045, inalterado).
- **Unidades** (7 col) = Data · Receita · Produção · Custo unitário · Vendas · Preço unitário · Status — foco em dados por-unidade + contagens; esconde os agregados da fornada (Custo C, Faturamento F, Saldo).
- **Fornadas** (8 col) = Data · Receita · Produção · Custo (C) · Vendas · Faturamento (F) · Saldo · Status — foco nos agregados da fornada; esconde os por-unidade (Custo unitário, Preço unitário).

**Regras travadas com o cliente:**
- **Status** (§2.2) aparece nas **três** visualizações.
- **Produção** e **Vendas** (contagens) aparecem nas **três**.
- **Data** e **Receita** = identidade da linha → **sempre** presentes.
- A cor `.loss` do Saldo (§2.5 P5) é preservada: em Unidades a célula fica escondida junto com o grupo agregado e reaparece com a cor correta ao voltar para Completa/Fornadas.
- O estado vazio (§3 caso 7) usa uma célula com `colspan` cobrindo as 10 colunas — esconder colunas não afeta essa linha.

Esta seção **não** altera §2.1–§2.5: é uma camada de apresentação sobre a mesma tabela e os mesmos totais.

---

## 3. Casos de borda / validações

1. **Produção sem venda nenhuma** (Vendas = 0): F = 0; Saldo = −C; Status = 0%. Linha válida, exibida normalmente — é exatamente a visibilidade de perda que a aba existe para dar.
2. **Venda maior que produção**: **impossível por construção** — bloqueada no registro da fornada (v5 §5.D e §14.6: Quantidade Vendida ≤ Quantidade Produzida, bloqueio). O BALANÇO não precisa de validação própria; herda a garantia.
3. **Divisão por zero no Status** (C = 0, ex.: fornada registrada com custo unitário 0): Status indefinido → exibir **"—"**, sem erro. Mesmo contrato de valor-indefinido da v5 §5.C (hidratação "—"). Vale também para o **Status agregado** do rodapé (§2.4): se $\Sigma C = 0$ → exibir "—".
3b. **Rodapé sem linhas somáveis** (tabela vazia ou só planejadas): totais exibem 0 (ou "—" no Status agregado por $\Sigma C = 0$); ver caso 7.
4. **Custo unitário mudando entre fornadas da mesma receita**: comportamento já coberto pelos snapshots (§2.3) — duas fornadas da mesma receita podem exibir custos unitários diferentes lado a lado, e isso é correto.
5. **Fornada órfã** (receita excluída, v5 §14.7): linha permanece no BALANÇO, legível via `recipeName` (snapshot), com a mesma indicação de receita inexistente do Histórico.
6. **Precisão e formatos**: valores monetários com 2 casas, % com 2 casas, data `aaaa-mm-dd`, vírgula decimal na exibição (v5 §7.1 e §9). Arredondamento só na exibição.
7. **Aba vazia** (nenhuma fornada registrada): exibir estado vazio orientando a registrar fornadas (fluxo v5 §14.2), não uma tabela em branco.

---

## 4. Fora de escopo (não pedido)

- Nenhuma mudança nas fórmulas/agregações por período do Histórico (v5 §14.3/14.4) — a linha de totais da §2.4 é soma simples do conjunto exibido, não um novo motor de agregação por dia/semana/mês.
- Nenhum campo novo de entrada de dados; nenhuma entidade nova de armazenamento (§2.3, P2).
- Semáforo de faixas coloridas por valor de Status (verde/amarelo/vermelho): **não**. Cor segue só a semântica contábil de valor monetário (§2.5); Status, sendo percentual, fica neutro.

---

## 5. Decisões travadas (2026-07-06)

| # | Pergunta | Decisão |
|---|---|---|
| P1 | Onde mora a aba | **Seção/tabela dentro da tela Histórico** existente (issues 018/044), reusando seu layout — não é página própria (§2.3) |
| P2 | Só leitura ou também registra/edita | **Só leitura**; registro/edição continuam nas telas de fornada existentes (§2.3) |
| P3 | Linha de totais | **Sim**, rodapé com Σ Produção · Σ C · Σ Vendas · Σ F · Σ Saldo; **Status agregado = ΣF/ΣC × 100%** (razão dos totais, não média das linhas) (§2.4) |
| P4 | Fornadas planejadas | **Espelha o Histórico**: listadas com badge "◌ Planejada — fora dos totais", "—" nas colunas de venda, fora de todos os Σ (§2.5) |
| P5 | Cor no Status/Saldo | **Semântica contábil** (memória issue 028): Saldo/valores monetários coloridos por sinal (negativo vermelho `.loss`, positivo azul); **Status % fica neutro/preto** (§2.5) |
| P6 | Ordenação | **Data decrescente** (mais recentes primeiro), espelhando o Histórico (§2.5) |
