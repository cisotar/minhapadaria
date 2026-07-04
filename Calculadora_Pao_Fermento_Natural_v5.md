# Calculadora de Pão com Fermento Natural (Sourdough) — v5

## Visão Geral

Aplicação web interativa para formular e escalar receitas de pão artesanal com fermento natural, seguindo a convenção de *baker's percentage* usada por padeiros profissionais, com cálculo preciso de custos, precificação e histórico de produção/vendas.

Este documento substitui a v4 e é o documento único e final, consolidando todas as decisões tomadas ao longo do processo de revisão — incluindo as resoluções de lacunas fechadas em 2026-07-04 (ver Seção 15).

---

## 1. Conceito Central: Baker's Percentage e o Modo de Cálculo

### 1.1. Farinha Total como Âncora

- O usuário informa o **peso total de farinha** ($F_{total}$), ex: 1000g. Este é o valor de referência (100%).
- Se houver múltiplas farinhas (branca, integral, centeio), cada uma tem uma **porcentagem sobre $F_{total}$**, somando exatamente 100%.
- Peso de cada farinha: $\text{Peso}_i = F_{total} \times \dfrac{\%_i}{100}$

### 1.2. Modo Padrão: Porcentagem → Peso

- Para todos os ingredientes não-farinha (água, sal, extras, proporção do fermento), o usuário informa a **porcentagem sobre $F_{total}$**; o peso é sempre **derivado e somente-leitura** nesse modo.

### 1.3. Modo Alternativo: Peso → Porcentagem

- Ativado por um **toggle global único**, que afeta a receita inteira.
- O usuário edita **pesos em gramas diretamente** para qualquer ingrediente não-fermento, inclusive farinha e água.
- **Exceção — Fermento**: o bloco do fermento é **sempre definido por proporção e hidratação** (Seção 2.B), em ambos os modos. O peso do fermento nunca é editado diretamente.
- A convenção de baker's percentage é **suspensa temporariamente**: as porcentagens passam a refletir a proporção de cada ingrediente sobre o **total geral da massa**.
- **Sinalização visual obrigatória enquanto ativo**: banner fixo no topo da tela + destaque visual nos campos de porcentagem.

### 1.4. Efeito do Modo no Escalonamento

- **Modo "% → peso"**: alterar $F_{total}$ recalcula todos os pesos derivados (Algoritmo de Escalonamento, Seção 3.D).
- **Modo "peso → %"**: alterar o peso da farinha não re-escala os demais automaticamente.

### 1.5. Transição de Volta ao Modo Padrão

Ao retornar de "peso → %" para "% → peso", **os pesos editados tornam-se a nova fonte de verdade**:

1. $F_{total}$ é recalculado como a soma dos pesos das farinhas principais.
2. Todas as porcentagens (farinhas entre si e ingredientes sobre $F_{total}$) são recalculadas a partir dos pesos vigentes.
3. Nada é descartado; não há prompt de confirmação.

### 1.6. Cálculo em Lote (Arquitetura)

Qualquer alteração de estado dispara **uma única função central de recálculo**, que reconstrói todos os valores derivados a partir do zero (porcentagens e pesos-base declarados) — nunca a partir de um resultado intermediário já arredondado. Isso evita loops de recálculo em cascata e elimina o acúmulo de erro de arredondamento por design.

---

## 2. Estrutura de Interface (UI)

### A. Bloco de Ingredientes Principais

- **Farinhas** (compõem 100% entre si): nome, peso, porcentagem sobre $F_{total}$, custo por kg.
  - Uma única farinha: trava em 100%. Múltiplas: soma deve ser exatamente 100% (bloqueio no blur, Seção 5).
- **Líquidos**: água, leite, cerveja etc. — peso, porcentagem, custo por litro.
  - **Simplificação declarada**: assume-se densidade 1 (1g = 1mL) para todos os líquidos, inclusive leite e cerveja. O custo por litro é aplicado sobre o peso em gramas ÷ 1000.
- **Sal e Extras**: peso, porcentagem, custo por kg.

