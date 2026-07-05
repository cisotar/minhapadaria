# Brandbook & Diretrizes de Design System

## Projeto: Calculadora de Pão com Fermento Natural (v5)

---

### Paleta de Cores (oficial)

| Hex | Nome sugerido | Papel semântico |
|---|---|---|
| `#283618` | Verde Floresta | Primária — títulos, ações principais, status positivo (texto) |
| `#606C38` | Verde Oliva | Primária suave — status positivo (fundos/ícones), hover |
| `#FEFAE0` | Creme | Acento claro — texto sobre botões escuros, destaques. **Não usar como fundo de página** (chamativo demais; decisão 2026-07-04). Fundo de página: neutro `#F5F3EC` |
| `#C3A87F` | Areia | Banner do modo alternativo, bordas, fornada planejada |
| `#87551D` | Caramelo | Status de atenção (margem 15–30%), acentos |
| `#6A2C0F` | Ferrugem | Status crítico — prejuízo, bloqueios, margem <15% |
| `#44270D` | Chocolate | Texto secundário, cabeçalhos de tabela |
| `#14120E` | Tinta | Texto principal |

### Tipografia

- **Sem serifa em toda a aplicação** (decisão de 2026-07-04): Inter (ou fallback system-ui).
- **`tabular-nums` obrigatório** em qualquer célula numérica (pesos, %, R$).

---

### 1. Visão Geral e Essência da Interface

Este documento estabelece as diretrizes de design para a interface do sistema, cujo objetivo principal é traduzir a precisão da panificação profissional e a organização operacional de produção em um ambiente digital intuitivo. A experiência visual deve apoiar-se em dois pilares:

* **Rigor Técnico e Clareza Lógica:** A aplicação opera sob convenções matemáticas rígidas, como a *baker's percentage* (porcentagem de padeiro) e o cálculo em lote centralizado. A interface deve priorizar a clareza dos dados e o entendimento imediato das relações entre insumos.

* **Eficiência de Uso em Produção:** O design deve ser limpo e focado no fluxo de trabalho cotidiano, garantindo que o gerenciamento de receitas e o histórico de fornadas sirvam como ferramentas de controle de desperdício e análise real de lucros.

---

### 2. Comportamento e Dinâmica da Paleta de Cores

A aplicação da cor no sistema de design não se limita à estética, mas atua como um sistema de sinalização em tempo real para o usuário. A inteligência artificial que estruturar o tema visual deve associar as variáveis de cor às regras operacionais descritas a seguir:

#### 2.1. Níveis de Alerta e Feedback de Margem de Lucro

O painel de precificação e o histórico devem usar variações tonais para traduzir o desempenho financeiro de forma imediata:

* **Tom de Status Positivo:** Aplicado em indicadores cuja margem de lucro calculada seja **superior a 30%**. Indica viabilidade comercial saudável.
* **Tom de Status de Atenção:** Aplicado para margens de lucro situadas **entre 15% e 30%**. Sinaliza zonas de controle que demandam acompanhamento.
* **Tom de Status Crítico / Alerta:** Aplicado de forma obrigatória para margens **menores que 15%**, sinalizações de prejuízo real (quando o custo unitário supera o preço de venda) ou violações em validações com bloqueio (como a soma de frações de farinhas que ultrapasse 100%).

#### 2.2. Sinalização de Modos de Cálculo

* **Tom do Modo Padrão (% → Peso):** Foco na sobriedade de dados. Os campos de peso derivado assumem uma característica visual passiva (apenas leitura), enquanto as porcentagens se destacam como áreas ativas de digitação livre.
* **Tom do Modo Alternativo (Peso → %):** Quando o toggle global único for ativado, o sistema deve aplicar um tom contrastante específico em um **banner fixado no topo da tela** e em destaques nos campos de porcentagem. Essa cor de sinalização técnica deve indicar visualmente que a convenção tradicional de padeiro está suspensa.

