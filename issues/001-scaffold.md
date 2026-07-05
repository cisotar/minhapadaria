---
id: "001"
titulo: Scaffold Vite + TypeScript strict + Vitest (MPA 3 páginas)
tipo: infra
deps: []
status: todo
---

## Contexto
Base técnica do app 100% client-side (spec §10). Stack decidida em `references/architecture.md`: Vite + TS strict + Vitest, vanilla DOM, MPA com 3 páginas espelhando `mockups/`.

## O que fazer
- Iniciar projeto Vite (template vanilla-ts) na raiz do repo, sem apagar nada existente.
- `tsconfig.json` com `strict: true`.
- Vitest configurado (`npm test` roda `vitest`; gates usam `npm test -- --run`).
- MPA: `index.html` (calculadora), `receitas.html`, `historico.html` — entradas no `vite.config.ts` (`build.rollupOptions.input`). Cada página importa `references/design-system.css`.
- Estrutura de pastas alvo: `src/core/`, `src/storage/`, `src/export/`, `src/ui/` (vazias com `.gitkeep` ou módulo placeholder).
- Scripts npm: `dev`, `build`, `preview`, `test`.
- Teste dourado da Seção 12 como placeholder **falhando** (`test.todo` NÃO serve — deve falhar de verdade, ex: `expect(goldenExample).toBeDefined()` contra módulo inexistente → usar `it.fails` invertido ou teste com `expect(false).toBe(true)` e comentário apontando §12). Marcar com `// TODO issue 008/020`.
- `package-lock.json` commitado (regra de ouro 3).
- `.gitignore`: `node_modules/`, `dist/`, `.env*` (spec §11.1).

## Critérios de aceite
- [ ] `npm run build` gera as 3 páginas.
- [ ] `npm test -- --run` roda e falha SOMENTE no teste dourado placeholder.
- [ ] TS strict ativo; zero dependência de runtime além do Vite toolchain.
- [ ] design-system.css importado, tokens intactos (nunca editar `references/design-system.css` tokens).

## Referências
- spec §10, §12 · references/architecture.md (stack, estrutura) · docs oficiais: vitejs.dev/guide (MPA), vitest.dev

---

## Plano Técnico

### Análise do existente
Busca real feita com `find`/`grep` na raiz e leitura dos arquivos citados.

- **Nenhum tooling ainda existe**: não há `package.json`, `tsconfig.json` nem `vite.config.ts` na raiz (confirmado por `ls`). Portanto scaffold é criação nova — nada a estender aqui, mas há arquivos existentes a **preservar** (ver "NÃO tocar").
- **`.gitignore` JÁ EXISTE** e já cobre `node_modules/`, `dist/`, `build/`, `.env`, `.env.*`, `!.env.example`, `*.log`, `.DS_Store` (spec §11.1). → **Reusar como está; NÃO recriar nem sobrescrever.** Só acrescentar linha se faltar algo (nada falta; nenhuma edição necessária).
- **`references/design-system.css` JÁ EXISTE** e é a única fonte de tokens (`architecture.md` §Estilo). → Cada página importa este arquivo; nunca copiar/duplicar/editar tokens.
- **Mockups JÁ EXISTEM** (`mockups/calculadora.html`, `receitas.html`, `historico.html`), importam o CSS via `<link rel="stylesheet" href="../references/design-system.css">` e usam fontes Inter via Google Fonts CDN. → São **referência de layout** (issues 014-018), NÃO são as páginas do app; não movê-los nem convertê-los agora.
- **`architecture.md`** fixa: Vite + TS strict + Vitest, vanilla DOM, 3 páginas MPA, estrutura `src/core|storage|export|ui`, valor canônico em gramas, teste dourado permanente (§12). O scaffold deve materializar exatamente isso.