### B. Bloco do Fermento Natural (Sourdough / Levain)

#### B.1. Configuração Geral
- **Proporção do Fermento (%)**: sobre $F_{total}$. Incremento de 0.5%.
- **Hidratação do Fermento (%)**: padrão 100%. Incremento de 5%.
- O fermento é definido por proporção/hidratação **em ambos os modos de cálculo** (Seção 1.3).

#### B.2. Composição do Fermento
- Lista de farinhas do fermento: nome, proporção (%), custo/kg, peso calculado.
- Soma = 100%, com bloqueio no blur. Custo atualizado automaticamente ao trocar a farinha (editável manualmente). Sempre ao menos 1 farinha.

#### B.3. Custo da Água no Fermento
- R$/L, padrão R$0,00 (torneira), configurável para água mineral/filtrada.

#### B.4. Resumo do Fermento
- Peso total, **Farinha do Fermento** (g), **Água do Fermento** (g), custo total, custo por kg.

> **Terminologia**: "Farinha do Fermento" e "Água do Fermento" substituem os antigos "farinha/água oculta".

### C. Painel de Hidratação

- **Hidratação Nominal**: $\dfrac{\sum \text{Líquidos Declarados}}{F_{total}} \times 100$
- **Hidratação Real**: $\dfrac{\sum \text{Líquidos Declarados} + \text{Água do Fermento}}{F_{total} + \text{Farinha do Fermento}} \times 100$

Exibidas lado a lado (ex: "Nominal: 70% · Real: 72.7%").

### D. Indicador de Farinha Real Consumida

$$\text{Farinha Real Consumida} = F_{total} + \text{Farinha do Fermento}$$

Campo somente-leitura, sempre visível quando há fermento configurado.

### E. Painel de Controle de Escala e Produção

- Peso da Farinha Total, Quantidade de Produtos, Painel de Precificação (3 modos sincronizados), Sistema de Unidades (Seção 7).

### F. Tela de Gerenciamento de Receitas

Lista de todas as receitas salvas, com as operações:

- **Criar nova** (em branco ou a partir de valores padrão)
- **Abrir** (carrega na calculadora)
- **Renomear**
- **Duplicar** (cópia integral: ingredientes, fermento, precificação)
- **Excluir** (com confirmação; ver Seção 14.7 sobre fornadas órfãs)

Cada receita guarda o estado completo: ingredientes, fermento, modo de cálculo, precificação.

---

## 3. Regras de Negócio e Lógica Matemática (Core)

### A. Farinha Total como Âncora
$$F_{total} = \sum \text{Peso das Farinhas Principais} \qquad \%_X = \left( \frac{\text{Peso}_X}{F_{total}} \right) \times 100$$

### B. Cálculo do Fermento (modelo aditivo)

$$W_{ferm} = F_{total} \times \left(\frac{\text{Proporção do Fermento \%}}{100}\right)$$
$$\text{Farinha do Fermento} = \frac{W_{ferm}}{1 + H_{ferm}\%} \qquad \text{Água do Fermento} = W_{ferm} - \text{Farinha do Fermento}$$
$$\text{Farinha do Fermento}_i = \text{Farinha do Fermento} \times \left(\frac{P_i}{100}\right), \quad \sum P_i = 100\%$$

### C. Hidratação Nominal e Real
Ver Seção 2.C.

### D. Algoritmo de Escalonamento pelo Peso Alvo (modo "% → peso" apenas)

1. $\text{Soma da Receita \%} = \sum \%_{\text{ingredientes}} + \text{Proporção do Fermento \%}$
   - **A proporção do fermento entra na soma**: o peso do fermento conta como parte do peso final da massa. Ex. da Seção 12: 100 + 70 + 2 + 20 = 192%.
2. $F_{nova\_total} = \dfrac{W_{alvo}}{\left(\frac{\text{Soma da Receita \%}}{100}\right)}$
3. $\text{Novo Peso}_X = F_{nova\_total} \times \left( \frac{\%_X}{100} \right)$

### E. Cálculo de Custos e Precificação