#### 2.3. Situações Operacionais no Histórico

* **Identificação de Fornadas Planejadas:** Registros com datas futuras devem possuir um rótulo visual e tratamento cromático diferenciado das demais fornadas. Eles devem ser identificados como registros em modo de planejamento e permanecer graficamente isolados das agregações e totais financeiros do dashboard consolidado.

---

### 3. Tipografia e Legibilidade Numérica

A tipografia deve garantir precisão absoluta na exibição de dados matemáticos dinâmicos.

* **Relação de Fontes:** Escolha de fontes que privilegiem o alto desempenho de leitura em tabelas estruturadas de insumos. **Somente fontes sem serifa.**
* **Uso OBRIGATÓRIO de numerais tabulares (*tabular-nums*):** É mandatório o uso de propriedades CSS ou fontes cujos caracteres numéricos possuam largura idêntica. Isso garante o alinhamento vertical perfeito das casas decimais em colunas de peso e valores monetários, impedindo que os dados oscilem na tela durante o recálculo em lote centralizado disparado por qualquer input.
* **Hierarquia de Textos:** Divisão clara entre títulos estruturais de grupos (ex: Farinhas Principais, Bloco do Fermento), subtítulos de resumo (Hidratação Nominal vs Real) e dados de leitura.

---

### 4. Componentes e Comportamentos de Interface (UI)

#### 4.1. Tabelas de Insumos e Campos de Entrada (Inputs)

* **Estados Visuais de Células (minimalismo — decisão 2026-07-04):** Tabelas com o mínimo de cor: **sem zebra** e sem fundo colorido em células derivadas. O sinal visual é invertido: **campos editáveis recebem um box (borda visível)**; campos calculados são texto plano, sem borda e sem fundo — nunca induzem o usuário a tentar editá-los.
* **Alinhamento Técnico:** Alinhamento à esquerda para nomes e categorias de insumos. Alinhamento rigoroso à direita para todas as métricas em gramas, percentuais, custos unitários e totais financeiros.
* **Controles Locais de Líquidos:** Componentes de linha nas tabelas de líquidos que apresentem de forma compacta o alternador opcional entre unidade de peso (gramas) ou volume (mL/L), mantendo o peso em gramas como valor armazenado de forma invisível.

#### 4.2. Painéis Modulares de Resumos

* **Métricas Exibidas Lado a Lado:** O painel de hidratação deve expor simultaneamente as saídas da Hidratação Nominal e da Hidratação Real para fins de comparação imediata.
* **Indicador de Farinha Real Consumida:** Exibição clara e somente leitura do peso total somado à farinha integrante do fermento natural.

---

### 5. Layout, Densidade e Estrutura de Telas

O design system deve organizar o fluxo operacional da calculadora e do histórico em áreas funcionais bem definidas.

* **Estrutura de Blocos Modulares (Cards):** Utilização de agrupamentos lógicos para separar as responsabilidades do sistema:

  * *Módulo Ancoragem:* Definição do Peso de Farinha Total ($F_{total}$).
  * *Módulo Receita:* Listagem controlada de farinhas, líquidos, sais e extras.
  * *Módulo Fermento Natural:* Parâmetros aditivos de proporção, hidratação e composição interna do levain.
  * *Módulo Negócios:* Sincronização dos 3 modos de precificação e dados de produção (Preço Fixo, Margem % e Lucro Fixo).

* **Densidade de Informação:** Média-alta. A exibição simultânea das variáveis é crítica para o balanceamento de receitas pelo padeiro, evitando a ocultação de parâmetros sob menus de navegação profundos.
* **Desktop-first (decisão 2026-07-04):** A aplicação é pensada para rodar em desktop — cards e tabelas podem crescer horizontalmente para exibir todas as colunas lado a lado. Adaptação a telas menores (tablet de bancada) é secundária e nunca justifica ocultar colunas no desktop.