### Decisões (cada uma justificada em 1 linha)
- **Vite 7.x + TypeScript 5.x + Vitest 3.x**, todos devDependencies; **zero dependência de runtime** (só toolchain) — atende critério "zero dependência de runtime além do Vite toolchain". Node 24.14 / npm 11.11 presentes (Vitest exige Vite ≥6 e Node ≥20 — OK).
- **Criar os arquivos manualmente** (não rodar `npm create vite@latest` interativo na raiz): o template scaffolda em diretório e o `create` em pasta não-vazia pede confirmação/pode sobrescrever `README.md`/`.gitignore` existentes. Criação manual é determinística e protege os arquivos do repo. Depois só `npm install`.
- **Config única em `vite.config.ts`** usando `defineConfig` importado de **`vitest/config`** (não de `vite`) — assim o campo `test` é tipado sem `/// <reference>` (doc oficial Vitest). MPA por `build.rollupOptions.input` com 3 entradas (issue + doc Vite MPA).
- **`import.meta.dirname`** para resolver os caminhos das entradas (Node ≥20.11; Node 24 aqui) — evita `__dirname` indisponível em ESM.
- **CSS do design system importado no módulo TS de cada página** (`import '../../references/design-system.css'`), não via `<link>` relativo — Vite processa/bundla o CSS pelo grafo do módulo, mantendo fonte única de tokens e funcionando em `build`. (§Estilo do architecture.md.)
- **Ambiente de teste `node`** (default do Vitest); `jsdom` só quando um teste de UI precisar (architecture.md) — nada de dependência extra agora.
- **Fontes**: NÃO introduzir Google Fonts CDN nas páginas do app (seria chamada de rede em runtime, viola spec §10/§11.1). Scaffold não configura fontes; herda o que o `design-system.css` define. (Ver Riscos.)

### Docs oficiais consultadas (regra de ouro 4)
- Vite — Multi-Page App (`build.rollupOptions.input`, resolução de caminhos): https://vite.dev/guide/build.html#multi-page-app
- Vitest — Getting Started (instalação, script `test`, config via `vite.config`/`vitest/config`, `vitest run` para CI): https://vitest.dev/guide/
- Vite — config `defineConfig` / TypeScript: https://vite.dev/config/

### Cenários
- **Caminho feliz**: `npm install` → `npm run dev` sobe as 3 rotas (`/`, `/receitas.html`, `/historico.html`) com o CSS aplicado; `npm run build` gera `dist/index.html`, `dist/receitas.html`, `dist/historico.html` (critério de aceite 1); `npm test -- --run` executa e falha **somente** no teste dourado placeholder (critério 2).
- **Borda — página sem entrada no `input`**: se uma das 3 páginas ficar fora de `rollupOptions.input`, `build` não a emite → cobre-se garantindo as 3 chaves (`main`/`receitas`/`historico`).
- **Borda — `strict` desligado**: TS deve reprovar código não-tipado; validar com `tsc --noEmit` incluído no `build` (`tsc && vite build`).
- **Erro esperado (desejado)**: o teste dourado referencia os números validados da §12 e **falha de propósito** porque o engine (issue 008) não existe — sinaliza que o produto ainda não foi implementado. Números-gabarito da §12: custo total **R$ 8,86** · Hidratação Nominal **70%** / Real **72,7%** · Farinha Real Consumida **1100 g** · Soma da Receita **192%** · $F_{nova\_total}$ para 2000 g **1041,7 g**.
- **Erro a evitar**: sobrescrever `.gitignore`/`README.md`/`references/`/`mockups/`/`spec/`/`brand/` existentes — mitigado por criação manual e lista "NÃO tocar".

### Testes primeiro (teste dourado placeholder)
Este é um scaffold; o único teste agora é o **placeholder dourado que DEVE falhar de verdade** (não `test.todo`).