$$\text{Custo}_{farinha\_i} = \text{Farinha do Fermento}_i \times C_{farinha\_i} \qquad \text{Custo}_{farinhas\_fermento} = \sum \text{Custo}_{farinha\_i}$$
$$\text{Custo}_{agua\_fermento} = \text{Água do Fermento (L)} \times \text{Custo}_{agua} \qquad \text{Custo}_{fermento} = \text{Custo}_{farinhas\_fermento} + \text{Custo}_{agua\_fermento}$$
$$\text{Custo}_{kg\_fermento} = \frac{\text{Custo}_{fermento}}{W_{ferm}} \times 1000$$
$$\text{Custo}_X = \text{Peso}_X \times \text{Custo Unitário}_X \qquad \text{Custo Total Receita} = \sum \text{Custo}_X + \text{Custo}_{fermento}$$
$$\text{Custo Unitário} = \frac{\text{Custo Total Receita}}{\text{Quantidade de Produtos}}$$

**Precificação (3 modos sincronizados):**

- *Preço Fixo*: $\text{Lucro Unitário} = \text{Preço} - \text{Custo Unitário}$; $\text{Margem \%} = \left(\frac{\text{Lucro Unitário}}{\text{Preço}}\right) \times 100$
- *Margem \%*: $\text{Preço} = \dfrac{\text{Custo Unitário}}{1 - \frac{\text{Margem \%}}{100}}$ — margem limitada a **99,9%** (Seção 5.C).
- *Lucro Fixo*: $\text{Preço} = \text{Custo Unitário} + \text{Lucro Unitário}$

$$\text{Custo Total Produção} = \text{Custo Total Receita} \times \text{Qtd. Produtos} \qquad \text{Receita Total} = \text{Preço} \times \text{Qtd. Produtos}$$
$$\text{Lucro Total} = \text{Receita Total} - \text{Custo Total Produção}$$

---

## 4. Comportamentos de Interface (UI Behaviors)

- **Farinhas principais**: no modo "% → peso", só a % é editável (peso derivado); no modo "peso → %", o peso é editável diretamente e a % passa a refletir o total geral da massa.
- **Ingredientes não-farinha**: mesma lógica — direção sempre ditada pelo toggle global, nunca por "último campo editado".
- **Bloco do Fermento**: alterar Proporção recalcula tudo em lote; alterar Hidratação mantém o peso total do fermento e redistribui Farinha/Água do Fermento internamente; alterar custo de uma farinha principal atualiza o custo correspondente no fermento (se não editado manualmente).
- **Painel de Precificação**: sincronização automática entre Preço, Margem % e Lucro Unitário; Quantidade de Produtos recalcula os totais.
- **Indicadores visuais**: destaque de prejuízo se custo > preço; margem colorida (Verde >30%, Amarelo 15–30%, Vermelho <15% ou negativo).

---

## 5. Validações

### A. Soma de Porcentagens (Farinhas Principais e do Fermento)
Digitação livre; validação no blur/Enter — se ultrapassar 100%, reverte o campo e exibe erro. **Nenhuma redistribuição automática** em nenhuma circunstância.

### B. Remoção de Farinha
Não redistribui automaticamente; usuário ajusta manualmente. Sempre ao menos 1 farinha por grupo (principal e fermento).

### C. Validações Gerais
Divisão por zero tratada; sem negativos/nulos indevidos; quantidade de produtos ≥ 1; custos ≥ 0 com 2 casas decimais; hidratação do fermento ≥ 0% (aviso se >200%); proporção do fermento ≥ 0% (aviso se 0%); **margem entre 0–99,9%** (evita divisão por zero na fórmula de preço por margem); alerta (não bloqueio) se preço ≤ custo unitário.

### D. Validações do Histórico de Fornadas (ver Seção 14)
Quantidade vendida não pode exceder quantidade produzida (bloqueio); quantidade produzida ≥ 1; data não pode ser futura (aviso, não bloqueio, para permitir planejamento — ver Seção 14.6).

---

