---
name: padaria-loop-visual
description: Loop leve para alterações puramente visuais (CSS/HTML/layout/copy estática) da Calculadora de Pão — sem lógica de cálculo, sem storage/export, sem rede/secret. Pula arquiteto e revisor-spec; gate único é o guardiao-design. Rodar via /loop para uma sequência de correções visuais simples.
---

# /padaria-loop-visual — iteração leve p/ alteração puramente visual

Escopo: SOMENTE visual — CSS, layout, HTML estático, texto de UI, classe do design system. Zero lógica de negócio/cálculo, zero storage/export, zero rede/secret. Se a tarefa tocar `src/core/`, cálculo (preço, hidratação, escalonamento, etc.), `localStorage`, `fetch`, ou qualquer coisa em `specs/`: **PARE** e recomende o `/padaria-loop` completo (arquiteto + revisor-spec) em vez deste.

## 0. Escopo da tarefa

- Receba a tarefa: descrição direta do usuário, ou issue tipo `ui`/`fix` visual de `issues/STATE.md`.
- Confira rápido (grep) o que será tocado. Sinal de que NÃO é escopo deste loop: import de `src/core/`, valor de preço/hidratação/margem, chamada de API, `localStorage`. Achou um desses → escale para `/padaria-loop`.

## 1. Implementar

- `designer-ux` → mudança exige julgamento de UX (reorganizar hierarquia, densidade, fluxo).
- `dev-ui` → ajuste mecânico direto (cor errada, espaçamento, texto, classe trocada).
- Regras de design system continuam valendo: zero valor hardcoded, tokens `:root` imutáveis, reuso antes de criar classe nova.

## 2. Gate único — `guardiao-design`

- Sempre rode (somente leitura) no que foi alterado.
- `crítico`/`alto` → corrija, rode de novo. Máx. 2 rodadas; persistindo, trate como bloqueio (registre em PROGRESS.md e pare).
- `médio`/`baixo` → registre em PROGRESS.md, não bloqueia.
- **Sem `revisor-spec`**: não há cálculo/regra de negócio em jogo ([[fix-issues-lighter-process]], mesma lógica).
- **Sem `arquiteto`**: mudança visual pequena não precisa de plano técnico formal.

## 3. Gates técnicos

- `npm run build` verde.
- Se já existir teste de UI cobrindo o trecho, `npm test -- --run` verde. Não escreva teste novo só para CSS/copy.

## 4. Documentar (leve)

- Uma linha em `PROGRESS.md`: o que mudou, por quê, resultado do `guardiao-design`.
- Só chame `escriba` se a mudança for grande a ponto de exigir atualização de `references/architecture.md` — normalmente pule.

## 5. Commitar

- `git add` só dos arquivos tocados (nunca `-A`).
- Mensagem: `style(ui): resumo` ou `fix(ui): resumo`.
- Se veio de issue do backlog, marque `done` em `issues/STATE.md` com o hash do commit.
- **Nunca `git push`.**

## 6. Continuar ou encerrar

- Lista de tarefas visuais simples e ainda restam? → próxima, repita do passo 0 (ScheduleWakeup se rodando via /loop).
- Tarefa única → encerre, sem reagendar.

## Regras invioláveis

- Zero secret, zero chamada de rede, zero lógica de cálculo — qualquer sinal disso durante a implementação, **PARE** e escale para `/padaria-loop` completo.
- Tokens do design system imutáveis; zero valor visual hardcoded.
- `specs/` fora de escopo aqui — se a mudança expuser necessidade de nova regra de negócio, não decida neste loop, escale (`arquiteto`/`especificador` no `/padaria-loop`).
- Nunca `git push`, `git reset --hard`, ou descartar trabalho.