- Arquivo: `src/core/golden-example.test.ts`
- Comportamento: fixar o gabarito da §12 como contrato permanente da suíte e falhar até o engine existir.
- Conteúdo do caso (um único `it`):
  - Nome: `"exemplo dourado da spec §12 — engine ainda não implementado"`.
  - Corpo: comentário listando as saídas esperadas da §12 (R$ 8,86 · 70% / 72,7% · 1100 g · 192% · 1041,7 g) + `expect(false).toBe(true)` para falha determinística.
  - Marcador: `// TODO issue 008/020: substituir por asserts reais contra o recalc engine (spec §12).`
- Resultado esperado ao rodar `npm test -- --run`: exatamente **1 falha**, neste teste, e nenhuma outra.

### Arquivos a criar
- `package.json` — `name`, `private: true`, `type: "module"`, `version`; scripts: `dev: "vite"`, `build: "tsc --noEmit && vite build"`, `preview: "vite preview"`, `test: "vitest"`; devDependencies: `vite@^7`, `typescript@^5`, `vitest@^3`. Sem `dependencies` (zero runtime).
- `tsconfig.json` — `compilerOptions` com `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`, `lib: ["ES2022","DOM","DOM.Iterable"]`, `noEmit: true`, `isolatedModules: true`, `skipLibCheck: true`, `types: ["vite/client","vitest/globals"]` (ou usar imports explícitos de `vitest`); `include: ["src","vite.config.ts"]`.
- `vite.config.ts` — `defineConfig` de `vitest/config`; `build.rollupOptions.input` = `{ main: resolve(import.meta.dirname,'index.html'), receitas: …'receitas.html', historico: …'historico.html' }`; `test` (deixar default `node`, comentar que `jsdom` entra quando houver teste de UI).
- `index.html` — root; `<html lang="pt-BR">`, `<title>` calculadora; `<script type="module" src="/src/ui/pages/calculadora.ts">`. (Espelha `mockups/calculadora.html`.)
- `receitas.html` — idem, `src="/src/ui/pages/receitas.ts"`.
- `historico.html` — idem, `src="/src/ui/pages/historico.ts"`.
- `src/ui/pages/calculadora.ts` — placeholder: `import '../../../references/design-system.css';` (ajustar profundidade real do caminho) + comentário citando issue 014.
- `src/ui/pages/receitas.ts` — idem (issue 017).
- `src/ui/pages/historico.ts` — idem (issue 018).
- `src/core/golden-example.test.ts` — teste dourado placeholder falhando (acima).
- `src/core/.gitkeep`, `src/storage/.gitkeep`, `src/export/.gitkeep` — manter pastas vazias no git (estrutura architecture.md). `src/ui/` já terá arquivos.
- `package-lock.json` — gerado por `npm install` e **commitado** (regra de ouro 3 / critério).

### Arquivos a modificar
- Nenhum arquivo existente precisa de modificação. `.gitignore` já cobre tudo (§11.1) → **não editar**.

### Arquivos que NÃO devem ser tocados
- `.gitignore` (já completo — não recriar).
- Tudo em `spec/`, `brand/`, `mockups/`.
- `references/design-system.css` (tokens imutáveis), `references/design-system.html`, `references/architecture.md` (editado pelo escriba, não por esta issue).
- `README.md`, `scripts/`, `.claude/`, demais `issues/*`.
- Não rodar `npm create vite` na raiz (evita prompt/sobrescrita).

### Ordem de implementação
1. Criar `package.json` (scripts + devDeps), `tsconfig.json` (strict), `vite.config.ts` (MPA + test).
2. Criar as 3 HTML (`index.html`, `receitas.html`, `historico.html`) e os 3 entries TS em `src/ui/pages/` importando o `design-system.css`.
3. Criar `src/core|storage|export` com `.gitkeep`.
4. Criar `src/core/golden-example.test.ts` (falha proposital §12).
5. `npm install` (gera `package-lock.json`).
6. Validar critérios: `npm run build` (3 páginas em `dist/`) · `npm test -- --run` (1 falha, só o dourado) · confirmar `strict` ativo via `tsc --noEmit`.
7. Commitar incluindo `package-lock.json` (`chore(001): ...`), sem push.