## 6. Estrutura de Dados

```typescript
type CalculationMode = 'percentage-to-weight' | 'weight-to-percentage';

interface Ingredient {
  id: string;
  name: string;
  category: 'flour' | 'liquid' | 'salt' | 'extra';
  weight: number;
  percentage: number;
  costPerUnit: number;
}

interface SourdoughFlour {
  flourId: string;
  name: string;
  percentage: number;
  costPerKg: number;
  weight: number;
}

interface Sourdough {
  percentageOfTotalFlour: number;
  hydration: number;
  flours: SourdoughFlour[];
  waterCostPerLiter: number;
  totalWeight?: number;
  flourWeight?: number;   // Farinha do Fermento
  waterWeight?: number;   // Água do Fermento
  totalCost?: number;
  costPerKg?: number;
}

interface HydrationSummary {
  nominal: number;
  real: number;
}

interface Pricing {
  quantity: number;
  salePrice: number;
  profitMargin: number;
  profitPerUnit: number;
  totalCost?: number;
  totalRevenue?: number;
  totalProfit?: number;
}

interface Recipe {
  id: string;
  name: string;
  calculationMode: CalculationMode;
  flourTotalWeight: number;
  ingredients: Ingredient[];
  sourdough: Sourdough;
  pricing: Pricing;
  createdAt: Date;
  updatedAt: Date;
}

interface RecipeSummary {
  hydration: HydrationSummary;
  realFlourConsumed: number;
  totalCost: number;
  costPerUnit: number;
  totalProductionCost: number;
  salePrice: number;
  totalRevenue: number;
  profitPerUnit: number;
  totalProfit: number;
  profitMargin: number;
}

// --- Histórico de Fornadas ---

interface BakeEntry {
  id: string;
  recipeId: string;
  recipeName: string;        // snapshot do nome no momento do registro
  date: Date;
  quantityProduced: number;
  quantitySold: number;      // pode ser < produzida (sobra/perda)
  unitCost: number;          // snapshot do custo unitário no momento
  unitSalePrice: number;     // snapshot do preço de venda no momento
  notes?: string;
  planned?: boolean;         // true se data futura ainda não confirmada (Seção 14.6)
  // Calculados
  totalCost?: number;        // unitCost * quantityProduced
  totalRevenue?: number;     // unitSalePrice * quantitySold
  totalProfit?: number;      // totalRevenue - totalCost
  wastage?: number;          // quantityProduced - quantitySold
  wastageRate?: number;      // % — wastage / quantityProduced
}

interface BakeHistorySummary {
  periodStart: Date;
  periodEnd: Date;
  totalProduced: number;
  totalSold: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  wastageRate: number;       // %
  averageProfitMargin: number; // %
}
```

---

## 7. Sistema de Unidades

**v1: apenas sistema métrico** (g, kg, mL, L). Internamente, o valor canônico é sempre gramas/mL; a unidade de exibição é apenas uma camada de apresentação.

> Suporte a unidades imperiais (oz, lb) movido para Funcionalidades Futuras (Seção 11).

### 7.1. Formatos de Exibição e Entrada

- **Datas**: formato `aaaa-mm-dd` (ex: 2026-07-04), em exibição e entrada.
- **Decimais e valores monetários**: exibição com vírgula (ex: 12,50 · R$ 8,86); **entrada aceita vírgula ou ponto** indistintamente.

---

## 8. Exportação de Relatório

- **"PDF"** é, na prática, uma página HTML formatada para impressão, acionada por um botão fixo no topo ("Imprimir / Salvar em PDF") — sem abertura automática do diálogo de impressão em nenhuma outra circunstância.
- **Dados estruturados exportados em XLSX** (não CSV), com separação por categorias em abas/seções.
- Opção de exportar **com ou sem custos**.
- Aplica-se tanto ao relatório de uma receita quanto ao Histórico de Fornadas (Seção 14).

---

## 9. Precisão

Percentuais: 2 casas decimais na exibição. Pesos: 1 casa decimal. Valores monetários: 2 casas decimais. Arredondamento ocorre **apenas na exibição**; cálculos internos usam valor completo e sempre partem do estado "puro" (Seção 1.6), eliminando acúmulo de erro por design.

---

## 10. Considerações Técnicas

- Estado gerenciado em tempo real com **cálculo em lote centralizado** (Seção 1.6).
- **Persistência local (localStorage)** para receitas e histórico de fornadas.
- **Backup e restauração em arquivo — obrigatório na v1**: botão de exportar todos os dados (receitas + histórico) para um arquivo JSON local, e botão de importar/restaurar a partir desse arquivo. Proteção contra perda de dados ao limpar o navegador ou trocar de aparelho.
- Debounce em inputs; memoização de cálculos pesados; acessibilidade (labels, contraste, navegação por teclado, ARIA).

---

## 11. Funcionalidades Futuras (fora do escopo da v1)

- Compartilhamento via link; custo de energia (forno) no custo total; biblioteca de receitas pré-definidas; integração com fornecedores.
- Unidades imperiais (oz, lb) com conversão automática, inclusive de custos.

### 11.1. ⚠️ Débito Técnico Registrado: Integração com Google Docs do Cliente

Sincronização/exportação dos dados (receitas e histórico de fornadas) para o Google Docs/Drive da conta do cliente. **Fora do escopo da v1**, registrado como débito para implementação futura.

**Restrições de segurança inegociáveis para quando for implementada:**

- **Nenhuma API key, secret, token ou credencial no front-end.** A aplicação v1 é 100% client-side; integração com Google exige um back-end (ou proxy/função serverless) que guarde as credenciais e faça o fluxo OAuth do lado do servidor.
- **Nenhuma credencial commitada ou pushada no GitHub** — nem em código, nem em arquivos de configuração, nem em histórico de commits. Credenciais vivem exclusivamente em variáveis de ambiente/gerenciador de segredos do ambiente de execução.
- Arquivos de exemplo (ex: `.env.example`) podem existir no repositório **apenas com placeholders**, nunca com valores reais.
- `.gitignore` deve cobrir `.env` e afins **antes** de qualquer trabalho nessa integração começar.

A v1 não deve conter nenhum vestígio dessa integração (sem stubs de API, sem dependências do Google SDK) — apenas este registro na spec.

---

## 12. Exemplo de Uso (validado)

**Configuração**: Farinha Branca 1000g (100%) a R$8,00/kg · Água 700g (70%) a R$0,00/L · Sal 20g (2%) a R$3,00/kg · Fermento: 20%, hidratação 100%, 100% Farinha Branca, água a R$0,00/L.

**Cálculos**: $F_{total}$ = 1000g · Fermento = 200g · Farinha do Fermento = 100g · Água do Fermento = 100g · Farinha Real Consumida = **1100g** · Custo total do fermento = R$0,80 · Custo total da receita = **R$8,86** · Hidratação Nominal = **70%** · Hidratação Real = **72.7%**.

**Precificação (2 unidades, 40% margem)**: Custo unitário R$4,43 · Preço de venda R$7,38 · Lucro unitário R$2,95 · Receita total R$14,76 · Lucro total R$5,90.

**Escalonamento**: Soma da Receita % = 100 + 70 + 2 + 20 = 192%. Peso alvo 2000g → $F_{nova\_total}$ = 2000 ÷ 1,92 ≈ 1041,7g.

---

## 13. Glossário

| Termo | Definição |
|---|---|
| Hidratação Nominal | % de água declarada sobre a farinha total declarada, sem considerar o fermento |
| Hidratação Real | % real de água considerando também a água e farinha do fermento |
| Farinha do Fermento | Farinha consumida dentro do fermento, adicional à farinha total declarada |
| Água do Fermento | Água consumida dentro do fermento, adicional à água total declarada |
| Farinha Real Consumida | Soma da farinha total declarada + farinha do fermento |
| Proporção do Fermento | % de fermento em relação à farinha total da receita |
| Hidratação do Fermento | Proporção água/farinha dentro do fermento |
| Modo de Cálculo | Toggle global: "% → peso" (baker's percentage) ou "peso → %" |
| Fornada | Um registro de produção real de uma receita em uma data específica |
| Fornada Planejada | Fornada com data futura, visível mas fora dos totais até acontecer |
| Desperdício (Wastage) | Quantidade produzida e não vendida numa fornada |
| Levain | Fermento natural ativo usado para panificação |
| Margem de Lucro | % do preço de venda que representa o lucro |
| ROI | Retorno sobre Investimento |
| Escalonamento | Ajuste de todos os pesos da receita para atingir um peso-alvo, preservando percentuais |
| Sub-receita | Receita dentro da receita (composição do fermento) |

---

## 14. Histórico de Fornadas (Produção e Vendas)

### 14.1. Conceito

Uma **Fornada** é o registro de uma execução real de produção: em uma data específica, o padeiro usou uma receita, produziu N unidades, e vendeu M unidades (M pode ser menor que N, por sobra ou perda). O histórico de fornadas acumula esses registros ao longo do tempo para gerar visões agregadas por dia, semana e mês.

**Distinção importante**: "Quantidade Produzida" e "Quantidade Vendida" são campos separados, porque nem todo pão produzido necessariamente é vendido no mesmo dia (sobras, doações, perdas, consumo próprio). O **custo** incide sobre o que foi *produzido* (os insumos foram gastos de qualquer forma); a **receita** incide sobre o que foi *vendido*.

### 14.2. Registro de uma Fornada

Formulário de registro rápido, com valores pré-preenchidos a partir da receita selecionada (mas editáveis, pois custos e preços mudam ao longo do tempo):

- **Receita utilizada** (seleção de uma receita já cadastrada)
- **Data** (padrão: hoje; aviso, não bloqueio, se for data futura)
- **Quantidade Produzida**
- **Quantidade Vendida** (não pode exceder a Quantidade Produzida — validação com bloqueio)
- **Custo Unitário** (pré-preenchido com o custo atual da receita, editável — funciona como um *snapshot* congelado no momento do registro, para preservar o histórico real mesmo que os custos dos insumos mudem depois)
- **Preço de Venda Unitário** (mesma lógica de snapshot editável)
- **Observações** (campo de texto livre, opcional — ex: "forno desregulado", "promoção de fim de semana")

### 14.3. Cálculos por Fornada

$$\text{Custo Total da Fornada} = \text{Custo Unitário} \times \text{Quantidade Produzida}$$
$$\text{Receita da Fornada} = \text{Preço de Venda Unitário} \times \text{Quantidade Vendida}$$
$$\text{Lucro da Fornada} = \text{Receita da Fornada} - \text{Custo Total da Fornada}$$
$$\text{Desperdício} = \text{Quantidade Produzida} - \text{Quantidade Vendida}$$
$$\text{Taxa de Desperdício \%} = \left(\frac{\text{Desperdício}}{\text{Quantidade Produzida}}\right) \times 100$$

Note que, se houver desperdício, o Lucro da Fornada reflete isso automaticamente (custo sobre tudo que foi produzido, receita só sobre o vendido) — é uma forma de visibilidade sobre perdas que o padeiro não teria olhando só o preço de venda.

### 14.4. Agregações — Dashboard de Histórico

O sistema deve agregar automaticamente as fornadas registradas em três granularidades, cada uma somando os campos abaixo:

- **Por Dia**: total produzido, total vendido, custo total, receita total, lucro total, taxa de desperdício.
- **Por Semana**: mesma soma, agrupada por semana (segunda a domingo, ou configurável).
- **Por Mês**: mesma soma, agrupada por mês calendário.

**Fornadas planejadas (data futura, não confirmadas) ficam fora de todas as agregações** — ver Seção 14.6.

Cada granularidade exibe, no mínimo:

- Total de pães produzidos
- Total de pães vendidos
- Custo total do período
- Faturamento total do período
- Lucro total do período
- Margem de lucro média do período (%)
- Taxa de desperdício média do período (%)

### 14.5. Funcionalidades Padrão para este tipo de registro

Recursos que costumam ser esperados em qualquer ferramenta de histórico de produção/vendas, incluídos aqui como parte do escopo padrão:

- **Listagem cronológica** de todas as fornadas, com paginação/rolagem, mais recentes primeiro.
- **Filtro por receita**: ver o histórico de uma receita específica isoladamente (ex: "só fornadas de Pão de Centeio").
- **Filtro por intervalo de datas customizado**, além dos períodos padrão (dia/semana/mês).
- **Edição e exclusão** de uma fornada já registrada (com confirmação antes de excluir).
- **Gráfico de tendência** (linha ou barras) de faturamento e lucro ao longo do tempo, para visualizar sazonalidade ou crescimento.
- **Comparação entre períodos**: ex. "esta semana vs. semana passada", "este mês vs. mês passado", com variação percentual.
- **Indicador de melhor e pior dia/semana/mês** do período visualizado (por lucro).
- **Exportação do histórico** seguindo o mesmo padrão da Seção 8 (HTML→impressão e XLSX), com opção de exportar com ou sem custos.

### 14.6. Validações do Histórico

- Quantidade Vendida não pode exceder Quantidade Produzida (bloqueio, não apenas aviso — evita registro de venda impossível).
- Quantidade Produzida deve ser ≥ 1.
- **Data futura**: permitida com aviso (útil para planejamento de produção), sinalizada visualmente como **"fornada planejada"**. Fornadas planejadas **não entram nas agregações do dashboard** (Seção 14.4) até que a data chegue ou o usuário confirme a realização; a partir daí, `planned` é removido e a fornada passa a contar normalmente.
- Custo Unitário e Preço de Venda Unitário não podem ser negativos.

### 14.7. Relação com o Sistema de Receitas

- Cada Fornada referencia uma `Recipe` existente por `recipeId`, mas guarda uma cópia (`recipeName`) do nome no momento do registro — assim, mesmo que a receita seja renomeada ou excluída depois, o histórico permanece legível e íntegro.
- Se a receita referenciada for excluída, a Fornada **não é excluída junto** — ela se torna um registro "órfão" mas ainda visível no histórico, com uma indicação de que a receita original não existe mais.

---

## 15. Registro de Decisões (2026-07-04)

Lacunas identificadas na revisão da v4 e decisões que as fecharam:

| # | Lacuna | Decisão |
|---|---|---|
| 1 | O que acontece ao voltar do modo "peso → %" para "% → peso" | Pesos editados viram a nova fonte de verdade; porcentagens recalculadas (Seção 1.5) |
| 2 | Como editar o fermento no modo "peso → %" | Fermento sempre por proporção/hidratação, em ambos os modos (Seção 1.3) |
| 3 | Fermento entra na soma do escalonamento por peso alvo? | Sim — proporção do fermento incluída na Soma da Receita % (Seção 3.D) |
| 4 | Margem 100% causa divisão por zero | Margem limitada a 99,9% (Seção 5.C) |
| 5 | Custo por litro aplicado a peso em gramas | Densidade 1 (1g = 1mL) assumida e declarada (Seção 2.A) |
| 6 | Fornadas com data futura nas agregações | Fora dos totais até acontecerem/confirmação; campo `planned` (Seções 14.4, 14.6) |
| 7 | Gerenciamento de receitas não especificado | Tela completa: criar, abrir, renomear, duplicar, excluir (Seção 2.F) |
| 8 | Formato de datas | `aaaa-mm-dd` (Seção 7.1) |
| 9 | Separador decimal | Entrada aceita vírgula ou ponto; exibição com vírgula (Seção 7.1) |
| 10 | Unidades imperiais | Removidas da v1; movidas para Futuras (Seções 7, 11) |
| 11 | Risco de perda de dados no localStorage | Backup/restauração em arquivo JSON obrigatório na v1 (Seção 10) |
| 12 | Integração com Google Docs do cliente | Débito registrado para o futuro, com restrições de segurança inegociáveis (Seção 11.1) |
